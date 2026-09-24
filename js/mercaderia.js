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

const productoSelect = document.getElementById("producto");
const cantidadInput = document.getElementById("cantidad");
const costoInput = document.getElementById("costo");
const ayuda = document.getElementById("ayudaProducto");
const tablaLineas = document.getElementById("lineasIngreso");
const btnGuardar = document.getElementById("btnGuardarIngreso");
const mensaje = document.getElementById("mensajeIngreso");

const ORDEN_TALLAS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

let productos = [];
let lineas = [];
let guardando = false;

const soles = n => "S/ " + Number(n || 0).toFixed(2);


async function pedir(accion) {

  const respuesta = await fetch(`${API_URL}?${new URLSearchParams({ accion, token: usuario.token })}`);
  const datos = await respuesta.json();

  if (!datos.ok) {
    if (datos.sesionExpirada) {
      sessionStorage.removeItem("zareinaUsuario");
      alert(datos.mensaje);
      window.location.replace("index.html");
    }
    throw new Error(datos.mensaje);
  }

  return datos;
}


// ======================================================
// PRODUCTOS
// ======================================================

async function cargarProductos() {

  try {

    const datos = await pedir("inventario");

    productos = (datos.productos || []).slice().sort((a, b) =>
      a.producto.localeCompare(b.producto, "es") ||
      ordenTalla(a.talla) - ordenTalla(b.talla) ||
      a.color.localeCompare(b.color, "es"));

    const grupos = {};
    productos.forEach(p => { (grupos[p.producto] = grupos[p.producto] || []).push(p); });

    productoSelect.innerHTML = `<option value="">Seleccionar producto</option>` +
      Object.keys(grupos).map(nombre => `
        <optgroup label="${escaparHTML(nombre)}">
          ${grupos[nombre].map(p => `
            <option value="${escaparHTML(p.id)}">
              ${escaparHTML(p.producto)} · ${escaparHTML(p.talla)} · ${escaparHTML(p.color)} — stock ${p.stock}${p.estado === "INACTIVO" ? " (inactivo)" : ""}
            </option>`).join("")}
        </optgroup>`).join("");

  } catch (error) {

    console.error(error);
    productoSelect.innerHTML = `<option value="">No se pudieron cargar los productos</option>`;
  }
}


function ordenTalla(talla) {
  const i = ORDEN_TALLAS.indexOf(String(talla).toUpperCase());
  return i === -1 ? 100 + (Number(talla) || 0) : i;
}


productoSelect.addEventListener("change", () => {

  const p = productos.find(x => x.id === productoSelect.value);

  if (!p) {
    ayuda.textContent = "";
    return;
  }

  costoInput.value = p.costo !== null && p.costo !== undefined ? p.costo : "";

  ayuda.textContent = p.costo !== null && p.costo !== undefined
    ? `Costo actual: ${soles(p.costo)} · precio de venta: ${soles(p.precio)} · stock: ${p.stock}`
    : `Todavía no tiene costo registrado · precio de venta: ${soles(p.precio)} · stock: ${p.stock}`;

  cantidadInput.focus();
  cantidadInput.select();
});


// ======================================================
// LÍNEAS DEL INGRESO
// ======================================================

document.getElementById("btnAgregar").addEventListener("click", () => {

  const p = productos.find(x => x.id === productoSelect.value);
  const cantidad = Number(cantidadInput.value);
  const costo = Number(costoInput.value);

  if (!p) return mostrarMensaje("Selecciona un producto.", "error");
  if (!Number.isInteger(cantidad) || cantidad <= 0) return mostrarMensaje("La cantidad debe ser un número entero mayor que 0.", "error");
  if (costoInput.value === "" || !(costo >= 0)) return mostrarMensaje("Escribe el costo unitario (lo que te costó cada prenda).", "error");

  const existente = lineas.find(l => l.id === p.id && l.costo === costo);

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    lineas.push({ id: p.id, producto: p.producto, talla: p.talla, color: p.color, cantidad, costo });
  }

  mostrarMensaje("", "");
  productoSelect.value = "";
  cantidadInput.value = 1;
  costoInput.value = "";
  ayuda.textContent = "";
  productoSelect.focus();

  renderLineas();
});


function renderLineas() {

  if (!lineas.length) {
    tablaLineas.innerHTML = `<tr><td colspan="7" class="cotizacion-vacia">Agrega los productos que llegaron.</td></tr>`;
  } else {
    tablaLineas.innerHTML = lineas.map((l, i) => `
      <tr data-i="${i}">
        <td><strong>${escaparHTML(l.producto)}</strong></td>
        <td>${escaparHTML(l.talla)}</td>
        <td>${escaparHTML(l.color)}</td>
        <td><input class="input-tabla" type="number" min="1" step="1" value="${l.cantidad}" data-campo="cantidad"></td>
        <td><input class="input-tabla" type="number" min="0" step="0.10" value="${l.costo}" data-campo="costo"></td>
        <td><strong>${soles(l.cantidad * l.costo)}</strong></td>
        <td><button class="btn-quitar" title="Quitar" data-quitar>×</button></td>
      </tr>`).join("");
  }

  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + l.cantidad * l.costo, 0);

  document.getElementById("totalUnidades").textContent = unidades;
  document.getElementById("totalCosto").textContent = total.toFixed(2);

  btnGuardar.disabled = !lineas.length || guardando;
}


tablaLineas.addEventListener("click", (event) => {
  if (!event.target.closest("[data-quitar]")) return;
  lineas.splice(Number(event.target.closest("tr").dataset.i), 1);
  renderLineas();
});

tablaLineas.addEventListener("change", (event) => {

  const input = event.target.closest("input[data-campo]");
  if (!input) return;

  const l = lineas[Number(input.closest("tr").dataset.i)];
  const n = Number(input.value);

  if (input.dataset.campo === "cantidad" && Number.isInteger(n) && n > 0) l.cantidad = n;
  if (input.dataset.campo === "costo" && n >= 0 && input.value !== "") l.costo = n;

  renderLineas();
});


// ======================================================
// GUARDAR
// ======================================================

btnGuardar.addEventListener("click", async () => {

  if (guardando || !lineas.length) return;

  const proveedor = document.getElementById("proveedor").value.trim();

  if (proveedor.length < 2) {
    document.getElementById("proveedor").focus();
    return mostrarMensaje("Escribe el proveedor.", "error");
  }

  guardando = true;
  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";
  mostrarMensaje("", "");

  try {

    const respuesta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "registrarIngreso",
        token: usuario.token,
        proveedor: proveedor,
        nota: document.getElementById("notaIngreso").value.trim(),
        items: lineas.map(l => ({ id: l.id, cantidad: l.cantidad, costo: l.costo }))
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

    lineas = [];
    document.getElementById("notaIngreso").value = "";

    mostrarMensaje(`✓ Ingreso ${datos.ingreso.numero} guardado: ${datos.ingreso.unidades} unidades, ${soles(datos.ingreso.total)}. El stock ya subió.`, "ok");

    cargarProductos();
    cargarHistorial();

  } catch (error) {

    console.error(error);
    mostrarMensaje(error.message || "No se pudo guardar el ingreso.", "error");

  } finally {

    guardando = false;
    btnGuardar.textContent = "Guardar ingreso";
    renderLineas();
  }
});


function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = "op-mensaje" + (tipo ? " " + tipo : "");
}


// ======================================================
// HISTORIAL
// ======================================================

async function cargarHistorial() {

  const contenedor = document.getElementById("historialIngresos");

  try {

    const datos = await pedir("ingresos");

    document.getElementById("listaProveedores").innerHTML =
      (datos.proveedores || []).map(p => `<option value="${escaparHTML(p)}"></option>`).join("");

    const ingresos = datos.ingresos || [];

    document.getElementById("conteoIngresos").textContent = ingresos.length ? `últimos ${ingresos.length}` : "";

    contenedor.innerHTML = ingresos.length
      ? ingresos.map(i => `
          <details>
            <summary>
              <span>
                <strong>${escaparHTML(i.proveedor)}</strong>
                <small>${escaparHTML(i.numero)} · ${escaparHTML(i.fecha)} · ${escaparHTML(i.usuario)}${i.nota ? " · " + escaparHTML(i.nota) : ""}</small>
              </span>
              <span style="text-align:right;">
                <strong>${soles(i.total)}</strong>
                <small>${i.unidades} unidades</small>
              </span>
            </summary>
            <ul>
              ${i.detalle.map(d => `<li>${escaparHTML(d.producto)} · ${escaparHTML(d.talla)} · ${escaparHTML(d.color)} — ${d.cantidad} × ${soles(d.costo)} = ${soles(d.subtotal)}</li>`).join("")}
            </ul>
          </details>`).join("")
      : `<div class="op-estado">Todavía no hay ingresos registrados.</div>`;

  } catch (error) {

    console.error(error);
    contenedor.innerHTML = `<div class="op-estado">No se pudo cargar el historial. ${escaparHTML(error.message)}</div>`;
  }
}


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


cargarProductos();
cargarHistorial();
