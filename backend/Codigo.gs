const NOMBRE_HOJA_USUARIOS = 'USUARIOS';
const NOMBRE_HOJA_PRODUCTOS = 'PRODUCTOS';
const NOMBRE_HOJA_COTIZACIONES = 'COTIZACIONES';
const NOMBRE_HOJA_DETALLE = 'DETALLE_COTIZACION';
const NOMBRE_HOJA_VENTAS = 'VENTAS';
const NOMBRE_HOJA_ANULACIONES = 'ANULACIONES';

const METODOS_PAGO = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

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

  if (accion === 'cotizaciones') {
    return listarCotizaciones(p);
  }

  if (accion === 'ventas') {
    return listarVentas(p);
  }

  if (accion === 'inventario') {
    return listarInventario(p);
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

    if (accion === 'registrarventa') {
      return registrarVenta(datos);
    }

    if (accion === 'anularcotizacion') {
      return anularCotizacion(datos);
    }

    if (accion === 'guardarproducto') {
      return guardarProducto(datos);
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
// HISTORIAL DE COTIZACIONES  (requiere sesión)
// ======================================================

function listarCotizaciones(p) {

  if (!validarSesion(p.token)) {
    return respuestaSesionVencida();
  }

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(NOMBRE_HOJA_COTIZACIONES);

  if (!hoja) {
    return responderJSON({
      ok: false,
      mensaje: 'No existe la hoja COTIZACIONES.'
    });
  }

  const ultimaFila = hoja.getLastRow();

  if (ultimaFila < 2) {
    return responderJSON({ ok: true, cotizaciones: [] });
  }

  const zona = Session.getScriptTimeZone();

  const cotizaciones = hoja
    .getRange(2, 1, ultimaFila - 1, Math.max(hoja.getLastColumn(), 8))
    .getValues()
    .filter(fila => String(fila[0]).trim())
    .map(fila => {

      const fecha = fila[1] instanceof Date ? fila[1] : new Date(fila[1]);
      const fechaValida = !isNaN(fecha.getTime());

      return {
        numero: String(fila[0]).trim(),
        fecha: fechaValida ? Utilities.formatDate(fecha, zona, 'dd/MM/yyyy') : String(fila[1]),
        fechaISO: fechaValida ? Utilities.formatDate(fecha, zona, 'yyyy-MM-dd') : '',
        cliente: String(fila[2]),
        subtotal: Number(fila[3]) || 0,
        descuento: Number(fila[4]) || 0,
        total: Number(fila[5]) || 0,
        estado: String(fila[6] || '').trim(),
        usuario: String(fila[7] || '').trim()
      };
    })
    .reverse(); // más recientes primero

  return responderJSON({ ok: true, cotizaciones: cotizaciones });
}


// ======================================================
// VENTAS
// ======================================================

// Convierte una cotización en venta: valida y descuenta
// el stock, marca la cotización como VENDIDO y registra
// la venta en la hoja VENTAS.

function registrarVenta(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const numero = String(datos.numero || '').trim().toUpperCase();
  const metodoPago = String(datos.metodoPago || '').trim().toUpperCase();

  if (!numero) {
    return responderJSON({ ok: false, mensaje: 'Falta el número de cotización.' });
  }

  if (METODOS_PAGO.indexOf(metodoPago) === -1) {
    return responderJSON({ ok: false, mensaje: 'Selecciona un método de pago válido.' });
  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaProductos = ss.getSheetByName(NOMBRE_HOJA_PRODUCTOS);
    const hojaCotizaciones = ss.getSheetByName(NOMBRE_HOJA_COTIZACIONES);
    const hojaDetalle = ss.getSheetByName(NOMBRE_HOJA_DETALLE);
    const hojaVentas = obtenerHojaVentas(ss);

    if (!hojaProductos || !hojaCotizaciones || !hojaDetalle) {
      throw new Error('Falta alguna hoja del sistema.');
    }

    // 1. Cotización
    const ultimaCot = hojaCotizaciones.getLastRow();

    if (ultimaCot < 2) {
      throw new Error('No existen cotizaciones registradas.');
    }

    const cotizaciones = hojaCotizaciones
      .getRange(2, 1, ultimaCot - 1, 8)
      .getValues();

    const indiceCot = cotizaciones.findIndex(
      fila => String(fila[0]).trim().toUpperCase() === numero
    );

    if (indiceCot === -1) {
      throw new Error('No se encontró la cotización ' + numero);
    }

    const cabecera = cotizaciones[indiceCot];
    const estadoActual = String(cabecera[6] || '').trim().toUpperCase();

    if (estadoActual === 'VENDIDO') {
      throw new Error('Esta cotización ya fue vendida.');
    }

    if (estadoActual === 'ANULADO') {
      throw new Error('Esta cotización está anulada.');
    }

    // 2. Detalle
    const ultimaDet = hojaDetalle.getLastRow();

    const detalle = ultimaDet < 2 ? [] : hojaDetalle
      .getRange(2, 1, ultimaDet - 1, 8)
      .getValues()
      .filter(fila => String(fila[0]).trim().toUpperCase() === numero);

    if (detalle.length === 0) {
      throw new Error('La cotización no tiene productos.');
    }

    const cantidadesPorId = {};

    detalle.forEach(fila => {
      const id = String(fila[1]).trim();
      cantidadesPorId[id] = (cantidadesPorId[id] || 0) + Number(fila[5] || 0);
    });

    // 3. Validar stock de TODO antes de descontar nada
    const ultimaProd = hojaProductos.getLastRow();

    const productosBD = hojaProductos
      .getRange(2, 1, ultimaProd - 1, 7)
      .getValues();

    const descuentos = Object.keys(cantidadesPorId).map(id => {

      const indice = productosBD.findIndex(fila => String(fila[0]).trim() === id);

      if (indice === -1) {
        throw new Error('El producto con código ' + id + ' ya no existe.');
      }

      const producto = productosBD[indice];
      const stockActual = Number(producto[5]) || 0;
      const cantidad = cantidadesPorId[id];

      if (cantidad > stockActual) {
        throw new Error(
          'Stock insuficiente para "' + producto[1] + ' ' + producto[3] + ' ' + producto[2] +
          '". Disponible: ' + stockActual + ', requerido: ' + cantidad
        );
      }

      return { fila: indice + 2, nuevoStock: stockActual - cantidad };
    });

    // 4. Descontar stock
    descuentos.forEach(d => {
      hojaProductos.getRange(d.fila, 6).setValue(d.nuevoStock);
    });

    // 5. Marcar cotización como vendida
    hojaCotizaciones.getRange(indiceCot + 2, 7).setValue('VENDIDO');

    // 6. Registrar la venta
    const numeroVenta = generarNumeroVenta(hojaVentas);
    const fecha = new Date();
    const total = Number(cabecera[5]) || 0;

    hojaVentas.appendRow([
      numeroVenta,
      fecha,
      numero,
      textoSeguro(cabecera[2]),
      total,
      metodoPago,
      textoSeguro(sesion.nombre),
      'VIGENTE'
    ]);

    SpreadsheetApp.flush();

    return responderJSON({
      ok: true,
      venta: {
        numero: numeroVenta,
        cotizacion: numero,
        cliente: String(cabecera[2]),
        total: total,
        metodoPago: metodoPago,
        fecha: Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy')
      }
    });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


function obtenerHojaVentas(ss) {

  let hoja = ss.getSheetByName(NOMBRE_HOJA_VENTAS);

  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA_VENTAS);
    hoja.appendRow(['NUMERO', 'FECHA', 'COTIZACION', 'CLIENTE', 'TOTAL', 'METODO_PAGO', 'USUARIO', 'ESTADO']);
    hoja.setFrozenRows(1);
  }

  return hoja;
}


function generarNumeroVenta(hoja) {

  const ultimaFila = hoja.getLastRow();

  if (ultimaFila < 2) {
    return 'VEN-000001';
  }

  let mayor = 0;

  hoja
    .getRange(2, 1, ultimaFila - 1, 1)
    .getDisplayValues()
    .flat()
    .forEach(valor => {
      const m = String(valor).match(/^VEN-(\d+)$/i);
      if (m) {
        mayor = Math.max(mayor, Number(m[1]));
      }
    });

  return 'VEN-' + String(mayor + 1).padStart(6, '0');
}


function listarVentas(p) {

  if (!validarSesion(p.token)) {
    return respuestaSesionVencida();
  }

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(NOMBRE_HOJA_VENTAS);

  if (!hoja || hoja.getLastRow() < 2) {
    return responderJSON({ ok: true, ventas: [] });
  }

  const zona = Session.getScriptTimeZone();

  const ventas = hoja
    .getRange(2, 1, hoja.getLastRow() - 1, 8)
    .getValues()
    .filter(fila => String(fila[0]).trim())
    .map(fila => {

      const fecha = fila[1] instanceof Date ? fila[1] : new Date(fila[1]);
      const valida = !isNaN(fecha.getTime());

      return {
        numero: String(fila[0]).trim(),
        fecha: valida ? Utilities.formatDate(fecha, zona, 'dd/MM/yyyy') : String(fila[1]),
        fechaISO: valida ? Utilities.formatDate(fecha, zona, 'yyyy-MM-dd') : '',
        cotizacion: String(fila[2]).trim(),
        cliente: String(fila[3]),
        total: Number(fila[4]) || 0,
        metodoPago: String(fila[5] || '').trim(),
        usuario: String(fila[6] || '').trim(),
        estado: String(fila[7] || '').trim().toUpperCase() || 'VIGENTE'
      };
    })
    .reverse();

  return responderJSON({ ok: true, ventas: ventas });
}


// ======================================================
// ANULAR COTIZACIÓN / VENTA
// ======================================================

// Si la cotización está vendida, devuelve el stock y marca
// la venta como ANULADA (solo administradora). Toda
// anulación queda registrada en la hoja ANULACIONES.

function anularCotizacion(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const numero = String(datos.numero || '').trim().toUpperCase();
  const motivo = String(datos.motivo || '').trim();

  if (!numero) {
    return responderJSON({ ok: false, mensaje: 'Falta el número de cotización.' });
  }

  if (motivo.length < 3) {
    return responderJSON({ ok: false, mensaje: 'Escribe el motivo de la anulación.' });
  }

  const esAdmin = String(sesion.rol || '').trim().toUpperCase() === 'ADMINISTRADOR';

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

    // 1. Cotización
    const ultimaCot = hojaCotizaciones.getLastRow();

    const cotizaciones = ultimaCot < 2 ? [] : hojaCotizaciones
      .getRange(2, 1, ultimaCot - 1, 8)
      .getValues();

    const indiceCot = cotizaciones.findIndex(
      fila => String(fila[0]).trim().toUpperCase() === numero
    );

    if (indiceCot === -1) {
      throw new Error('No se encontró la cotización ' + numero);
    }

    const estadoActual = String(cotizaciones[indiceCot][6] || '').trim().toUpperCase();

    if (estadoActual === 'ANULADO') {
      throw new Error('Esta cotización ya está anulada.');
    }

    const estabaVendida = estadoActual === 'VENDIDO';

    if (estabaVendida && !esAdmin) {
      throw new Error('Solo la administradora puede anular una venta.');
    }

    let numeroVenta = '';
    let filaVenta = -1;
    let devoluciones = [];
    let hojaVentas = null;

    if (estabaVendida) {

      // 2. Venta asociada
      hojaVentas = ss.getSheetByName(NOMBRE_HOJA_VENTAS);

      if (hojaVentas && hojaVentas.getLastRow() >= 2) {

        const ventas = hojaVentas
          .getRange(2, 1, hojaVentas.getLastRow() - 1, 8)
          .getValues();

        const indiceVenta = ventas.findIndex(fila =>
          String(fila[2]).trim().toUpperCase() === numero &&
          String(fila[7] || '').trim().toUpperCase() !== 'ANULADA'
        );

        if (indiceVenta !== -1) {
          numeroVenta = String(ventas[indiceVenta][0]).trim();
          filaVenta = indiceVenta + 2;
        }
      }

      // 3. Cantidades a devolver
      const ultimaDet = hojaDetalle.getLastRow();

      const detalle = ultimaDet < 2 ? [] : hojaDetalle
        .getRange(2, 1, ultimaDet - 1, 8)
        .getValues()
        .filter(fila => String(fila[0]).trim().toUpperCase() === numero);

      const cantidadesPorId = {};

      detalle.forEach(fila => {
        const id = String(fila[1]).trim();
        cantidadesPorId[id] = (cantidadesPorId[id] || 0) + Number(fila[5] || 0);
      });

      const productosBD = hojaProductos
        .getRange(2, 1, hojaProductos.getLastRow() - 1, 7)
        .getValues();

      // Validar todo antes de escribir
      devoluciones = Object.keys(cantidadesPorId).map(id => {

        const indice = productosBD.findIndex(fila => String(fila[0]).trim() === id);

        if (indice === -1) {
          throw new Error(
            'El producto con código ' + id +
            ' ya no existe en PRODUCTOS. Restáuralo antes de anular.'
          );
        }

        const producto = productosBD[indice];

        return {
          id: id,
          nombre: producto[1] + ' ' + producto[3] + ' ' + producto[2],
          cantidad: cantidadesPorId[id],
          fila: indice + 2,
          nuevoStock: (Number(producto[5]) || 0) + cantidadesPorId[id]
        };
      });

      // 4. Devolver stock
      devoluciones.forEach(d => {
        hojaProductos.getRange(d.fila, 6).setValue(d.nuevoStock);
      });

      // 5. Marcar la venta como anulada
      if (filaVenta !== -1) {
        if (!hojaVentas.getRange(1, 8).getValue()) {
          hojaVentas.getRange(1, 8).setValue('ESTADO');
        }
        hojaVentas.getRange(filaVenta, 8).setValue('ANULADA');
      }
    }

    // 6. Marcar la cotización como anulada
    hojaCotizaciones.getRange(indiceCot + 2, 7).setValue('ANULADO');

    // 7. Registro de la anulación
    const hojaAnulaciones = obtenerHojaAnulaciones(ss);

    hojaAnulaciones.appendRow([
      new Date(),
      numero,
      numeroVenta,
      textoSeguro(motivo),
      textoSeguro(sesion.nombre),
      devoluciones.map(d => d.cantidad + ' x ' + d.nombre).join(', ')
    ]);

    SpreadsheetApp.flush();

    return responderJSON({
      ok: true,
      anulacion: {
        cotizacion: numero,
        venta: numeroVenta,
        stockDevuelto: devoluciones.map(d => ({ producto: d.nombre, cantidad: d.cantidad }))
      }
    });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


function obtenerHojaAnulaciones(ss) {

  let hoja = ss.getSheetByName(NOMBRE_HOJA_ANULACIONES);

  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA_ANULACIONES);
    hoja.appendRow(['FECHA', 'COTIZACION', 'VENTA', 'MOTIVO', 'USUARIO', 'STOCK_DEVUELTO']);
    hoja.setFrozenRows(1);
  }

  return hoja;
}


// ======================================================
// INVENTARIO DE PRODUCTOS
// ======================================================

function listarInventario(p) {

  if (!validarSesion(p.token)) {
    return respuestaSesionVencida();
  }

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(NOMBRE_HOJA_PRODUCTOS);

  if (!hoja) {
    return responderJSON({ ok: false, mensaje: 'No existe la hoja PRODUCTOS.' });
  }

  if (hoja.getLastRow() < 2) {
    return responderJSON({ ok: true, productos: [] });
  }

  const productos = hoja
    .getRange(2, 1, hoja.getLastRow() - 1, 7)
    .getValues()
    .filter(fila => String(fila[0]).trim())
    .map(fila => ({
      id: String(fila[0]).trim(),
      producto: String(fila[1]).trim(),
      color: String(fila[2]).trim(),
      talla: String(fila[3]).trim(),
      precio: Number(fila[4]) || 0,
      stock: Number(fila[5]) || 0,
      estado: String(fila[6]).trim().toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO'
    }));

  return responderJSON({ ok: true, productos: productos });
}


// Crea o actualiza una variante de producto (solo administradora).

function guardarProducto(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (String(sesion.rol || '').trim().toUpperCase() !== 'ADMINISTRADOR') {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede modificar productos.' });
  }

  const id = String(datos.id || '').trim();
  const producto = String(datos.producto || '').trim();
  const color = String(datos.color || '').trim();
  const talla = String(datos.talla || '').trim();
  const precio = Number(datos.precio);
  const stock = Number(datos.stock);
  const estado = String(datos.estado || 'ACTIVO').trim().toUpperCase();

  if (!producto || !color || !talla) {
    return responderJSON({ ok: false, mensaje: 'Completa producto, color y talla.' });
  }

  if (!isFinite(precio) || precio < 0) {
    return responderJSON({ ok: false, mensaje: 'El precio no es válido.' });
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return responderJSON({ ok: false, mensaje: 'El stock debe ser un número entero de 0 o más.' });
  }

  if (estado !== 'ACTIVO' && estado !== 'INACTIVO') {
    return responderJSON({ ok: false, mensaje: 'Estado no válido.' });
  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const hoja = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(NOMBRE_HOJA_PRODUCTOS);

    if (!hoja) {
      throw new Error('No existe la hoja PRODUCTOS.');
    }

    const filas = hoja.getLastRow() < 2 ? [] : hoja
      .getRange(2, 1, hoja.getLastRow() - 1, 7)
      .getValues();

    const clave = (p, c, t) =>
      [p, c, t].map(x => String(x).trim().toLowerCase()).join('|');

    const claveNueva = clave(producto, color, talla);

    const duplicado = filas.findIndex(fila =>
      String(fila[0]).trim() !== id &&
      clave(fila[1], fila[2], fila[3]) === claveNueva
    );

    if (duplicado !== -1) {
      throw new Error(
        'Ya existe "' + producto + '" en talla ' + talla + ' y color ' + color +
        ' (código ' + String(filas[duplicado][0]).trim() + ').'
      );
    }

    const valores = [
      textoSeguro(producto),
      textoSeguro(color),
      textoSeguro(talla),
      precio,
      stock,
      estado
    ];

    let idFinal = id;

    if (id) {

      const indice = filas.findIndex(fila => String(fila[0]).trim() === id);

      if (indice === -1) {
        throw new Error('No se encontró el producto con código ' + id);
      }

      hoja.getRange(indice + 2, 2, 1, 6).setValues([valores]);

    } else {

      idFinal = generarIdProducto(filas.map(fila => String(fila[0]).trim()));
      hoja.appendRow([idFinal].concat(valores));
    }

    SpreadsheetApp.flush();

    return responderJSON({
      ok: true,
      producto: {
        id: idFinal,
        producto: producto,
        color: color,
        talla: talla,
        precio: precio,
        stock: stock,
        estado: estado
      },
      nuevo: !id
    });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// Sigue el formato de los códigos existentes (ej. P0012 -> P0013).

function generarIdProducto(ids) {

  const conteo = {};
  let mayor = 0;
  let ancho = 0;

  ids.forEach(id => {
    const m = id.match(/^(.*?)(\d+)$/);
    if (m) {
      conteo[m[1]] = (conteo[m[1]] || 0) + 1;
    }
  });

  const prefijo = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])[0];

  if (prefijo === undefined) {
    return 'PROD-' + String(ids.length + 1).padStart(4, '0');
  }

  ids.forEach(id => {
    const m = id.match(/^(.*?)(\d+)$/);
    if (m && m[1] === prefijo) {
      mayor = Math.max(mayor, Number(m[2]));
      ancho = Math.max(ancho, m[2].length);
    }
  });

  let nuevo;

  do {
    mayor += 1;
    nuevo = prefijo + String(mayor).padStart(ancho, '0');
  } while (ids.indexOf(nuevo) !== -1);

  return nuevo;
}


// ======================================================
// RESPUESTA JSON
// ======================================================

function responderJSON(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
