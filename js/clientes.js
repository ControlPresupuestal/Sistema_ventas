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

document.getElementById("nombreUsuario").textContent = usuario.nombre;
document.getElementById("rolUsuario").textContent = usuario.rol;
document.getElementById("avatarUsuario").textContent = obtenerIniciales(usuario.nombre);


// ======================================================
// ELEMENTOS
// ======================================================

const buscarInput = document.getElementById("buscar");
const ordenSelect = document.getElementById("orden");
const lista = document.getElementById("listaClientes");

let clientes = [];


// ======================================================
// CARGAR
// ======================================================

async function cargarClientes() {

  try {

    const parametros = new URLSearchParams({ accion: "clientes", token: usuario.token });
    const respuesta = await fetch(`${API_URL}?${parametros.toString()}`);
    const datos = await respuesta.json();

    if (!datos.ok) {
      if (datos.sesionExpirada) return sesionVencida(datos.mensaje);
      throw new Error(datos.mensaje);
    }

    clientes = datos.clientes || [];
    render();

  } catch (error) {

    console.error(error);

    lista.innerHTML = `
      <tr>
        <td colspan="7" class="cotizacion-vacia">
          <strong>No se pudieron cargar los clientes.</strong>
          <span>${escaparHTML(error.message)}</span>
        </td>
      </tr>`;
  }
}


function sesionVencida(mensaje) {
  sessionStorage.removeItem("zareinaUsuario");
  alert(mensaje);
  window.location.replace("index.html");
}


// ======================================================
// FILTROS Y ORDEN
// ======================================================

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}


function filtrar() {

  const texto = normalizar(buscarInput.value.trim());
  const soloDigitos = texto.replace(/\D/g, "");

  const filtrados = clientes.filter(c => {

    if (!texto) return true;

    const campos = normalizar([c.nombre, c.documento, c.email, c.id].join(" "));

    return texto.split(/\s+/).every(p => campos.includes(p)) ||
      (soloDigitos.length >= 3 && String(c.telefono).replace(/\D/g, "").includes(soloDigitos));
  });

  const orden = ordenSelect.value;

  return filtrados.sort((a, b) => {
    if (orden === "total") return b.total - a.total || a.nombre.localeCompare(b.nombre, "es");
    if (orden === "reciente") return (b.ultimaCompra || "").localeCompare(a.ultimaCompra || "") || a.nombre.localeCompare(b.nombre, "es");
    return a.nombre.localeCompare(b.nombre, "es");
  });
}


let temporizador;

buscarInput.addEventListener("input", () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(render, 200);
});

ordenSelect.addEventListener("change", render);

document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
  buscarInput.value = "";
  ordenSelect.value = "nombre";
  render();
});


// ======================================================
// MOSTRAR
// ======================================================

function formatoFecha(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}


function formatoSoles(numero) {
  return Number(numero || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function render() {

  const visibles = filtrar();

  document.getElementById("resumenClientes").textContent = visibles.length;
  document.getElementById("resumenCompradores").textContent = visibles.filter(c => c.compras > 0).length;
  document.getElementById("resumenTotal").textContent = formatoSoles(visibles.reduce((s, c) => s + c.total, 0));

  if (visibles.length === 0) {

    lista.innerHTML = `
      <tr>
        <td colspan="7" class="cotizacion-vacia">
          <div>👥</div>
          <strong>${clientes.length ? "No hay clientes con esa búsqueda" : "Aún no hay clientes"}</strong>
          <span>${clientes.length ? "Prueba con otro nombre o teléfono." : "Se agregan solos al guardar una cotización, o con + Nuevo cliente."}</span>
        </td>
      </tr>`;

    return;
  }

  lista.innerHTML = visibles.map(c => `
    <tr class="historial-fila" data-id="${escaparHTML(c.id)}">
      <td data-label="Cliente">
        <strong>${escaparHTML(c.nombre)}</strong>
        ${c.documento ? `<small class="cliente-contacto">Doc. ${escaparHTML(c.documento)}</small>` : ""}
      </td>
      <td data-label="Teléfono">${escaparHTML(c.telefono || "—")}</td>
      <td data-label="Cotizaciones" class="historial-derecha">${c.cotizaciones}</td>
      <td data-label="Compras" class="historial-derecha">${c.compras}</td>
      <td data-label="Total" class="historial-derecha"><strong>S/ ${formatoSoles(c.total)}</strong></td>
      <td data-label="Última compra">${formatoFecha(c.ultimaCompra)}</td>
      <td class="historial-derecha"><span class="historial-abrir">Ver →</span></td>
    </tr>`).join("");
}


lista.addEventListener("click", (event) => {

  const fila = event.target.closest("tr[data-id]");

  if (!fila) return;

  const cliente = clientes.find(c => c.id === fila.dataset.id);

  if (cliente) abrirModal(cliente);
});


// ======================================================
// NUEVO / EDITAR
// ======================================================

const modal = document.getElementById("modalCliente");
const btnGuardar = document.getElementById("btnGuardarCliente");
const errorModal = document.getElementById("modalClienteError");

const campos = {
  nombre: document.getElementById("fNombre"),
  telefono: document.getElementById("fTelefono"),
  documento: document.getElementById("fDocumento"),
  email: document.getElementById("fEmail"),
  notas: document.getElementById("fNotas")
};

let editandoId = "";
let guardando = false;


function enlaceWhatsapp(telefono) {

  let digitos = String(telefono || "").replace(/\D/g, "");

  if (!digitos) return "";

  // Números peruanos de 9 dígitos: se agrega el código de país
  if (digitos.length === 9 && digitos.startsWith("9")) digitos = "51" + digitos;

  return `https://wa.me/${digitos}`;
}


function abrirModal(cliente) {

  editandoId = cliente ? cliente.id : "";

  document.getElementById("tituloModalCliente").textContent = cliente ? cliente.nombre : "Nuevo cliente";

  document.getElementById("resumenCliente").textContent = cliente
    ? `${cliente.id} · ${cliente.compras} compra(s) por S/ ${formatoSoles(cliente.total)} · ${cliente.cotizaciones} cotización(es)`
    : "Registra los datos de contacto del cliente.";

  Object.keys(campos).forEach(k => { campos[k].value = cliente ? (cliente[k] || "") : ""; });

  const accesos = document.getElementById("accionesCliente");

  if (cliente) {

    const wa = enlaceWhatsapp(cliente.telefono);
    const lnkWa = document.getElementById("lnkWhatsapp");

    lnkWa.style.display = wa ? "" : "none";
    lnkWa.className = "whatsapp";
    lnkWa.href = wa || "#";

    document.getElementById("lnkCotizaciones").href = `cotizaciones.html?buscar=${encodeURIComponent(cliente.nombre)}`;
    document.getElementById("lnkVentas").href = `ventas.html?buscar=${encodeURIComponent(cliente.nombre)}`;

    accesos.style.display = "flex";

  } else {

    accesos.style.display = "none";
  }

  errorModal.textContent = "";
  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar";

  modal.style.display = "flex";

  if (!cliente) campos.nombre.focus();
}


function cerrarModal() {
  if (guardando) return;
  modal.style.display = "none";
}


document.getElementById("btnNuevoCliente").addEventListener("click", () => abrirModal(null));
document.getElementById("btnCancelarCliente").addEventListener("click", cerrarModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) cerrarModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.style.display !== "none") cerrarModal();
});


btnGuardar.addEventListener("click", async () => {

  if (guardando) return;

  const datos = {};
  Object.keys(campos).forEach(k => { datos[k] = campos[k].value.trim(); });

  if (datos.nombre.length < 2) {
    errorModal.textContent = "Escribe el nombre del cliente.";
    return;
  }

  guardando = true;
  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";
  errorModal.textContent = "";

  try {

    const respuesta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(Object.assign({ accion: "guardarCliente", token: usuario.token, id: editandoId }, datos))
    });

    const resultado = await respuesta.json();

    if (!resultado.ok) {
      if (resultado.sesionExpirada) return sesionVencida(resultado.mensaje);
      throw new Error(resultado.mensaje);
    }

    const guardado = resultado.cliente;
    const indice = clientes.findIndex(c => c.id === guardado.id);

    if (indice === -1) {
      clientes.push(Object.assign({ cotizaciones: 0, compras: 0, total: 0, ultimaCompra: "" }, guardado));
    } else {
      clientes[indice] = Object.assign({}, clientes[indice], guardado);
    }

    guardando = false;
    cerrarModal();
    render();

  } catch (error) {

    console.error(error);
    errorModal.textContent = error.message || "No se pudo guardar.";
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Guardar";

  } finally {

    guardando = false;
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


// ======================================================
// ARRANQUE
// ======================================================

cargarClientes();
