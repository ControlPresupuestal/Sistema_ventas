const API_URL =
  "https://script.google.com/macros/s/AKfycbwRtoQGreKj8V-sY7DmK596CpMxvPim001r2VT-_dYHn73djudhq0Duja5uOt5uf_lL/exec";

let productos = [];
let detalle = [];


// ==========================
// SESIÓN
// ==========================

const sesion =
  sessionStorage.getItem("zareinaUsuario");

if (!sesion) {
  window.location.href = "index.html";
}

const usuario = JSON.parse(sesion);

document.getElementById("nombreUsuario").textContent =
  usuario.nombre;

document.getElementById("rolUsuario").textContent =
  usuario.rol;

document.getElementById("avatarUsuario").textContent =
  obtenerIniciales(usuario.nombre);


// ==========================
// ELEMENTOS
// ==========================

const productoSelect =
  document.getElementById("producto");

const tallaSelect =
  document.getElementById("talla");

const colorSelect =
  document.getElementById("color");

const cantidadInput =
  document.getElementById("cantidad");

const precioProducto =
  document.getElementById("precioProducto");

const stockInfo =
  document.getElementById("stockInfo");

const btnAgregar =
  document.getElementById("btnAgregarProducto");

const detalleCotizacion =
  document.getElementById("detalleCotizacion");

const descuentoInput =
  document.getElementById("descuento");


// ==========================
// CARGAR PRODUCTOS
// ==========================

async function cargarProductos() {

  try {

    const respuesta =
      await fetch(`${API_URL}?accion=productos`);

    const datos =
      await respuesta.json();

    if (!datos.ok) {
      throw new Error(datos.mensaje);
    }

    productos = datos.productos;

    cargarListaProductos();

  } catch (error) {

    console.error(error);

    productoSelect.innerHTML =
      `<option value="">
        Error al cargar productos
       </option>`;

  }

}


function cargarListaProductos() {

  const nombres =
    [...new Set(
      productos.map(p => p.producto)
    )]
    .filter(Boolean)
    .sort((a, b) =>
      a.localeCompare(b, "es")
    );

  productoSelect.innerHTML =
    `<option value="">
      Seleccionar producto
     </option>`;

  nombres.forEach(nombre => {

    const option =
      document.createElement("option");

    option.value = nombre;
    option.textContent = nombre;

    productoSelect.appendChild(option);

  });

}


// ==========================
// PRODUCTO → TALLA
// ==========================

productoSelect.addEventListener(
  "change",
  () => {

    reiniciarDesdeProducto();

    const producto =
      productoSelect.value;

    if (!producto) return;

    const tallas =
      [...new Set(
        productos
          .filter(p =>
            p.producto === producto &&
            p.stock > 0
          )
          .map(p => p.talla)
      )]
      .filter(Boolean);

    tallaSelect.innerHTML =
      `<option value="">
        Seleccionar
       </option>`;

    tallas.forEach(talla => {

      const option =
        document.createElement("option");

      option.value = talla;
      option.textContent = talla;

      tallaSelect.appendChild(option);

    });

    tallaSelect.disabled = false;

    stockInfo.textContent =
      `${tallas.length} talla(s) disponible(s)`;

  }
);


// ==========================
// TALLA → COLOR
// ==========================

tallaSelect.addEventListener(
  "change",
  () => {

    reiniciarDesdeTalla();

    const producto =
      productoSelect.value;

    const talla =
      tallaSelect.value;

    if (!talla) return;

    const colores =
      [...new Set(
        productos
          .filter(p =>
            p.producto === producto &&
            p.talla === talla &&
            p.stock > 0
          )
          .map(p => p.color)
      )]
      .filter(Boolean);

    colorSelect.innerHTML =
      `<option value="">
        Seleccionar
       </option>`;

    colores.forEach(color => {

      const option =
        document.createElement("option");

      option.value = color;
      option.textContent = color;

      colorSelect.appendChild(option);

    });

    colorSelect.disabled = false;

  }
);


// ==========================
// COLOR → STOCK/PRECIO
// ==========================

colorSelect.addEventListener(
  "change",
  () => {

    const variante =
      obtenerVarianteSeleccionada();

    if (!variante) {

      precioProducto.textContent =
        "0.00";

      cantidadInput.disabled = true;
      btnAgregar.disabled = true;

      return;
    }

    precioProducto.textContent =
      Number(variante.precio)
        .toFixed(2);

    cantidadInput.value = 1;

    cantidadInput.max =
      variante.stock;

    cantidadInput.disabled =
      false;

    btnAgregar.disabled =
      false;

    stockInfo.innerHTML =
      `<strong>${variante.stock}</strong>
       unidad(es) disponible(s)`;

  }
);


// ==========================
// AGREGAR
// ==========================

btnAgregar.addEventListener(
  "click",
  () => {

    const variante =
      obtenerVarianteSeleccionada();

    if (!variante) return;

    const cantidad =
      Number(cantidadInput.value);

    if (
      !cantidad ||
      cantidad < 1 ||
      cantidad > variante.stock
    ) {

      alert(
        `Solo hay ${variante.stock} unidad(es) disponibles.`
      );

      return;
    }


    const existente =
      detalle.find(
        item => item.id === variante.id
      );


    if (existente) {

      const nuevaCantidad =
        existente.cantidad + cantidad;

      if (
        nuevaCantidad >
        variante.stock
      ) {

        alert(
          `No puedes agregar más de ${variante.stock} unidad(es).`
        );

        return;
      }

      existente.cantidad =
        nuevaCantidad;

    } else {

      detalle.push({

        id: variante.id,

        producto:
          variante.producto,

        talla:
          variante.talla,

        color:
          variante.color,

        cantidad:
          cantidad,

        precio:
          Number(variante.precio),

        stock:
          Number(variante.stock)

      });

    }


    renderDetalle();
    limpiarSeleccionProducto();

  }
);


// ==========================
// TABLA
// ==========================

function renderDetalle() {

  detalleCotizacion.innerHTML = "";

  if (detalle.length === 0) {

    detalleCotizacion.innerHTML =
      `
      <tr>
        <td colspan="7"
            class="cotizacion-vacia">

          <div>🛍️</div>

          <strong>
            Aún no agregaste productos
          </strong>

          <span>
            Selecciona un producto arriba para comenzar.
          </span>

        </td>
      </tr>
      `;

    calcularTotales();

    return;
  }


  detalle.forEach(
    (item, index) => {

      const total =
        item.cantidad *
        item.precio;

      const fila =
        document.createElement("tr");

      fila.innerHTML =
        `
        <td>
          <strong>
            ${item.producto}
          </strong>
        </td>

        <td>
          ${item.talla}
        </td>

        <td>
          ${item.color}
        </td>

        <td>
          ${item.cantidad}
        </td>

        <td>
          S/ ${item.precio.toFixed(2)}
        </td>

        <td>
          <strong>
            S/ ${total.toFixed(2)}
          </strong>
        </td>

        <td>
          <button
            class="btn-eliminar"
            onclick="eliminarProducto(${index})">
            ×
          </button>
        </td>
        `;

      detalleCotizacion
        .appendChild(fila);

    }
  );

  calcularTotales();

}


function eliminarProducto(index) {

  detalle.splice(index, 1);

  renderDetalle();

}


// ==========================
// TOTALES
// ==========================

function calcularTotales() {

  const subtotal =
    detalle.reduce(
      (suma, item) =>
        suma +
        item.cantidad *
        item.precio,
      0
    );

  let descuento =
    Number(
      descuentoInput.value
    ) || 0;

  if (descuento < 0) {
    descuento = 0;
  }

  if (descuento > subtotal) {
    descuento = subtotal;
  }

  const total =
    subtotal - descuento;

  document
    .getElementById("subtotal")
    .textContent =
      subtotal.toFixed(2);

  document
    .getElementById("totalGeneral")
    .textContent =
      total.toFixed(2);

}


descuentoInput.addEventListener(
  "input",
  calcularTotales
);


// ==========================
// LIMPIAR
// ==========================

document
  .getElementById("btnLimpiar")
  .addEventListener(
    "click",
    () => {

      if (
        detalle.length > 0 &&
        !confirm(
          "¿Deseas limpiar toda la cotización?"
        )
      ) {
        return;
      }

      detalle = [];

      document
        .getElementById("cliente")
        .value = "";

      descuentoInput.value = 0;

      limpiarSeleccionProducto();

      renderDetalle();

    }
  );


// Guardar lo haremos después.
document
  .getElementById(
    "btnGuardarCotizacion"
  )
  .addEventListener(
    "click",
    () => {

      if (detalle.length === 0) {

        alert(
          "Agrega al menos un producto."
        );

        return;
      }

      alert(
        "¡Cotización lista! El siguiente paso será guardarla."
      );

    }
  );


// ==========================
// FUNCIONES AUXILIARES
// ==========================

function obtenerVarianteSeleccionada() {

  return productos.find(
    p =>
      p.producto ===
        productoSelect.value &&

      p.talla ===
        tallaSelect.value &&

      p.color ===
        colorSelect.value
  );

}


function reiniciarDesdeProducto() {

  tallaSelect.innerHTML =
    `<option value="">
      Seleccionar
     </option>`;

  colorSelect.innerHTML =
    `<option value="">
      Seleccionar
     </option>`;

  tallaSelect.disabled = true;
  colorSelect.disabled = true;
  cantidadInput.disabled = true;
  btnAgregar.disabled = true;

  precioProducto.textContent =
    "0.00";

}


function reiniciarDesdeTalla() {

  colorSelect.innerHTML =
    `<option value="">
      Seleccionar
     </option>`;

  colorSelect.disabled = true;
  cantidadInput.disabled = true;
  btnAgregar.disabled = true;

  precioProducto.textContent =
    "0.00";

}


function limpiarSeleccionProducto() {

  productoSelect.value = "";

  reiniciarDesdeProducto();

  stockInfo.textContent =
    "Selecciona un producto para consultar disponibilidad.";

}


function obtenerIniciales(nombre) {

  return nombre
    .trim()
    .split(" ")
    .slice(0, 2)
    .map(p =>
      p.charAt(0)
    )
    .join("")
    .toUpperCase();

}


// ARRANQUE
cargarProductos();
