// ============================================
// Google Apps Script - Chatbot Choferes
// ============================================
// Este archivo va en Google Apps Script
// (Extensions > Apps Script desde tu Google Sheet)
// ============================================

// ID de la carpeta de Google Drive donde se guardan las fotos
// Creá una carpeta en Drive y copiá el ID de la URL
var FOLDER_ID = 'ACÁ_VA_EL_ID_DE_TU_CARPETA_DE_DRIVE';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;

    if (action === 'login') {
      return handleLogin(data);
    } else if (action === 'submit') {
      return handleSubmit(data);
    } else {
      return jsonResponse({ success: false, error: 'Acción no válida' });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function handleLogin(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Choferes');

  if (!sheet) {
    return jsonResponse({ success: false, error: 'No existe la hoja "Choferes"' });
  }

  var rows = sheet.getDataRange().getValues();

  // Columnas: A=Nombre, B=Usuario, C=Password
  for (var i = 1; i < rows.length; i++) {
    var nombre = rows[i][0];
    var usuario = rows[i][1].toString().trim().toLowerCase();
    var password = rows[i][2].toString().trim();

    if (usuario === data.usuario.trim().toLowerCase() && password === data.password.trim()) {
      return jsonResponse({ success: true, nombre: nombre });
    }
  }

  return jsonResponse({ success: false, error: 'Usuario o contraseña incorrectos' });
}

function handleSubmit(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Comprobantes');

  if (!sheet) {
    sheet = ss.insertSheet('Comprobantes');
    sheet.appendRow([
      'Fecha', 'Hora', 'Chofer', 'Cód. Cliente', 'Monto', 'Foto', 'Estado'
    ]);
    // Formato encabezado
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
  }

  // Guardar foto en Google Drive
  var fotoUrl = '';
  if (data.fotoBase64) {
    try {
      var folder = DriveApp.getFolderById(FOLDER_ID);

      // Decodificar base64
      var base64Data = data.fotoBase64.split(',')[1] || data.fotoBase64;
      var blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        data.fotoTipo || 'image/jpeg',
        data.fotoNombre || 'comprobante.jpg'
      );

      // Nombre del archivo: fecha_chofer_cliente.ext
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

  // Agregar fila al sheet
  var now = new Date();
  var fecha = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
  var hora = Utilities.formatDate(now, 'America/Argentina/Buenos_Aires', 'HH:mm:ss');

  sheet.appendRow([
    fecha,
    hora,
    data.chofer,
    data.codCliente,
    parseFloat(data.monto),
    fotoUrl,
    'Pendiente'
  ]);

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
  return jsonResponse({ status: 'ok', message: 'Chatbot Choferes API activa' });
}
