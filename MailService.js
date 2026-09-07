/**
 * @fileoverview Service for assembling and sending emails with Markdown support.
 */

const MailService = {
  /**
   * Main function to send emails based on the 'MAILER' named range data.
   */
  sendEmails() {
    const converter = new showdown.Converter({
      tables: true,
      tasklists: true
    });

    const isReady = Config.getNamedRangeValue(Config.NAMED_RANGES.MAILER_LISTO);
    if (!isReady) {
      SpreadsheetApp.getActive().toast("Interlock activo", "❌");
      return;
    }

    // Toggle interlock
    const interlockRange = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(Config.NAMED_RANGES.MAILER_LISTO);
    interlockRange.setValue(false);

    const values = Config.getNamedRangeValues(Config.NAMED_RANGES.MAILER);
    const mappedData = SheetUtils.mapRowsToObjects(values);
    const logSheet = SheetUtils.getSheet(Config.SHEETS.LOG_MAILER);

    const remainingQuota = MailApp.getRemainingDailyQuota();
    if (remainingQuota <= 0) {
      SpreadsheetApp.getActive().toast("Quota diaria de correos agotada.", "❌");
      return;
    }

    const logEntries = [];
    let sentCount = 0;
    let errorCount = 0;

    mappedData.forEach(fila => {
      if (!fila["a_enviar"]) {
        Logger.log(`Salteando a ${fila["e-mail"]}`);
        return;
      }

      const fechaLog = new Date();

      try {
        let htmlBody = converter.makeHtml(fila["cuerpo"]);
        
        // Agregar Tracking Pixel
        const webAppUrl = ScriptApp.getService().getUrl();
        if (webAppUrl) {
          const trackingUrl = `${webAppUrl}?action=track&u=${encodeURIComponent(fila["e-mail"])}&s=${encodeURIComponent(fila["asunto"])}`;
          htmlBody += `<img src="${trackingUrl}" width="1" height="1" style="display:none;" />`;
        }

        const emailOptions = {
          to: fila["e-mail"],
          subject: fila["asunto"],
          name: 'Martín René Vilugrón [bot]',
          htmlBody: htmlBody,
        };

        MailApp.sendEmail(emailOptions);

        sentCount++;
        logEntries.push([fechaLog, fila["e-mail"], fila["asunto"], fila["cuerpo"], "ENVIADO"]);
      } catch (e) {
        errorCount++;
        Logger.log(`Error enviando mail a ${fila["e-mail"]}: ${e.message}`);
        logEntries.push([fechaLog, fila["e-mail"], fila["asunto"], fila["cuerpo"], `ERROR: ${e.message}`]);
      }
    });

    if (logEntries.length > 0) {
      logSheet.getRange(logSheet.getLastRow() + 1, 1, logEntries.length, logEntries[0].length).setValues(logEntries);
    }

    SpreadsheetApp.getActive().toast(`Proceso completado: ${sentCount} enviados, ${errorCount} fallidos. Quota: ${MailApp.getRemainingDailyQuota()}`, "✉️");
  },

  /**
   * Utility to assemble templates for preview or bulk preparation.
   */
  assembleTemplates() {
    const data = SheetUtils.mapRowsToObjects(Config.getNamedRangeValues(Config.NAMED_RANGES.MAILER_DATA));
    const template = Config.getNamedRangeValue(Config.NAMED_RANGES.CUERPO_MAIL);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    const results = data.map(fila => {
      let body = template;
      Object.keys(fila).forEach(key => {
        const marker = new RegExp(`{{${key}}}`, "g");
        body = body.replace(marker, fila[key]);
      });
      return [body];
    });

    if (results.length > 0) {
      sheet.getRange(2, sheet.getLastColumn() + 1, results.length, 1).setValues(results);
    }
    Logger.log(`Plantillas ensambladas: ${results.length}`);
  }
};
