/**
 * @fileoverview Centralized configuration and property management.
 */

const Config = {
  KEYS: {
    GITHUB_API: 'api.key',
    SUPABASE_URL: 'supabase.url',
    SUPABASE_ANON_KEY: 'supabase.anon_key',
    SUPABASE_SERVICE_KEY: 'supabase.service_key',
    SUPABASE_TABLE: 'supabase.table'
  },

  NAMED_RANGES: {
    GH_CUTOFF: 'GH_CUTOFF',
    GH_ORG: 'GH_ORG',
    TP_SLUGS: 'TP_SLUGS',
    GH_IGNORED_USERS: 'GH_IGNORED_USERS',
    MATERIA: 'MATERIA',
    EMAIL_REMITENTE: 'EMAIL_REMITENTE',
    EMAIL_RESPUESTA: 'EMAIL_RESPUESTA',
    MAILER_REMITENTE: 'MAILER_REMITENTE',
    MAILER_DATA: 'MAILER_DATA',
    CUERPO_MAIL: 'CUERPO_MAIL',
    MAILER_LISTO: 'MAILER_LISTO',
    MAILER: 'MAILER',
    ULTIMA_FILA_PROCESADA_ENTREGAS: 'ULTIMA_FILA_PROCESADA_ENTREGAS',
    GH_LAST_UPDATE: 'GH_LAST_UPDATE',
    SYS_INIT: 'SYS_INIT',
    TRIGGER_ENTREGAS_ON: 'TRIGGER_ENTREGAS_ON',
    TRIGGER_GITHUB_ON: 'TRIGGER_GITHUB_ON',
    TRIGGER_SUPABASE_ON: 'TRIGGER_SUPABASE_ON',
    TRIGGER_ENTREGAS_RATE: 'TRIGGER_ENTREGAS_RATE',
    TRIGGER_GITHUB_RATE: 'TRIGGER_GITHUB_RATE',
    TRIGGER_SUPABASE_RATE: 'TRIGGER_SUPABASE_RATE'
  },

  SHEETS: {
    ENTREGAS: 'entregas',
    CORRECCIONES: 'correcciones',
    ASISTENCIA_RAW: 'asistencia_raw',
    LOG_MAILER: 'log_mailer',
    LOG_APERTURAS: 'log_aperturas'
  },

  get githubToken() {
    return PropertiesService.getUserProperties().getProperty(this.KEYS.GITHUB_API);
  },

  get ignoredGitHubUsers() {
    const val = this.getNamedRangeValue(this.NAMED_RANGES.GH_IGNORED_USERS);
    if (!val) return [];
    return String(val)
      .split(/[\n,]+/)
      .map(u => u.trim().toLowerCase())
      .filter(Boolean);
  },

  get mailerSenderName() {
    const sender = this.getNamedRangeValue(this.NAMED_RANGES.EMAIL_REMITENTE) || this.getNamedRangeValue(this.NAMED_RANGES.MAILER_REMITENTE);
    if (sender && String(sender).trim()) {
      return String(sender).trim();
    }
    const materia = this.getNamedRangeValue(this.NAMED_RANGES.MATERIA);
    if (materia && String(materia).trim()) {
      return `${String(materia).trim()} [bot]`;
    }
    return 'Gestión Cátedra [bot]';
  },

  get mailerReplyTo() {
    const replyTo = this.getNamedRangeValue(this.NAMED_RANGES.EMAIL_RESPUESTA);
    return (replyTo && String(replyTo).trim()) ? String(replyTo).trim() : null;
  },

  get supabaseConfig() {
    const userProps = PropertiesService.getUserProperties();
    const scriptProps = PropertiesService.getScriptProperties();
    return {
      url: userProps.getProperty(this.KEYS.SUPABASE_URL) || scriptProps.getProperty(this.KEYS.SUPABASE_URL) || null,
      anonKey: userProps.getProperty(this.KEYS.SUPABASE_ANON_KEY) || scriptProps.getProperty(this.KEYS.SUPABASE_ANON_KEY) || null,
      serviceKey: userProps.getProperty(this.KEYS.SUPABASE_SERVICE_KEY) || scriptProps.getProperty(this.KEYS.SUPABASE_SERVICE_KEY) || null,
      table: userProps.getProperty(this.KEYS.SUPABASE_TABLE) || scriptProps.getProperty(this.KEYS.SUPABASE_TABLE) || 'asistencias'
    };
  },

  getNamedRangeValue(name) {
    const range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(name);
    return range ? range.getValue() : null;
  },

  getNamedRangeValues(name) {
    const range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(name);
    return range ? range.getValues() : null;
  },

  setKey(keyName, value, isUser = true) {
    const props = isUser ? PropertiesService.getUserProperties() : PropertiesService.getScriptProperties();
    props.setProperty(keyName, value);
  },

  deleteKey(keyName, isUser = true) {
    const props = isUser ? PropertiesService.getUserProperties() : PropertiesService.getScriptProperties();
    props.deleteProperty(keyName);
  }
};
