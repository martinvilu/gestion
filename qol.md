# Registro de Mejoras de Calidad de Vida (QoL) - Gestión de Cátedra

Este documento detalla 40 mejoras de calidad de vida, robustez operativa, rendimiento y mantenimiento para el proyecto, fundamentadas en el código fuente actual.

---

### 1. Parametrización de usuarios docentes excluidos en GitHub (RESUELTO)
* **Evidencia**: [GitHubService.js:L199](GitHubService.js#L199) (`const ignoredUsers = Config.ignoredGitHubUsers;`).
* **Causa raíz**: Lista rígida de cuentas fijada en código fuente.
* **Prescripción**: Definir el rango con nombre `GH_IGNORED_USERS` en la hoja `Configuración` y leerlo en [`Config`](Config.js).
* **Punto de control**: Modificar docentes desde la planilla sin alterar archivos `.js`.
* **Estado**: Implementado. Rango registrado en `Initializer.js`, getter en `Config.js` y filtrado en `GitHubService.dumpPermissions`.

### 2. Nombre de remitente configurable en correos (RESUELTO)
* **Evidencia**: [MailService.js:L53](MailService.js#L53) (`name: Config.mailerSenderName`).
* **Causa raíz**: Identidad de cátedra codificada en texto fijo dentro del servicio de correos.
* **Prescripción**: Leer el remitente del rango `MATERIA` o de los parámetros `EMAIL_REMITENTE` y `EMAIL_RESPUESTA` (para `replyTo`).
* **Punto de control**: Modificar la celda en `Configuración` cambia el encabezado `From` y `Reply-To` del mail enviado.
* **Estado**: Implementado. Rangos `EMAIL_REMITENTE` y `EMAIL_RESPUESTA` creados en `Initializer.js`, getters en `Config.js` e inyección de remitente y replyTo en `MailService.sendEmails`.


### 3. Unificación del motor de plantillas en MailService
* **Evidencia**: [MailService.js:L84-L91](MailService.js#L84-L91) implementa un reemplazo elemental con regex (`new RegExp("{{${key}}}", "g")`), mientras que [Templater.js:L46-L75](Templater.js#L46-L75) define [`RENDER`](Templater.js#L46-L75).
* **Causa raíz**: Duplicación de lógica que omite las capacidades de formato ya implementadas.
* **Prescripción**: Sustituir la sustitución manual en `assembleTemplates` por el llamado a [`RENDER`](Templater.js#L46-L75).
* **Punto de control**: Soporte para modificadores (`{{Campo:U}}`, `{{Fecha:yyyy-MM-dd}}`) en los correos procesados.

### 4. Centralización y uniformidad de zona horaria
* **Evidencia**: [GitHubService.js:L86](GitHubService.js#L86), [L173-L174](GitHubService.js#L173-L174) y [SyncService.js:L337](SyncService.js#L337) hardcodean `"GMT-3"`, mientras que [appsscript.json:L2](appsscript.json#L2) define `"America/Argentina/Buenos_Aires"` y [Templater.js:L88](Templater.js#L88) consulta `Session.getScriptTimeZone()`.
* **Causa raíz**: Cadenas literales en lugar de consultar la zona horaria del proyecto.
* **Prescripción**: Reemplazar `"GMT-3"` por `Session.getScriptTimeZone()` en todo el código.
* **Punto de control**: Formateo uniforme de marcas temporales en todas las hojas.

### 5. Inicialización automática del intervalo `TP_SLUGS`
* **Evidencia**: [Initializer.js:L54-L69](Initializer.js#L54-L69) no inicializa el rango con nombre `TP_SLUGS`.
* **Causa raíz**: Omisión del intervalo en el procedimiento [`Initializer.initAll`](Initializer.js#L9-L25).
* **Prescripción**: Crear columnas `["slug_prefijo", "abreviado"]` en [`Initializer.initPracticasSheet`](Initializer.js#L135-L137) y asignar el nombre de rango `TP_SLUGS`.
* **Punto de control**: Un spreadsheet recién inicializado ejecuta `fetchRepos` sin requerir configuración manual del rango.

### 6. Evitar fragmentación de la hoja `correcciones` con `insertRowsAfter`
* **Evidencia**: [SyncService.js:L56-L61](SyncService.js#L56-L61) calcula capacidad e inserta filas al final alterando la estructura física de la hoja.
* **Causa raíz**: Gestión manual de capacidad de filas previa al pegado.
* **Prescripción**: Validar la capacidad total de la hoja y redimensionar en un solo bloque solo si `targetRow + payload.length - 1 > currentMaxRows`.
* **Punto de control**: Eliminación de inserciones redundantes que fragmentan el historial de revisiones.

### 7. Paginación y control de volumen en la API de Supabase
* **Evidencia**: [SupabaseService.js:L23](SupabaseService.js#L23) consulta `select=*&order=created_at.desc` sin parámetro `limit`.
* **Causa raíz**: Descarga irrestricta de la tabla remota.
* **Prescripción**: Agregar parámetro `&limit=1000` o filtro incremental por timestamp.
* **Punto de control**: Tiempos de respuesta estables independientemente del volumen de asistencias acumuladas.

### 8. Formato uniforme de fecha en la hoja de asistencias
* **Evidencia**: [SupabaseService.js:L52](SupabaseService.js#L52) vuelca `new Date(row.created_at)` crudo.
* **Causa raíz**: Falta de normalización a texto estructurado.
* **Prescripción**: Aplicar `Utilities.formatDate(new Date(row.created_at), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")`.
* **Punto de control**: Fechas legibles e independientes de la configuración regional del cliente.

### 9. Robustecimiento de la extracción de repositorios en PR Sync
* **Evidencia**: [GitHubService.js:L371](GitHubService.js#L371) emplea `/github\.com\/[^\/]+\/([^\/\.]+)/`, que falla ante trailing slashes o sufijos `.git`.
* **Causa raíz**: Expresión regular que no contempla variantes en el formato de URL.
* **Prescripción**: Emplear `/github\.com\/[^\/]+\/([^/\s#?]+?)(?:\.git)?(?:\/.*)?$/`.
* **Punto de control**: Coincidencia exacta ante URLs con o sin `.git` y con o sin barra de cierre.

### 10. Diccionario exhaustivo de permisos en `gh_perm`
* **Evidencia**: [GitHubService.js:L315](GitHubService.js#L315) solo mapea `'read'`, `'write'` y `'admin'`.
* **Causa raíz**: Incompatibilidad con los roles `'TRIAGE'` y `'MAINTAIN'` de GitHub GraphQL v4.
* **Prescripción**: Expandir el mapa de permisos normalizados para incluir roles extendidos de GitHub.
* **Punto de control**: Actualizaciones sin error para usuarios con rol triage o maintain.

### 11. Confirmación previa para desinstalar triggers
* **Evidencia**: [SyncService.js:L118-L121](SyncService.js#L118-L121) borra todos los triggers del proyecto sin confirmar.
* **Causa raíz**: Falta de diálogo de seguridad ante acciones destructivas.
* **Prescripción**: Anteponer un diálogo `ui.alert('Confirmar', '¿Eliminar triggers?', ButtonSet.YES_NO)`.
* **Punto de control**: Presionar "No" aborta la eliminación sin alterar los disparadores configurados.

### 12. Validación estricta en disparador `onEdit`
* **Evidencia**: [Main.js:L47-L62](Main.js#L47-L62) agrega filas a `correcciones` ante cualquier edición en la última celda de la columna B.
* **Causa raíz**: Falta de saneamiento del valor ingresado.
* **Prescripción**: Validar que el valor contenga un patrón de URL de repositorio antes de hacer `appendRow`.
* **Punto de control**: Celdas editadas con texto arbitrario no se transfieren a la hoja de correcciones.


### 14. Retroalimentación visual continua en tareas de sincronización
* **Evidencia**: [`GitHubService.fetchRepos`](GitHubService.js#L9-L78) no informa la cantidad procesada a medida que avanza entre páginas.
* **Causa raíz**: Ausencia de notificaciones de progreso intermedias.
* **Prescripción**: Actualizar el `toast` al final de cada página: `Obtenidos N repositorios...`.
* **Punto de control**: El usuario visualiza el incremento numérico de datos durante la descarga.

### 15. Retorno de pixel transparente real en Web App `doGet`
* **Evidencia**: [Main.js:L109-L111](Main.js#L109-L111) devuelve un array de bytes decodificado como `MimeType.TEXT`.
* **Causa raíz**: `ContentService` no soporta tipos MIME de imagen de forma nativa.
* **Prescripción**: Responder con un HTML mínimo conteniendo la imagen transparente embebida o redirección HTTP 302 hacia un asset estático.
* **Punto de control**: Respuestas HTTP sin caracteres corruptos al solicitarse el pixel de tracking.

### 16. Modularización del script monolítico `showdown.js`
* **Evidencia**: [showdown.js](showdown.js) suma 4200 líneas de código externo en el directorio principal.
* **Causa raíz**: Dependencia de terceros copiada manualmente al proyecto sin empaquetador.
* **Prescripción**: Mover el renderizado de markdown a los sidebars HTML cargando Showdown desde CDN y excluir el archivo de la raíz mediante `.claspignore`.
* **Punto de control**: Reducción drástica del tamaño del código desplegado en Apps Script.

### 17. Deduplicación de correos en `MailService`
* **Evidencia**: [MailService.js:L36-L65](MailService.js#L36-L65) procesa destinatarios sin control de unicidad.
* **Causa raíz**: Falta de filtrado sobre el rango de entrada.
* **Prescripción**: Almacenar los correos procesados en un `Set` y omitir envíos repetidos hacia una misma casilla dentro de la misma ejecución.
* **Punto de control**: Filas duplicadas en `MAILER` no generan envíos redundantes al mismo estudiante.

### 18. Validación de sintaxis en direcciones de correo antes del envío
* **Evidencia**: [MailService.js:L40](MailService.js#L40) intenta el envío directo sin validar la estructura del email.
* **Causa raíz**: Ausencia de regex de validación previa al llamado a la API de Gmail.
* **Prescripción**: Validar formato de email (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) previo al despacho y marcar `"ERROR: Dirección inválida"` en el log sin gastar cuota.
* **Punto de control**: Correos malformados se descartan sin interrumpir la cola de envíos válidos.

### 19. Soporte para encabezado `replyTo` configurable en el Mailer
* **Evidencia**: [MailService.js:L50-L56](MailService.js#L50-L56) no pasa el parámetro `replyTo` a `MailApp.sendEmail`.
* **Causa raíz**: Los correos enviados reciben respuestas en la casilla personal del usuario que ejecuta el script.
* **Prescripción**: Agregar opción `replyTo` en `MailApp.sendEmail` obtenida desde la configuración de la cátedra.
* **Punto de control**: Respuestas de los estudiantes dirigidas a la casilla oficial de la materia.

### 20. Modo borrador (`Draft Mode`) en MailService
* **Evidencia**: [MailService.js:L50-L56](MailService.js#L50-L56) solo permite envío inmediato vía `MailApp.sendEmail`.
* **Causa raíz**: Imposibilidad de revisar los correos generados antes de su despacho masivo.
* **Prescripción**: Incorporar un interruptor `SOLO_BORRADORES` que invoque `GmailApp.createDraft()` en lugar de `sendEmail()`.
* **Punto de control**: Creación de borradores en Gmail para inspección previa sin salida inmediata.

### 21. Validación de rangos con nombre inexistentes en `Config`
* **Evidencia**: [Config.js:L57-L64](Config.js#L57-L64) retorna `null` silenciosamente si un rango solicitado no existe en la planilla.
* **Causa raíz**: Ausencia de logging en los métodos `getNamedRangeValue` y `getNamedRangeValues`.
* **Prescripción**: Registrar una advertencia en `Logger.log` indicando el nombre del rango faltante para facilitar el diagnóstico.
* **Punto de control**: Logs claros cuando se intenta consultar un rango mal nombrado o eliminado.

### 22. Métodos de lectura con coerción tipada en `Config`
* **Evidencia**: Dispersión de llamadas `parseInt(...) || 1` y conversiones booleanas manuales en [SyncService.js:L75](SyncService.js#L75), [L85](SyncService.js#L85), [L95](SyncService.js#L95).
* **Causa raíz**: Lectura no tipada desde celdas de configuración.
* **Prescripción**: Añadir métodos `getNumber(name, default)` y `getBoolean(name, default)` en `Config`.
* **Punto de control**: Conversión homogénea de parámetros de configuración en un único módulo.

### 23. Centralización de nombres de columnas y constantes mágicas
* **Evidencia**: Strings como `"url_repositorio"`, `"ultimo PR sync"`, `"Timestamp"`, `"practica"` distribuidos en [SyncService.js:L10](SyncService.js#L10) y [GitHubService.js:L360](GitHubService.js#L360).
* **Causa raíz**: Acoplamiento a literales dispersos en vez de constantes de diccionario.
* **Prescripción**: Añadir bloque `COLUMNS` en `Config` con identificadores estándar.
* **Punto de control**: Cambio de encabezados gestionado desde una única ubicación en código.

### 24. Manejo específico de rate limit (HTTP 403 / 429) en GraphQL de GitHub
* **Evidencia**: [GitHubService.js:L69](GitHubService.js#L69) y [HttpUtils:L20-L26](Utils.js#L20-L26) aplican reintentos exponenciales genéricos sin inspeccionar los encabezados `X-RateLimit-Remaining` y `X-RateLimit-Reset`.
* **Causa raíz**: Falta de soporte de encabezados específicos de la API de GitHub en `HttpUtils`.
* **Prescripción**: Inspeccionar cabeceras de rate limit en respuestas 403/429 y reportar el tiempo exacto de espera necesario.
* **Punto de control**: Mensajes de cuota agotada informando los segundos restantes hasta la reactivación.

### 25. Paralelización de descarga de comentarios de PRs en `syncPRComments`
* **Evidencia**: [GitHubService.js:L382](GitHubService.js#L382) recorre secuencialmente repositorio por repositorio ejecutando `_fetchAllPRComments`.
* **Causa raíz**: Iteración secuencial vulnerable al límite de 6 minutos de Apps Script.
* **Prescripción**: Implementar lotes de solicitudes GraphQL agrupadas mediante `UrlFetchApp.fetchAll` emulando el patrón aplicado en `dumpPermissions`.
* **Punto de control**: Tiempo de sincronización de PRs reducido drásticamente en cursos con más de 50 alumnos.

### 26. Parametrización del descuento de commits iniciales en GitHub Classroom
* **Evidencia**: [GitHubService.js:L168](GitHubService.js#L168) resta 2 fijos al totalCount (`totalCount - 2`) asumiendo commits predeterminados del starter code.
* **Causa raíz**: Valor mágico fijo que distorsiona la métrica si el repositorio template tenía otro número de commits iniciales.
* **Prescripción**: Mover el offset a una columna en `practicas` o celda `COMMITS_OFFSET` en `Configuración`.
* **Punto de control**: Conteo preciso de commits reales del estudiante según la práctica.

### 27. Reporte agregado de modificaciones en `updatePermissions`
* **Evidencia**: [GitHubService.js:L298-L325](GitHubService.js#L298-L325) aplica permisos emitiendo únicamente registros individuales en `Logger.log`.
* **Causa raíz**: Falta de resumen consolidado al finalizar la actualización de permisos.
* **Prescripción**: Acumular conteos de usuarios actualizados vs omitidos y emitir un toast final informativo.
* **Punto de control**: Visualización inmediata del total de permisos modificados en la interfaz de Sheets.

### 28. Auto-ajuste de columnas (`autoResizeColumns`) en todas las hojas inicializadas
* **Evidencia**: Solo la hoja `Configuración` invoca `autoResizeColumns` en [Initializer.js:L91](Initializer.js#L91).
* **Causa raíz**: Omisión del auto-dimensionamiento en `initGitHubSheets`, `initSyncSheets`, `initAsistenciaSheet`, etc.
* **Prescripción**: Invocar `sheet.autoResizeColumns(1, headers.length)` dentro de [`_createSheetWithHeaders`](Initializer.js#L142-L150).
* **Punto de control**: Columnas legibles de inmediato sin requerir ajuste manual de anchos.

### 29. Reglas de validación de datos en hojas creadas por Initializer
* **Evidencia**: [Initializer.js:L135-L137](Initializer.js#L135-L137) crea la hoja `practicas` sin listas desplegables para la columna `acceso`.
* **Causa raíz**: Hojas creadas como texto libre sin restricciones de entrada.
* **Prescripción**: Añadir `SpreadsheetApp.newDataValidation().requireValueInList(['pull', 'push', 'admin'])` en la columna de acceso de `practicas`.
* **Punto de control**: Menú desplegable en cada fila evitando ingresos erróneos de permisos.

### 30. Protección de filas de encabezado contra sobrescritura accidental
* **Evidencia**: [Initializer.js:L148-L150](Initializer.js#L148-L150) congela la primera fila pero no define protecciones (`protect()`).
* **Causa raíz**: Los encabezados quedan expuestos a edición accidental por parte de colaboradores de la planilla.
* **Prescripción**: Proteger el rango `sheet.getRange(1, 1, 1, headers.length).protect().setDescription('Encabezados del Sistema')`.
* **Punto de control**: Alertas de Google Sheets si un usuario intenta sobreescribir la fila 1.

### 31. Acción de reparación de encabezados sin reinicializar datos
* **Evidencia**: [`Initializer.initAll`](Initializer.js#L9-L25) reinicializa todo el sistema borrando o alertando riesgo de sobreescritura general.
* **Causa raíz**: Falta de una función de auto-reparación no destructiva.
* **Prescripción**: Implementar `menuRepairHeaders` que valide y reescriba únicamente la fila 1 de cada hoja respetando los datos preexistentes.
* **Punto de control**: Recuperación de encabezados dañados sin riesgo para las filas de datos de estudiantes.

### 32. Formulario HTML consolidado de configuración en la interfaz
* **Evidencia**: [Interface.js:L54-L122](Interface.js#L54-L122) despliega múltiples `ui.prompt()` sucesivos para ingresar credenciales y configuraciones.
* **Causa raíz**: Interfaz basada en ventanas modales secuenciales de Apps Script.
* **Prescripción**: Unificar la configuración en un panel sidebar HTML (`HtmlService.createHtmlOutput`) con inputs para GitHub, Supabase y variables globales.
* **Punto de control**: Configuración completa del sistema en una única pantalla.

### 33. Validación de formato en prompts de claves API y URLs
* **Evidencia**: [Interface.js:L63](Interface.js#L63) y [L88](Interface.js#L88) aceptan cualquier string no vacío sin validar estructura.
* **Causa raíz**: Falta de expresiones regulares de validación sintáctica en los setters de interfaz.
* **Prescripción**: Rechazar tokens que no cumplan el prefijo `ghp_` / `github_pat_` o URLs que no comiencen con `https://`.
* **Punto de control**: Mensajes de advertencia antes de persistir claves o endpoints malformados.

### 34. Sanitización de HTML contra XSS en previsualización de Markdown
* **Evidencia**: [Interface.js:L37](Interface.js#L37) inyecta directamente `${converter.makeHtml(content)}` en el cuerpo del HTML.
* **Causa raíz**: Renderizado de entradas sin saneamiento contra etiquetas `<script>` o atributos de evento.
* **Prescripción**: Configurar Showdown con `converter.setOption('sanitize', true)` o filtrar el HTML resultante.
* **Punto de control**: Scripts incrustados en comentarios de corrección no se ejecutan en el navegador.

### 35. Actualización dinámica al cambiar de celda en el visor Markdown
* **Evidencia**: [Interface.js:L10](Interface.js#L10) lee la celda activa solo en el momento de invocar la acción de menú.
* **Causa raíz**: El sidebar HTML es estático y no escucha cambios de selección.
* **Prescripción**: Implementar un polling ligero o trigger `onSelectionChange` que refresque el contenido del sidebar si está abierto.
* **Punto de control**: Al seleccionar otra celda de devolución, el panel actualiza automáticamente la vista previa.

### 36. Autenticación con token secreto en endpoints Web App `doGet` y `doPost`
* **Evidencia**: [Main.js:L93-L222](Main.js#L93-L222) procesa acciones como `?action=sync` o webhooks en `doPost` sin comprobar identidad.
* **Causa raíz**: Falta de validación de un token de autenticación en la URL (`&token=...`) o en los encabezados HTTP.
* **Prescripción**: Exigir un token precompartido en los parámetros de consulta y rechazar solicitudes no autorizadas con HTTP 401.
* **Punto de control**: Peticiones anónimas a la Web App no disparan sincronizaciones del sistema.

### 37. Captura y reporte amigable de excepciones en funciones de menú
* **Evidencia**: [Main.js:L66-L75](Main.js#L66-L75) invoca directamente los métodos de servicio sin envolver en `try/catch`.
* **Causa raíz**: Ausencia de capa de presentación de errores en los wrappers del menú.
* **Prescripción**: Envolver cada función de menú para capturar excepciones y mostrar un diálogo `SpreadsheetApp.getUi().alert('Error', e.message, ButtonSet.OK)`.
* **Punto de control**: Los errores de ejecución se comunican con claridad en la UI en lugar de mostrar cuadros técnicos nativos de Apps Script.

### 38. Sincronización incremental en `SupabaseService` mediante timestamp de corte
* **Evidencia**: [SupabaseService.js:L23](SupabaseService.js#L23) limpia la hoja completa y re-descarga toda la tabla en cada ejecución.
* **Causa raíz**: Modo de sincronización destructivo en lugar de acumulativo.
* **Prescripción**: Registrar la fecha máxima persistida y consultar `created_at=gt.${ultimaFecha}`, insertando únicamente los nuevos escaneos.
* **Punto de control**: Preservación del histórico local y descargas de red reducidas al mínimo delta.

### 39. Normalización y saneamiento de URLs en la hoja `entregas`
* **Evidencia**: [SyncService.js:L29-L35](SyncService.js#L29-L35) transfiere URLs directamente de `entregas` a `correcciones` sin normalizar.
* **Causa raíz**: Celdas con espacios accidentales, barras finales o protocolos mixtos (`http` en vez de `https`) se propagan sin filtrar.
* **Prescripción**: Aplicar `.trim().replace(/^http:\/\//, 'https://').replace(/\/+$/, '')` antes de agregar la entrega.
* **Punto de control**: URLs uniformes en la hoja `correcciones`, facilitando cruces con `BUSCARV` y matching de PRs.

### 40. Integración de linter y formateador estático de código local
* **Evidencia**: [package.json](package.json) solo dispone del comando `npm test`.
* **Causa raíz**: Falta de validación estática de convenciones de estilo en el flujo de desarrollo local.
* **Prescripción**: Añadir ESLint con configuración para Google Apps Script (`eslint-plugin-googleappsscript`) y script `"lint": "eslint ."` en `package.json`.
* **Punto de control**: `npm run lint` detectando variables no declaradas o errores de sintaxis antes del despliegue con clasp.
