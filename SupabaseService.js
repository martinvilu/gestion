/**
 * @fileoverview Service for interacting with Supabase REST API.
 */

const SupabaseService = {
  /**
   * Syncs attendance data from Supabase to the spreadsheet.
   */
  syncAttendance() {
    return LockUtils.withLock(() => {
      const config = Config.supabaseConfig;
      if (!config.url || !config.serviceKey) {
        Logger.log("Error: Configuración de Supabase incompleta (url o serviceKey faltante).");
        SpreadsheetApp.getActive().toast("Faltan credenciales de Supabase.", "⚠️");
        return;
      }

      const sheetName = Config.SHEETS.ASISTENCIA_RAW;
      const sheet = SheetUtils.getSheet(sheetName);

      try {
        const apiUrl = `${config.url}/rest/v1/${config.table}?select=*&order=created_at.desc`;
        const options = {
          method: 'get',
          headers: {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.serviceKey}`
          },
          muteHttpExceptions: true
        };

        const response = HttpUtils.fetchWithRetry(apiUrl, options);
        const data = HttpUtils.parseResponse(response);

        if (data.length === 0) {
          sheet.clearContents();
          sheet.getRange(1, 1).setValue("No se encontraron registros.");
          return;
        }

        const headers = ['id', 'created_at', 'user_id', 'github_username', 'palabra_clave', 'materia', 'clase', 'escaneo_valido', 'fecha_local'];
        const formattedData = data.map(row => [
          row.id,
          row.created_at,
          row.user_id,
          row.github_username,
          row.palabra_clave,
          row.materia,
          row.clase,
          row.escaneo_valido,
          row.created_at ? new Date(row.created_at) : ''
        ]);

        sheet.clearContents();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
        sheet.getRange(2, 1, formattedData.length, headers.length).setValues(formattedData);
        
        SpreadsheetApp.getActive().toast("Sincronización de Supabase completada.", "✅");
      } catch (e) {
        Logger.log(`Error syncing Supabase data: ${e.message}`);
        SpreadsheetApp.getUi().alert(`Error de Supabase: ${e.message}`);
      }
    }, 5000, "Sincronización Supabase");
  }
};
