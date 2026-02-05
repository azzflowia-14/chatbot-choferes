// ============================================
// Google Apps Script - Chatbot Choferes v2
// Control de Rutas y Cobros
// ============================================
// Este archivo va en Google Apps Script
// (Extensions > Apps Script desde tu Google Sheet)
// ============================================

// ID de la carpeta de Google Drive donde se guardan las fotos
var FOLDER_ID = '1234567890'; // <-- REEMPLAZÁ CON TU ID DE CARPETA

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    switch (action) {
      case 'login':
        return handleLogin(data);
      case 'crearRuta':
        return handleCrearRuta(data);
      case 'getMisRutas':
        return handleGetMisRutas(data);
      case 'getRuta':
        return handleGetRuta(data);
      case 'getMovimientos':
        return handleGetMovimientos(data);
      case 'agregarMovimiento':
        return handleAgregarMovimiento(data);
      case 'toggleRuta':
        return handleToggleRuta(data);
      case 'verificarCliente':
        return handleVerificarCliente(data);
      case 'getRutasParaDescarga':
        return handleGetRutasParaDescarga(data);
      case 'subirFotoDescarga':
        return handleSubirFotoDescarga(data);
      case 'getFotosDescarga':
        return handleGetFotosDescarga(data);
      case 'submit':
        // Mantener compatibilidad con versión anterior
        return handleSubmitLegacy(data);
      default:
        return jsonResponse({ success: false, error: 'Acción no válida' });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// =============================================
// LOGIN
// =============================================
function handleLogin(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Choferes');

  if (!sheet) {
    return jsonResponse({ success: false, error: 'No existe la hoja "Choferes"' });
  }

  var rows = sheet.getDataRange().getValues();

  // Columnas: A=Nombre, B=Usuario, C=Password, D=Tipo (Chofer/Auxiliar)
  for (var i = 1; i < rows.length; i++) {
    var nombre = rows[i][0];
    var usuario = rows[i][1].toString().trim().toLowerCase();
    var password = rows[i][2].toString().trim();
    var tipoRaw = rows[i][3] ? rows[i][3].toString().trim().toLowerCase() : 'chofer';
    var tipo = (tipoRaw === 'auxiliar') ? 'Auxiliar' : 'Chofer';

    if (usuario === data.usuario.trim().toLowerCase() && password === data.password.trim()) {
      return jsonResponse({ success: true, nombre: nombre, tipo: tipo });
    }
  }

  return jsonResponse({ success: false, error: 'Usuario o contraseña incorrectos' });
}

// =============================================
// CREAR RUTA
// =============================================
function handleCrearRuta(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Rutas', ['ID', 'Fecha', 'Hora', 'Chofer', 'Camion', 'CHESS', 'Estado', 'Total Trans.', 'Total Efectivo', 'Total Cta.Cte.', 'Total General']);

  var now = new Date();
  var rutaId = now.getTime().toString();
  var fecha = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
  var hora = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'HH:mm:ss');

  sheet.appendRow([
    rutaId,
    fecha,
    hora,
    data.chofer,
    data.camion,
    data.chess || '',
    'abierta',
    0,
    0,
    0,
    0
  ]);

  return jsonResponse({
    success: true,
    ruta: {
      id: rutaId,
      fecha: fecha,
      hora: hora,
      chofer: data.chofer,
      camion: data.camion,
      chess: data.chess || '',
      estado: 'abierta'
    }
  });
}

// =============================================
// OBTENER MIS RUTAS
// =============================================
function handleGetMisRutas(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Rutas');

  if (!sheet) {
    return jsonResponse({ success: true, rutas: [] });
  }

  var rows = sheet.getDataRange().getValues();
  var rutas = [];

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][3] === data.chofer) {
      rutas.push({
        id: rows[i][0].toString(),
        fecha: rows[i][1],
        hora: rows[i][2],
        camion: rows[i][4],
        chess: rows[i][5],
        estado: rows[i][6],
        total: rows[i][10] || 0
      });
    }
  }

  // Ordenar por fecha más reciente
  rutas.reverse();

  return jsonResponse({ success: true, rutas: rutas });
}

// =============================================
// OBTENER UNA RUTA CON SUS MOVIMIENTOS
// =============================================
function handleGetRuta(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Rutas');

  if (!sheet) {
    return jsonResponse({ success: false, error: 'No se encontró la ruta' });
  }

  var rows = sheet.getDataRange().getValues();
  var ruta = null;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === data.rutaId) {
      ruta = {
        id: rows[i][0].toString(),
        fecha: rows[i][1],
        hora: rows[i][2],
        chofer: rows[i][3],
        camion: rows[i][4],
        chess: rows[i][5],
        estado: rows[i][6]
      };
      break;
    }
  }

  if (!ruta) {
    return jsonResponse({ success: false, error: 'No se encontró la ruta' });
  }

  // Obtener movimientos
  var movimientos = obtenerMovimientosRuta(ss, data.rutaId);

  return jsonResponse({ success: true, ruta: ruta, movimientos: movimientos });
}

// =============================================
// OBTENER MOVIMIENTOS DE UNA RUTA
// =============================================
function handleGetMovimientos(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var movimientos = obtenerMovimientosRuta(ss, data.rutaId);

  return jsonResponse({ success: true, movimientos: movimientos });
}

function obtenerMovimientosRuta(ss, rutaId) {
  var movimientos = [];

  // Transferencias
  var sheetTrans = ss.getSheetByName('Transferencias');
  if (sheetTrans) {
    var rowsTrans = sheetTrans.getDataRange().getValues();
    for (var i = 1; i < rowsTrans.length; i++) {
      if (rowsTrans[i][0].toString() === rutaId) {
        movimientos.push({
          tipo: 'transferencia',
          codCliente: rowsTrans[i][4],
          monto: rowsTrans[i][5]
        });
      }
    }
  }

  // Efectivo
  var sheetEfe = ss.getSheetByName('Efectivo');
  if (sheetEfe) {
    var rowsEfe = sheetEfe.getDataRange().getValues();
    for (var i = 1; i < rowsEfe.length; i++) {
      if (rowsEfe[i][0].toString() === rutaId) {
        movimientos.push({
          tipo: 'efectivo',
          codCliente: rowsEfe[i][4],
          monto: rowsEfe[i][5]
        });
      }
    }
  }

  // Cuenta Corriente
  var sheetCta = ss.getSheetByName('CuentaCorriente');
  if (sheetCta) {
    var rowsCta = sheetCta.getDataRange().getValues();
    for (var i = 1; i < rowsCta.length; i++) {
      if (rowsCta[i][0].toString() === rutaId) {
        movimientos.push({
          tipo: 'ctacte',
          codCliente: rowsCta[i][4],
          monto: rowsCta[i][5]
        });
      }
    }
  }

  return movimientos;
}

// =============================================
// AGREGAR MOVIMIENTO
// =============================================
function handleAgregarMovimiento(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var fecha = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
  var hora = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'HH:mm:ss');
  var monto = parseFloat(data.monto) || 0;

  if (data.tipo === 'transferencia') {
    // Guardar foto en Drive (solo si no es exceptuado)
    var fotoUrl = '';
    var esExceptuado = data.exceptuado === 'Sí';

    if (data.fotoBase64 && !esExceptuado) {
      try {
        var folder = DriveApp.getFolderById(FOLDER_ID);
        var base64Data = data.fotoBase64.split(',')[1] || data.fotoBase64;
        var blob = Utilities.newBlob(
          Utilities.base64Decode(base64Data),
          data.fotoTipo || 'image/jpeg',
          data.fotoNombre || 'comprobante.jpg'
        );

        var fileName = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'yyyyMMdd_HHmmss')
          + '_' + data.chofer.replace(/\s/g, '')
          + '_' + data.codCliente
          + '.' + (data.fotoNombre ? data.fotoNombre.split('.').pop() : 'jpg');
        blob.setName(fileName);

        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fotoUrl = file.getUrl();
      } catch (err) {
        return jsonResponse({ success: false, error: 'Error al guardar foto: ' + err.toString() });
      }
    }

    var sheet = getOrCreateSheet(ss, 'Transferencias', ['ID Ruta', 'Fecha', 'Hora', 'Chofer', 'Cod. Cliente', 'Monto', 'Foto', 'Estado', 'Exceptuado']);
    sheet.appendRow([data.rutaId, fecha, hora, data.chofer, data.codCliente, monto, fotoUrl, 'Pendiente', data.exceptuado || 'No']);

    actualizarTotalesRuta(ss, data.rutaId);
    return jsonResponse({ success: true, message: 'Transferencia registrada' });

  } else if (data.tipo === 'efectivo') {
    var sheet = getOrCreateSheet(ss, 'Efectivo', ['ID Ruta', 'Fecha', 'Hora', 'Chofer', 'Cod. Cliente', 'Monto']);
    sheet.appendRow([data.rutaId, fecha, hora, data.chofer, data.codCliente, monto]);

    actualizarTotalesRuta(ss, data.rutaId);
    return jsonResponse({ success: true, message: 'Efectivo registrado' });

  } else if (data.tipo === 'ctacte') {
    var sheet = getOrCreateSheet(ss, 'CuentaCorriente', ['ID Ruta', 'Fecha', 'Hora', 'Chofer', 'Cod. Cliente', 'Monto']);
    sheet.appendRow([data.rutaId, fecha, hora, data.chofer, data.codCliente, monto]);

    actualizarTotalesRuta(ss, data.rutaId);
    return jsonResponse({ success: true, message: 'Cuenta Corriente registrada' });

  } else {
    return jsonResponse({ success: false, error: 'Tipo de movimiento no válido' });
  }
}

// =============================================
// TOGGLE RUTA (Cerrar/Reabrir)
// =============================================
function handleToggleRuta(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Rutas');

  if (!sheet) {
    return jsonResponse({ success: false, error: 'No se encontró la hoja de rutas' });
  }

  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === data.rutaId) {
      sheet.getRange(i + 1, 7).setValue(data.estado);
      return jsonResponse({ success: true, estado: data.estado });
    }
  }

  return jsonResponse({ success: false, error: 'No se encontró la ruta' });
}

// =============================================
// VERIFICAR CLIENTE (Exceptuados / C_Corriente)
// =============================================
function handleVerificarCliente(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = data.tipo === 'exceptuado' ? 'Exceptuados' : 'C_Corriente';
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // Si no existe la hoja, devolver no encontrado
    return jsonResponse({ success: true, encontrado: false });
  }

  var rows = sheet.getDataRange().getValues();
  var codBuscado = data.codCliente.toString().trim().toUpperCase();

  // Buscar en columna A (índice 0)
  for (var i = 1; i < rows.length; i++) {
    var codEnLista = rows[i][0].toString().trim().toUpperCase();
    if (codEnLista === codBuscado) {
      return jsonResponse({ success: true, encontrado: true });
    }
  }

  return jsonResponse({ success: true, encontrado: false });
}

// =============================================
// AUXILIARES - Rutas para descarga
// =============================================
function handleGetRutasParaDescarga(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Rutas');

  if (!sheet) {
    return jsonResponse({ success: true, rutas: [] });
  }

  var rows = sheet.getDataRange().getValues();
  var rutas = [];
  var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');

  // Mostrar rutas de hoy (o todas las abiertas si querés)
  for (var i = 1; i < rows.length; i++) {
    // Mostrar todas las rutas (no solo las de hoy, para que puedan cargar descargas de días anteriores)
    rutas.push({
      id: rows[i][0].toString(),
      fecha: rows[i][1],
      chofer: rows[i][3],
      camion: rows[i][4],
      chess: rows[i][5],
      estado: rows[i][6]
    });
  }

  // Ordenar por fecha más reciente
  rutas.reverse();

  return jsonResponse({ success: true, rutas: rutas });
}

// =============================================
// AUXILIARES - Subir foto de descarga
// =============================================
function handleSubirFotoDescarga(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date();
  var fecha = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
  var hora = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'HH:mm:ss');

  // Guardar foto en Drive
  var fotoUrl = '';
  if (data.fotoBase64) {
    try {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var base64Data = data.fotoBase64.split(',')[1] || data.fotoBase64;
      var blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        data.fotoTipo || 'image/jpeg',
        data.fotoNombre || 'descarga.jpg'
      );

      var fileName = 'DESCARGA_' + Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'yyyyMMdd_HHmmss')
        + '_' + data.auxiliar.replace(/\s/g, '')
        + '_' + data.rutaId
        + '.' + (data.fotoNombre ? data.fotoNombre.split('.').pop() : 'jpg');
      blob.setName(fileName);

      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fotoUrl = file.getUrl();
    } catch (err) {
      return jsonResponse({ success: false, error: 'Error al guardar foto: ' + err.toString() });
    }
  }

  // Guardar en hoja Descargas
  var sheet = getOrCreateSheet(ss, 'Descargas', ['ID Ruta', 'Fecha', 'Hora', 'Auxiliar', 'Foto URL']);
  sheet.appendRow([data.rutaId, fecha, hora, data.auxiliar, fotoUrl]);

  return jsonResponse({ success: true, message: 'Foto subida correctamente', url: fotoUrl });
}

// =============================================
// AUXILIARES - Obtener fotos de descarga
// =============================================
function handleGetFotosDescarga(data) {
  if (!validarCredenciales(data)) {
    return jsonResponse({ success: false, error: 'Credenciales inválidas' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Descargas');

  if (!sheet) {
    return jsonResponse({ success: true, fotos: [] });
  }

  var rows = sheet.getDataRange().getValues();
  var fotos = [];

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === data.rutaId) {
      fotos.push({
        fecha: rows[i][1],
        hora: rows[i][2],
        auxiliar: rows[i][3],
        url: rows[i][4]
      });
    }
  }

  return jsonResponse({ success: true, fotos: fotos });
}

// =============================================
// FUNCIONES AUXILIARES
// =============================================

function validarCredenciales(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Choferes');

  if (!sheet) return false;

  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var usuario = rows[i][1].toString().trim().toLowerCase();
    var password = rows[i][2].toString().trim();

    if (usuario === data.usuario.trim().toLowerCase() && password === data.password.trim()) {
      return true;
    }
  }

  return false;
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function actualizarTotalesRuta(ss, rutaId) {
  var totalTrans = 0;
  var totalEfe = 0;
  var totalCta = 0;

  // Sumar transferencias
  var sheetTrans = ss.getSheetByName('Transferencias');
  if (sheetTrans) {
    var rowsTrans = sheetTrans.getDataRange().getValues();
    for (var i = 1; i < rowsTrans.length; i++) {
      if (rowsTrans[i][0].toString() === rutaId) {
        totalTrans += parseFloat(rowsTrans[i][5]) || 0;
      }
    }
  }

  // Sumar efectivo
  var sheetEfe = ss.getSheetByName('Efectivo');
  if (sheetEfe) {
    var rowsEfe = sheetEfe.getDataRange().getValues();
    for (var i = 1; i < rowsEfe.length; i++) {
      if (rowsEfe[i][0].toString() === rutaId) {
        totalEfe += parseFloat(rowsEfe[i][5]) || 0;
      }
    }
  }

  // Sumar cuenta corriente
  var sheetCta = ss.getSheetByName('CuentaCorriente');
  if (sheetCta) {
    var rowsCta = sheetCta.getDataRange().getValues();
    for (var i = 1; i < rowsCta.length; i++) {
      if (rowsCta[i][0].toString() === rutaId) {
        totalCta += parseFloat(rowsCta[i][5]) || 0;
      }
    }
  }

  var totalGeneral = totalTrans + totalEfe + totalCta;

  // Actualizar hoja Rutas
  var sheetRutas = ss.getSheetByName('Rutas');
  if (sheetRutas) {
    var rowsRutas = sheetRutas.getDataRange().getValues();
    for (var i = 1; i < rowsRutas.length; i++) {
      if (rowsRutas[i][0].toString() === rutaId) {
        sheetRutas.getRange(i + 1, 8).setValue(totalTrans);
        sheetRutas.getRange(i + 1, 9).setValue(totalEfe);
        sheetRutas.getRange(i + 1, 10).setValue(totalCta);
        sheetRutas.getRange(i + 1, 11).setValue(totalGeneral);
        break;
      }
    }
  }
}

// Compatibilidad con versión anterior (submit directo)
function handleSubmitLegacy(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Comprobantes', ['Fecha', 'Hora', 'Chofer', 'Cod. Cliente', 'Monto', 'Foto', 'Estado']);

  var fotoUrl = '';
  if (data.fotoBase64) {
    try {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var base64Data = data.fotoBase64.split(',')[1] || data.fotoBase64;
      var blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        data.fotoTipo || 'image/jpeg',
        data.fotoNombre || 'comprobante.jpg'
      );

      var now = new Date();
      var fileName = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'yyyyMMdd_HHmmss')
        + '_' + data.chofer.replace(/\s/g, '')
        + '_' + data.codCliente
        + '.' + (data.fotoNombre ? data.fotoNombre.split('.').pop() : 'jpg');
      blob.setName(fileName);

      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fotoUrl = file.getUrl();
    } catch (err) {
      return jsonResponse({ success: false, error: 'Error al guardar foto: ' + err.toString() });
    }
  }

  var now = new Date();
  var fecha = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
  var hora = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'HH:mm:ss');

  sheet.appendRow([fecha, hora, data.chofer, data.codCliente, parseFloat(data.monto), fotoUrl, 'Pendiente']);

  return jsonResponse({ success: true, message: 'Comprobante registrado' });
}

// Utilidad para responder JSON con CORS
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET para verificar que el script está funcionando
function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'Control de Rutas API v2 activa' });
}
