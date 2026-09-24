const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";

const POR_PAGINA = 50;


// ======================================================
// SESIÓN
// ======================================================

const sesion =
  sessionStorage.getItem("zareinaUsuario");

const usuario =
  sesion ? JSON.parse(sesion) : null;

if (!usuario || !usuario.token) {

  sessionStorage.removeItem("zareinaUsuario");

  window.location.replace("index.html");

  throw new Error("Sin sesión");
}

document.getElementById("nombreUsuario").textContent = usuario.nombre;
document.getElementById("rolUsuario").textContent = usuario.rol;
document.getElementById("avatarUsuario").textContent = obtenerIniciales(usuario.nombre);


// ======================================================
// ELEMENTOS
// ======================================================

const buscarInput = document.getElementById("buscar");
const desdeInput = document.getElementById("desde");
const hastaInput = document.getElementById("hasta");
const estadoSelect = document.getElementById("estado");
const lista = document.getElementById("listaCotizaciones");
const btnVerMas = document.getElementById("btnVerMas");

let cotizaciones = [];
let filtradas = [];
let mostrando = POR_PAGINA;


// ======================================================
// CARGAR
// ======================================================

async function cargarCotizaciones() {

  try {

    const parametros = new URLSearchParams({
      accion: "ventas",
      token: usuario.token
    });

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

    cotizaciones = datos.ventas || [];

    cargarEstados();
    aplicarFiltros();

  } catch (error) {

    console.error(error);

    lista.innerHTML = `
      <tr>
        <td colspan="7" class="cotizacion-vacia">
          <strong>No se pudieron cargar las ventas.</strong>
          <span>${escaparHTML(error.message)}</span>
        </td>
      </tr>`;
  }
}


function cargarEstados() {

  const estados = [...new Set(cotizaciones.map(c => c.metodoPago).filter(Boolean))].sort();

  estados.forEach(estado => {
    const option = document.createElement("option");
    option.value = estado;
    option.textContent = estado;
    estadoSelect.appendChild(option);
  });
}


// ======================================================
// FILTROS
// ======================================================

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}


function aplicarFiltros() {

  const texto = normalizar(buscarInput.value.trim());
  const desde = desdeInput.value;
  const hasta = hastaInput.value;
  const estado = estadoSelect.value;

  filtradas = cotizaciones.filter(c => {

    if (texto) {
      const enCliente = normalizar(c.cliente).includes(texto);
      const enNumero =
        normalizar(c.numero).includes(texto) ||
        normalizar(c.cotizacion).includes(texto);
      if (!enCliente && !enNumero) return false;
    }

    if (desde && (!c.fechaISO || c.fechaISO < desde)) return false;
    if (hasta && (!c.fechaISO || c.fechaISO > hasta)) return false;
    if (estado && c.metodoPago !== estado) return false;

    return true;
  });

  mostrando = POR_PAGINA;

  render();
}


let temporizador;

buscarInput.addEventListener("input", () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(aplicarFiltros, 200);
});

desdeInput.addEventListener("change", aplicarFiltros);
hastaInput.addEventListener("change", aplicarFiltros);
estadoSelect.addEventListener("change", aplicarFiltros);

document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
  buscarInput.value = "";
  desdeInput.value = "";
  hastaInput.value = "";
  estadoSelect.value = "";
  aplicarFiltros();
});

btnVerMas.addEventListener("click", () => {
  mostrando += POR_PAGINA;
  render();
});


// ======================================================
// MOSTRAR
// ======================================================

function render() {

  const monto = filtradas.reduce((suma, c) => suma + Number(c.total || 0), 0);

  document.getElementById("resumenCantidad").textContent = filtradas.length;
  document.getElementById("resumenMonto").textContent =
    monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (filtradas.length === 0) {

    lista.innerHTML = `
      <tr>
        <td colspan="7" class="cotizacion-vacia">
          <div>🛒</div>
          <strong>${cotizaciones.length ? "No hay ventas con esos filtros" : "Aún no hay ventas"}</strong>
          <span>${cotizaciones.length ? "Prueba con otra búsqueda." : "Abre una cotización y usa Registrar venta."}</span>
        </td>
      </tr>`;

    btnVerMas.style.display = "none";
    return;
  }

  lista.innerHTML = filtradas
    .slice(0, mostrando)
    .map(c => {

      const url = `vista-cotizacion.html?numero=${encodeURIComponent(c.cotizacion)}`;

      return `
        <tr class="historial-fila" data-url="${url}">
          <td data-label="Venta">
            <strong>${escaparHTML(c.numero)}</strong>
            <small class="historial-sub">${escaparHTML(c.cotizacion)}</small>
          </td>
          <td data-label="Fecha">${escaparHTML(c.fecha)}</td>
          <td data-label="Cliente">${escaparHTML(c.cliente)}</td>
          <td data-label="Vendedora">${escaparHTML(c.usuario || "—")}</td>
          <td data-label="Pago">
            <span class="chip-pago">${escaparHTML(c.metodoPago || "—")}</span>
          </td>
          <td data-label="Total" class="historial-derecha">
            <strong>S/ ${Number(c.total || 0).toFixed(2)}</strong>
          </td>
          <td class="historial-derecha">
            <a href="${url}" class="historial-abrir">Ver →</a>
          </td>
        </tr>`;
    })
    .join("");

  const restantes = filtradas.length - mostrando;

  btnVerMas.style.display = restantes > 0 ? "inline-flex" : "none";
  btnVerMas.textContent = `Ver más (${Math.max(restantes, 0)})`;
}


// Toda la fila abre la cotización vendida
lista.addEventListener("click", (event) => {

  if (event.target.closest("a")) return;

  const fila = event.target.closest("tr[data-url]");

  if (fila) {
    window.location.href = fila.dataset.url;
  }
});


// ======================================================
// AUXILIARES
// ======================================================

function obtenerIniciales(nombre) {
  return String(nombre || "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .map(p => p.charAt(0))
    .join("")
    .toUpperCase();
}


function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}


// ======================================================
// ARRANQUE
// ======================================================

cargarCotizaciones();
