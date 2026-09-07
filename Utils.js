/**
 * @fileoverview Utility functions for HTTP requests and Sheet operations.
 */

const HttpUtils = {
  /**
   * Performs a fetch with exponential backoff.
   */
  fetchWithRetry(url, options = {}, maxRetries = 3) {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        const response = UrlFetchApp.fetch(url, options);
        const code = response.getResponseCode();
        
        if (code >= 200 && code < 300) {
          return response;
        }
        
        // Handle rate limiting (429) or server errors (5xx)
        if (code === 429 || code >= 500) {
          attempts++;
          Utilities.sleep(Math.pow(2, attempts) * 1000);
          continue;
        }
        
        throw new Error(`HTTP Error ${code}: ${response.getContentText()}`);
      } catch (e) {
        attempts++;
        if (attempts >= maxRetries) throw e;
        Utilities.sleep(Math.pow(2, attempts) * 1000);
      }
    }
  },

  /**
   * Parses JSON response with error handling.
   */
  parseResponse(response) {
    try {
      return JSON.parse(response.getContentText());
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${e.message}`);
    }
  }
};

const SheetUtils = {
  /**
   * Gets a sheet by name or throws an error.
   */
  getSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error(`Sheet "${name}" not found.`);
    return sheet;
  },

  /**
   * Gets values from a named range.
   */
  getNamedRangeValues(name) {
    const range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(name);
    return range ? range.getValues() : null;
  },

  /**
   * Maps a 2D array (with headers) to an array of objects.
   */
  mapRowsToObjects(values) {
    if (!values || values.length < 1) return [];
    const headers = values[0];
    const data = values.slice(1);
    return data.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
  }
};

const LockUtils = {
  /**
   * Ejecuta una acción dentro de un bloqueo exclusivo a nivel de script.
   * Si no obtiene el bloqueo dentro del timeout, desiste y retorna null.
   *
   * @param {Function} action Función a ejecutar dentro del lock.
   * @param {number} timeoutMs Tiempo máximo de espera en milisegundos (default: 5000).
   * @param {string} taskName Nombre descriptivo de la tarea para logs.
   * @return {*} Resultado de la acción o null si fue bloqueada.
   */
  withLock(action, timeoutMs = 5000, taskName = "Operación") {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(timeoutMs)) {
      Logger.log(`Bloqueo no adquirido para: ${taskName}. Otra ejecución está activa.`);
      try {
        SpreadsheetApp.getActive()?.toast(`Otra tarea está en curso (${taskName}).`, "⚠️");
      } catch (e) {}
      return null;
    }

    try {
      return action();
    } finally {
      lock.releaseLock();
    }
  }
};
