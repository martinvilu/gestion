/**
 * @fileoverview Service for synchronizing data between sheets and managing triggers.
 */

const SyncService = {
  /**
   * Syncs new entries from 'entregas' to 'correcciones'.
   */
  syncEntregas() {
    return LockUtils.withLock(() => {
      const hEntregas = SheetUtils.getSheet(Config.SHEETS.ENTREGAS);
      const hCorrecciones = SheetUtils.getSheet(Config.SHEETS.CORRECCIONES);
      const rangePuntero = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(Config.NAMED_RANGES.ULTIMA_FILA_PROCESADA_ENTREGAS);

      if (!rangePuntero) throw new Error("Named Range ULTIMA_FILA_PROCESADA_ENTREGAS not found.");

      const lastRowEntregas = hEntregas.getLastRow();
      if (lastRowEntregas <= 1) return;

      // Lectura acotada a las filas con datos en lugar de columna B:B completa
      const valsEntregas = hEntregas.getRange(1, 2, lastRowEntregas, 1).getValues();
      let ultimaFilaDatos = 0;

      for (let i = valsEntregas.length - 1; i >= 1; i--) {
        if (valsEntregas[i][0] !== "") {
          ultimaFilaDatos = i + 1;
          break;
        }
      }

      const ptrActual = parseInt(rangePuntero.getValue()) || 1;
      if (ultimaFilaDatos <= ptrActual) return;

      const payload = [];
      for (let i = Math.max(1, ptrActual); i < ultimaFilaDatos; i++) {
        if (valsEntregas[i][0] !== "") {
          payload.push([valsEntregas[i][0]]);
        }
      }

      if (!payload.length) return;

      // Buscar primera fila vacía acotando al rango de datos de correcciones
      const lastRowCorr = hCorrecciones.getLastRow();
      let targetRow = lastRowCorr + 1;

      if (lastRowCorr > 1) {
        const valsCorrecciones = hCorrecciones.getRange(1, 1, lastRowCorr, 1).getValues();
        for (let i = 1; i < valsCorrecciones.length; i++) {
          if (valsCorrecciones[i][0] === "") {
            targetRow = i + 1;
            break;
          }
        }
      }

      // Capacity management
      const requiredRows = targetRow + payload.length - 1;
      const currentMaxRows = hCorrecciones.getMaxRows();
      if (requiredRows > currentMaxRows) {
        hCorrecciones.insertRowsAfter(currentMaxRows, requiredRows - currentMaxRows);
      }

      hCorrecciones.getRange(targetRow, 1, payload.length, 1).setValues(payload);
      rangePuntero.setValue(ultimaFilaDatos);
      
      SpreadsheetApp.getActive().toast(`Sincronizadas ${payload.length} entregas.`, "✅");
    }, 5000, "Sincronización Entregas");
  },

  /**
   * Installs all time-based triggers.
   */
  installTrigger() {
    this.removeTriggers();

    let installed = [];

    // Sync Entregas - Configurable Rate
    if (Config.getNamedRangeValue(Config.NAMED_RANGES.TRIGGER_ENTREGAS_ON)) {
      const rate = parseInt(Config.getNamedRangeValue(Config.NAMED_RANGES.TRIGGER_ENTREGAS_RATE)) || 1;
      ScriptApp.newTrigger('runSyncEntregas')
        .timeBased()
        .everyHours(rate)
        .create();
      installed.push(`Entregas (${rate}h)`);
    }

    // Sync GitHub Repos - Configurable Rate
    if (Config.getNamedRangeValue(Config.NAMED_RANGES.TRIGGER_GITHUB_ON)) {
      const rate = parseInt(Config.getNamedRangeValue(Config.NAMED_RANGES.TRIGGER_GITHUB_RATE)) || 4;
      ScriptApp.newTrigger('runSyncGitHub')
        .timeBased()
        .everyHours(rate)
        .create();
      installed.push(`GitHub (${rate}h)`);
    }

    // Sync Supabase Data - Configurable Rate
    if (Config.getNamedRangeValue(Config.NAMED_RANGES.TRIGGER_SUPABASE_ON)) {
      const rate = parseInt(Config.getNamedRangeValue(Config.NAMED_RANGES.TRIGGER_SUPABASE_RATE)) || 1;
      ScriptApp.newTrigger('runSyncSupabase')
        .timeBased()
        .everyHours(rate)
        .create();
      installed.push(`Supabase (${rate}h)`);
    }

    const msg = installed.length > 0 
      ? `Triggers activados: ${installed.join(", ")}` 
      : "No se instaló ningún trigger (todos desactivados).";

    SpreadsheetApp.getActive().toast(msg, "✅");
  },
  /**
   * Removes all project triggers.
   */
  removeTriggers() {
    ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
    SpreadsheetApp.getActive().toast("Todos los triggers han sido eliminados.", "🗑️");
  }
};

/**
 * Global entry points for triggers.
 */
function runSyncEntregas() { SyncService.syncEntregas(); }
function runSyncGitHub() { GitHubService.fetchRepos(); }
function runSyncSupabase() { SupabaseService.syncAttendance(); }

