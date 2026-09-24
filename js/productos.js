const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";

const STOCK_BAJO = 2;


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

const esAdministradora =
  String(usuario.rol || "").trim().toUpperCase() === "ADMINISTRADOR";

document.getElementById("nombreUsuario").textContent = usuario.nombre;
document.getElementById("rolUsuario").textContent = usuario.rol;
document.getElementById("avatarUsuario").textContent = obtenerIniciales(usuario.nombre);

if (esAdministradora) {
  document.getElementById("btnNuevoProducto").style.display = "inline-flex";
} else {
  document.body.classList.add("solo-lectura");
}


// ======================================================
// ELEMENTOS
// ======================================================

const buscarInput = document.getElementById("buscar");
const filtroStock = document.getElementById("filtroStock");
const filtroEstado = document.getElementById("filtroEstado");
const lista = document.getElementById("listaProductos");

let productos = [];


// ======================================================
// CARGAR
// ======================================================

async function cargarProductos() {

  try {

    const parametros = new URLSearchParams({
      accion: "inventario",
      token: usuario.token
    });

    const respuesta = await fetch(`${API_URL}?${parametros.toString()}`);
    const datos = await respuesta.json();

    if (!datos.ok) {
      if (datos.sesionExpirada) return sesionVencida(datos.mensaje);
      throw new Error(datos.mensaje);
    }

    productos = datos.productos || [];

    actualizarSugerencias();
    render();

  } catch (error) {

    console.error(error);

    lista.innerHTML = `
      <tr>
        <td colspan="7" class="cotizacion-vacia">
          <strong>No se pudieron cargar los productos.</strong>
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
// FILTROS
// ======================================================

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}


function filtrar() {

  const texto = normalizar(buscarInput.value.trim());
  const stock = filtroStock.value;
  const estado = filtroEstado.value;

  return productos.filter(p => {

    if (texto) {
      const campos = normalizar([p.producto, p.color, p.talla, p.id].join(" "));
      const palabras = texto.split(/\s+/);
      if (!palabras.every(palabra => campos.includes(palabra))) return false;
    }

    if (stock === "con" && p.stock <= 0) return false;
    if (stock === "bajo" && !(p.stock > 0 && p.stock <= STOCK_BAJO)) return false;
    if (stock === "agotado" && p.stock > 0) return false;

    if (estado && p.estado !== estado) return false;

    return true;
  });
}


let temporizador;

buscarInput.addEventListener("input", () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(render, 200);
});

filtroStock.addEventListener("change", render);
filtroEstado.addEventListener("change", render);

document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
  buscarInput.value = "";
  filtroStock.value = "";
  filtroEstado.value = "";
  render();
});


// ======================================================
// MOSTRAR
// ======================================================

const ORDEN_TALLAS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

function ordenTalla(talla) {
  const t = String(talla).trim().toUpperCase();
  const i = ORDEN_TALLAS.indexOf(t);
  if (i !== -1) return i;
  const numero = parseFloat(t);
  return isNaN(numero) ? 100 : 20 + numero;
}


function claseStock(stock) {
  if (stock <= 0) return "stock-agotado";
  if (stock <= STOCK_BAJO) return "stock-bajo";
  return "stock-ok";
}


function render() {

  const visibles = filtrar()
    .sort((a, b) =>
      a.producto.localeCompare(b.producto, "es") ||
      ordenTalla(a.talla) - ordenTalla(b.talla) ||
      a.talla.localeCompare(b.talla, "es", { numeric: true }) ||
      a.color.localeCompare(b.color, "es")
    );

  // Resumen
  const nombres = new Set(visibles.map(p => normalizar(p.producto)));
  const unidades = visibles.reduce((suma, p) => suma + Math.max(p.stock, 0), 0);
  const alertas = visibles.filter(p => p.estado === "ACTIVO" && p.stock <= STOCK_BAJO).length;

  document.getElementById("resumenProductos").textContent = nombres.size;
  document.getElementById("resumenVariantes").textContent = visibles.length;
  document.getElementById("resumenUnidades").textContent = unidades.toLocaleString("es-PE");
  document.getElementById("resumenAlertas").textContent = alertas;

  if (visibles.length === 0) {

    lista.innerHTML = `
      <tr>
        <td colspan="7" class="cotizacion-vacia">
          <div>👗</div>
          <strong>${productos.length ? "No hay productos con esos filtros" : "Aún no hay productos"}</strong>
          <span>${productos.length ? "Prueba con otra búsqueda." : (esAdministradora ? "Agrega el primero con + Nuevo producto." : "")}</span>
        </td>
      </tr>`;

    return;
  }

  let anterior = "";

  lista.innerHTML = visibles.map(p => {

    const nombre = normalizar(p.producto);
    const primero = nombre !== anterior;
    anterior = nombre;

    return `
      <tr class="producto-fila${primero ? " grupo-inicio" : ""}${p.estado === "INACTIVO" ? " producto-inactivo" : ""}">
        <td data-label="Producto">
          <strong class="${primero ? "" : "nombre-repetido"}">${escaparHTML(p.producto)}</strong>
          <small class="historial-sub">${escaparHTML(p.id)}</small>
        </td>
        <td data-label="Talla">${escaparHTML(p.talla)}</td>
        <td data-label="Color">${escaparHTML(p.color)}</td>
        <td data-label="Precio" class="historial-derecha">S/ ${Number(p.precio).toFixed(2)}</td>
        <td data-label="Stock" class="historial-derecha">
          <span class="chip-stock ${claseStock(p.stock)}">${p.stock}</span>
        </td>
        <td data-label="Estado">
          <span class="estado-chip ${p.estado === "ACTIVO" ? "estado-vendido" : "estado-anulado"}">${p.estado}</span>
        </td>
        <td class="historial-derecha solo-admin-col">
          <button class="btn-editar-producto" data-id="${escaparHTML(p.id)}">Editar</button>
        </td>
      </tr>`;
  }).join("");
}


// ======================================================
// EDITAR / NUEVO (solo administradora)
// ======================================================

const modal = document.getElementById("modalProducto");
const btnGuardar = document.getElementById("btnGuardarProducto");
const errorModal = document.getElementById("modalProductoError");

const campos = {
  producto: document.getElementById("fProducto"),
  talla: document.getElementById("fTalla"),
  color: document.getElementById("fColor"),
  precio: document.getElementById("fPrecio"),
  stock: document.getElementById("fStock"),
  estado: document.getElementById("fEstado")
};

let editandoId = "";
let guardando = false;


function actualizarSugerencias() {

  const nombres = [...new Set(productos.map(p => p.producto))].sort((a, b) => a.localeCompare(b, "es"));

  document.getElementById("listaNombres").innerHTML =
    nombres.map(n => `<option value="${escaparHTML(n)}">`).join("");
}


function abrirModal(producto) {

  editandoId = producto ? producto.id : "";

  document.getElementById("tituloModalProducto").textContent =
    producto ? "Editar producto" : "Nuevo producto";

  document.getElementById("codigoProducto").textContent =
    producto ? `Código ${producto.id}` : "El código se genera automáticamente.";

  campos.producto.value = producto ? producto.producto : "";
  campos.talla.value = producto ? producto.talla : "";
  campos.color.value = producto ? producto.color : "";
  campos.precio.value = producto ? Number(producto.precio).toFixed(2) : "";
  campos.stock.value = producto ? producto.stock : "";
  campos.estado.value = producto ? producto.estado : "ACTIVO";

  errorModal.textContent = "";
  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar";

  modal.style.display = "flex";

  (producto ? campos.stock : campos.producto).focus();
}


function cerrarModal() {
  if (guardando) return;
  modal.style.display = "none";
}


document.getElementById("btnNuevoProducto").addEventListener("click", () => abrirModal(null));
document.getElementById("btnCancelarProducto").addEventListener("click", cerrarModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) cerrarModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.style.display !== "none") cerrarModal();
});

lista.addEventListener("click", (event) => {

  const boton = event.target.closest(".btn-editar-producto");

  if (!boton || !esAdministradora) return;

  const producto = productos.find(p => p.id === boton.dataset.id);

  if (producto) abrirModal(producto);
});


btnGuardar.addEventListener("click", async () => {

  if (guardando) return;

  const datos = {
    producto: campos.producto.value.trim(),
    talla: campos.talla.value.trim(),
    color: campos.color.value.trim(),
    precio: Number(campos.precio.value),
    stock: Number(campos.stock.value),
    estado: campos.estado.value
  };

  if (!datos.producto || !datos.talla || !datos.color) {
    errorModal.textContent = "Completa producto, talla y color.";
    return;
  }

  if (campos.precio.value === "" || !(datos.precio >= 0)) {
    errorModal.textContent = "Ingresa un precio válido.";
    return;
  }

  if (campos.stock.value === "" || !Number.isInteger(datos.stock) || datos.stock < 0) {
    errorModal.textContent = "El stock debe ser un número entero de 0 o más.";
    return;
  }

  guardando = true;
  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";
  errorModal.textContent = "";

  try {

    const respuesta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(Object.assign({
        accion: "guardarProducto",
        token: usuario.token,
        id: editandoId
      }, datos))
    });

    const resultado = await respuesta.json();

    if (!resultado.ok) {
      if (resultado.sesionExpirada) return sesionVencida(resultado.mensaje);
      throw new Error(resultado.mensaje);
    }

    const guardado = resultado.producto;
    const indice = productos.findIndex(p => p.id === guardado.id);

    if (indice === -1) {
      productos.push(guardado);
    } else {
      productos[indice] = guardado;
    }

    guardando = false;
    cerrarModal();
    actualizarSugerencias();
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

cargarProductos();
