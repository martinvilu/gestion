/**
 * @fileoverview Custom functions for template interpolation.
 */

/**
 * Genera un token de acceso determinista basado en una semilla (seed).
 *
 * @param {string} seed El valor base para generar el token (ej. email o ID).
 * @param {number} largo Indice de longitud (0: 8, 1: 12, 2: 16, 3: 24, 4: 32).
 * @return {string} Un token alfanumérico.
 * @customfunction
 */
function TOKEN(seed, largo) {
  if (!seed) return "";
  
  // Mapeo de longitudes predefinidas
  const longitudes = [8, 12, 16, 24, 32];
  const length = longitudes[largo] || 16;

  // Generar un hash SHA-256 de la semilla
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed.toString());
  
  // Convertir a Base64 y limpiar para que sea azAZ09 (URL Safe)
  let txt = Utilities.base64EncodeWebSafe(rawHash)
    .replace(/[^a-zA-Z0-9]/g, ''); // Eliminar caracteres no alfanuméricos

  // Si el hash limpio es más corto que lo solicitado (raro), repetirlo
  while (txt.length < length) {
    txt += txt;
  }

  return txt.substring(0, length);
}

/**
 * Renderiza una plantilla interpolando valores de una fila.
 * Soporta {{NombreColumna}} y {{LetraColumna}} (ej. {{A}}).
 * Permite opciones de formato con la sintaxis {{Columna:Formato}}.
 *
 * @param {string} template El texto de la plantilla.
 * @param {Array<any>} row La fila de datos (rango de una sola fila).
 * @param {Array<string>} headers (Opcional) La fila de encabezados.
 * @return {string} El texto renderizado.
 * @customfunction
 */
function RENDER(template, row, headers) {
  if (!template || !row) return "";
  
  // Normalizar row (Apps Script pasa rangos como arrays 2D)
  const data = Array.isArray(row[0]) ? row[0] : row;
  const headerRow = headers && Array.isArray(headers[0]) ? headers[0] : (headers || []);

  // Crear un mapa de valores para búsqueda rápida
  const valueMap = {};
  data.forEach((value, index) => {
    // Mapeo por letra (A, B, C...)
    const letter = String.fromCharCode(65 + (index % 26));
    valueMap[letter] = value;
    
    // Mapeo por nombre de encabezado
    const headerName = headerRow[index];
    if (headerName) {
      valueMap[headerName] = value;
    }
  });

  // Reemplazar marcadores usando una expresión regular para detectar formatos
  // Sintaxis: {{Key}} o {{Key:Format}}
  return template.replace(/{{([^:}]+)(?::([^}]+))?}}/g, (match, key, format) => {
    const val = valueMap[key];
    if (val === undefined) return match; // Mantener el marcador si no hay datos
    
    return format ? _applyFormat(val, format) : val;
  });
}

/**
 * Función interna para aplicar formatos a los valores.
 * @private
 */
function _applyFormat(value, format) {
  if (value === null || value === undefined) return "";

  // 1. Formato de Fecha
  if (value instanceof Date) {
    try {
      // Si el formato es una de nuestras palabras clave, lo traducimos o usamos directo
      return Utilities.formatDate(value, Session.getScriptTimeZone(), format);
    } catch (e) {
      return value.toString();
    }
  }

  // 2. Formato de Número
  if (typeof value === 'number') {
    if (format.toUpperCase().startsWith('N')) {
      const decimals = parseInt(format.substring(1)) || 0;
      return value.toFixed(decimals);
    }
    if (format === '%') {
      return (value * 100).toFixed(2) + "%";
    }
  }

  // 3. Formato de Texto
  const str = String(value);
  switch (format.toUpperCase()) {
    case 'U': return str.toUpperCase(); // Uppercase
    case 'L': return str.toLowerCase(); // Lowercase
    case 'T': return str.trim();        // Trim
    default: return str;
  }
}

/**
 * Genera el encabezado de una tabla Markdown.
 *
 * @param {Array<string>} headers Rango de celdas con los nombres de las columnas.
 * @return {string} El encabezado en formato Markdown con su línea separadora.
 * @customfunction
 */
function MD_TABLE_HEADER(headers) {
  if (!headers) return "";
  const data = Array.isArray(headers[0]) ? headers[0] : headers;
  
  const row = "| " + data.join(" | ") + " |";
  const separator = "| " + data.map(() => "---").join(" | ") + " |";
  
  return row + "\n" + separator;
}

/**
 * Genera una fila de una tabla Markdown.
 *
 * @param {Array<any>} values Rango de celdas con los valores de la fila.
 * @return {string} La fila en formato Markdown.
 * @customfunction
 */
function MD_TABLE_ROW(values) {
  if (!values) return "";
  const data = Array.isArray(values[0]) ? values[0] : values;
  
  return "| " + data.join(" | ") + " |";
}

/**
 * Sanitiza un texto o matriz de textos para que sea seguro usarlo como argumento en Bash.
 * Soporta evaluación vectorizada (rangos) compatible con ARRAYFORMULA.
 *
 * @param {string|Array<Array<any>>} input El texto escalar o el rango (matriz 2D).
 * @return {string|Array<Array<string>>} Texto u matriz de textos escapados para Bash.
 * @customfunction
 */
function BASH_ESCAPE(input) {
  // Closure de sanitización base
  const escapeString = (val) => {
    if (!val && val !== 0 && val !== false) return "''";
    return "'" + String(val).replace(/'/g, "'\\''") + "'";
  };

  // Procesamiento matricial para rangos bidimensionales en Google Sheets
  if (Array.isArray(input)) {
    return input.map(row => row.map(cell => escapeString(cell)));
  }

  // Procesamiento escalar
  return escapeString(input);
}

/**
 * Calcula la distancia numérica entre dos letras de columna (1-based).
 * Útil para obtener el índice dinámico en funciones como BUSCARV (VLOOKUP).
 *
 * @param {string} colInicio Letra de la columna inicial (ej. "A").
 * @param {string} colFin Letra de la columna final (ej. "C").
 * @return {number} La distancia entre las columnas (ej. "A" a "C" devuelve 3).
 * @customfunction
 */
function DISTANCIAV(colInicio, colFin) {
  if (!colInicio || !colFin) return 0;
  
  const idx1 = _columnLetterToIndex(colInicio);
  const idx2 = _columnLetterToIndex(colFin);
  
  // Retornamos la diferencia absoluta + 1 para que sea compatible con el índice de BUSCARV
  // Ej: De A (1) a B (2) la distancia para BUSCARV es 2.
  return Math.abs(idx2 - idx1) + 1;
}

/**
 * Convierte una letra de columna de Excel/Sheets a su índice numérico (1-based).
 * @private
 */
function _columnLetterToIndex(letter) {
  const column = letter.toUpperCase();
  let result = 0;
  for (let i = 0; i < column.length; i++) {
    result *= 26;
    result += column.charCodeAt(i) - 64;
  }
  return result;
}



