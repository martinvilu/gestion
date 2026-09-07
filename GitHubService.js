/**
 * @fileoverview Service for interacting with the GitHub API (GraphQL and REST).
 */

const GitHubService = {
  /**
   * Fetches repositories for the configured organization.
   */
  fetchRepos() {
    return LockUtils.withLock(() => {
      const token = Config.githubToken;
      const org = Config.getNamedRangeValue(Config.NAMED_RANGES.GH_ORG);
      const cutoff = Config.getNamedRangeValue(Config.NAMED_RANGES.GH_CUTOFF);

      if (!token || !org) {
        Logger.log("Error: GitHub Token or Organization missing.");
        return;
      }

      const query = `
        query GetOrganizationRepos($org: String!, $after: String) {
          organization(login: $org) {
            repositories(first: 100, after: $after, orderBy: { field: PUSHED_AT, direction: DESC }) {
              pageInfo { hasNextPage, endCursor }
              nodes {
                id, name, url, createdAt, pushedAt
                defaultBranchRef {
                  target {
                    ... on Commit { history(first: 1) { totalCount } }
                  }
                }
              }
            }
          }
        }
      `;

      let allRepos = [];
      let hasNextPage = true;
      let cursor = null;

      while (hasNextPage) {
        const options = {
          method: "post",
          payload: JSON.stringify({ query, variables: { org, after: cursor } }),
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          muteHttpExceptions: true
        };

        try {
          const response = HttpUtils.fetchWithRetry("https://api.github.com/graphql", options);
          const data = HttpUtils.parseResponse(response);
          const repoNodes = data.data?.organization?.repositories?.nodes || [];
          
          for (const repo of repoNodes) {
            if (new Date(repo.pushedAt) >= cutoff) {
              allRepos.push(repo);
            } else {
              hasNextPage = false;
              break;
            }
          }

          if (hasNextPage) {
            const pageInfo = data.data.organization.repositories.pageInfo;
            hasNextPage = pageInfo.hasNextPage;
            cursor = pageInfo.endCursor;
          }
        } catch (e) {
          Logger.log(`Error fetching GitHub repos: ${e.message}`);
          break;
        }
      }

      if (allRepos.length > 0) {
        this._saveReposToSheet(allRepos);
        this._updateLastSyncTimestamp();
      }
    }, 5000, "Sincronización GitHub");
  },

  /**
   * Updates the GH_LAST_UPDATE named range with the current timestamp.
   */
  _updateLastSyncTimestamp() {
    const range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(Config.NAMED_RANGES.GH_LAST_UPDATE);
    if (range) {
      const now = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");
      range.setValue(now);
    }
  },

  /**
   * Obtiene y parsea el mapeo de prefijos desde el intervalo con nombre TP_SLUGS.
   * @return {Array<{prefix: string, abreviado: string}>}
   */
  _getSlugMappings() {
    const raw = Config.getNamedRangeValues(Config.NAMED_RANGES.TP_SLUGS);
    if (!raw || raw.length === 0) {
      Logger.log("Rango TP_SLUGS no encontrado o vacío.");
      return [];
    }

    const mappings = [];
    const headerKeywordsCol0 = ["prefijo", "match", "slug", "slug prefijo", "patron", "patrón", "debe matchear"];
    const headerKeywordsCol1 = ["abreviado", "devolver", "practica", "práctica", "abreviatura", "retornar", "valor"];

    raw.forEach((row, idx) => {
      if (!row || row.length < 2) return;
      const prefix = String(row[0] || "").trim();
      const abreviado = String(row[1] || "").trim();
      if (!prefix || !abreviado) return;

      if (idx === 0 && headerKeywordsCol0.includes(prefix.toLowerCase()) && headerKeywordsCol1.includes(abreviado.toLowerCase())) {
        return;
      }

      mappings.push({ prefix, abreviado });
    });

    return mappings.sort((a, b) => b.prefix.length - a.prefix.length);
  },

  /**
   * Mapea el nombre del repositorio con un slug prefijo y extrae el usuario.
   * @param {string} repoName
   * @param {Array<{prefix: string, abreviado: string}>} mappings
   * @return {{abreviado: string, usuario: string}|null}
   */
  _matchSlug(repoName, mappings) {
    if (!repoName || !mappings || mappings.length === 0) return null;

    const lowerRepo = repoName.toLowerCase();

    for (const m of mappings) {
      const lowerPrefix = m.prefix.toLowerCase();
      if (lowerRepo.startsWith(lowerPrefix)) {
        const endsWithSep = lowerPrefix.endsWith("-") || lowerPrefix.endsWith("_");
        if (!endsWithSep && lowerRepo.length > lowerPrefix.length) {
          const nextChar = lowerRepo[lowerPrefix.length];
          if (nextChar !== "-" && nextChar !== "_") {
            continue;
          }
        }

        const rawRemainder = repoName.slice(m.prefix.length);
        const usuario = rawRemainder.replace(/^[-_]+/, "").replace(/[-_]+$/, "").trim();

        return {
          abreviado: m.abreviado,
          usuario: usuario
        };
      }
    }

    return null;
  },

  /**
   * Internal helper to save repo data to the 'github' sheet.
   */
  _saveReposToSheet(repos) {
    const sheet = SheetUtils.getSheet("github");
    sheet.clearContents();

    const rows = [["slug", "practica", "usuario", "commits", "creado", "actualizado", "url", "repositoryId"]];
    const mappings = this._getSlugMappings();

    repos.forEach(repo => {
      const match = this._matchSlug(repo.name, mappings);
      if (!match) return;

      let commitCount = 0;
      try { commitCount = repo.defaultBranchRef.target.history.totalCount - 2; } catch(e) {}

      rows.push([
        repo.name,
        match.abreviado,
        match.usuario,
        commitCount,
        Utilities.formatDate(new Date(repo.createdAt), "GMT-3", "yyyy-MM-dd HH:mm:ss"),
        Utilities.formatDate(new Date(repo.pushedAt), "GMT-3", "yyyy-MM-dd HH:mm:ss"),
        repo.url,
        repo.id
      ]);
    });

    if (rows.length > 0) {
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  },

  /**
   * Dumps repository collaborator permissions to 'gh_perm' sheet.
   */
  dumpPermissions() {
    const token = Config.githubToken;
    const org = Config.getNamedRangeValue(Config.NAMED_RANGES.GH_ORG);
    if (!token || !org) return;

    const ignoredUsers = ["martinvilu", "mfermindev", "miguelmariguin", "inomdedeu", "dteira", "mmariguin-unrn"];
    const githubSheet = SheetUtils.getSheet("github");
    if (githubSheet.getLastRow() <= 1) return;
    const repoData = githubSheet.getRange(2, 1, githubSheet.getLastRow() - 1, githubSheet.getLastColumn()).getValues();

    const rows = [["repo_name", "practica", "repo_id", "username", "permission"]];
    const query = `
      query GetCollaborators($owner: String!, $name: String!, $cursor: String) {
        repository(owner: $owner, name: $name) {
          collaborators(first: 100, after: $cursor) {
            pageInfo { hasNextPage, endCursor }
            edges {
              permission
              node { login }
            }
          }
        }
      }
    `;

    const reposToProcess = [];
    repoData.forEach(row => {
      const [repoName, practicaName, , , , , , repositoryId] = row;
      if (repoName) {
        reposToProcess.push({ repoName, practicaName, repositoryId, cursor: null });
      }
    });

    if (reposToProcess.length === 0) return;

    const BATCH_SIZE = 50;
    let pending = reposToProcess;

    while (pending.length > 0) {
      const currentBatch = pending.slice(0, BATCH_SIZE);
      const remaining = pending.slice(BATCH_SIZE);
      const nextPending = [];

      const requests = currentBatch.map(item => ({
        url: "https://api.github.com/graphql",
        method: "post",
        payload: JSON.stringify({ query, variables: { owner: org, name: item.repoName, cursor: item.cursor } }),
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        muteHttpExceptions: true
      }));

      try {
        const responses = UrlFetchApp.fetchAll(requests);

        responses.forEach((response, idx) => {
          const item = currentBatch[idx];
          const statusCode = response.getResponseCode();

          if (statusCode >= 200 && statusCode < 300) {
            try {
              const data = HttpUtils.parseResponse(response);
              const collaborators = data.data?.repository?.collaborators;

              if (collaborators) {
                collaborators.edges.forEach(edge => {
                  if (edge.node && !ignoredUsers.includes(edge.node.login)) {
                    rows.push([item.repoName, item.practicaName, item.repositoryId, edge.node.login, edge.permission]);
                  }
                });

                if (collaborators.pageInfo?.hasNextPage) {
                  nextPending.push({
                    ...item,
                    cursor: collaborators.pageInfo.endCursor
                  });
                }
              }
            } catch (parseErr) {
              Logger.log(`Error parseando respuesta de ${item.repoName}: ${parseErr.message}`);
            }
          } else {
            Logger.log(`Error HTTP ${statusCode} en ${item.repoName}: ${response.getContentText()}`);
          }
        });
      } catch (e) {
        Logger.log(`Error ejecutando fetchAll: ${e.message}`);
      }

      pending = remaining.concat(nextPending);
    }

    const permSheet = SheetUtils.getSheet("gh_perm");
    permSheet.clearContents();
    if (rows.length > 0) {
      permSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  },

  /**
   * Updates permissions based on 'practicas' sheet mapping.
   */
  updatePermissions() {
    const token = Config.githubToken;
    const org = Config.getNamedRangeValue(Config.NAMED_RANGES.GH_ORG);
    if (!token || !org) return;

    const permSheet = SheetUtils.getSheet("gh_perm");
    const pracSheet = SheetUtils.getSheet("practicas");
    
    const permData = permSheet.getRange(2, 1, permSheet.getLastRow() - 1, permSheet.getLastColumn()).getValues();
    const pracData = SheetUtils.mapRowsToObjects(pracSheet.getDataRange().getValues());

    pracData.forEach(prac => {
      const practica = prac.practica; // Assuming column header is 'practica'
      const desired = String(prac.acceso || "").toLowerCase();
      if (!practica || !desired) return;

      permData.forEach(row => {
        const [repoName, repoPractica, , username, currentPerm] = row;
        if (repoPractica?.toUpperCase() === practica.toUpperCase()) {
          let normalizedCurrent = String(currentPerm).toLowerCase();
          const permMap = { 'read': 'pull', 'write': 'push', 'admin': 'admin' };
          normalizedCurrent = permMap[normalizedCurrent] || normalizedCurrent;

          if (desired !== normalizedCurrent) {
            this._updateCollaborator(org, repoName, username, desired, token);
          }
        }
      });
    });
  },

  _updateCollaborator(owner, repo, username, permission, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/collaborators/${username}`;
    const options = {
      method: "put",
      payload: JSON.stringify({ permission }),
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      muteHttpExceptions: true
    };

    try {
      const response = HttpUtils.fetchWithRetry(url, options);
      if ([201, 204].includes(response.getResponseCode())) {
        Logger.log(`Updated ${username} on ${repo} to ${permission}`);
      }
    } catch (e) {
      Logger.log(`Failed to update ${username} on ${repo}: ${e.message}`);
    }
  },

  /**
   * Syncs Pull Request comments for repos in 'correcciones'.
   */
  syncPRComments() {
    const token = Config.githubToken;
    const org = Config.getNamedRangeValue(Config.NAMED_RANGES.GH_ORG);
    if (!token || !org) return;

    const corrSheet = SheetUtils.getSheet("correcciones");
    const data = corrSheet.getDataRange().getValues();
    const headers = data[0];
    const urlIdx = headers.indexOf("url_repositorio") !== -1 ? headers.indexOf("url_repositorio") : headers.indexOf("Dirección del repositorio");
    const syncIdx = headers.indexOf("ultimo PR sync");

    if (urlIdx === -1 || syncIdx === -1) return;

    const currentTimestamp = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss");
    const prDataToAppend = [];
    const processedRepos = new Set();

    for (let i = 1; i < data.length; i++) {
      const repoUrl = data[i][urlIdx];
      const repoMatch = repoUrl?.match(/github\.com\/[^\/]+\/([^\/\.]+)/);
      if (!repoMatch) continue;

      const repoName = repoMatch[1];
      if (data[i][syncIdx] || processedRepos.has(repoName)) {
        if (!data[i][syncIdx]) data[i][syncIdx] = currentTimestamp;
        processedRepos.add(repoName);
        continue;
      }

      try {
        const comments = this._fetchAllPRComments(org, repoName, token);
        comments.forEach(c => {
          prDataToAppend.push([
            currentTimestamp, repoName, c.number, c.title, c.type, c.author, c.createdAt, c.body, c.url
          ]);
        });
        data[i][syncIdx] = currentTimestamp;
        processedRepos.add(repoName);
      } catch (e) {
        Logger.log(`Error syncing PRs for ${repoName}: ${e.message}`);
      }
    }

    if (prDataToAppend.length > 0) {
      const prSheet = SheetUtils.getSheet("PR");
      prSheet.getRange(prSheet.getLastRow() + 1, 1, prDataToAppend.length, prDataToAppend[0].length).setValues(prDataToAppend);
    }

    const syncCol = data.map(row => [row[syncIdx]]);
    corrSheet.getRange(1, syncIdx + 1, syncCol.length, 1).setValues(syncCol);
  },

  _fetchAllPRComments(org, repo, token) {
    const results = [];
    let hasNextPage = true;
    let cursor = null;

    const query = `
      query GetPRs($org: String!, $repo: String!, $cursor: String) {
        repository(owner: $org, name: $repo) {
          pullRequests(first: 30, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
            pageInfo { hasNextPage, endCursor }
            nodes {
              number, title
              comments(first: 50) {
                nodes { author { login }, body, createdAt, url }
              }
              reviews(first: 50) {
                nodes { author { login }, body, createdAt, url }
              }
            }
          }
        }
      }
    `;

    while (hasNextPage) {
      const options = {
        method: "post",
        payload: JSON.stringify({ query, variables: { org, repo, cursor } }),
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        muteHttpExceptions: true
      };

      try {
        const response = HttpUtils.fetchWithRetry("https://api.github.com/graphql", options);
        const data = HttpUtils.parseResponse(response);
        const prs = data.data?.repository?.pullRequests;
        if (!prs) break;

        prs.nodes.forEach(pr => {
          const process = (nodes, type) => {
            nodes.forEach(n => {
              if (n.body?.trim()) {
                let body = n.body;
                // Truncate long automated "El Juez Dredd" comments
                if (body.trim().startsWith('# El Juez Dredd')) {
                  body = body.split('\n')[0];
                }

                results.push({
                  number: pr.number, title: pr.title, type,
                  author: n.author?.login || "Ghost",
                  createdAt: Utilities.formatDate(new Date(n.createdAt), "GMT-3", "yyyy-MM-dd HH:mm:ss"),
                  body: body, url: n.url
                });
              }
            });
          };
          if (pr.comments?.nodes) process(pr.comments.nodes, "IssueComment");
          if (pr.reviews?.nodes) process(pr.reviews.nodes, "PullRequestReview");
        });

        hasNextPage = prs.pageInfo.hasNextPage;
        cursor = prs.pageInfo.endCursor;
      } catch (e) {
        Logger.log(`Error in _fetchAllPRComments for ${repo}: ${e.message}`);
        break;
      }
    }
    return results;
  }
};
