const NOMBRE_HOJA_USUARIOS = 'USUARIOS';
const NOMBRE_HOJA_PRODUCTOS = 'PRODUCTOS';
const NOMBRE_HOJA_COTIZACIONES = 'COTIZACIONES';
const NOMBRE_HOJA_DETALLE = 'DETALLE_COTIZACION';

const DURACION_SESION = 21600;      // 6 horas
const MAX_INTENTOS_LOGIN = 5;
const BLOQUEO_LOGIN = 600;          // 10 minutos


// ======================================================
// GET  (solo lecturas)
// ======================================================

function doGet(e) {

  const p = (e && e.parameter) || {};

  const accion = String(p.accion || '')
    .trim()
    .toLowerCase();

  if (accion === 'productos') {
    return obtenerProductos();
  }

  if (accion === 'vercotizacion') {
    return obtenerCotizacion(p);
  }

  if (accion === 'login' || accion === 'guardarcotizacion') {
    return responderJSON({
      ok: false,
      mensaje: 'Actualiza la página (Ctrl + F5) para usar la nueva versión del sistema.'
    });
  }

  return responderJSON({
    ok: false,
    mensaje: 'API ZAREINA funcionando'
  });
}


// ======================================================
// POST  (login, guardar, salir)
// ======================================================

function doPost(e) {

  try {

    const datos = JSON.parse(
      (e && e.postData && e.postData.contents) || '{}'
    );

    const accion = String(datos.accion || '')
      .trim()
      .toLowerCase();

    if (accion === 'login') {
      return loginUsuario(datos.usuario, datos.clave);
    }

    if (accion === 'guardarcotizacion') {
      return guardarCotizacion(datos);
    }

    if (accion === 'logout') {
      return cerrarSesion(datos.token);
    }

    return responderJSON({
      ok: false,
      mensaje: 'Acción no válida.'
    });

  } catch (error) {

    return responderJSON({
      ok: false,
      mensaje: error.message
    });

  }
}


// ======================================================
// CONTRASEÑAS
// ======================================================

// Las claves se guardan como hash SHA-256 (64 caracteres).
// Si en la hoja hay una clave en texto plano (usuario nuevo
// o antiguo), se acepta una vez y se reemplaza por su hash
// automáticamente al iniciar sesión.

function hashClave(usuario, clave) {

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    'ZAREINA::' + String(usuario).trim().toLowerCase() + '::' + String(clave),
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');
}

function esHash(valor) {
  return /^[0-9a-f]{64}$/.test(String(valor));
}


// ======================================================
// LOGIN
// ======================================================

function loginUsuario(usuarioIn, claveIn) {

  const usuario = String(usuarioIn || '').trim();
  const clave = String(claveIn || '').trim();

  if (!usuario || !clave) {
    return responderJSON({
      ok: false,
      mensaje: 'Ingresa usuario y contraseña.'
    });
  }

  // Protección contra intentos repetidos
  const cache = CacheService.getScriptCache();
  const claveIntentos = 'INTENTOS_' + usuario.toLowerCase();
  const intentos = Number(cache.get(claveIntentos) || 0);

  if (intentos >= MAX_INTENTOS_LOGIN) {
    return responderJSON({
      ok: false,
      mensaje: 'Demasiados intentos. Espera 10 minutos e inténtalo de nuevo.'
    });
  }

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(NOMBRE_HOJA_USUARIOS);

  if (!hoja) {
    return responderJSON({
      ok: false,
      mensaje: 'No existe la hoja USUARIOS.'
    });
  }

  const ultimaFila = hoja.getLastRow();

  if (ultimaFila < 2) {
    return responderJSON({
      ok: false,
      mensaje: 'No existen usuarios registrados.'
    });
  }

  const datos = hoja
    .getRange(2, 1, ultimaFila - 1, 6)
    .getDisplayValues();

  let filaEncontrada = -1;

  const encontrado = datos.find((fila, i) => {

    const usuarioBD = String(fila[2]).trim().toLowerCase();
    const claveBD = String(fila[3]).trim();
    const estadoBD = String(fila[5]).trim().toUpperCase();

    if (usuarioBD !== usuario.toLowerCase() || estadoBD !== 'ACTIVO') {
      return false;
    }

    const coincide = esHash(claveBD)
      ? claveBD === hashClave(usuarioBD, clave)
      : claveBD === clave;

    if (coincide) {
      filaEncontrada = i + 2;
    }

    return coincide;
  });

  if (!encontrado) {

    cache.put(claveIntentos, String(intentos + 1), BLOQUEO_LOGIN);

    return responderJSON({
      ok: false,
      mensaje: 'Usuario o contraseña incorrectos.'
    });
  }

  cache.remove(claveIntentos);

  // Migración automática: texto plano -> hash
  if (!esHash(String(encontrado[3]).trim())) {
    hoja
      .getRange(filaEncontrada, 4)
      .setValue(hashClave(encontrado[2], clave));
  }

  const token = Utilities.getUuid();

  const datosSesion = {
    id: encontrado[0],
    nombre: encontrado[1],
    usuario: encontrado[2],
    rol: encontrado[4]
  };

  cache.put(
    'SESION_' + token,
    JSON.stringify(datosSesion),
    DURACION_SESION
  );

  return responderJSON({
    ok: true,
    usuario: Object.assign({}, datosSesion, { token: token })
  });
}


// ======================================================
// SESIÓN
// ======================================================

function validarSesion(token) {

  if (!token) {
    return null;
  }

  const sesion = CacheService
    .getScriptCache()
    .get('SESION_' + token);

  return sesion ? JSON.parse(sesion) : null;
}

function cerrarSesion(token) {

  if (token) {
    CacheService.getScriptCache().remove('SESION_' + token);
  }

  return responderJSON({ ok: true });
}

function respuestaSesionVencida() {
  return responderJSON({
    ok: false,
    sesionExpirada: true,
    mensaje: 'Tu sesión venció. Ingresa nuevamente.'
  });
}


// ======================================================
// PRODUCTOS
// ======================================================

function obtenerProductos() {

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(NOMBRE_HOJA_PRODUCTOS);

  if (!hoja) {
    return responderJSON({
      ok: false,
      mensaje: 'No existe la hoja PRODUCTOS.'
    });
  }

  const ultimaFila = hoja.getLastRow();

  if (ultimaFila < 2) {
    return responderJSON({ ok: true, productos: [] });
  }

  const datos = hoja
    .getRange(2, 1, ultimaFila - 1, 7)
    .getValues();

  const productos = datos
    .filter(fila =>
      Number(fila[5]) > 0 &&
      String(fila[6]).trim().toUpperCase() !== 'INACTIVO'
    )
    .map(fila => ({
      id: String(fila[0]).trim(),
      producto: String(fila[1]).trim(),
      color: String(fila[2]).trim(),
      talla: String(fila[3]).trim(),
      precio: Number(fila[4]),
      stock: Number(fila[5]),
      estado: String(fila[6]).trim()
    }));

  return responderJSON({ ok: true, productos: productos });
}


// ======================================================
// GUARDAR COTIZACIÓN
// ======================================================

function guardarCotizacion(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const cliente = String(datos.cliente || '').trim();

  const productos = Array.isArray(datos.productos)
    ? datos.productos
    : [];

  const descuento = Number(datos.descuento || 0) || 0;

  if (!cliente) {
    return responderJSON({
      ok: false,
      mensaje: 'Ingresa el nombre del cliente.'
    });
  }

  if (productos.length === 0) {
    return responderJSON({
      ok: false,
      mensaje: 'Agrega al menos un producto.'
    });
  }

  // Unir líneas repetidas del mismo producto (mismo id)
  const cantidadesPorId = {};

  productos.forEach(item => {

    const id = String(item.id || '').trim();
    const cantidad = Number(item.cantidad);

    if (!id) {
      throw new Error('Producto sin código.');
    }

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new Error('Cantidad inválida para ' + (item.producto || id));
    }

    cantidadesPorId[id] = (cantidadesPorId[id] || 0) + cantidad;
  });

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const hojaProductos = ss.getSheetByName(NOMBRE_HOJA_PRODUCTOS);
    const hojaCotizaciones = ss.getSheetByName(NOMBRE_HOJA_COTIZACIONES);
    const hojaDetalle = ss.getSheetByName(NOMBRE_HOJA_DETALLE);

    if (!hojaProductos || !hojaCotizaciones || !hojaDetalle) {
      throw new Error('Falta alguna hoja del sistema.');
    }

    const ultimaFilaProductos = hojaProductos.getLastRow();

    if (ultimaFilaProductos < 2) {
      throw new Error('No existen productos registrados.');
    }

    const productosBD = hojaProductos
      .getRange(2, 1, ultimaFilaProductos - 1, 7)
      .getValues();

    let subtotal = 0;
    const filasDetalle = [];
    const numeroCotizacion = generarNumeroCotizacion(hojaCotizaciones);

    Object.keys(cantidadesPorId).forEach(id => {

      const encontrado = productosBD.find(
        fila => String(fila[0]).trim() === id
      );

      if (!encontrado) {
        throw new Error('No se encontró el producto con código ' + id);
      }

      const cantidad = cantidadesPorId[id];
      const stockActual = Number(encontrado[5]);
      const precio = Number(encontrado[4]);

      if (cantidad > stockActual) {
        throw new Error(
          'Stock insuficiente para "' + encontrado[1] +
          '". Disponible: ' + stockActual
        );
      }

      subtotal += cantidad * precio;

      filasDetalle.push([
        numeroCotizacion,
        id,
        textoSeguro(encontrado[1]),
        textoSeguro(encontrado[3]),
        textoSeguro(encontrado[2]),
        cantidad,
        precio,
        cantidad * precio
      ]);
    });

    const descuentoAplicado = Math.min(Math.max(descuento, 0), subtotal);
    const total = subtotal - descuentoAplicado;

    // Encabezado de la nueva columna USUARIO (solo la primera vez)
    if (!hojaCotizaciones.getRange(1, 8).getValue()) {
      hojaCotizaciones.getRange(1, 8).setValue('USUARIO');
    }

    hojaCotizaciones.appendRow([
      numeroCotizacion,
      new Date(),
      textoSeguro(cliente),
      subtotal,
      descuentoAplicado,
      total,
      'COTIZADO',
      textoSeguro(sesion.nombre)
    ]);

    hojaDetalle
      .getRange(hojaDetalle.getLastRow() + 1, 1, filasDetalle.length, 8)
      .setValues(filasDetalle);

    return responderJSON({
      ok: true,
      cotizacion: {
        numero: numeroCotizacion,
        cliente: cliente,
        subtotal: subtotal,
        descuento: descuentoAplicado,
        total: total,
        usuario: sesion.nombre
      }
    });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// Evita que un texto que empiece con = + - @ se ejecute
// como fórmula dentro de Google Sheets.
function textoSeguro(valor) {
  const texto = String(valor == null ? '' : valor);
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}


// ======================================================
// CORRELATIVO
// ======================================================

function generarNumeroCotizacion(hoja) {

  const ultimaFila = hoja.getLastRow();

  if (ultimaFila < 2) {
    return 'COT-000001';
  }

  const valores = hoja
    .getRange(2, 1, ultimaFila - 1, 1)
    .getDisplayValues()
    .flat();

  let mayor = 0;

  valores.forEach(valor => {
    const coincidencia = String(valor).match(/^COT-(\d+)$/i);
    if (coincidencia) {
      mayor = Math.max(mayor, Number(coincidencia[1]));
    }
  });

  return 'COT-' + String(mayor + 1).padStart(6, '0');
}


// ======================================================
// VER COTIZACIÓN  (requiere sesión)
// ======================================================

function obtenerCotizacion(p) {

  if (!validarSesion(p.token)) {
    return respuestaSesionVencida();
  }

  const numero = String(p.numero || '').trim().toUpperCase();

  if (!numero) {
    return responderJSON({
      ok: false,
      mensaje: 'Falta el número de cotización.'
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaCotizaciones = ss.getSheetByName(NOMBRE_HOJA_COTIZACIONES);
  const hojaDetalle = ss.getSheetByName(NOMBRE_HOJA_DETALLE);

  if (!hojaCotizaciones || !hojaDetalle) {
    return responderJSON({
      ok: false,
      mensaje: 'No se encontraron las hojas de cotizaciones.'
    });
  }

  const ultimaFilaCot = hojaCotizaciones.getLastRow();

  if (ultimaFilaCot < 2) {
    return responderJSON({
      ok: false,
      mensaje: 'No existen cotizaciones registradas.'
    });
  }

  const cabecera = hojaCotizaciones
    .getRange(2, 1, ultimaFilaCot - 1, 8)
    .getValues()
    .find(fila => String(fila[0]).trim().toUpperCase() === numero);

  if (!cabecera) {
    return responderJSON({
      ok: false,
      mensaje: 'No se encontró la cotización ' + numero
    });
  }

  const ultimaFilaDetalle = hojaDetalle.getLastRow();
  let productos = [];

  if (ultimaFilaDetalle >= 2) {
    productos = hojaDetalle
      .getRange(2, 1, ultimaFilaDetalle - 1, 8)
      .getValues()
      .filter(fila => String(fila[0]).trim().toUpperCase() === numero)
      .map(fila => ({
        id: String(fila[1]),
        producto: String(fila[2]),
        talla: String(fila[3]),
        color: String(fila[4]),
        cantidad: Number(fila[5]),
        precio: Number(fila[6]),
        total: Number(fila[7])
      }));
  }

  return responderJSON({
    ok: true,
    cotizacion: {
      numero: String(cabecera[0]),
      fecha: Utilities.formatDate(
        new Date(cabecera[1]),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy'
      ),
      cliente: String(cabecera[2]),
      subtotal: Number(cabecera[3]),
      descuento: Number(cabecera[4]),
      total: Number(cabecera[5]),
      estado: String(cabecera[6]),
      usuario: String(cabecera[7] || ''),
      productos: productos
    }
  });
}


// ======================================================
// RESPUESTA JSON
// ======================================================

function responderJSON(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
