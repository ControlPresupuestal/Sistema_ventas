const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";


// ======================================================
// SESIÓN (solo administradora)
// ======================================================

const sesion = sessionStorage.getItem("zareinaUsuario");
const usuario = sesion ? JSON.parse(sesion) : null;

if (!usuario || !usuario.token) {
  sessionStorage.removeItem("zareinaUsuario");
  window.location.replace("index.html");
  throw new Error("Sin sesión");
}

if (String(usuario.rol || "").trim().toUpperCase() !== "ADMINISTRADOR") {
  window.location.replace("dashboard.html");
  throw new Error("Sin permiso");
}

document.getElementById("nombreUsuario").textContent = usuario.nombre;
document.getElementById("rolUsuario").textContent = usuario.rol;
document.getElementById("avatarUsuario").textContent = obtenerIniciales(usuario.nombre);


// ======================================================
// CAMPOS
// ======================================================

const form = document.getElementById("formConfig");
const estado = document.getElementById("estadoConfig");
const btnGuardar = document.getElementById("btnGuardar");
const btnDeshacer = document.getElementById("btnDeshacer");
const mensaje = document.getElementById("mensajeConfig");

const CAMPOS_TEXTO = [
  "tiendaNombre", "tiendaEslogan", "tiendaRuc", "tiendaDireccion", "tiendaTelefono",
  "tiendaInstagram", "tiendaEmail", "mensajeTitulo", "mensajeTexto", "condiciones",
  "yapeNumero", "plinNumero", "cuentaBancaria"
];

const CAMPOS_NUMERO = ["validezDias", "stockBajo"];

// Dato que acompaña a cada método de pago
const DATO_METODO = { YAPE: "yapeNumero", PLIN: "plinNumero", TRANSFERENCIA: "cuentaBancaria" };

const casillas = [...document.querySelectorAll("#listaMetodos input[type=checkbox]")];

let original = null;
let guardando = false;


function campo(id) {
  return document.getElementById(id);
}


// ======================================================
// CARGAR
// ======================================================

async function cargarConfiguracion() {

  try {

    const parametros = new URLSearchParams({ accion: "configuracion", token: usuario.token });
    const respuesta = await fetch(`${API_URL}?${parametros.toString()}`);
    const datos = await respuesta.json();

    if (!datos.ok) {
      if (datos.sesionExpirada) return sesionVencida(datos.mensaje);
      throw new Error(datos.mensaje);
    }

    original = datos.configuracion;
    llenarFormulario(original);

    estado.style.display = "none";
    form.style.display = "block";

  } catch (error) {

    console.error(error);
    estado.innerHTML = `<strong>No se pudo cargar la configuración.</strong><br>${escaparHTML(error.message)}`;
  }
}


function sesionVencida(texto) {
  sessionStorage.removeItem("zareinaUsuario");
  alert(texto);
  window.location.replace("index.html");
}


function llenarFormulario(config) {

  CAMPOS_TEXTO.forEach(id => { campo(id).value = config[id] || ""; });
  CAMPOS_NUMERO.forEach(id => { campo(id).value = config[id] ?? 0; });

  const activos = config.metodosActivos || [];
  casillas.forEach(c => { c.checked = activos.includes(c.value); });

  form.querySelectorAll(".invalido").forEach(el => el.classList.remove("invalido"));

  actualizarMetodos();
  revisarCambios();
}


function leerFormulario() {

  const config = {};

  CAMPOS_TEXTO.forEach(id => { config[id] = campo(id).value.trim(); });
  CAMPOS_NUMERO.forEach(id => {
    const texto = campo(id).value.trim();
    config[id] = texto === "" ? "" : Number(texto);
  });

  config.metodosActivos = casillas.filter(c => c.checked).map(c => c.value);

  return config;
}


// ======================================================
// INTERACCIÓN
// ======================================================

function actualizarMetodos() {

  casillas.forEach(c => {
    const fila = c.closest(".config-metodo");
    fila.classList.toggle("apagado", !c.checked);
    const dato = DATO_METODO[c.value];
    if (dato) campo(dato).disabled = !c.checked;
  });
}


function revisarCambios() {

  if (!original) return;

  const hayCambios = JSON.stringify(leerFormulario()) !== JSON.stringify(normalizar(original));

  btnGuardar.disabled = !hayCambios || guardando;
  btnDeshacer.disabled = !hayCambios || guardando;

  if (hayCambios) mostrarMensaje("Tienes cambios sin guardar.", "");
  else if (!mensaje.classList.contains("ok")) mostrarMensaje("", "");
}


// Deja la configuración en el mismo formato que leerFormulario()
function normalizar(config) {

  const copia = {};

  CAMPOS_TEXTO.forEach(id => { copia[id] = String(config[id] || "").trim(); });
  CAMPOS_NUMERO.forEach(id => { copia[id] = Number(config[id] ?? 0); });
  copia.metodosActivos = casillas.map(c => c.value).filter(m => (config.metodosActivos || []).includes(m));

  return copia;
}


function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = "config-mensaje" + (tipo ? " " + tipo : "");
}


form.addEventListener("input", (event) => {
  event.target.classList.remove("invalido");
  if (mensaje.classList.contains("ok")) mostrarMensaje("", "");
  revisarCambios();
});

form.addEventListener("change", () => {
  actualizarMetodos();
  revisarCambios();
});

btnDeshacer.addEventListener("click", () => {
  if (original) llenarFormulario(original);
});

window.addEventListener("beforeunload", (event) => {
  if (!btnGuardar.disabled) {
    event.preventDefault();
    event.returnValue = "";
  }
});


// ======================================================
// VALIDAR Y GUARDAR
// ======================================================

function validar(config) {

  const marcar = (id, texto) => {
    campo(id).classList.add("invalido");
    campo(id).focus();
    return texto;
  };

  if (!config.tiendaNombre) return marcar("tiendaNombre", "Escribe el nombre de la tienda.");

  if (config.tiendaRuc && !/^\d{11}$/.test(config.tiendaRuc)) {
    return marcar("tiendaRuc", "El RUC debe tener 11 números.");
  }

  if (config.tiendaEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.tiendaEmail)) {
    return marcar("tiendaEmail", "El correo no es válido.");
  }

  if (!Number.isInteger(config.validezDias) || config.validezDias < 0 || config.validezDias > 365) {
    return marcar("validezDias", "Los días de validez deben ser un número entero entre 0 y 365.");
  }

  if (!config.metodosActivos.length) {
    return "Deja activo al menos un método de pago.";
  }

  if (!Number.isInteger(config.stockBajo) || config.stockBajo < 0 || config.stockBajo > 1000) {
    return marcar("stockBajo", "La alerta de stock bajo debe ser un número entero entre 0 y 1000.");
  }

  return "";
}


form.addEventListener("submit", async (event) => {

  event.preventDefault();

  if (guardando || btnGuardar.disabled) return;

  const config = leerFormulario();
  const error = validar(config);

  if (error) {
    mostrarMensaje(error, "error");
    return;
  }

  guardando = true;
  btnGuardar.disabled = true;
  btnDeshacer.disabled = true;
  btnGuardar.textContent = "Guardando...";
  mostrarMensaje("", "");

  try {

    const respuesta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "guardarConfiguracion", token: usuario.token, configuracion: config })
    });

    const resultado = await respuesta.json();

    if (!resultado.ok) {
      if (resultado.sesionExpirada) return sesionVencida(resultado.mensaje);
      throw new Error(resultado.mensaje);
    }

    original = resultado.configuracion;
    guardando = false;
    llenarFormulario(original);
    mostrarMensaje("✓ Cambios guardados.", "ok");

  } catch (err) {

    console.error(err);
    guardando = false;
    mostrarMensaje(err.message || "No se pudo guardar.", "error");
    revisarCambios();
    mostrarMensaje(err.message || "No se pudo guardar.", "error");

  } finally {

    guardando = false;
    btnGuardar.textContent = "Guardar cambios";
  }
});


// ======================================================
// AUXILIARES
// ======================================================

function obtenerIniciales(nombre) {
  return String(nombre || "").trim().split(" ").slice(0, 2).map(p => p.charAt(0)).join("").toUpperCase();
}


function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}


cargarConfiguracion();
