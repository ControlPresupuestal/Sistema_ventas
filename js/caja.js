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
// ELEMENTOS
// ======================================================

const fechaInput = document.getElementById("fecha");
const fondoInput = document.getElementById("fondo");
const salidasInput = document.getElementById("salidas");
const contadoInput = document.getElementById("contado");
const notaInput = document.getElementById("notaCaja");
const btnCerrar = document.getElementById("btnCerrarCaja");
const mensaje = document.getElementById("mensajeCaja");

const NOMBRES_METODO = { EFECTIVO: "💵 Efectivo", YAPE: "📱 Yape", PLIN: "📱 Plin", TRANSFERENCIA: "🏦 Transferencia", TARJETA: "💳 Tarjeta" };

let datosCaja = null;
let guardando = false;

const soles = n => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


function fechaLarga(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}


fechaInput.value = hoyISO();
fechaInput.max = hoyISO();


// ======================================================
// CARGAR
// ======================================================

async function cargar() {

  document.getElementById("cargandoCaja").style.display = "block";
  document.getElementById("contenidoCaja").style.display = "none";
  mostrarMensaje("", "");

  try {

    const parametros = new URLSearchParams({ accion: "caja", token: usuario.token, fecha: fechaInput.value });
    const respuesta = await fetch(`${API_URL}?${parametros.toString()}`);
    const datos = await respuesta.json();

    if (!datos.ok) {
      if (datos.sesionExpirada) {
        sessionStorage.removeItem("zareinaUsuario");
        alert(datos.mensaje);
        window.location.replace("index.html");
        return;
      }
      throw new Error(datos.mensaje);
    }

    datosCaja = datos;
    render();

    document.getElementById("cargandoCaja").style.display = "none";
    document.getElementById("contenidoCaja").style.display = "block";

  } catch (error) {

    console.error(error);
    document.getElementById("cargandoCaja").innerHTML =
      `<strong>No se pudo cargar la caja.</strong><br>${escaparHTML(error.message)}`;
  }
}


function render() {

  const { movimientos: mov, cierre, historial, fondoSugerido } = datosCaja;

  // Estado del día
  const estado = document.getElementById("estadoCaja");
  estado.textContent = cierre ? `✓ Cerrada por ${cierre.usuario} · ${cierre.registrado}` : "Sin cerrar";
  estado.classList.toggle("cerrada", !!cierre);

  // Movimientos
  const c = mov.conteo;
  document.getElementById("conteoMovimientos").textContent =
    `${fechaLarga(datosCaja.fecha)} · ${c.ventas} venta(s) · ${c.pagosSeparado} pago(s) de separados · ${c.cambios} cambio(s) con cobro`;

  document.getElementById("tablaMovimientos").innerHTML = mov.metodos.length
    ? mov.metodos.map(m => `
        <tr>
          <td>${escaparHTML(NOMBRES_METODO[m.metodo] || m.metodo)}</td>
          <td>${soles(m.ventas)}</td>
          <td>${soles(m.separados)}</td>
          <td>${soles(m.cambios)}</td>
          <td><strong>${soles(m.total)}</strong></td>
        </tr>`).join("")
    : `<tr><td colspan="5" class="cotizacion-vacia">No entró dinero este día.</td></tr>`;

  document.getElementById("totalDia").textContent = soles(mov.total);
  document.getElementById("rEntradas").textContent = soles(mov.efectivo);

  // Formulario
  fondoInput.value = cierre ? cierre.fondo : (fondoSugerido || 0);
  salidasInput.value = cierre ? cierre.salidas : 0;
  contadoInput.value = cierre ? cierre.contado : "";
  notaInput.value = cierre ? cierre.nota : "";

  btnCerrar.textContent = cierre ? "Actualizar cierre" : "Guardar cierre";

  recalcular();

  // Historial
  document.getElementById("historialCaja").innerHTML = historial.length
    ? historial.map(h => `
        <tr>
          <td data-label="Día">${escaparHTML(fechaLarga(h.fecha))}</td>
          <td data-label="Total del día" class="historial-derecha">${soles(h.total)}</td>
          <td data-label="Esperado" class="historial-derecha">${soles(h.esperado)}</td>
          <td data-label="Contado" class="historial-derecha">${soles(h.contado)}</td>
          <td data-label="Diferencia" class="historial-derecha">${textoDiferencia(h.diferencia)}</td>
          <td data-label="Cerró">${escaparHTML(h.usuario)}${h.nota ? `<br><small>${escaparHTML(h.nota)}</small>` : ""}</td>
        </tr>`).join("")
    : `<tr><td colspan="6" class="cotizacion-vacia">Todavía no hay cierres.</td></tr>`;
}


function textoDiferencia(d) {
  if (Math.abs(d) < 0.005) return "✓ Cuadra";
  return d < 0
    ? `<span class="dif-falta">Falta ${soles(-d)}</span>`
    : `<span class="dif-sobra">Sobra ${soles(d)}</span>`;
}


function valor(input) {
  const n = Number(input.value);
  return input.value === "" || isNaN(n) ? null : n;
}


function recalcular() {

  if (!datosCaja) return;

  const esperado = (valor(fondoInput) || 0) + datosCaja.movimientos.efectivo - (valor(salidasInput) || 0);
  const contado = valor(contadoInput);

  document.getElementById("rEsperado").textContent = soles(esperado);

  const caja = document.getElementById("cajaDiferencia");
  const texto = document.getElementById("rDiferencia");

  caja.classList.remove("falta", "sobra");

  if (contado === null) {
    texto.textContent = "—";
    return;
  }

  const d = Math.round((contado - esperado) * 100) / 100;

  if (Math.abs(d) < 0.005) {
    texto.textContent = "✓ Cuadra";
  } else if (d < 0) {
    texto.textContent = `Falta ${soles(-d)}`;
    caja.classList.add("falta");
  } else {
    texto.textContent = `Sobra ${soles(d)}`;
    caja.classList.add("sobra");
  }
}


[fondoInput, salidasInput, contadoInput].forEach(i => i.addEventListener("input", recalcular));
fechaInput.addEventListener("change", () => { if (fechaInput.value) cargar(); });


function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = "op-mensaje" + (tipo ? " " + tipo : "");
}


// ======================================================
// GUARDAR CIERRE
// ======================================================

btnCerrar.addEventListener("click", async () => {

  if (guardando) return;

  const fondo = valor(fondoInput);
  const salidas = valor(salidasInput);
  const contado = valor(contadoInput);

  if (fondo === null || fondo < 0) return mostrarMensaje("Escribe el fondo inicial (0 si no había).", "error");
  if (salidas === null || salidas < 0) return mostrarMensaje("Escribe las salidas de efectivo (0 si no hubo).", "error");
  if (contado === null || contado < 0) return mostrarMensaje("Cuenta el efectivo de la caja y escribe el monto.", "error");

  guardando = true;
  btnCerrar.disabled = true;
  btnCerrar.textContent = "Guardando...";
  mostrarMensaje("", "");

  try {

    const respuesta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "cerrarCaja",
        token: usuario.token,
        fecha: fechaInput.value,
        fondo, salidas, contado,
        nota: notaInput.value.trim()
      })
    });

    const datos = await respuesta.json();

    if (!datos.ok) {
      if (datos.sesionExpirada) {
        sessionStorage.removeItem("zareinaUsuario");
        alert(datos.mensaje);
        window.location.replace("index.html");
        return;
      }
      throw new Error(datos.mensaje);
    }

    await cargar();
    mostrarMensaje("✓ Cierre guardado.", "ok");

  } catch (error) {

    console.error(error);
    mostrarMensaje(error.message || "No se pudo guardar el cierre.", "error");

  } finally {

    guardando = false;
    btnCerrar.disabled = false;
    if (datosCaja) btnCerrar.textContent = datosCaja.cierre ? "Actualizar cierre" : "Guardar cierre";
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


cargar();
