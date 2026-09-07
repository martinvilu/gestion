/**
 * @fileoverview UI interaction logic.
 */

const Interface = {
  /**
   * Renders Markdown from the active cell in a sidebar.
   */
  renderMarkdownFromActiveCell() {
    const activeCell = SpreadsheetApp.getActiveRange().getCell(1, 1);
    const content = activeCell.getValue();
    
    if (!content) {
      SpreadsheetApp.getActive().toast("La celda está vacía.", "⚠️");
      return;
    }

    const converter = new showdown.Converter({
      tables: true,
      tasklists: true,
      strikethrough: true,
      emoji: true
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
          <style>
            body { padding: 20px; }
            .markdown-body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; }
          </style>
        </head>
        <body class="markdown-body">
          ${converter.makeHtml(content)}
        </body>
      </html>
    `;

    const sidebar = HtmlService
      .createHtmlOutput(htmlContent)
      .setTitle("Vista previa Markdown")
      .setWidth(400);

    SpreadsheetApp.getUi().showSidebar(sidebar);
  }
};

/**
 * UI functions for API key management.
 */
function uiSetGitHubKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Configuración de GitHub',
    'Introduce tu Personal Access Token (API Key) de GitHub:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const key = response.getResponseText().trim();
    if (key) {
      Config.setKey(Config.KEYS.GITHUB_API, key);
      ui.alert('Éxito', 'API Key guardada.', ui.ButtonSet.OK);
    }
  }
}

function uiResetGitHubKey() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert('Confirmación', '¿Eliminar API Key?', ui.ButtonSet.YES_NO);
  if (confirm === ui.Button.YES) {
    Config.deleteKey(Config.KEYS.GITHUB_API);
    ui.alert('Eliminada.');
  }
}

/**
 * UI functions for Supabase configuration.
 */
function uiSetSupabaseUrl() {
  const ui = SpreadsheetApp.getUi();
  const current = Config.supabaseConfig.url || '';
  const response = ui.prompt('Configurar Supabase', `Introduce la URL del proyecto (Actual: ${current}):`, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const val = response.getResponseText().trim();
    if (val) {
      Config.setKey(Config.KEYS.SUPABASE_URL, val, true);
      ui.alert('Éxito', 'URL de Supabase guardada.', ui.ButtonSet.OK);
    }
  }
}

function uiSetSupabaseTable() {
  const ui = SpreadsheetApp.getUi();
  const current = Config.supabaseConfig.table || '';
  const response = ui.prompt('Configurar Supabase', `Introduce el nombre de la tabla (Actual: ${current}):`, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const val = response.getResponseText().trim();
    if (val) {
      Config.setKey(Config.KEYS.SUPABASE_TABLE, val, true);
      ui.alert('Éxito', 'Tabla de Supabase guardada.', ui.ButtonSet.OK);
    }
  }
}

function uiSetSupabaseAnonKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Configurar Supabase', 'Introduce la Anon Key:', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const val = response.getResponseText().trim();
    if (val) {
      Config.setKey(Config.KEYS.SUPABASE_ANON_KEY, val, true);
      ui.alert('Éxito', 'Anon Key guardada.', ui.ButtonSet.OK);
    }
  }
}

function uiSetSupabaseServiceKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Configurar Supabase', 'Introduce la Service/Role Key (Lectura):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    const val = response.getResponseText().trim();
    if (val) {
      Config.setKey(Config.KEYS.SUPABASE_SERVICE_KEY, val, true);
      ui.alert('Éxito', 'Service Key guardada.', ui.ButtonSet.OK);
    }
  }
}

function uiResetSupabaseKeys() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert('Confirmación', '¿Eliminar configuración y claves de Supabase?', ui.ButtonSet.YES_NO);
  if (confirm === ui.Button.YES) {
    Config.deleteKey(Config.KEYS.SUPABASE_URL, true);
    Config.deleteKey(Config.KEYS.SUPABASE_ANON_KEY, true);
    Config.deleteKey(Config.KEYS.SUPABASE_SERVICE_KEY, true);
    Config.deleteKey(Config.KEYS.SUPABASE_TABLE, true);
    Config.deleteKey(Config.KEYS.SUPABASE_URL, false);
    Config.deleteKey(Config.KEYS.SUPABASE_ANON_KEY, false);
    Config.deleteKey(Config.KEYS.SUPABASE_SERVICE_KEY, false);
    Config.deleteKey(Config.KEYS.SUPABASE_TABLE, false);
    ui.alert('Credenciales de Supabase eliminadas.');
  }
}
