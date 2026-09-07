/**
 * Test harness for offline unit testing of pure logic in gestion-catedra.
 * Runs with standard Node.js without Google Apps Script dependencies.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// Load environment mocks
const mockDigest = (algo, str) => {
  return Array.from(crypto.createHash('sha256').update(String(str)).digest());
};

const mockBase64EncodeWebSafe = (bytes) => {
  return Buffer.from(bytes).toString('base64url');
};

const mockFormatDate = (date, tz, format) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (format === 'yyyy-MM-dd') return `${y}-${m}-${d}`;
  return date.toISOString();
};

const mockNamedRanges = {};

const sandbox = {
  console,
  Date,
  Logger: { log: () => {} },
  Session: {
    getScriptTimeZone: () => 'America/Argentina/Buenos_Aires'
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: mockDigest,
    base64EncodeWebSafe: mockBase64EncodeWebSafe,
    formatDate: mockFormatDate
  },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getRangeByName: (name) => {
        if (name in mockNamedRanges) {
          return {
            getValue: () => mockNamedRanges[name],
            getValues: () => mockNamedRanges[name]
          };
        }
        return null;
      }
    }),
    getActive: () => ({ toast: () => {} })
  },
  PropertiesService: {
    getUserProperties: () => ({ getProperty: () => null }),
    getScriptProperties: () => ({ getProperty: () => null })
  }
};

vm.createContext(sandbox);

// Load project files into sandbox and expose const declarations on global context
const rootDir = path.resolve(__dirname, '..');
const configCode = fs.readFileSync(path.join(rootDir, 'Config.js'), 'utf8');
const templaterCode = fs.readFileSync(path.join(rootDir, 'Templater.js'), 'utf8');
const utilsCode = fs.readFileSync(path.join(rootDir, 'Utils.js'), 'utf8');
const githubCode = fs.readFileSync(path.join(rootDir, 'GitHubService.js'), 'utf8');

vm.runInContext(configCode + '\n;this.Config = Config;', sandbox);
vm.runInContext(templaterCode, sandbox);
vm.runInContext(utilsCode + '\n;this.SheetUtils = SheetUtils; this.LockUtils = LockUtils;', sandbox);
vm.runInContext(githubCode + '\n;this.GitHubService = GitHubService;', sandbox);

let testsRun = 0;
let testsPassed = 0;

function it(desc, fn) {
  testsRun++;
  try {
    fn();
    testsPassed++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("\n==================================================");
console.log(" Ejecutando suite de pruebas unitarias locales");
console.log("==================================================\n");

console.log("1. Templater.js");

it("RENDER interpola variables básicas por nombre de encabezado", () => {
  const res = sandbox.RENDER("Hola {{nombre}}, tu nota es {{nota}}", ["Martín", 10], ["nombre", "nota"]);
  assert.strictEqual(res, "Hola Martín, tu nota es 10");
});

it("RENDER soporta marcadores por letra de columna", () => {
  const res = sandbox.RENDER("TP: {{A}} - Alumno: {{B}}", ["TP1", "González"]);
  assert.strictEqual(res, "TP: TP1 - Alumno: González");
});

it("RENDER aplica formato de texto :U (mayúsculas), :L (minúsculas) y :T (trim)", () => {
  const resU = sandbox.RENDER("{{A:U}}", ["usuario_test"]);
  assert.strictEqual(resU, "USUARIO_TEST");

  const resL = sandbox.RENDER("{{A:L}}", ["USUARIO_TEST"]);
  assert.strictEqual(resL, "usuario_test");

  const resT = sandbox.RENDER("{{A:T}}", ["   espacios   "]);
  assert.strictEqual(resT, "espacios");
});

it("RENDER formatea números con decimales (:N2) y porcentajes (:%)", () => {
  const resNum = sandbox.RENDER("Promedio: {{A:N2}}", [8.5678]);
  assert.strictEqual(resNum, "Promedio: 8.57");

  const resPct = sandbox.RENDER("Asistencia: {{A:%}}", [0.75]);
  assert.strictEqual(resPct, "Asistencia: 75.00%");
});

it("RENDER formatea objetos Date con formato especificado", () => {
  const fecha = new sandbox.Date(2026, 8, 4);
  const res = sandbox.RENDER("Fecha: {{A:yyyy-MM-dd}}", [fecha]);
  assert.strictEqual(res, "Fecha: 2026-09-04");
});

it("MD_TABLE_HEADER genera fila de cabecera y separador markdown", () => {
  const res = sandbox.MD_TABLE_HEADER(["Columna 1", "Columna 2"]);
  assert.strictEqual(res, "| Columna 1 | Columna 2 |\n| --- | --- |");
});

it("MD_TABLE_ROW formatea valores de fila como celdas markdown", () => {
  const res = sandbox.MD_TABLE_ROW(["Valor A", 123]);
  assert.strictEqual(res, "| Valor A | 123 |");
});

it("BASH_ESCAPE escapa cadenas escalares y comillas simples", () => {
  assert.strictEqual(sandbox.BASH_ESCAPE("hola mundo"), "'hola mundo'");
  assert.strictEqual(sandbox.BASH_ESCAPE("O'Reilly"), "'O'\\''Reilly'");
  assert.strictEqual(sandbox.BASH_ESCAPE(""), "''");
});

it("BASH_ESCAPE opera sobre matrices 2D (soporte matricial ARRAYFORMULA)", () => {
  const matrix = [["a", "b"], ["c'd", "e"]];
  const escaped = sandbox.BASH_ESCAPE(matrix);
  assert.deepEqual(escaped, [
    ["'a'", "'b'"],
    ["'c'\\''d'", "'e'"]
  ]);
});

it("DISTANCIAV calcula la separación entre columnas para BUSCARV", () => {
  assert.strictEqual(sandbox.DISTANCIAV("A", "C"), 3);
  assert.strictEqual(sandbox.DISTANCIAV("A", "A"), 1);
  assert.strictEqual(sandbox.DISTANCIAV("B", "D"), 3);
});

it("TOKEN genera un hash alfanumérico determinista de longitud especificada", () => {
  const tok1 = sandbox.TOKEN("usuario@test.com", 0); // largo 8
  const tok2 = sandbox.TOKEN("usuario@test.com", 0);
  const tok3 = sandbox.TOKEN("usuario@test.com", 2); // largo 16

  assert.strictEqual(tok1.length, 8);
  assert.strictEqual(tok1, tok2, "El token debe ser determinista para la misma semilla");
  assert.strictEqual(tok3.length, 16);
});

console.log("\n2. GitHubService.js (_matchSlug)");

it("_matchSlug extrae práctica y usuario con prefijo terminado en guion", () => {
  const mappings = [{ prefix: "algo2-2024-tp1-", abreviado: "TP1" }];
  const res = sandbox.GitHubService._matchSlug("algo2-2024-tp1-martinvilu", mappings);
  assert.deepEqual(res, { abreviado: "TP1", usuario: "martinvilu" });
});

it("_matchSlug extrae práctica y usuario sin guion al final del prefijo", () => {
  const mappings = [{ prefix: "algo2-2024-tp1", abreviado: "TP1" }];
  const res = sandbox.GitHubService._matchSlug("algo2-2024-tp1-martinvilu", mappings);
  assert.deepEqual(res, { abreviado: "TP1", usuario: "martinvilu" });
});

it("_matchSlug respeta el orden del prefijo más específico", () => {
  const mappings = [
    { prefix: "tp1-recu-", abreviado: "TP1R" },
    { prefix: "tp1-", abreviado: "TP1" }
  ];
  const resRecu = sandbox.GitHubService._matchSlug("tp1-recu-mariagomez", mappings);
  assert.deepEqual(resRecu, { abreviado: "TP1R", usuario: "mariagomez" });

  const resNormal = sandbox.GitHubService._matchSlug("tp1-mariagomez", mappings);
  assert.deepEqual(resNormal, { abreviado: "TP1", usuario: "mariagomez" });
});

it("_matchSlug no confunde prefijos sin delimitador (ej: tp1 con tp10)", () => {
  const mappings = [{ prefix: "tp1", abreviado: "TP1" }];
  const res = sandbox.GitHubService._matchSlug("tp10-mariagomez", mappings);
  assert.strictEqual(res, null, "tp1 no debe matchear tp10");
});

it("_matchSlug retorna null si el repositorio no coincide con ningún prefijo", () => {
  const mappings = [{ prefix: "tp1-", abreviado: "TP1" }];
  const res = sandbox.GitHubService._matchSlug(".github-private", mappings);
  assert.strictEqual(res, null);
});

console.log("\n3. Config.js (QoL 1 y 2: Ignored Users & Mailer Sender)");

it("Config.ignoredGitHubUsers parsea listas separadas por coma y convierte a minúsculas", () => {
  mockNamedRanges["GH_IGNORED_USERS"] = "MartinVilu, Docente2, Ayudante-UNRN\nExtraUser ";
  const ignored = sandbox.Config.ignoredGitHubUsers;
  assert.deepEqual(ignored, ["martinvilu", "docente2", "ayudante-unrn", "extrauser"]);
});

it("Config.ignoredGitHubUsers retorna array vacío si no hay valor", () => {
  delete mockNamedRanges["GH_IGNORED_USERS"];
  assert.deepEqual(sandbox.Config.ignoredGitHubUsers, []);
});

it("Config.mailerSenderName y mailerReplyTo leen parámetros EMAIL_REMITENTE y EMAIL_RESPUESTA", () => {
  mockNamedRanges["EMAIL_REMITENTE"] = "Algoritmos 2 [Oficial]";
  mockNamedRanges["EMAIL_RESPUESTA"] = "consultas@catedra.edu.ar";
  assert.strictEqual(sandbox.Config.mailerSenderName, "Algoritmos 2 [Oficial]");
  assert.strictEqual(sandbox.Config.mailerReplyTo, "consultas@catedra.edu.ar");

  delete mockNamedRanges["EMAIL_REMITENTE"];
  delete mockNamedRanges["EMAIL_RESPUESTA"];
  mockNamedRanges["MATERIA"] = "Taller de Programación";
  assert.strictEqual(sandbox.Config.mailerSenderName, "Taller de Programación [bot]");
  assert.strictEqual(sandbox.Config.mailerReplyTo, null);
});

console.log("\n4. Utils.js (SheetUtils & LockUtils)");

it("SheetUtils.mapRowsToObjects convierte matriz 2D con cabeceras a objetos", () => {
  const data = [
    ["id", "nombre", "activo"],
    [1, "Martín", true],
    [2, "Ana", false]
  ];
  const res = sandbox.SheetUtils.mapRowsToObjects(data);
  assert.deepEqual(res, [
    { id: 1, nombre: "Martín", activo: true },
    { id: 2, nombre: "Ana", activo: false }
  ]);
});

it("SheetUtils.mapRowsToObjects maneja arreglos vacíos o nulos", () => {
  assert.deepEqual(sandbox.SheetUtils.mapRowsToObjects([]), []);
  assert.deepEqual(sandbox.SheetUtils.mapRowsToObjects(null), []);
});

it("LockUtils.withLock ejecuta la acción y libera el bloqueo en finally", () => {
  let lockReleased = false;
  let tryLockCalled = false;

  sandbox.LockService = {
    getScriptLock: () => ({
      tryLock: (timeout) => {
        tryLockCalled = true;
        assert.strictEqual(timeout, 3000);
        return true;
      },
      releaseLock: () => {
        lockReleased = true;
      }
    })
  };

  const res = sandbox.LockUtils.withLock(() => {
    return 42;
  }, 3000, "TestTask");

  assert.strictEqual(tryLockCalled, true);
  assert.strictEqual(lockReleased, true);
  assert.strictEqual(res, 42);
});

it("LockUtils.withLock retorna null y no ejecuta la acción si tryLock falla", () => {
  let actionExecuted = false;

  sandbox.LockService = {
    getScriptLock: () => ({
      tryLock: () => false,
      releaseLock: () => {}
    })
  };

  const res = sandbox.LockUtils.withLock(() => {
    actionExecuted = true;
    return 100;
  }, 1000, "ContendedTask");

  assert.strictEqual(actionExecuted, false);
  assert.strictEqual(res, null);
});

console.log("\n--------------------------------------------------");
console.log(` Resultado: ${testsPassed}/${testsRun} pruebas exitosas.`);
console.log("--------------------------------------------------\n");

if (testsPassed !== testsRun) {
  process.exit(1);
}
