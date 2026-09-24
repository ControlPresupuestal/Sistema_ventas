const NOMBRE_HOJA_USUARIOS = 'USUARIOS';
const NOMBRE_HOJA_PRODUCTOS = 'PRODUCTOS';
const NOMBRE_HOJA_COTIZACIONES = 'COTIZACIONES';
const NOMBRE_HOJA_DETALLE = 'DETALLE_COTIZACION';
const NOMBRE_HOJA_VENTAS = 'VENTAS';
const NOMBRE_HOJA_ANULACIONES = 'ANULACIONES';
const NOMBRE_HOJA_CLIENTES = 'CLIENTES';
const NOMBRE_HOJA_CONFIGURACION = 'CONFIGURACION';

const NOMBRE_HOJA_SEPARADOS = 'SEPARADOS';
const NOMBRE_HOJA_PAGOS_SEPARADO = 'PAGOS_SEPARADO';
const NOMBRE_HOJA_CAMBIOS = 'CAMBIOS';
const NOMBRE_HOJA_DETALLE_CAMBIO = 'DETALLE_CAMBIO';
const NOMBRE_HOJA_INGRESOS = 'INGRESOS';
const NOMBRE_HOJA_DETALLE_INGRESO = 'DETALLE_INGRESO';
const NOMBRE_HOJA_CAJA = 'CAJA';

// Nombre que se usa en la venta rápida cuando no se escribe cliente
const CLIENTE_MOSTRADOR = 'Cliente de mostrador';

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

  if (accion === 'clientes') {
    return listarClientes(p);
  }

  if (accion === 'reportes') {
    return obtenerReportes(p);
  }

  if (accion === 'usuarios') {
    return listarUsuarios(p);
  }

  if (accion === 'configuracion') {
    return verConfiguracion(p);
  }

  if (accion === 'resumendia') {
    return resumenDelDia(p);
  }

  if (accion === 'separados') {
    return listarSeparados(p);
  }

  if (accion === 'ingresos') {
    return listarIngresos(p);
  }

  if (accion === 'caja') {
    return verCaja(p);
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

    if (accion === 'ventadirecta') {
      return ventaDirecta(datos);
    }

    if (accion === 'crearseparado') {
      return crearSeparado(datos);
    }

    if (accion === 'pagarseparado') {
      return pagarSeparado(datos);
    }

    if (accion === 'cancelarseparado') {
      return cancelarSeparado(datos);
    }

    if (accion === 'registrarcambio') {
      return registrarCambio(datos);
    }

    if (accion === 'registraringreso') {
      return registrarIngreso(datos);
    }

    if (accion === 'cerrarcaja') {
      return cerrarCaja(datos);
    }

    if (accion === 'anularcotizacion') {
      return anularCotizacion(datos);
    }

    if (accion === 'guardarproducto') {
      return guardarProducto(datos);
    }

    if (accion === 'guardarcliente') {
      return guardarCliente(datos);
    }

    if (accion === 'guardarusuario') {
      return guardarUsuario(datos);
    }

    if (accion === 'guardarconfiguracion') {
      return guardarConfiguracion(datos);
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
    rol: encontrado[4],
    creada: Date.now()
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

  const cache = CacheService.getScriptCache();
  const sesion = cache.get('SESION_' + token);

  if (!sesion) {
    return null;
  }

  const datos = JSON.parse(sesion);

  // Sesiones cerradas por la administradora (usuario desactivado,
  // contraseña o rol cambiados)
  const revocado = Number(cache.get('REVOCADO_' + String(datos.usuario || '').trim().toLowerCase()) || 0);

  if (revocado && (!datos.creada || datos.creada <= revocado)) {
    cache.remove('SESION_' + token);
    return null;
  }

  return datos;
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

    if (normalizarTexto(cliente) !== normalizarTexto(CLIENTE_MOSTRADOR)) {
      registrarClienteSiNoExiste(ss, cliente);
    }

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
    },
    clienteTelefono: telefonoDeCliente(ss, cabecera[2]),
    separado: separadoDeCotizacion(ss, numero),
    cambios: cambiosDeCotizacion(ss, numero),
    articulosCliente: String(cabecera[6]).trim().toUpperCase() === 'VENDIDO'
      ? articulosEnPoderDelCliente(ss, numero, productos)
      : [],
    configuracion: leerConfiguracion()
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

function registrarVenta(datos, interno) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const numero = String(datos.numero || '').trim().toUpperCase();
  const metodoPago = String(datos.metodoPago || '').trim().toUpperCase();

  if (!numero) {
    return responderJSON({ ok: false, mensaje: 'Falta el número de cotización.' });
  }

  // Al completar un separado el dinero ya entró en cada pago: la venta queda como "SEPARADO"
  const desdeSeparado = interno === true && metodoPago === 'SEPARADO';

  if (!desdeSeparado) {

    if (METODOS_PAGO.indexOf(metodoPago) === -1) {
      return responderJSON({ ok: false, mensaje: 'Selecciona un método de pago válido.' });
    }

    if (leerConfiguracion().metodosActivos.indexOf(metodoPago) === -1) {
      return responderJSON({ ok: false, mensaje: 'Ese método de pago está desactivado en Configuración.' });
    }
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

    if (estadoActual === 'SEPARADO' && !desdeSeparado) {
      throw new Error('Esta cotización está separada. Regístrale los pagos desde Separados.');
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
      .getRange(2, 1, ultimaProd - 1, 8)
      .getValues();

    // Costo de lo vendido (para calcular la ganancia). Vacío si falta el costo de algún producto.
    let costoVenta = 0;
    let costoCompleto = true;

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

      const costo = producto[7];

      if (costo === '' || costo === null || isNaN(Number(costo))) {
        costoCompleto = false;
      } else {
        costoVenta += Number(costo) * cantidad;
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
      'VIGENTE',
      costoCompleto ? Math.round(costoVenta * 100) / 100 : ''
    ]);

    if (!hojaVentas.getRange(1, 9).getValue()) {
      hojaVentas.getRange(1, 9).setValue('COSTO');
    }

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

    if (estadoActual === 'SEPARADO') {
      throw new Error('Esta cotización está separada. Cancélala desde Separados.');
    }

    const estabaVendida = estadoActual === 'VENDIDO';

    if (estabaVendida && leerHoja(ss, NOMBRE_HOJA_CAMBIOS, 4).some(f => String(f[3]).trim().toUpperCase() === numero)) {
      throw new Error('Esta venta tiene cambios registrados y ya no se puede anular.');
    }

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

  const sesion = validarSesion(p.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const verCosto = esAdministradora(sesion);

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(NOMBRE_HOJA_PRODUCTOS);

  if (!hoja) {
    return responderJSON({ ok: false, mensaje: 'No existe la hoja PRODUCTOS.' });
  }

  if (hoja.getLastRow() < 2) {
    return responderJSON({ ok: true, productos: [], stockBajo: leerConfiguracion().stockBajo });
  }

  const productos = hoja
    .getRange(2, 1, hoja.getLastRow() - 1, 8)
    .getValues()
    .filter(fila => String(fila[0]).trim())
    .map(fila => ({
      id: String(fila[0]).trim(),
      producto: String(fila[1]).trim(),
      color: String(fila[2]).trim(),
      talla: String(fila[3]).trim(),
      precio: Number(fila[4]) || 0,
      stock: Number(fila[5]) || 0,
      estado: String(fila[6]).trim().toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
      costo: verCosto && fila[7] !== '' && !isNaN(Number(fila[7])) ? Number(fila[7]) : null
    }));

  return responderJSON({ ok: true, productos: productos, stockBajo: leerConfiguracion().stockBajo });
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
// UTILIDADES COMUNES
// ======================================================

function esAdministradora(sesion) {
  return String((sesion && sesion.rol) || '').trim().toUpperCase() === 'ADMINISTRADOR';
}

function normalizarTexto(texto) {
  return String(texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function fechaISO(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return isNaN(fecha.getTime())
    ? ''
    : Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function leerHoja(ss, nombre, columnas) {
  const hoja = ss.getSheetByName(nombre);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, columnas).getValues();
}


// ======================================================
// CLIENTES
// ======================================================

function obtenerHojaClientes(ss) {

  let hoja = ss.getSheetByName(NOMBRE_HOJA_CLIENTES);

  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA_CLIENTES);
    hoja.appendRow(['ID', 'NOMBRE', 'TELEFONO', 'DOCUMENTO', 'EMAIL', 'NOTAS', 'FECHA_REGISTRO']);
    hoja.setFrozenRows(1);
  }

  return hoja;
}


function siguienteIdCliente(hoja) {

  let mayor = 0;

  if (hoja.getLastRow() >= 2) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getDisplayValues().flat().forEach(v => {
      const m = String(v).match(/^CLI-(\d+)$/i);
      if (m) mayor = Math.max(mayor, Number(m[1]));
    });
  }

  return 'CLI-' + String(mayor + 1).padStart(5, '0');
}


// Se llama al guardar una cotización: si el cliente no existe, se crea solo con su nombre.
function registrarClienteSiNoExiste(ss, nombre) {

  try {

    const hoja = obtenerHojaClientes(ss);
    const clave = normalizarTexto(nombre);

    if (!clave) return;

    const existe = hoja.getLastRow() >= 2 && hoja
      .getRange(2, 2, hoja.getLastRow() - 1, 1)
      .getValues()
      .some(fila => normalizarTexto(fila[0]) === clave);

    if (!existe) {
      hoja.appendRow([siguienteIdCliente(hoja), textoSeguro(nombre), '', '', '', '', new Date()]);
    }

  } catch (error) {
    // Nunca debe impedir que se guarde la cotización.
    console.error(error);
  }
}


function listarClientes(p) {

  if (!validarSesion(p.token)) {
    return respuestaSesionVencida();
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerHojaClientes(ss);

  // Estadísticas por nombre de cliente
  const estadisticas = {};

  const stats = clave => estadisticas[clave] || (estadisticas[clave] = {
    cotizaciones: 0, compras: 0, total: 0, ultimaCompra: ''
  });

  leerHoja(ss, NOMBRE_HOJA_COTIZACIONES, 7).forEach(fila => {
    if (String(fila[0]).trim()) stats(normalizarTexto(fila[2])).cotizaciones += 1;
  });

  leerHoja(ss, NOMBRE_HOJA_VENTAS, 8).forEach(fila => {
    if (!String(fila[0]).trim()) return;
    if (String(fila[7] || '').trim().toUpperCase() === 'ANULADA') return;
    const e = stats(normalizarTexto(fila[3]));
    e.compras += 1;
    e.total += Number(fila[4]) || 0;
    const f = fechaISO(fila[1]);
    if (f > e.ultimaCompra) e.ultimaCompra = f;
  });

  const clientes = leerHoja(ss, NOMBRE_HOJA_CLIENTES, 7)
    .filter(fila => String(fila[0]).trim())
    .map(fila => {
      const e = estadisticas[normalizarTexto(fila[1])] || {};
      return {
        id: String(fila[0]).trim(),
        nombre: String(fila[1]).trim(),
        telefono: String(fila[2]).trim(),
        documento: String(fila[3]).trim(),
        email: String(fila[4]).trim(),
        notas: String(fila[5]).trim(),
        registro: fechaISO(fila[6]),
        cotizaciones: e.cotizaciones || 0,
        compras: e.compras || 0,
        total: Math.round((e.total || 0) * 100) / 100,
        ultimaCompra: e.ultimaCompra || ''
      };
    });

  return responderJSON({ ok: true, clientes: clientes });
}


function guardarCliente(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const id = String(datos.id || '').trim();
  const nombre = String(datos.nombre || '').trim().replace(/\s+/g, ' ');
  const telefono = String(datos.telefono || '').trim();
  const documento = String(datos.documento || '').trim();
  const email = String(datos.email || '').trim();
  const notas = String(datos.notas || '').trim().slice(0, 300);

  if (nombre.length < 2) {
    return responderJSON({ ok: false, mensaje: 'Escribe el nombre del cliente.' });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return responderJSON({ ok: false, mensaje: 'El correo no es válido.' });
  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = obtenerHojaClientes(ss);
    const filas = leerHoja(ss, NOMBRE_HOJA_CLIENTES, 7);

    const repetido = filas.find(fila =>
      String(fila[0]).trim() !== id &&
      normalizarTexto(fila[1]) === normalizarTexto(nombre)
    );

    if (repetido) {
      throw new Error('Ya existe un cliente llamado "' + String(repetido[1]).trim() + '".');
    }

    const telefonoLimpio = telefono.replace(/\D/g, '');

    if (telefonoLimpio) {
      const mismoTelefono = filas.find(fila =>
        String(fila[0]).trim() !== id &&
        String(fila[2]).replace(/\D/g, '') === telefonoLimpio
      );
      if (mismoTelefono) {
        throw new Error('Ese teléfono ya es de "' + String(mismoTelefono[1]).trim() + '".');
      }
    }

    const valores = [textoSeguro(nombre), textoSeguro(telefono), textoSeguro(documento), textoSeguro(email), textoSeguro(notas)];

    let idFinal = id;

    if (id) {

      const indice = filas.findIndex(fila => String(fila[0]).trim() === id);

      if (indice === -1) {
        throw new Error('No se encontró el cliente ' + id);
      }

      hoja.getRange(indice + 2, 2, 1, 5).setValues([valores]);

    } else {

      idFinal = siguienteIdCliente(hoja);
      hoja.appendRow([idFinal].concat(valores, [new Date()]));
    }

    SpreadsheetApp.flush();

    return responderJSON({
      ok: true,
      cliente: { id: idFinal, nombre: nombre, telefono: telefono, documento: documento, email: email, notas: notas },
      nuevo: !id
    });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// ======================================================
// REPORTES (solo administradora)
// ======================================================

function obtenerReportes(p) {

  const sesion = validarSesion(p.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede ver los reportes.' });
  }

  const desde = String(p.desde || '').trim();
  const hasta = String(p.hasta || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || desde > hasta) {
    return responderJSON({ ok: false, mensaje: 'Rango de fechas no válido.' });
  }

  const enRango = f => f && f >= desde && f <= hasta;

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ventasVigentes = [];
  let anuladas = 0;

  leerHoja(ss, NOMBRE_HOJA_VENTAS, 9).forEach(fila => {
    if (!String(fila[0]).trim()) return;
    const f = fechaISO(fila[1]);
    if (!enRango(f)) return;
    if (String(fila[7] || '').trim().toUpperCase() === 'ANULADA') { anuladas += 1; return; }
    ventasVigentes.push({
      fecha: f,
      cotizacion: String(fila[2]).trim().toUpperCase(),
      total: Number(fila[4]) || 0,
      metodo: String(fila[5] || '').trim() || 'SIN DATO',
      vendedora: String(fila[6] || '').trim() || 'Sin registrar',
      costo: fila[8] === '' || fila[8] === null || isNaN(Number(fila[8])) ? null : Number(fila[8])
    });
  });

  let cotizacionesRango = 0;

  leerHoja(ss, NOMBRE_HOJA_COTIZACIONES, 7).forEach(fila => {
    if (String(fila[0]).trim() && enRango(fechaISO(fila[1]))) cotizacionesRango += 1;
  });

  const agrupar = (lista, campo) => {
    const mapa = {};
    lista.forEach(v => {
      const k = v[campo];
      mapa[k] = mapa[k] || { nombre: k, ventas: 0, total: 0 };
      mapa[k].ventas += 1;
      mapa[k].total += v.total;
    });
    return Object.keys(mapa).map(k => mapa[k]).sort((a, b) => b.total - a.total);
  };

  // Ventas por día (todos los días del rango, incluidos los que no tienen ventas)
  const porDiaMapa = {};
  ventasVigentes.forEach(v => {
    porDiaMapa[v.fecha] = porDiaMapa[v.fecha] || { ventas: 0, total: 0 };
    porDiaMapa[v.fecha].ventas += 1;
    porDiaMapa[v.fecha].total += v.total;
  });

  const porDia = [];
  const inicio = new Date(desde + 'T12:00:00');
  const fin = new Date(hasta + 'T12:00:00');

  for (let d = new Date(inicio); d <= fin && porDia.length < 400; d.setDate(d.getDate() + 1)) {
    const clave = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const x = porDiaMapa[clave] || { ventas: 0, total: 0 };
    porDia.push({ fecha: clave, ventas: x.ventas, total: Math.round(x.total * 100) / 100 });
  }

  // Productos más vendidos
  const cotizacionesVendidas = {};
  ventasVigentes.forEach(v => { cotizacionesVendidas[v.cotizacion] = true; });

  const productosMapa = {};

  leerHoja(ss, NOMBRE_HOJA_DETALLE, 8).forEach(fila => {
    if (!cotizacionesVendidas[String(fila[0]).trim().toUpperCase()]) return;
    const nombre = String(fila[2]).trim();
    productosMapa[nombre] = productosMapa[nombre] || { nombre: nombre, unidades: 0, total: 0 };
    productosMapa[nombre].unidades += Number(fila[5]) || 0;
    productosMapa[nombre].total += Number(fila[7]) || 0;
  });

  const productos = Object.keys(productosMapa)
    .map(k => productosMapa[k])
    .sort((a, b) => b.unidades - a.unidades || b.total - a.total)
    .slice(0, 10);

  const totalVendido = ventasVigentes.reduce((s, v) => s + v.total, 0);
  const redondear = lista => lista.map(x => Object.assign({}, x, { total: Math.round(x.total * 100) / 100 }));

  return responderJSON({
    ok: true,
    reporte: {
      desde: desde,
      hasta: hasta,
      totalVendido: Math.round(totalVendido * 100) / 100,
      ventas: ventasVigentes.length,
      ticketPromedio: ventasVigentes.length ? Math.round(totalVendido / ventasVigentes.length * 100) / 100 : 0,
      cotizaciones: cotizacionesRango,
      anuladas: anuladas,
      ganancia: Math.round(ventasVigentes.filter(v => v.costo !== null).reduce((s, v) => s + v.total - v.costo, 0) * 100) / 100,
      ventasConCosto: ventasVigentes.filter(v => v.costo !== null).length,
      porDia: porDia,
      porMetodo: redondear(agrupar(ventasVigentes, 'metodo')),
      porVendedora: redondear(agrupar(ventasVigentes, 'vendedora')),
      productos: redondear(productos)
    }
  });
}


// ======================================================
// USUARIOS (solo administradora)
// ======================================================

function listarUsuarios(p) {

  const sesion = validarSesion(p.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede ver los usuarios.' });
  }

  const usuarios = leerHoja(SpreadsheetApp.getActiveSpreadsheet(), NOMBRE_HOJA_USUARIOS, 6)
    .filter(fila => String(fila[2]).trim())
    .map(fila => ({
      id: String(fila[0]).trim(),
      nombre: String(fila[1]).trim(),
      usuario: String(fila[2]).trim(),
      rol: String(fila[4]).trim().toUpperCase(),
      estado: String(fila[5]).trim().toUpperCase() === 'ACTIVO' ? 'ACTIVO' : 'INACTIVO',
      claveCifrada: esHash(String(fila[3]).trim())
    }));

  return responderJSON({ ok: true, usuarios: usuarios, yo: String(sesion.usuario || '').trim().toLowerCase() });
}


function guardarUsuario(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede modificar usuarios.' });
  }

  const id = String(datos.id || '').trim();
  const nombre = String(datos.nombre || '').trim().replace(/\s+/g, ' ');
  const usuario = String(datos.usuario || '').trim().toLowerCase();
  const clave = String(datos.clave || '').trim();
  const rol = String(datos.rol || '').trim().toUpperCase();
  const estado = String(datos.estado || 'ACTIVO').trim().toUpperCase();

  if (nombre.length < 2) {
    return responderJSON({ ok: false, mensaje: 'Escribe el nombre.' });
  }

  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
    return responderJSON({ ok: false, mensaje: 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion.' });
  }

  if (!/^[A-ZÁÉÍÓÚÑ ]{3,30}$/.test(rol)) {
    return responderJSON({ ok: false, mensaje: 'Rol no válido.' });
  }

  if (estado !== 'ACTIVO' && estado !== 'INACTIVO') {
    return responderJSON({ ok: false, mensaje: 'Estado no válido.' });
  }

  if (clave && clave.length < 6) {
    return responderJSON({ ok: false, mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = ss.getSheetByName(NOMBRE_HOJA_USUARIOS);

    if (!hoja) {
      throw new Error('No existe la hoja USUARIOS.');
    }

    const filas = leerHoja(ss, NOMBRE_HOJA_USUARIOS, 6);

    const repetido = filas.find(fila =>
      String(fila[0]).trim() !== id &&
      String(fila[2]).trim().toLowerCase() === usuario
    );

    if (repetido) {
      throw new Error('El usuario "' + usuario + '" ya existe.');
    }

    const esAdminActiva = fila =>
      String(fila[4]).trim().toUpperCase() === 'ADMINISTRADOR' &&
      String(fila[5]).trim().toUpperCase() === 'ACTIVO';

    if (id) {

      const indice = filas.findIndex(fila => String(fila[0]).trim() === id);

      if (indice === -1) {
        throw new Error('No se encontró el usuario.');
      }

      const actual = filas[indice];
      const usuarioAnterior = String(actual[2]).trim().toLowerCase();
      const claveActual = String(actual[3]).trim();

      // No quedarse sin administradora activa
      const quedaAdmin = rol === 'ADMINISTRADOR' && estado === 'ACTIVO';
      const otrasAdmins = filas.filter((fila, i) => i !== indice && esAdminActiva(fila)).length;

      if (esAdminActiva(actual) && !quedaAdmin && otrasAdmins === 0) {
        throw new Error('Debe quedar al menos una administradora activa.');
      }

      if (usuarioAnterior === String(sesion.usuario || '').trim().toLowerCase() && !quedaAdmin) {
        throw new Error('No puedes quitarte tu propio acceso de administradora.');
      }

      let claveFinal = claveActual;

      if (clave) {
        claveFinal = hashClave(usuario, clave);
      } else if (usuario !== usuarioAnterior) {
        if (esHash(claveActual)) {
          throw new Error('Al cambiar el nombre de usuario debes asignar una nueva contraseña.');
        }
        claveFinal = claveActual; // texto plano: se cifrará en su próximo ingreso
      }

      hoja.getRange(indice + 2, 2, 1, 5).setValues([[
        textoSeguro(nombre), usuario, claveFinal, rol, estado
      ]]);

      const cambioAcceso =
        clave ||
        usuario !== usuarioAnterior ||
        rol !== String(actual[4]).trim().toUpperCase() ||
        estado !== 'ACTIVO';

      if (cambioAcceso && usuarioAnterior !== String(sesion.usuario || '').trim().toLowerCase()) {
        CacheService.getScriptCache().put('REVOCADO_' + usuarioAnterior, String(Date.now()), DURACION_SESION);
      }

    } else {

      if (!clave) {
        throw new Error('Asigna una contraseña al nuevo usuario.');
      }

      let mayor = 0;
      filas.forEach(fila => {
        const n = Number(String(fila[0]).replace(/\D/g, ''));
        if (!isNaN(n)) mayor = Math.max(mayor, n);
      });

      hoja.appendRow([mayor + 1, textoSeguro(nombre), usuario, hashClave(usuario, clave), rol, estado]);
    }

    SpreadsheetApp.flush();

    return responderJSON({ ok: true });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// ======================================================
// CONFIGURACIÓN
// ======================================================

const CONFIG_DEFECTO = {
  tiendaNombre: 'ZAREINA',
  tiendaEslogan: 'Moda que eleva tu esencia',
  tiendaRuc: '',
  tiendaDireccion: '',
  tiendaTelefono: '',
  tiendaInstagram: '',
  tiendaEmail: '',
  mensajeTitulo: 'Gracias por elegir ZAREINA',
  mensajeTexto: 'Esperamos que encuentres algo que eleve tu esencia.',
  validezDias: 0,
  condiciones: '',
  metodosActivos: METODOS_PAGO.slice(),
  yapeNumero: '',
  plinNumero: '',
  cuentaBancaria: '',
  stockBajo: 2
};

// Máximo de caracteres por campo de texto
const CONFIG_LARGOS = {
  tiendaNombre: 40, tiendaEslogan: 80, tiendaRuc: 11, tiendaDireccion: 120,
  tiendaTelefono: 20, tiendaInstagram: 40, tiendaEmail: 80,
  mensajeTitulo: 80, mensajeTexto: 200, condiciones: 600,
  yapeNumero: 20, plinNumero: 20, cuentaBancaria: 200
};

const CONFIG_NOMBRES = {
  tiendaNombre: 'Nombre de la tienda', tiendaEslogan: 'Eslogan', tiendaRuc: 'RUC',
  tiendaDireccion: 'Dirección', tiendaTelefono: 'Teléfono', tiendaInstagram: 'Instagram',
  tiendaEmail: 'Correo', mensajeTitulo: 'Título del mensaje', mensajeTexto: 'Mensaje',
  condiciones: 'Condiciones', yapeNumero: 'Número de Yape', plinNumero: 'Número de Plin',
  cuentaBancaria: 'Cuenta bancaria'
};


function obtenerHojaConfiguracion(ss) {

  let hoja = ss.getSheetByName(NOMBRE_HOJA_CONFIGURACION);

  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA_CONFIGURACION);
    hoja.appendRow(['CLAVE', 'VALOR']);
    hoja.setFrozenRows(1);
  }

  return hoja;
}


function leerConfiguracion() {

  const cache = CacheService.getScriptCache();
  const guardada = cache.get('CONFIGURACION');

  if (guardada) {
    return JSON.parse(guardada);
  }

  const config = JSON.parse(JSON.stringify(CONFIG_DEFECTO));

  try {

    leerHoja(SpreadsheetApp.getActiveSpreadsheet(), NOMBRE_HOJA_CONFIGURACION, 2).forEach(fila => {

      const clave = String(fila[0]).trim();
      const valor = String(fila[1] == null ? '' : fila[1]);

      if (!Object.prototype.hasOwnProperty.call(CONFIG_DEFECTO, clave)) return;

      if (clave === 'metodosActivos') {
        config.metodosActivos = valor.split(',')
          .map(m => m.trim().toUpperCase())
          .filter(m => METODOS_PAGO.indexOf(m) !== -1);
      } else if (clave === 'validezDias' || clave === 'stockBajo') {
        const n = Number(valor);
        if (valor !== '' && Number.isInteger(n) && n >= 0) config[clave] = n;
      } else {
        config[clave] = valor.replace(/^'/, '');
      }
    });

  } catch (error) {
    console.error(error);
  }

  if (!config.metodosActivos.length) {
    config.metodosActivos = METODOS_PAGO.slice();
  }

  cache.put('CONFIGURACION', JSON.stringify(config), 600);

  return config;
}


function verConfiguracion(p) {

  if (!validarSesion(p.token)) {
    return respuestaSesionVencida();
  }

  return responderJSON({ ok: true, configuracion: leerConfiguracion(), metodos: METODOS_PAGO });
}


function guardarConfiguracion(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede cambiar la configuración.' });
  }

  const entrada = datos.configuracion || {};
  const config = {};

  try {

    Object.keys(CONFIG_LARGOS).forEach(clave => {
      const texto = String(entrada[clave] == null ? '' : entrada[clave]).trim();
      if (texto.length > CONFIG_LARGOS[clave]) {
        throw new Error(CONFIG_NOMBRES[clave] + ': máximo ' + CONFIG_LARGOS[clave] + ' caracteres.');
      }
      config[clave] = texto;
    });

    if (!config.tiendaNombre) {
      throw new Error('Escribe el nombre de la tienda.');
    }

    if (config.tiendaRuc && !/^\d{11}$/.test(config.tiendaRuc)) {
      throw new Error('El RUC debe tener 11 números.');
    }

    if (config.tiendaEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.tiendaEmail)) {
      throw new Error('El correo de la tienda no es válido.');
    }

    const validez = Number(entrada.validezDias);
    if (entrada.validezDias === '' || !Number.isInteger(validez) || validez < 0 || validez > 365) {
      throw new Error('Los días de validez deben ser un número entre 0 y 365.');
    }
    config.validezDias = validez;

    const stockBajo = Number(entrada.stockBajo);
    if (entrada.stockBajo === '' || !Number.isInteger(stockBajo) || stockBajo < 0 || stockBajo > 1000) {
      throw new Error('La alerta de stock bajo debe ser un número entre 0 y 1000.');
    }
    config.stockBajo = stockBajo;

    const metodos = (Array.isArray(entrada.metodosActivos) ? entrada.metodosActivos : [])
      .map(m => String(m).trim().toUpperCase())
      .filter((m, i, lista) => METODOS_PAGO.indexOf(m) !== -1 && lista.indexOf(m) === i);

    if (!metodos.length) {
      throw new Error('Deja activo al menos un método de pago.');
    }
    config.metodosActivos = metodos;

  } catch (error) {
    return responderJSON({ ok: false, mensaje: error.message });
  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const hoja = obtenerHojaConfiguracion(SpreadsheetApp.getActiveSpreadsheet());

    const filas = Object.keys(CONFIG_DEFECTO).map(clave => [
      clave,
      clave === 'metodosActivos' ? config.metodosActivos.join(',') : textoSeguro(config[clave])
    ]);

    if (hoja.getLastRow() > 1) {
      hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).clearContent();
    }

    // Como texto, para que el Sheet no convierta el RUC o los teléfonos en números
    hoja.getRange(2, 1, filas.length, 2).setNumberFormat('@').setValues(filas);

    SpreadsheetApp.flush();

    CacheService.getScriptCache().remove('CONFIGURACION');

    return responderJSON({ ok: true, configuracion: leerConfiguracion() });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// ======================================================
// VENTA RÁPIDA (cotización + venta en un solo paso)
// ======================================================

function leerRespuesta(salida) {
  return typeof salida.getContent === 'function' ? JSON.parse(salida.getContent()) : salida;
}


function ventaDirecta(datos) {

  if (!validarSesion(datos.token)) {
    return respuestaSesionVencida();
  }

  const metodoPago = String(datos.metodoPago || '').trim().toUpperCase();

  // Se valida antes de guardar nada
  if (METODOS_PAGO.indexOf(metodoPago) === -1 || leerConfiguracion().metodosActivos.indexOf(metodoPago) === -1) {
    return responderJSON({ ok: false, mensaje: 'Selecciona un método de pago activo.' });
  }

  const cotizacion = leerRespuesta(guardarCotizacion(Object.assign({}, datos, {
    cliente: String(datos.cliente || '').trim() || CLIENTE_MOSTRADOR
  })));

  if (!cotizacion.ok) {
    return responderJSON(cotizacion);
  }

  const numero = cotizacion.cotizacion.numero;

  const venta = leerRespuesta(registrarVenta({
    token: datos.token,
    numero: numero,
    metodoPago: metodoPago
  }));

  if (!venta.ok) {
    return responderJSON({
      ok: false,
      cotizacionGuardada: numero,
      mensaje: 'Se guardó la cotización ' + numero + ', pero no se pudo registrar la venta: ' + venta.mensaje
    });
  }

  return responderJSON({ ok: true, cotizacion: cotizacion.cotizacion, venta: venta.venta });
}


// Teléfono del cliente guardado en CLIENTES (para WhatsApp)
function telefonoDeCliente(ss, nombre) {

  try {
    const clave = normalizarTexto(nombre);
    const fila = leerHoja(ss, NOMBRE_HOJA_CLIENTES, 3).find(f => normalizarTexto(f[1]) === clave);
    return fila ? String(fila[2]).trim() : '';
  } catch (error) {
    return '';
  }
}


// ======================================================
// RESUMEN DEL DÍA (pantalla de inicio)
// ======================================================

function resumenDelDia(p) {

  const sesion = validarSesion(p.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const admin = esAdministradora(sesion);
  const yo = normalizarTexto(sesion.nombre);
  const hoy = fechaISO(new Date());
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // La vendedora solo ve lo suyo; la administradora, toda la tienda
  const esMio = nombre => admin || normalizarTexto(nombre) === yo;

  let total = 0;
  let ventas = 0;
  const porMetodo = {};
  const porVendedora = {};

  leerHoja(ss, NOMBRE_HOJA_VENTAS, 8).forEach(fila => {
    if (!String(fila[0]).trim()) return;
    if (fechaISO(fila[1]) !== hoy) return;
    if (String(fila[7] || '').trim().toUpperCase() === 'ANULADA') return;
    if (!esMio(fila[6])) return;

    const monto = Number(fila[4]) || 0;
    const metodo = String(fila[5] || '').trim() || 'SIN DATO';
    const vendedora = String(fila[6] || '').trim() || 'Sin registrar';

    total += monto;
    ventas += 1;
    porMetodo[metodo] = (porMetodo[metodo] || 0) + monto;
    porVendedora[vendedora] = (porVendedora[vendedora] || 0) + monto;
  });

  let pendientes = 0;

  leerHoja(ss, NOMBRE_HOJA_COTIZACIONES, 8).forEach(fila => {
    if (!String(fila[0]).trim()) return;
    if (String(fila[6] || '').trim().toUpperCase() !== 'COTIZADO') return;
    if (fechaISO(fila[1]) !== hoy) return;
    if (!esMio(fila[7])) return;
    pendientes += 1;
  });

  const umbral = leerConfiguracion().stockBajo;

  const bajos = leerHoja(ss, NOMBRE_HOJA_PRODUCTOS, 7)
    .filter(fila => String(fila[0]).trim() && String(fila[6]).trim().toUpperCase() !== 'INACTIVO')
    .map(fila => ({
      producto: String(fila[1]).trim(),
      color: String(fila[2]).trim(),
      talla: String(fila[3]).trim(),
      stock: Number(fila[5]) || 0
    }))
    .filter(x => x.stock <= umbral)
    .sort((a, b) => a.stock - b.stock || a.producto.localeCompare(b.producto));

  const lista = obj => Object.keys(obj)
    .map(k => ({ nombre: k, total: Math.round(obj[k] * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  return responderJSON({
    ok: true,
    resumen: {
      fecha: hoy,
      alcance: admin ? 'TIENDA' : 'PROPIO',
      total: Math.round(total * 100) / 100,
      ventas: ventas,
      pendientes: pendientes,
      porMetodo: lista(porMetodo),
      porVendedora: admin ? lista(porVendedora) : [],
      stockBajo: umbral,
      agotados: bajos.filter(x => x.stock <= 0).length,
      bajos: bajos.length,
      productosBajos: bajos.slice(0, 6)
    }
  });
}


// ======================================================
// UTILIDADES PARA HOJAS NUEVAS
// ======================================================

function obtenerHoja(ss, nombre, encabezados) {

  let hoja = ss.getSheetByName(nombre);

  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.appendRow(encabezados);
    hoja.setFrozenRows(1);
  }

  return hoja;
}


function siguienteNumero(hoja, prefijo) {

  let mayor = 0;
  const patron = new RegExp('^' + prefijo + '-(\\d+)$', 'i');

  if (hoja.getLastRow() >= 2) {
    hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getDisplayValues().flat().forEach(v => {
      const m = String(v).match(patron);
      if (m) mayor = Math.max(mayor, Number(m[1]));
    });
  }

  return prefijo + '-' + String(mayor + 1).padStart(6, '0');
}


function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}


function fechaHora(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return isNaN(fecha.getTime())
    ? ''
    : Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}


function validarMetodoActivo(metodo) {
  if (METODOS_PAGO.indexOf(metodo) === -1 || leerConfiguracion().metodosActivos.indexOf(metodo) === -1) {
    throw new Error('Selecciona un método de pago activo.');
  }
}


// Busca la fila de una cotización (índice 0 = fila 2)
function buscarCotizacion(hojaCotizaciones, numero) {

  const filas = hojaCotizaciones.getLastRow() < 2 ? [] : hojaCotizaciones
    .getRange(2, 1, hojaCotizaciones.getLastRow() - 1, 8)
    .getValues();

  const indice = filas.findIndex(f => String(f[0]).trim().toUpperCase() === numero);

  return indice === -1 ? null : { fila: indice + 2, datos: filas[indice] };
}


// ======================================================
// SEPARADOS (adelantos). El stock no se toca hasta completar el pago.
// ======================================================

function hojaSeparados(ss) {
  return obtenerHoja(ss, NOMBRE_HOJA_SEPARADOS,
    ['NUMERO', 'FECHA', 'COTIZACION', 'CLIENTE', 'TOTAL', 'PAGADO', 'SALDO', 'ESTADO', 'USUARIO', 'NOTA']);
}


function hojaPagosSeparado(ss) {
  return obtenerHoja(ss, NOMBRE_HOJA_PAGOS_SEPARADO,
    ['SEPARADO', 'FECHA', 'MONTO', 'METODO_PAGO', 'USUARIO']);
}


function separadoDeCotizacion(ss, numero) {

  try {

    const fila = leerHoja(ss, NOMBRE_HOJA_SEPARADOS, 10).find(f =>
      String(f[2]).trim().toUpperCase() === numero &&
      String(f[7]).trim().toUpperCase() === 'PENDIENTE');

    return fila ? {
      numero: String(fila[0]).trim(),
      total: Number(fila[4]) || 0,
      pagado: Number(fila[5]) || 0,
      saldo: Number(fila[6]) || 0
    } : null;

  } catch (error) {
    return null;
  }
}


function crearSeparado(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const numero = String(datos.numero || '').trim().toUpperCase();
  const adelanto = redondear2(datos.adelanto);
  const metodo = String(datos.metodoPago || '').trim().toUpperCase();
  const nota = String(datos.nota || '').trim().slice(0, 200);

  const lock = LockService.getScriptLock();

  try {

    validarMetodoActivo(metodo);

    if (!(adelanto > 0)) {
      throw new Error('Escribe el monto del adelanto.');
    }

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaCot = ss.getSheetByName(NOMBRE_HOJA_COTIZACIONES);
    const cot = buscarCotizacion(hojaCot, numero);

    if (!cot) {
      throw new Error('No se encontró la cotización ' + numero);
    }

    const estado = String(cot.datos[6]).trim().toUpperCase();

    if (estado !== 'COTIZADO') {
      throw new Error('Solo se puede separar una cotización pendiente (está ' + estado + ').');
    }

    const total = redondear2(cot.datos[5]);

    if (adelanto >= total) {
      throw new Error('El adelanto cubre todo el total: usa "Registrar venta".');
    }

    const hoja = hojaSeparados(ss);
    const numeroSep = siguienteNumero(hoja, 'SEP');
    const ahora = new Date();

    hoja.appendRow([
      numeroSep, ahora, numero, textoSeguro(cot.datos[2]),
      total, adelanto, redondear2(total - adelanto), 'PENDIENTE',
      textoSeguro(sesion.nombre), textoSeguro(nota)
    ]);

    hojaPagosSeparado(ss).appendRow([numeroSep, ahora, adelanto, metodo, textoSeguro(sesion.nombre)]);

    hojaCot.getRange(cot.fila, 7).setValue('SEPARADO');

    SpreadsheetApp.flush();

    return responderJSON({
      ok: true,
      separado: { numero: numeroSep, total: total, pagado: adelanto, saldo: redondear2(total - adelanto) }
    });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


function listarSeparados(p) {

  if (!validarSesion(p.token)) {
    return respuestaSesionVencida();
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const pagos = {};

  leerHoja(ss, NOMBRE_HOJA_PAGOS_SEPARADO, 5).forEach(f => {
    const k = String(f[0]).trim();
    if (!k) return;
    (pagos[k] = pagos[k] || []).push({
      fecha: fechaHora(f[1]),
      monto: Number(f[2]) || 0,
      metodo: String(f[3]).trim(),
      usuario: String(f[4]).trim()
    });
  });

  const telefonos = {};

  leerHoja(ss, NOMBRE_HOJA_CLIENTES, 3).forEach(f => {
    telefonos[normalizarTexto(f[1])] = String(f[2]).trim();
  });

  const hoy = new Date();

  const separados = leerHoja(ss, NOMBRE_HOJA_SEPARADOS, 10)
    .filter(f => String(f[0]).trim())
    .map(f => {
      const fecha = f[1] instanceof Date ? f[1] : new Date(f[1]);
      return {
        numero: String(f[0]).trim(),
        fecha: fechaISO(f[1]),
        dias: isNaN(fecha.getTime()) ? 0 : Math.floor((hoy - fecha) / 86400000),
        cotizacion: String(f[2]).trim(),
        cliente: String(f[3]).trim(),
        telefono: telefonos[normalizarTexto(f[3])] || '',
        total: Number(f[4]) || 0,
        pagado: Number(f[5]) || 0,
        saldo: Number(f[6]) || 0,
        estado: String(f[7]).trim().toUpperCase(),
        usuario: String(f[8]).trim(),
        nota: String(f[9]).trim(),
        pagos: pagos[String(f[0]).trim()] || []
      };
    })
    .reverse();

  return responderJSON({ ok: true, separados: separados });
}


function pagarSeparado(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const numeroSep = String(datos.numero || '').trim().toUpperCase();
  const monto = redondear2(datos.monto);
  const metodo = String(datos.metodoPago || '').trim().toUpperCase();

  try {

    validarMetodoActivo(metodo);

    if (!(monto > 0)) {
      throw new Error('Escribe el monto del pago.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = hojaSeparados(ss);
    const filas = leerHoja(ss, NOMBRE_HOJA_SEPARADOS, 10);
    const indice = filas.findIndex(f => String(f[0]).trim().toUpperCase() === numeroSep);

    if (indice === -1) {
      throw new Error('No se encontró el separado ' + numeroSep);
    }

    const sep = filas[indice];

    if (String(sep[7]).trim().toUpperCase() !== 'PENDIENTE') {
      throw new Error('Este separado ya no está pendiente.');
    }

    const saldo = redondear2(sep[6]);

    if (monto > saldo + 0.001) {
      throw new Error('El pago (S/ ' + monto.toFixed(2) + ') es mayor que el saldo (S/ ' + saldo.toFixed(2) + ').');
    }

    const completa = Math.abs(saldo - monto) < 0.005;
    let venta = null;

    // Último pago: se registra la venta (descuenta stock) antes de guardar el pago
    if (completa) {

      const resultado = leerRespuesta(registrarVenta({
        token: datos.token,
        numero: String(sep[2]).trim().toUpperCase(),
        metodoPago: 'SEPARADO'
      }, true));

      if (!resultado.ok) {
        throw new Error('No se pudo completar: ' + resultado.mensaje);
      }

      venta = resultado.venta;
    }

    const lock = LockService.getScriptLock();

    try {

      lock.waitLock(15000);

      const pagado = redondear2(Number(sep[5]) + monto);
      const nuevoSaldo = completa ? 0 : redondear2(saldo - monto);

      hoja.getRange(indice + 2, 6, 1, 3).setValues([[pagado, nuevoSaldo, completa ? 'COMPLETADO' : 'PENDIENTE']]);
      hojaPagosSeparado(ss).appendRow([numeroSep, new Date(), monto, metodo, textoSeguro(sesion.nombre)]);

      SpreadsheetApp.flush();

      return responderJSON({ ok: true, completado: completa, pagado: pagado, saldo: nuevoSaldo, venta: venta });

    } finally {

      lock.releaseLock();
    }

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });
  }
}


function cancelarSeparado(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede cancelar un separado.' });
  }

  const numeroSep = String(datos.numero || '').trim().toUpperCase();
  const motivo = String(datos.motivo || '').trim().slice(0, 200);

  if (motivo.length < 3) {
    return responderJSON({ ok: false, mensaje: 'Escribe el motivo de la cancelación.' });
  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = hojaSeparados(ss);
    const filas = leerHoja(ss, NOMBRE_HOJA_SEPARADOS, 10);
    const indice = filas.findIndex(f => String(f[0]).trim().toUpperCase() === numeroSep);

    if (indice === -1) {
      throw new Error('No se encontró el separado ' + numeroSep);
    }

    if (String(filas[indice][7]).trim().toUpperCase() !== 'PENDIENTE') {
      throw new Error('Este separado ya no está pendiente.');
    }

    const nota = [String(filas[indice][9] || '').trim(), 'Cancelado: ' + motivo].filter(Boolean).join(' · ');

    hoja.getRange(indice + 2, 8).setValue('CANCELADO');
    hoja.getRange(indice + 2, 10).setValue(textoSeguro(nota));

    // La cotización queda anulada (el stock nunca se descontó)
    const hojaCot = ss.getSheetByName(NOMBRE_HOJA_COTIZACIONES);
    const cot = buscarCotizacion(hojaCot, String(filas[indice][2]).trim().toUpperCase());

    if (cot && String(cot.datos[6]).trim().toUpperCase() === 'SEPARADO') {
      hojaCot.getRange(cot.fila, 7).setValue('ANULADO');
    }

    SpreadsheetApp.flush();

    return responderJSON({ ok: true });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// ======================================================
// CAMBIOS (solo cambios, no se devuelve dinero)
// ======================================================

function cambiosDeCotizacion(ss, numero) {

  try {
    return leerHoja(ss, NOMBRE_HOJA_CAMBIOS, 11)
      .filter(f => String(f[3]).trim().toUpperCase() === numero)
      .map(f => ({
        numero: String(f[0]).trim(),
        fecha: fechaHora(f[1]),
        devuelto: Number(f[5]) || 0,
        nuevo: Number(f[6]) || 0,
        diferencia: Number(f[7]) || 0,
        metodo: String(f[8]).trim(),
        motivo: String(f[9]).trim()
      }));
  } catch (error) {
    return [];
  }
}


// Lo que la clienta tiene hoy de esa compra: lo comprado + lo que se llevó en cambios − lo devuelto
function articulosEnPoderDelCliente(ss, numero, productosOriginales) {

  const mapa = {};

  const sumar = (id, datos, cantidad) => {
    mapa[id] = mapa[id] || Object.assign({ id: id, cantidad: 0 }, datos);
    mapa[id].cantidad += cantidad;
  };

  (productosOriginales || []).forEach(p => sumar(p.id, {
    producto: p.producto, talla: p.talla, color: p.color, precio: Number(p.precio) || 0
  }, Number(p.cantidad) || 0));

  const cambios = {};
  leerHoja(ss, NOMBRE_HOJA_CAMBIOS, 4).forEach(f => {
    if (String(f[3]).trim().toUpperCase() === numero) cambios[String(f[0]).trim()] = true;
  });

  leerHoja(ss, NOMBRE_HOJA_DETALLE_CAMBIO, 8).forEach(f => {
    if (!cambios[String(f[0]).trim()]) return;
    const signo = String(f[1]).trim().toUpperCase() === 'LLEVA' ? 1 : -1;
    sumar(String(f[2]).trim(), {
      producto: String(f[3]), talla: String(f[4]), color: String(f[5]), precio: Number(f[7]) || 0
    }, signo * (Number(f[6]) || 0));
  });

  return Object.keys(mapa).map(k => mapa[k]).filter(x => x.cantidad > 0);
}


function registrarCambio(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  const numero = String(datos.numero || '').trim().toUpperCase();
  const motivo = String(datos.motivo || '').trim().slice(0, 200);

  const limpiar = lista => {
    const mapa = {};
    (Array.isArray(lista) ? lista : []).forEach(x => {
      const id = String(x.id || '').trim();
      const cantidad = Number(x.cantidad);
      if (!id || !Number.isInteger(cantidad) || cantidad <= 0) return;
      mapa[id] = (mapa[id] || 0) + cantidad;
    });
    return mapa;
  };

  const devuelve = limpiar(datos.devuelve);
  const lleva = limpiar(datos.lleva);

  if (!Object.keys(devuelve).length) {
    return responderJSON({ ok: false, mensaje: 'Elige qué prenda devuelve la clienta.' });
  }

  if (!Object.keys(lleva).length) {
    return responderJSON({ ok: false, mensaje: 'Elige qué prenda se lleva a cambio.' });
  }

  if (motivo.length < 3) {
    return responderJSON({ ok: false, mensaje: 'Escribe el motivo del cambio.' });
  }

  const lock = LockService.getScriptLock();

  try {

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaCot = ss.getSheetByName(NOMBRE_HOJA_COTIZACIONES);
    const cot = buscarCotizacion(hojaCot, numero);

    if (!cot || String(cot.datos[6]).trim().toUpperCase() !== 'VENDIDO') {
      throw new Error('Solo se pueden hacer cambios de una venta registrada.');
    }

    const venta = leerHoja(ss, NOMBRE_HOJA_VENTAS, 8).find(f =>
      String(f[2]).trim().toUpperCase() === numero &&
      String(f[7] || '').trim().toUpperCase() !== 'ANULADA');

    if (!venta) {
      throw new Error('No se encontró la venta de esta cotización.');
    }

    // Lo que la clienta tiene
    const original = leerHoja(ss, NOMBRE_HOJA_DETALLE, 8)
      .filter(f => String(f[0]).trim().toUpperCase() === numero)
      .map(f => ({ id: String(f[1]).trim(), producto: f[2], talla: f[3], color: f[4], cantidad: Number(f[5]) || 0, precio: Number(f[6]) || 0 }));

    const enPoder = {};
    articulosEnPoderDelCliente(ss, numero, original).forEach(x => { enPoder[x.id] = x; });

    let totalDevuelto = 0;

    Object.keys(devuelve).forEach(id => {
      const x = enPoder[id];
      if (!x || x.cantidad < devuelve[id]) {
        throw new Error('La clienta no tiene ' + devuelve[id] + ' unidad(es) de ' + (x ? x.producto : id) + ' en esta compra.');
      }
      totalDevuelto += x.precio * devuelve[id];
    });

    // Productos
    const hojaProd = ss.getSheetByName(NOMBRE_HOJA_PRODUCTOS);
    const prods = hojaProd.getRange(2, 1, hojaProd.getLastRow() - 1, 7).getValues();
    const indiceDe = id => prods.findIndex(f => String(f[0]).trim() === id);

    let totalNuevo = 0;

    Object.keys(lleva).forEach(id => {
      const i = indiceDe(id);
      if (i === -1) throw new Error('No se encontró el producto ' + id);
      if (String(prods[i][6]).trim().toUpperCase() === 'INACTIVO') throw new Error('"' + prods[i][1] + '" está inactivo.');
      totalNuevo += (Number(prods[i][4]) || 0) * lleva[id];
    });

    // Stock: primero entra lo devuelto, luego sale lo nuevo
    const cambiosStock = {};
    Object.keys(devuelve).forEach(id => { cambiosStock[id] = (cambiosStock[id] || 0) + devuelve[id]; });
    Object.keys(lleva).forEach(id => { cambiosStock[id] = (cambiosStock[id] || 0) - lleva[id]; });

    const escrituras = Object.keys(cambiosStock).map(id => {
      const i = indiceDe(id);
      if (i === -1) throw new Error('El producto ' + id + ' ya no existe en PRODUCTOS.');
      const nuevo = (Number(prods[i][5]) || 0) + cambiosStock[id];
      if (nuevo < 0) {
        throw new Error('Stock insuficiente para "' + prods[i][1] + ' ' + prods[i][3] + ' ' + prods[i][2] + '". Disponible: ' + prods[i][5]);
      }
      return { fila: i + 2, stock: nuevo };
    });

    totalDevuelto = redondear2(totalDevuelto);
    totalNuevo = redondear2(totalNuevo);
    const diferencia = redondear2(totalNuevo - totalDevuelto);

    let metodo = '';

    if (diferencia > 0) {
      metodo = String(datos.metodoPago || '').trim().toUpperCase();
      validarMetodoActivo(metodo);
    }

    escrituras.forEach(e => hojaProd.getRange(e.fila, 6).setValue(e.stock));

    const hojaCambios = obtenerHoja(ss, NOMBRE_HOJA_CAMBIOS,
      ['NUMERO', 'FECHA', 'VENTA', 'COTIZACION', 'CLIENTE', 'DEVUELTO', 'NUEVO', 'DIFERENCIA', 'METODO_PAGO', 'MOTIVO', 'USUARIO']);
    const hojaDetalle = obtenerHoja(ss, NOMBRE_HOJA_DETALLE_CAMBIO,
      ['CAMBIO', 'TIPO', 'ID_PRODUCTO', 'PRODUCTO', 'TALLA', 'COLOR', 'CANTIDAD', 'PRECIO']);

    const numeroCambio = siguienteNumero(hojaCambios, 'CAM');

    hojaCambios.appendRow([
      numeroCambio, new Date(), String(venta[0]).trim(), numero, textoSeguro(cot.datos[2]),
      totalDevuelto, totalNuevo, Math.max(diferencia, 0), metodo, textoSeguro(motivo), textoSeguro(sesion.nombre)
    ]);

    const filasDetalle = [];

    Object.keys(devuelve).forEach(id => {
      const x = enPoder[id];
      filasDetalle.push([numeroCambio, 'DEVUELVE', id, textoSeguro(x.producto), textoSeguro(x.talla), textoSeguro(x.color), devuelve[id], x.precio]);
    });

    Object.keys(lleva).forEach(id => {
      const f = prods[indiceDe(id)];
      filasDetalle.push([numeroCambio, 'LLEVA', id, textoSeguro(f[1]), textoSeguro(f[3]), textoSeguro(f[2]), lleva[id], Number(f[4]) || 0]);
    });

    hojaDetalle.getRange(hojaDetalle.getLastRow() + 1, 1, filasDetalle.length, 8).setValues(filasDetalle);

    SpreadsheetApp.flush();

    return responderJSON({
      ok: true,
      cambio: {
        numero: numeroCambio,
        devuelto: totalDevuelto,
        nuevo: totalNuevo,
        cobrado: Math.max(diferencia, 0),
        saldoNoDevuelto: diferencia < 0 ? -diferencia : 0,
        metodo: metodo
      }
    });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// ======================================================
// INGRESO DE MERCADERÍA (solo administradora)
// ======================================================

function registrarIngreso(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede registrar mercadería.' });
  }

  const proveedor = String(datos.proveedor || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const nota = String(datos.nota || '').trim().slice(0, 200);
  const items = Array.isArray(datos.items) ? datos.items : [];

  const lock = LockService.getScriptLock();

  try {

    if (proveedor.length < 2) {
      throw new Error('Escribe el proveedor.');
    }

    if (!items.length) {
      throw new Error('Agrega al menos un producto.');
    }

    // Unir líneas del mismo producto
    const lineas = {};

    items.forEach(x => {
      const id = String(x.id || '').trim();
      const cantidad = Number(x.cantidad);
      const costo = Number(x.costo);
      if (!id) throw new Error('Producto sin código.');
      if (!Number.isInteger(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida.');
      if (!(costo >= 0) || costo > 100000) throw new Error('Costo inválido.');
      const l = lineas[id] || (lineas[id] = { cantidad: 0, total: 0 });
      l.cantidad += cantidad;
      l.total += cantidad * costo;
    });

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaProd = ss.getSheetByName(NOMBRE_HOJA_PRODUCTOS);

    if (!hojaProd || hojaProd.getLastRow() < 2) {
      throw new Error('No hay productos registrados.');
    }

    const prods = hojaProd.getRange(2, 1, hojaProd.getLastRow() - 1, 8).getValues();

    if (!hojaProd.getRange(1, 8).getValue()) {
      hojaProd.getRange(1, 8).setValue('COSTO');
    }

    const hojaIng = obtenerHoja(ss, NOMBRE_HOJA_INGRESOS,
      ['NUMERO', 'FECHA', 'PROVEEDOR', 'UNIDADES', 'TOTAL_COSTO', 'NOTA', 'USUARIO']);
    const hojaDet = obtenerHoja(ss, NOMBRE_HOJA_DETALLE_INGRESO,
      ['INGRESO', 'ID_PRODUCTO', 'PRODUCTO', 'TALLA', 'COLOR', 'CANTIDAD', 'COSTO_UNITARIO', 'SUBTOTAL']);

    const numero = siguienteNumero(hojaIng, 'ING');

    const escrituras = [];
    const detalle = [];
    let unidades = 0;
    let totalCosto = 0;

    Object.keys(lineas).forEach(id => {

      const i = prods.findIndex(f => String(f[0]).trim() === id);

      if (i === -1) {
        throw new Error('No se encontró el producto ' + id);
      }

      const f = prods[i];
      const l = lineas[id];
      const costoUnit = l.total / l.cantidad;
      const stockAntes = Math.max(Number(f[5]) || 0, 0);
      const costoAntes = f[7] === '' || isNaN(Number(f[7])) ? null : Number(f[7]);

      // Costo promedio: mezcla lo que había con lo que entra
      const costoNuevo = costoAntes === null || stockAntes === 0
        ? costoUnit
        : (stockAntes * costoAntes + l.total) / (stockAntes + l.cantidad);

      escrituras.push({ fila: i + 2, stock: (Number(f[5]) || 0) + l.cantidad, costo: redondear2(costoNuevo) });
      detalle.push([numero, id, textoSeguro(f[1]), textoSeguro(f[3]), textoSeguro(f[2]), l.cantidad, redondear2(costoUnit), redondear2(l.total)]);

      unidades += l.cantidad;
      totalCosto += l.total;
    });

    escrituras.forEach(e => {
      hojaProd.getRange(e.fila, 6).setValue(e.stock);
      hojaProd.getRange(e.fila, 8).setValue(e.costo);
    });

    hojaIng.appendRow([numero, new Date(), textoSeguro(proveedor), unidades, redondear2(totalCosto), textoSeguro(nota), textoSeguro(sesion.nombre)]);
    hojaDet.getRange(hojaDet.getLastRow() + 1, 1, detalle.length, 8).setValues(detalle);

    SpreadsheetApp.flush();

    return responderJSON({ ok: true, ingreso: { numero: numero, unidades: unidades, total: redondear2(totalCosto) } });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


function listarIngresos(p) {

  const sesion = validarSesion(p.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede ver la mercadería.' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const detalle = {};

  leerHoja(ss, NOMBRE_HOJA_DETALLE_INGRESO, 8).forEach(f => {
    const k = String(f[0]).trim();
    if (!k) return;
    (detalle[k] = detalle[k] || []).push({
      id: String(f[1]).trim(), producto: String(f[2]), talla: String(f[3]), color: String(f[4]),
      cantidad: Number(f[5]) || 0, costo: Number(f[6]) || 0, subtotal: Number(f[7]) || 0
    });
  });

  const ingresos = leerHoja(ss, NOMBRE_HOJA_INGRESOS, 7)
    .filter(f => String(f[0]).trim())
    .map(f => ({
      numero: String(f[0]).trim(),
      fecha: fechaHora(f[1]),
      fechaISO: fechaISO(f[1]),
      proveedor: String(f[2]).trim(),
      unidades: Number(f[3]) || 0,
      total: Number(f[4]) || 0,
      nota: String(f[5]).trim(),
      usuario: String(f[6]).trim(),
      detalle: detalle[String(f[0]).trim()] || []
    }))
    .reverse();

  const proveedores = [...new Set(ingresos.map(i => i.proveedor).filter(Boolean))].sort();

  return responderJSON({ ok: true, ingresos: ingresos.slice(0, 100), proveedores: proveedores });
}


// ======================================================
// CIERRE DE CAJA (solo administradora)
// ======================================================

function hojaCaja(ss) {
  return obtenerHoja(ss, NOMBRE_HOJA_CAJA, [
    'FECHA', 'FONDO_INICIAL', 'EFECTIVO_ENTRADAS', 'SALIDAS', 'EFECTIVO_ESPERADO', 'EFECTIVO_CONTADO',
    'DIFERENCIA', 'OTROS_METODOS', 'TOTAL_INGRESOS', 'NOTA', 'USUARIO', 'REGISTRADO'
  ]);
}


// Todo el dinero que entró en una fecha (yyyy-MM-dd), por método y por origen
function movimientosDelDia(ss, fecha) {

  const porMetodo = {};
  const suma = (metodo, origen, monto) => {
    const m = porMetodo[metodo] || (porMetodo[metodo] = { ventas: 0, separados: 0, cambios: 0, total: 0 });
    m[origen] += monto;
    m.total += monto;
  };

  let ventas = 0;
  let pagosSeparado = 0;
  let cambios = 0;

  leerHoja(ss, NOMBRE_HOJA_VENTAS, 8).forEach(f => {
    if (!String(f[0]).trim() || fechaISO(f[1]) !== fecha) return;
    if (String(f[7] || '').trim().toUpperCase() === 'ANULADA') return;
    const metodo = String(f[5] || '').trim().toUpperCase();
    if (metodo === 'SEPARADO') return; // ya se contó en cada pago del separado
    suma(metodo || 'SIN DATO', 'ventas', Number(f[4]) || 0);
    ventas += 1;
  });

  leerHoja(ss, NOMBRE_HOJA_PAGOS_SEPARADO, 5).forEach(f => {
    if (!String(f[0]).trim() || fechaISO(f[1]) !== fecha) return;
    suma(String(f[3]).trim().toUpperCase() || 'SIN DATO', 'separados', Number(f[2]) || 0);
    pagosSeparado += 1;
  });

  leerHoja(ss, NOMBRE_HOJA_CAMBIOS, 9).forEach(f => {
    if (!String(f[0]).trim() || fechaISO(f[1]) !== fecha) return;
    const monto = Number(f[7]) || 0;
    if (monto <= 0) return;
    suma(String(f[8]).trim().toUpperCase() || 'SIN DATO', 'cambios', monto);
    cambios += 1;
  });

  const metodos = Object.keys(porMetodo).map(k => ({
    metodo: k,
    ventas: redondear2(porMetodo[k].ventas),
    separados: redondear2(porMetodo[k].separados),
    cambios: redondear2(porMetodo[k].cambios),
    total: redondear2(porMetodo[k].total)
  })).sort((a, b) => b.total - a.total);

  const efectivo = porMetodo.EFECTIVO ? redondear2(porMetodo.EFECTIVO.total) : 0;
  const total = redondear2(metodos.reduce((s, m) => s + m.total, 0));

  return { metodos, efectivo, total, conteo: { ventas, pagosSeparado, cambios } };
}


function leerCierres(ss) {

  return leerHoja(ss, NOMBRE_HOJA_CAJA, 12)
    .filter(f => String(f[0]).trim())
    .map(f => ({
      fecha: f[0] instanceof Date ? fechaISO(f[0]) : String(f[0]).replace(/^'/, '').trim(),
      fondo: Number(f[1]) || 0,
      entradas: Number(f[2]) || 0,
      salidas: Number(f[3]) || 0,
      esperado: Number(f[4]) || 0,
      contado: Number(f[5]) || 0,
      diferencia: Number(f[6]) || 0,
      otros: Number(f[7]) || 0,
      total: Number(f[8]) || 0,
      nota: String(f[9]).trim(),
      usuario: String(f[10]).trim(),
      registrado: fechaHora(f[11])
    }));
}


function verCaja(p) {

  const sesion = validarSesion(p.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede ver la caja.' });
  }

  const hoy = fechaISO(new Date());
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha || '')) ? String(p.fecha) : hoy;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cierres = leerCierres(ss).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cierre = cierres.find(c => c.fecha === fecha) || null;
  const anterior = cierres.find(c => c.fecha < fecha);

  return responderJSON({
    ok: true,
    fecha: fecha,
    hoy: hoy,
    movimientos: movimientosDelDia(ss, fecha),
    cierre: cierre,
    fondoSugerido: anterior ? anterior.contado : 0,
    historial: cierres.slice(0, 31)
  });
}


function cerrarCaja(datos) {

  const sesion = validarSesion(datos.token);

  if (!sesion) {
    return respuestaSesionVencida();
  }

  if (!esAdministradora(sesion)) {
    return responderJSON({ ok: false, mensaje: 'Solo la administradora puede cerrar la caja.' });
  }

  const fecha = String(datos.fecha || '').trim();
  const numero = v => (v === '' || v === null || v === undefined) ? NaN : Number(v);
  const fondo = numero(datos.fondo);
  const salidas = numero(datos.salidas);
  const contado = numero(datos.contado);
  const nota = String(datos.nota || '').trim().slice(0, 300);

  const lock = LockService.getScriptLock();

  try {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > fechaISO(new Date())) {
      throw new Error('Fecha no válida.');
    }

    [[fondo, 'El fondo inicial'], [salidas, 'Las salidas'], [contado, 'El efectivo contado']].forEach(([v, nombre]) => {
      if (!(v >= 0) || v > 1000000) throw new Error(nombre + ' debe ser un monto de 0 o más.');
    });

    lock.waitLock(15000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = hojaCaja(ss);
    const mov = movimientosDelDia(ss, fecha);

    const esperado = redondear2(fondo + mov.efectivo - salidas);
    const diferencia = redondear2(contado - esperado);

    const fila = [
      "'" + fecha, redondear2(fondo), mov.efectivo, redondear2(salidas), esperado, redondear2(contado),
      diferencia, redondear2(mov.total - mov.efectivo), mov.total, textoSeguro(nota), textoSeguro(sesion.nombre), new Date()
    ];

    // Un cierre por día: si ya existe, se reemplaza
    const existentes = hoja.getLastRow() < 2 ? [] : hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
    const indice = existentes.findIndex(f =>
      (f[0] instanceof Date ? fechaISO(f[0]) : String(f[0]).replace(/^'/, '').trim()) === fecha);

    if (indice === -1) {
      hoja.appendRow(fila);
    } else {
      hoja.getRange(indice + 2, 1, 1, fila.length).setValues([fila]);
    }

    SpreadsheetApp.flush();

    return responderJSON({ ok: true, cierre: { fecha, esperado, diferencia, contado: redondear2(contado) } });

  } catch (error) {

    return responderJSON({ ok: false, mensaje: error.message });

  } finally {

    lock.releaseLock();
  }
}


// ======================================================
// RESPUESTA JSON
// ======================================================

function responderJSON(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
