const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";


// ======================================================
// SESIÓN
// ======================================================

const sesion = sessionStorage.getItem("zareinaUsuario");
const usuario = sesion ? JSON.parse(sesion) : null;

if (!usuario || !usuario.token) {
  sessionStorage.removeItem("zareinaUsuario");
  window.location.replace("index.html");
  throw new Error("Sin sesión");
}

const esAdmin = String(usuario.rol || "").trim().toUpperCase() === "ADMINISTRADOR";

document.getElementById("nombreUsuario").textContent = usuario.nombre;
document.getElementById("rolUsuario").textContent = usuario.rol;
document.getElementById("avatarUsuario").textContent = obtenerIniciales(usuario.nombre);


// ======================================================
// CARGAR
// ======================================================

const lista = document.getElementById("listaSeparados");
const buscarInput = document.getElementById("buscar");
const ordenSelect = document.getElementById("orden");

let separados = [];
let config = {};
let estadoVista = "PENDIENTE";


async function pedir(parametros) {

  const respuesta = await fetch(`${API_URL}?${new URLSearchParams(Object.assign({ token: usuario.token }, parametros))}`);
  const datos = await respuesta.json();

  if (!datos.ok && datos.sesionExpirada) {
    sessionStorage.removeItem("zareinaUsuario");
    alert(datos.mensaje);
    window.location.replace("index.html");
    throw new Error(datos.mensaje);
  }

  return datos;
}


async function enviar(cuerpo) {

  const respuesta = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(Object.assign({ token: usuario.token }, cuerpo))
  });

  const datos = await respuesta.json();

  if (!datos.ok && datos.sesionExpirada) {
    sessionStorage.removeItem("zareinaUsuario");
    alert(datos.mensaje);
    window.location.replace("index.html");
  }

  return datos;
}


async function cargar() {

  try {

    const [datos, datosConfig] = await Promise.all([
      pedir({ accion: "separados" }),
      pedir({ accion: "configuracion" }).catch(() => ({}))
    ]);

    if (!datos.ok) throw new Error(datos.mensaje);

    separados = datos.separados || [];
    config = (datosConfig && datosConfig.configuracion) || {};

    const activos = config.metodosActivos;

    if (activos) {
      document.querySelectorAll("#metodosPago button[data-metodo]").forEach(b => {
        b.style.display = activos.includes(b.dataset.metodo) ? "" : "none";
      });
    }

    render();

  } catch (error) {

    console.error(error);
    lista.innerHTML = `<div class="op-estado"><strong>No se pudieron cargar los separados.</strong><br>${escaparHTML(error.message)}</div>`;
  }
}


// ======================================================
// MOSTRAR
// ======================================================

const soles = n => "S/ " + Number(n || 0).toFixed(2);

const NOMBRES_METODO = { EFECTIVO: "Efectivo", YAPE: "Yape", PLIN: "Plin", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta" };


function render() {

  const cuenta = e => separados.filter(s => s.estado === e).length;

  document.getElementById("nPendientes").textContent = cuenta("PENDIENTE");
  document.getElementById("nCompletados").textContent = cuenta("COMPLETADO");
  document.getElementById("nCancelados").textContent = cuenta("CANCELADO");

  const pendientes = separados.filter(s => s.estado === "PENDIENTE");
  document.getElementById("resumenPendientes").textContent = pendientes.length;
  document.getElementById("resumenSaldo").textContent = pendientes.reduce((s, x) => s + x.saldo, 0).toFixed(2);

  const texto = normalizar(buscarInput.value);

  let visibles = separados.filter(s => s.estado === estadoVista && (!texto ||
    normalizar(`${s.cliente} ${s.numero} ${s.cotizacion}`).includes(texto)));

  const orden = ordenSelect.value;

  visibles.sort((a, b) =>
    orden === "saldo" ? b.saldo - a.saldo :
    orden === "recientes" ? b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero) :
    a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero));

  if (!visibles.length) {
    lista.innerHTML = `<div class="op-estado">${texto ? "No hay resultados." : "No hay separados en esta lista."}</div>`;
    return;
  }

  lista.innerHTML = visibles.map(tarjeta).join("");
}


function tarjeta(s) {

  const porcentaje = s.total ? Math.min(100, Math.round(s.pagado / s.total * 100)) : 0;
  const clase = s.estado === "COMPLETADO" ? " completado" : s.estado === "CANCELADO" ? " cancelado" : "";
  const antiguedad = s.dias === 0 ? "hoy" : s.dias === 1 ? "hace 1 día" : `hace ${s.dias} días`;

  const acciones = s.estado === "PENDIENTE" ? `
      <button class="principal" data-accion="pagar">Registrar pago</button>
      ${s.telefono ? `<a class="wa" target="_blank" rel="noopener" href="${urlWhatsapp(s)}">Recordar por WhatsApp</a>` : ""}
      ${esAdmin ? `<button class="peligro" data-accion="cancelar">Cancelar</button>` : ""}` : "";

  return `
    <article class="sep-card${clase}" data-numero="${escaparHTML(s.numero)}">

      <div class="sep-cabecera">
        <div>
          <h4>${escaparHTML(s.cliente)}</h4>
          <small>
            ${escaparHTML(s.numero)} · <a href="vista-cotizacion.html?numero=${encodeURIComponent(s.cotizacion)}">${escaparHTML(s.cotizacion)}</a> ·
            separado ${antiguedad}${s.dias >= 30 && s.estado === "PENDIENTE" ? ' <span class="sep-alerta">· más de un mes</span>' : ""}
          </small>
        </div>
        <div class="sep-montos">
          ${s.estado === "PENDIENTE"
            ? `<strong>${soles(s.saldo)}</strong><small>por cobrar de ${soles(s.total)}</small>`
            : `<strong style="color:${s.estado === "COMPLETADO" ? "#3d6b43" : "#9a897e"}">${s.estado === "COMPLETADO" ? "Pagado" : "Cancelado"}</strong><small>${soles(s.pagado)} de ${soles(s.total)}</small>`}
        </div>
      </div>

      <div class="sep-barra"><div style="width:${porcentaje}%"></div></div>

      <ul class="sep-pagos">
        ${s.pagos.map(p => `<li><span>${escaparHTML(p.fecha)} · ${escaparHTML(NOMBRES_METODO[p.metodo] || p.metodo)} · ${escaparHTML(p.usuario)}</span><span>${soles(p.monto)}</span></li>`).join("")}
      </ul>

      ${s.nota ? `<p class="sep-nota">📝 ${escaparHTML(s.nota)}</p>` : ""}

      <div class="sep-acciones">${acciones}</div>

    </article>`;
}


function urlWhatsapp(s) {

  const digitos = String(s.telefono).replace(/\D/g, "");
  const numero = /^9\d{8}$/.test(digitos) ? "51" + digitos : digitos;
  const tienda = config.tiendaNombre || "ZAREINA";
  const nombre = String(s.cliente).split(" ")[0];

  const texto = `Hola ${nombre} 👋 Te escribimos de ${tienda}. Tu separado ${s.numero} tiene un saldo de ${soles(s.saldo)} ` +
    `(total ${soles(s.total)}, ya pagaste ${soles(s.pagado)}). ¡Te esperamos para completarlo! ✨`;

  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}


document.getElementById("pestanas").addEventListener("click", (event) => {

  const boton = event.target.closest("button[data-estado]");
  if (!boton) return;

  estadoVista = boton.dataset.estado;
  document.querySelectorAll("#pestanas button").forEach(b => b.classList.toggle("activo", b === boton));
  render();
});

let temporizador;
buscarInput.addEventListener("input", () => { clearTimeout(temporizador); temporizador = setTimeout(render, 200); });
ordenSelect.addEventListener("change", render);

document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
  buscarInput.value = "";
  ordenSelect.value = "antiguos";
  render();
});

lista.addEventListener("click", (event) => {

  const boton = event.target.closest("button[data-accion]");
  if (!boton) return;

  const s = separados.find(x => x.numero === boton.closest("[data-numero]").dataset.numero);
  if (!s) return;

  if (boton.dataset.accion === "pagar") abrirPago(s);
  if (boton.dataset.accion === "cancelar") abrirCancelar(s);
});


// ======================================================
// REGISTRAR PAGO
// ======================================================

const modalPago = document.getElementById("modalPago");
const montoPago = document.getElementById("montoPago");
const btnConfirmarPago = document.getElementById("btnConfirmarPago");
const errorPago = document.getElementById("errorPago");

let separadoActual = null;
let metodoPago = "";
let enviando = false;


function abrirPago(s) {

  separadoActual = s;
  metodoPago = "";

  document.getElementById("textoPago").innerHTML =
    `${escaparHTML(s.cliente)} · ${escaparHTML(s.numero)}<br>Saldo: <strong>${soles(s.saldo)}</strong>. ` +
    `Si paga todo el saldo, se registra la venta y se descuenta el stock.`;

  montoPago.value = s.saldo.toFixed(2);
  montoPago.max = s.saldo;
  errorPago.textContent = "";
  btnConfirmarPago.disabled = true;
  btnConfirmarPago.textContent = "Registrar pago";

  document.querySelectorAll("#metodosPago button").forEach(b => b.classList.remove("activo"));

  modalPago.style.display = "flex";
  montoPago.focus();
  montoPago.select();
}


function cerrarPago() {
  if (enviando) return;
  modalPago.style.display = "none";
}


document.getElementById("metodosPago").addEventListener("click", (event) => {

  const boton = event.target.closest("button[data-metodo]");
  if (!boton || enviando) return;

  document.querySelectorAll("#metodosPago button").forEach(b => b.classList.toggle("activo", b === boton));
  metodoPago = boton.dataset.metodo;
  btnConfirmarPago.disabled = false;
});

document.getElementById("btnCancelarPago").addEventListener("click", cerrarPago);
modalPago.addEventListener("click", (event) => { if (event.target === modalPago) cerrarPago(); });


btnConfirmarPago.addEventListener("click", async () => {

  if (enviando || !metodoPago || !separadoActual) return;

  const monto = Math.round(Number(montoPago.value) * 100) / 100;

  if (!(monto > 0)) {
    errorPago.textContent = "Escribe el monto del pago.";
    return;
  }

  if (monto > separadoActual.saldo + 0.001) {
    errorPago.textContent = `El pago no puede ser mayor que el saldo (${soles(separadoActual.saldo)}).`;
    return;
  }

  enviando = true;
  btnConfirmarPago.disabled = true;
  btnConfirmarPago.textContent = "Registrando...";
  errorPago.textContent = "";

  try {

    const datos = await enviar({ accion: "pagarSeparado", numero: separadoActual.numero, monto: monto, metodoPago: metodoPago });

    if (!datos.ok) throw new Error(datos.mensaje);

    enviando = false;
    cerrarPago();

    if (datos.completado) {
      alert(`✓ Separado completado. Se registró la venta ${datos.venta.numero} y se descontó el stock.`);
    }

    cargar();

  } catch (error) {

    console.error(error);
    errorPago.textContent = error.message || "No se pudo registrar el pago.";
    btnConfirmarPago.disabled = false;
    btnConfirmarPago.textContent = "Registrar pago";

  } finally {

    enviando = false;
  }
});


// ======================================================
// CANCELAR (solo administradora)
// ======================================================

const modalCancelar = document.getElementById("modalCancelar");
const motivoCancelar = document.getElementById("motivoCancelar");
const btnConfirmarCancelar = document.getElementById("btnConfirmarCancelar");
const errorCancelar = document.getElementById("errorCancelar");


function abrirCancelar(s) {

  separadoActual = s;

  document.getElementById("textoCancelar").innerHTML =
    `${escaparHTML(s.cliente)} · ${escaparHTML(s.numero)}. La cotización quedará anulada. ` +
    `Lo ya pagado (${soles(s.pagado)}) sigue registrado en la caja del día en que se cobró.`;

  motivoCancelar.value = "";
  errorCancelar.textContent = "";
  btnConfirmarCancelar.disabled = true;

  modalCancelar.style.display = "flex";
  motivoCancelar.focus();
}


function cerrarCancelar() {
  if (enviando) return;
  modalCancelar.style.display = "none";
}

motivoCancelar.addEventListener("input", () => {
  btnConfirmarCancelar.disabled = motivoCancelar.value.trim().length < 3;
});

document.getElementById("btnVolverCancelar").addEventListener("click", cerrarCancelar);
modalCancelar.addEventListener("click", (event) => { if (event.target === modalCancelar) cerrarCancelar(); });

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (modalPago.style.display !== "none") cerrarPago();
  if (modalCancelar.style.display !== "none") cerrarCancelar();
});


btnConfirmarCancelar.addEventListener("click", async () => {

  if (enviando || !separadoActual) return;

  enviando = true;
  btnConfirmarCancelar.disabled = true;
  btnConfirmarCancelar.textContent = "Cancelando...";

  try {

    const datos = await enviar({ accion: "cancelarSeparado", numero: separadoActual.numero, motivo: motivoCancelar.value.trim() });

    if (!datos.ok) throw new Error(datos.mensaje);

    enviando = false;
    cerrarCancelar();
    cargar();

  } catch (error) {

    console.error(error);
    errorCancelar.textContent = error.message || "No se pudo cancelar.";
    btnConfirmarCancelar.disabled = false;

  } finally {

    enviando = false;
    btnConfirmarCancelar.textContent = "Cancelar separado";
  }
});


// ======================================================
// AUXILIARES
// ======================================================

function normalizar(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function obtenerIniciales(nombre) {
  return String(nombre || "").trim().split(" ").slice(0, 2).map(p => p.charAt(0)).join("").toUpperCase();
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}


cargar();
