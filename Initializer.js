/**
 * @fileoverview Service to initialize the spreadsheet structure, sheets, and named ranges.
 */

const Initializer = {
  /**
   * Initializes all sheets and settings.
   */
  initAll() {
    if (!this._checkInterlock()) return;

    this.initSettingsSheet();
    this.initGitHubSheets();
    this.initSyncSheets();
    this.initAsistenciaSheet();
    this.initMailSheets();
    this.initPRSheet();
    this.initPracticasSheet();
    
    // Set the interlock flag
    const range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(Config.NAMED_RANGES.SYS_INIT);
    if (range) range.setValue(true);

    SpreadsheetApp.getActive().toast("Inicialización completa.", "🚀");
  },

  /**
   * Safety check to prevent accidental re-initialization.
   */
  _checkInterlock() {
    const isInit = Config.getNamedRangeValue(Config.NAMED_RANGES.SYS_INIT);
    if (isInit === true) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        '⚠️ Sistema ya inicializado',
        'Se ha detectado que esta planilla ya fue configurada previamente.\n¿Estás seguro de que deseas RE-INICIALIZAR todo el sistema? (Esto podría sobrescribir encabezados)',
        ui.ButtonSet.YES_NO
      );
      return response === ui.Button.YES;
    }
    return true;
  },

  /**
   * Creates the Settings sheet and defines all required named ranges.
   */
  initSettingsSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Configuración");
    if (!sheet) {
      sheet = ss.insertSheet("Configuración", 0);
    }

    const configData = [
      ["VARIABLE", "VALOR", "DESCRIPCIÓN"],
      ["GH_ORG", "", "Nombre de la organización en GitHub"],
      ["GH_CUTOFF", new Date(), "Fecha de corte para sincronización"],
      ["MATERIA", "MATERIA_DEFAULT", "Nombre de la materia/cátedra"],
      ["MAILER_LISTO", false, "Interlock para envío de correos (Checkbox)"],
      ["ULTIMA_FILA_PROCESADA_ENTREGAS", 1, "Puntero para sincronización de entregas"],
      ["GH_LAST_UPDATE", "", "Timestamp de última ejecución GitHub"],
      ["SYS_INIT", false, "Flag de inicialización del sistema (Interlock)"],
      ["TRIGGER_ENTREGAS_ON", true, "Activar sincronización de Entregas (Auto)"],
      ["TRIGGER_GITHUB_ON", true, "Activar sincronización de GitHub (Auto)"],
      ["TRIGGER_SUPABASE_ON", true, "Activar sincronización de Supabase (Auto)"],
      ["TRIGGER_ENTREGAS_RATE", 1, "Frecuencia sincronización Entregas (Horas)"],
      ["TRIGGER_GITHUB_RATE", 4, "Frecuencia sincronización GitHub (Horas)"],
      ["TRIGGER_SUPABASE_RATE", 1, "Frecuencia sincronización Supabase (Horas)"]
    ];

    sheet.getRange(1, 1, configData.length, configData[0].length).setValues(configData);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#eeeeee");
    
    // Create Named Ranges
    configData.slice(1).forEach((row, i) => {
      const rangeName = row[0];
      const targetCell = sheet.getRange(i + 2, 2);
      
      // Remove if exists
      const oldRange = ss.getRangeByName(rangeName);
      if (oldRange) ss.removeNamedRange(rangeName);
      
      ss.setNamedRange(rangeName, targetCell);
      
      // Special case for checkboxes
      if (rangeName === "MAILER_LISTO" || rangeName === "SYS_INIT" || rangeName.startsWith("TRIGGER_")) {
        targetCell.insertCheckboxes();
      }
    });

    sheet.autoResizeColumns(1, 3);
  },

  /**
   * Initializes GitHub related sheets.
   */
  initGitHubSheets() {
    this._createSheetWithHeaders("github", ["slug", "practica", "usuario", "commits", "creado", "actualizado", "url", "repositoryId"]);
    this._createSheetWithHeaders("gh_perm", ["repo_name", "practica", "repo_id", "username", "permission"]);
  },

  /**
   * Initializes Sync related sheets.
   */
  initSyncSheets() {
    this._createSheetWithHeaders(Config.SHEETS.ENTREGAS, ["Timestamp", "Dirección del repositorio"]);
    this._createSheetWithHeaders(Config.SHEETS.CORRECCIONES, ["url_repositorio", "ultimo PR sync", "Comentarios"]);
  },

  /**
   * Initializes Attendance sheet.
   */
  initAsistenciaSheet() {
    this._createSheetWithHeaders(Config.SHEETS.ASISTENCIA_RAW, ['id', 'created_at', 'user_id', 'github_username', 'palabra_clave', 'materia', 'clase', 'escaneo_valido', 'fecha_local']);
  },

  /**
   * Initializes Mailer related sheets.
   */
  initMailSheets() {
    this._createSheetWithHeaders(Config.SHEETS.LOG_MAILER, ["Fecha Log", "e-mail", "asunto", "cuerpo", "a_enviar"]);
    this._createSheetWithHeaders(Config.SHEETS.LOG_APERTURAS, ["Fecha", "Email", "Asunto", "User Agent"]);
  },

  /**
   * Initializes PR tracking sheet.
   */
  initPRSheet() {
    this._createSheetWithHeaders("PR", ["Timestamp Colección", "Repositorio", "PR Number", "PR Title", "Tipo Comentario", "Autor Comentario", "Fecha Comentario", "Body", "URL"]);
  },

  /**
   * Initializes Practicas mapping sheet.
   */
  initPracticasSheet() {
    this._createSheetWithHeaders("practicas", ["id", "practica", "acceso"]);
  },

  /**
   * Helper to create a sheet if it doesn't exist and set headers.
   */
  _createSheetWithHeaders(name, headers) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#eeeeee");
    sheet.setFrozenRows(1);
  }
};
