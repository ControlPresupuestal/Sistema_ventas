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
// CARGAR Y MOSTRAR
// ======================================================

const lista = document.getElementById("listaUsuarios");

const ROLES_BASE = ["ADMINISTRADOR", "VENDEDORA"];

let usuarios = [];
let yo = String(usuario.usuario || "").trim().toLowerCase();


async function cargarUsuarios() {

  try {

    const parametros = new URLSearchParams({ accion: "usuarios", token: usuario.token });
    const respuesta = await fetch(`${API_URL}?${parametros.toString()}`);
    const datos = await respuesta.json();

    if (!datos.ok) {
      if (datos.sesionExpirada) return sesionVencida(datos.mensaje);
      throw new Error(datos.mensaje);
    }

    usuarios = datos.usuarios || [];
    yo = datos.yo || yo;

    render();

  } catch (error) {

    console.error(error);

    lista.innerHTML = `
      <tr>
        <td colspan="5" class="cotizacion-vacia">
          <strong>No se pudieron cargar los usuarios.</strong>
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


function render() {

  const ordenados = usuarios.slice().sort((a, b) =>
    (a.estado === b.estado ? 0 : a.estado === "ACTIVO" ? -1 : 1) ||
    (a.rol === b.rol ? 0 : a.rol === "ADMINISTRADOR" ? -1 : 1) ||
    a.nombre.localeCompare(b.nombre, "es")
  );

  lista.innerHTML = ordenados.map(u => `
    <tr class="historial-fila${u.estado === "INACTIVO" ? " producto-inactivo" : ""}" data-id="${escaparHTML(u.id)}">
      <td data-label="Nombre">
        <strong>${escaparHTML(u.nombre)}</strong>
        ${u.usuario.toLowerCase() === yo ? '<span class="etiqueta-tu">(tú)</span>' : ""}
      </td>
      <td data-label="Usuario">${escaparHTML(u.usuario)}</td>
      <td data-label="Rol">
        <span class="chip-rol${u.rol === "ADMINISTRADOR" ? " admin" : ""}">${escaparHTML(u.rol)}</span>
      </td>
      <td data-label="Estado">
        <span class="estado-chip ${u.estado === "ACTIVO" ? "estado-vendido" : "estado-anulado"}">${u.estado}</span>
      </td>
      <td class="historial-derecha"><button class="btn-editar-producto">Editar</button></td>
    </tr>`).join("") || `
    <tr><td colspan="5" class="cotizacion-vacia">No hay usuarios.</td></tr>`;
}


lista.addEventListener("click", (event) => {

  const fila = event.target.closest("tr[data-id]");

  if (!fila) return;

  const encontrado = usuarios.find(u => u.id === fila.dataset.id);

  if (encontrado) abrirModal(encontrado);
});


// ======================================================
// NUEVO / EDITAR
// ======================================================

const modal = document.getElementById("modalUsuario");
const btnGuardar = document.getElementById("btnGuardarUsuario");
const errorModal = document.getElementById("modalUsuarioError");

const campos = {
  nombre: document.getElementById("fNombre"),
  usuario: document.getElementById("fUsuario"),
  clave: document.getElementById("fClave"),
  rol: document.getElementById("fRol"),
  estado: document.getElementById("fEstado")
};

let editando = null;
let guardando = false;


function cargarRoles(seleccionado) {

  const roles = [...new Set(ROLES_BASE.concat(usuarios.map(u => u.rol)).filter(Boolean))];

  campos.rol.innerHTML = roles
    .map(r => `<option value="${escaparHTML(r)}">${escaparHTML(r.charAt(0) + r.slice(1).toLowerCase())}</option>`)
    .join("");

  campos.rol.value = seleccionado || "VENDEDORA";
}


function abrirModal(u) {

  editando = u;

  const soyYo = u && u.usuario.toLowerCase() === yo;

  document.getElementById("tituloModalUsuario").textContent = u ? "Editar usuario" : "Nuevo usuario";

  document.getElementById("textoUsuario").textContent = u
    ? (soyYo
        ? "Esta es tu cuenta. No puedes quitarte el rol de administradora ni desactivarte."
        : "Si la desactivas o cambias su contraseña o rol, su sesión abierta se cerrará.")
    : "Crea el acceso para una nueva vendedora o administradora.";

  document.getElementById("etiquetaClave").textContent = u ? "Nueva contraseña (opcional)" : "Contraseña";

  campos.nombre.value = u ? u.nombre : "";
  campos.usuario.value = u ? u.usuario : "";
  campos.clave.value = "";
  campos.clave.placeholder = u ? "Déjala vacía para no cambiarla" : "Mínimo 6 caracteres";
  cargarRoles(u ? u.rol : "VENDEDORA");
  campos.estado.value = u ? u.estado : "ACTIVO";

  campos.rol.disabled = !!soyYo;
  campos.estado.disabled = !!soyYo;

  errorModal.textContent = "";
  btnGuardar.disabled = false;
  btnGuardar.textContent = "Guardar";

  modal.style.display = "flex";

  (u ? campos.clave : campos.nombre).focus();
}


function cerrarModal() {
  if (guardando) return;
  modal.style.display = "none";
}


document.getElementById("btnNuevoUsuario").addEventListener("click", () => abrirModal(null));
document.getElementById("btnCancelarUsuario").addEventListener("click", cerrarModal);

modal.addEventListener("click", (event) => {
  if (event.target === modal) cerrarModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.style.display !== "none") cerrarModal();
});


btnGuardar.addEventListener("click", async () => {

  if (guardando) return;

  const datos = {
    nombre: campos.nombre.value.trim(),
    usuario: campos.usuario.value.trim().toLowerCase(),
    clave: campos.clave.value,
    rol: campos.rol.value,
    estado: campos.estado.value
  };

  if (datos.nombre.length < 2) {
    errorModal.textContent = "Escribe el nombre.";
    return;
  }

  if (!/^[a-z0-9._-]{3,30}$/.test(datos.usuario)) {
    errorModal.textContent = "El usuario debe tener de 3 a 30 caracteres, sin espacios (letras, números, punto o guion).";
    return;
  }

  if (!editando && datos.clave.length < 6) {
    errorModal.textContent = "La contraseña debe tener al menos 6 caracteres.";
    return;
  }

  if (editando && datos.clave && datos.clave.length < 6) {
    errorModal.textContent = "La nueva contraseña debe tener al menos 6 caracteres.";
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
        accion: "guardarUsuario",
        token: usuario.token,
        id: editando ? editando.id : ""
      }, datos))
    });

    const resultado = await respuesta.json();

    if (!resultado.ok) {
      if (resultado.sesionExpirada) return sesionVencida(resultado.mensaje);
      throw new Error(resultado.mensaje);
    }

    guardando = false;
    cerrarModal();
    cargarUsuarios();

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


cargarUsuarios();
