/**
 * @fileoverview Main entry points for Google Sheets events.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('¡Magia!')
    .addItem('Actualizar repositorios', 'menuFetchGitHubRepos')
    .addItem('Sincronizar Entregados', 'menuSincronizarEntregas')
    .addItem('Sincronizar Comentarios', 'menuSyncPRComments')
    .addSeparator()
    .addItem("Vista previa Markdown", 'menuRenderMarkdown')
    .addItem('Enviar correos', 'menuEnviarCorreos')
    .addSeparator()
    .addItem('Actualizar permisos', 'menuDumpPermissions')
    .addItem('Aplicar permisos', 'menuUpdatePermissions')
    .addSeparator()
    .addItem('Sincronizar Asistencia', 'menuSyncSupabase')
    .addSeparator()
    .addSubMenu(ui.createMenu('Configuración')
      .addItem('Setear GitHub API key', 'uiSetGitHubKey')
      .addItem('Borrar GitHub API key', 'uiResetGitHubKey')
      .addSeparator()
      .addSubMenu(ui.createMenu('Supabase')
        .addItem('Configurar URL', 'uiSetSupabaseUrl')
        .addItem('Configurar Tabla', 'uiSetSupabaseTable')
        .addItem('Configurar Anon Key', 'uiSetSupabaseAnonKey')
        .addItem('Configurar Service Key', 'uiSetSupabaseServiceKey')
        .addSeparator()
        .addItem('Borrar credenciales Supabase', 'uiResetSupabaseKeys'))
      .addSeparator()
      .addItem('Instalar Triggers', 'menuInstallTriggers')
      .addItem('Borrar Triggers', 'menuRemoveTriggers')
      .addSeparator()
      .addSubMenu(ui.createMenu('Inicialización')
        .addItem('Inicializar TODO', 'menuInitAll')
        .addSeparator()
        .addItem('Crear Hoja Configuración', 'menuInitSettings')
        .addItem('Inicializar Módulo GitHub', 'menuInitGitHub')
        .addItem('Inicializar Módulo Sync', 'menuInitSync')
        .addItem('Inicializar Módulo Supabase', 'menuInitSupabase')
        .addItem('Inicializar Módulo Mailer', 'menuInitMailer')))
    .addToUi();
}

/**
 * Handle edits in the spreadsheet.
 */
function onEdit(e) {
  if (!e) return;
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Logic from old entregas.js
  if (sheet.getName() === Config.SHEETS.ENTREGAS && col === 2 && row === sheet.getLastRow()) {
    const value = e.range.getValue();
    if (value) {
      const destSheet = SheetUtils.getSheet(Config.SHEETS.CORRECCIONES);
      destSheet.appendRow([value]);
      SpreadsheetApp.getActive().toast("Entrega registrada en correcciones.", "✅");
    }
  }
}

// Menu Wrappers

function menuFetchGitHubRepos() { GitHubService.fetchRepos(); }
function menuSincronizarEntregas() { SyncService.syncEntregas(); }
function menuSyncPRComments() { GitHubService.syncPRComments(); }
function menuRenderMarkdown() { Interface.renderMarkdownFromActiveCell(); }
function menuEnviarCorreos() { MailService.sendEmails(); }
function menuDumpPermissions() { GitHubService.dumpPermissions(); }
function menuUpdatePermissions() { GitHubService.updatePermissions(); }
function menuSyncSupabase() { SupabaseService.syncAttendance(); }
function menuInstallTriggers() { SyncService.installTrigger(); }
function menuRemoveTriggers() { SyncService.removeTriggers(); }

// Initialization Wrappers
function menuInitAll() { Initializer.initAll(); }
function menuInitSettings() { Initializer.initSettingsSheet(); }
function menuInitGitHub() { Initializer.initGitHubSheets(); }
function menuInitSync() { Initializer.initSyncSheets(); }
function menuInitSupabase() { Initializer.initAsistenciaSheet(); }
function menuInitMailer() { Initializer.initMailSheets(); }

/**
 * WEB APP ENTRY POINTS
 * Permite que el script funcione como una aplicación web o API.
 */

/**
 * Responde a peticiones GET. Útil para dashboards o consultar estado.
 */
function doGet(e) {
  const action = e.parameter.action;
  
  // Seguimiento de apertura de correos (Tracking Pixel)
  if (action === 'track') {
    const email = e.parameter.u;
    const subject = e.parameter.s;
    if (email) {
      try {
        const logSheet = SheetUtils.getSheet(Config.SHEETS.LOG_APERTURAS);
        logSheet.appendRow([new Date(), email, subject, e.parameter.userAgent || 'unknown']);
      } catch (err) {
        Logger.log("Error en tracking: " + err.message);
      }
    }
    // Retornar un pixel transparente de 1x1 en base64
    const pixel = Utilities.base64Decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
    return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT)
      .setContent(pixel); // Nota: Apps Script no soporta MIME image directamente de forma nativa fácil, pero esto sirve para disparar el hit.
  }

  // Ejemplo: Trigger de sincronización vía URL (?action=sync)
  if (action === 'sync') {
    try {
      SyncService.syncEntregas();
      return ContentService.createTextOutput("Sincronización de entregas completada.");
    } catch (err) {
      return ContentService.createTextOutput("Error: " + err.message);
    }
  }

  // Dashboard básico de estado
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/milligram/1.4.1/milligram.min.css">
        <style>
          body { padding: 2rem; background: #f4f5f6; }
          .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .button-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 2rem; }
          .status-card { background: #eef2f3; padding: 1rem; border-radius: 4px; margin-bottom: 2rem; }
          .loader { display: none; margin-left: 10px; border: 3px solid #f3f3f3; border-top: 3px solid #9b4dca; border-radius: 50%; width: 20px; height: 20px; animation: spin 2s linear infinite; vertical-align: middle; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Panel de Control - Gestión</h1>
          
          <div class="status-card">
            <strong>Estado del Sistema:</strong>
            <ul>
              <li>📧 Quota de Mail: ${MailApp.getRemainingDailyQuota()} restantes</li>
              <li>📅 Zona Horaria: ${Session.getScriptTimeZone()}</li>
              <li>👤 Usuario: ${Session.getActiveUser().getEmail()}</li>
            </ul>
          </div>

          <h3>Acciones Disponibles</h3>
          <div class="button-grid">
            <div>
              <button class="button" onclick="runTask('menuFetchGitHubRepos', this)">Sincronizar GitHub</button>
            </div>
            <div>
              <button class="button" onclick="runTask('menuSyncSupabase', this)">Sincronizar Supabase</button>
            </div>
            <div>
              <button class="button" onclick="runTask('menuSyncPRComments', this)">Sincronizar Comentarios PR</button>
            </div>
            <div>
              <button class="button" onclick="runTask('menuSincronizarEntregas', this)">Sincronizar Entregas</button>
            </div>
            <div>
              <button class="button button-outline" onclick="runTask('menuUpdatePermissions', this)">Aplicar Permisos GitHub</button>
            </div>
            <div>
              <button class="button button-outline" onclick="runTask('menuInstallTriggers', this)">Reinstalar Triggers</button>
            </div>
          </div>
          
          <div id="log" style="margin-top: 2rem; padding: 1rem; background: #333; color: #7f7; border-radius: 4px; font-family: monospace; display: none;"></div>
        </div>

        <script>
          function runTask(functionName, btn) {
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = 'Ejecutando...';
            const log = document.getElementById('log');
            log.style.display = 'block';
            log.innerHTML += '> Iniciando ' + functionName + '...<br>';

            google.script.run
              .withSuccessHandler(() => {
                btn.disabled = false;
                btn.innerText = originalText;
                log.innerHTML += '<span style="color:white">> ' + functionName + ' completado con éxito.</span><br>';
                log.scrollTop = log.scrollHeight;
              })
              .withFailureHandler((err) => {
                btn.disabled = false;
                btn.innerText = originalText;
                log.innerHTML += '<span style="color:#f77">> ERROR en ' + functionName + ': ' + err.message + '</span><br>';
                log.scrollTop = log.scrollHeight;
              })[functionName]();
          }
        </script>
      </body>
    </html>
  `;
  
  return HtmlService.createHtmlOutput(html)
    .setTitle("Gestión de Cátedra - Dashboard")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Responde a peticiones POST. Ideal para recibir Webhooks de GitHub o Supabase.
 */
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  Logger.log("Webhook recibido: " + JSON.stringify(payload));
  
  // Aquí podrías procesar eventos en tiempo real
  return ContentService.createTextOutput(JSON.stringify({status: "success", received: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
