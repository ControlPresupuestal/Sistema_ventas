const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";


let productos = [];
let detalle = [];


// ======================================================
// SESIÓN
// ======================================================

const sesion =
  sessionStorage.getItem(
    "zareinaUsuario"
  );


if (!sesion) {
  window.location.href =
    "index.html";
}


const usuario =
  JSON.parse(sesion);


if (!usuario.token) {

  sessionStorage.removeItem(
    "zareinaUsuario"
  );

  alert(
    "Debes iniciar sesión nuevamente."
  );

  window.location.href =
    "index.html";
}


document
  .getElementById(
    "nombreUsuario"
  )
  .textContent =
    usuario.nombre;


document
  .getElementById(
    "rolUsuario"
  )
  .textContent =
    usuario.rol;


document
  .getElementById(
    "avatarUsuario"
  )
  .textContent =
    obtenerIniciales(
      usuario.nombre
    );



// ======================================================
// ELEMENTOS
// ======================================================

const productoSelect =
  document.getElementById(
    "producto"
  );


const tallaSelect =
  document.getElementById(
    "talla"
  );


const colorSelect =
  document.getElementById(
    "color"
  );


const cantidadInput =
  document.getElementById(
    "cantidad"
  );


const precioProducto =
  document.getElementById(
    "precioProducto"
  );


const stockInfo =
  document.getElementById(
    "stockInfo"
  );


const btnAgregar =
  document.getElementById(
    "btnAgregarProducto"
  );


const detalleCotizacion =
  document.getElementById(
    "detalleCotizacion"
  );


const descuentoInput =
  document.getElementById(
    "descuento"
  );


const btnGuardar =
  document.getElementById(
    "btnGuardarCotizacion"
  );



// ======================================================
// PRODUCTOS
// ======================================================

async function cargarProductos() {

  try {

    const respuesta =
      await fetch(
        `${API_URL}?accion=productos`
      );


    const datos =
      await respuesta.json();


    if (!datos.ok) {
      throw new Error(
        datos.mensaje
      );
    }


    productos =
      datos.productos || [];


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

  const nombres = [

    ...new Set(
      productos.map(
        p => p.producto
      )
    )

  ]

    .filter(Boolean)

    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          "es"
        )
    );


  productoSelect.innerHTML =
    `<option value="">
       Seleccionar producto
     </option>`;


  nombres.forEach(nombre => {

    const option =
      document.createElement(
        "option"
      );


    option.value =
      nombre;


    option.textContent =
      nombre;


    productoSelect
      .appendChild(option);

  });

}



// ======================================================
// PRODUCTO → TALLA
// ======================================================

productoSelect
  .addEventListener(
    "change",
    () => {

      reiniciarDesdeProducto();


      const producto =
        productoSelect.value;


      if (!producto) {
        return;
      }


      const tallas = [

        ...new Set(

          productos

            .filter(p =>
              p.producto === producto &&
              Number(p.stock) > 0
            )

            .map(p =>
              p.talla
            )

        )

      ].filter(Boolean);


      tallaSelect.innerHTML =
        `<option value="">
           Seleccionar
         </option>`;


      tallas.forEach(talla => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          talla;


        option.textContent =
          talla;


        tallaSelect
          .appendChild(option);

      });


      tallaSelect.disabled =
        false;


      stockInfo.textContent =
        `${tallas.length} talla(s) disponible(s)`;

    }
  );



// ======================================================
// TALLA → COLOR
// ======================================================

tallaSelect
  .addEventListener(
    "change",
    () => {

      reiniciarDesdeTalla();


      const producto =
        productoSelect.value;


      const talla =
        tallaSelect.value;


      if (!talla) {
        return;
      }


      const colores = [

        ...new Set(

          productos

            .filter(p =>
              p.producto === producto &&
              p.talla === talla &&
              Number(p.stock) > 0
            )

            .map(p =>
              p.color
            )

        )

      ].filter(Boolean);


      colorSelect.innerHTML =
        `<option value="">
           Seleccionar
         </option>`;


      colores.forEach(color => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          color;


        option.textContent =
          color;


        colorSelect
          .appendChild(option);

      });


      colorSelect.disabled =
        false;

    }
  );



// ======================================================
// COLOR → STOCK
// ======================================================

colorSelect
  .addEventListener(
    "change",
    () => {

      const variante =
        obtenerVarianteSeleccionada();


      if (!variante) {

        precioProducto.textContent =
          "0.00";

        cantidadInput.disabled =
          true;

        btnAgregar.disabled =
          true;

        return;
      }


      const agregado =
        detalle
          .filter(
            item =>
              item.id ===
              variante.id
          )
          .reduce(
            (suma, item) =>
              suma +
              Number(
                item.cantidad
              ),
            0
          );


      const disponible =
        Number(variante.stock) -
        agregado;


      precioProducto.textContent =
        Number(
          variante.precio
        ).toFixed(2);


      cantidadInput.value =
        1;


      cantidadInput.max =
        disponible;


      cantidadInput.disabled =
        disponible <= 0;


      btnAgregar.disabled =
        disponible <= 0;


      stockInfo.innerHTML =
        `<strong>${disponible}</strong>
         unidad(es) disponible(s)`;

    }
  );



// ======================================================
// AGREGAR
// ======================================================

btnAgregar
  .addEventListener(
    "click",
    () => {

      const variante =
        obtenerVarianteSeleccionada();


      if (!variante) {
        return;
      }


      const cantidad =
        Number(
          cantidadInput.value
        );


      const existente =
        detalle.find(
          item =>
            item.id ===
            variante.id
        );


      const yaAgregado =
        existente
          ? Number(
              existente.cantidad
            )
          : 0;


      const disponible =
        Number(variante.stock) -
        yaAgregado;


      if (
        !cantidad ||
        cantidad < 1 ||
        cantidad > disponible
      ) {

        alert(
          `Solo hay ${disponible} unidad(es) disponibles.`
        );

        return;

      }


      if (existente) {

        existente.cantidad +=
          cantidad;

      } else {

        detalle.push({

          id:
            variante.id,

          producto:
            variante.producto,

          talla:
            variante.talla,

          color:
            variante.color,

          cantidad:
            cantidad,

          precio:
            Number(
              variante.precio
            ),

          stock:
            Number(
              variante.stock
            )

        });

      }


      renderDetalle();

      limpiarSeleccionProducto();

    }
  );



// ======================================================
// DETALLE
// ======================================================

function renderDetalle() {

  detalleCotizacion.innerHTML =
    "";


  if (
    detalle.length === 0
  ) {

    detalleCotizacion.innerHTML =
      `
      <tr>
        <td
          colspan="7"
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
        document.createElement(
          "tr"
        );


      fila.innerHTML =
        `
        <td>
          <strong>
            ${escaparHTML(item.producto)}
          </strong>
        </td>

        <td>
          ${escaparHTML(item.talla)}
        </td>

        <td>
          ${escaparHTML(item.color)}
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

  detalle.splice(
    index,
    1
  );


  renderDetalle();

}



// ======================================================
// TOTALES
// ======================================================

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


  if (
    descuento >
    subtotal
  ) {
    descuento =
      subtotal;
  }


  const total =
    subtotal -
    descuento;


  document
    .getElementById(
      "subtotal"
    )
    .textContent =
      subtotal.toFixed(2);


  document
    .getElementById(
      "totalGeneral"
    )
    .textContent =
      total.toFixed(2);

}



descuentoInput
  .addEventListener(
    "input",
    calcularTotales
  );



// ======================================================
// GUARDAR COTIZACIÓN
// ======================================================

btnGuardar
  .addEventListener(
    "click",
    guardarCotizacion
  );



async function guardarCotizacion() {

  const cliente =
    document
      .getElementById(
        "cliente"
      )
      .value
      .trim();


  if (!cliente) {

    alert(
      "Ingresa el nombre del cliente."
    );

    return;

  }


  if (
    detalle.length === 0
  ) {

    alert(
      "Agrega al menos un producto."
    );

    return;

  }


  const descuento =
    Number(
      descuentoInput.value
    ) || 0;


  btnGuardar.disabled =
    true;


  btnGuardar.textContent =
    "Guardando...";


  try {

    const parametros =
  new URLSearchParams({
    accion: "guardarCotizacion",
    token: usuario.token,
    cliente: cliente,
    descuento: descuento.toString(),
    productos: JSON.stringify(detalle)
  });

const respuesta =
  await fetch(
    `${API_URL}?${parametros.toString()}`
  );

    const datos =
      await respuesta.json();


    if (!datos.ok) {

      if (
        datos.sesionExpirada
      ) {

        sessionStorage
          .removeItem(
            "zareinaUsuario"
          );


        alert(
          datos.mensaje
        );


        window.location.href =
          "index.html";


        return;

      }


      throw new Error(
        datos.mensaje
      );

    }


    const cotizacion =
      datos.cotizacion;


    alert(
      `¡Cotización ${cotizacion.numero} guardada!\n\n` +
      `Cliente: ${cotizacion.cliente}\n` +
      `Total: S/ ${Number(cotizacion.total).toFixed(2)}`
    );


    document
      .querySelector(
        ".cotizacion-numero strong"
      )
      .textContent =
        cotizacion.numero;


    btnGuardar.textContent =
      "Cotización Guardada ✓";


    btnGuardar.disabled =
      true;


  } catch (error) {

    console.error(error);


    alert(
      "No se pudo guardar la cotización:\n" +
      error.message
    );


    btnGuardar.disabled =
      false;


    btnGuardar.textContent =
      "Guardar Cotización";

  }

}



// ======================================================
// LIMPIAR
// ======================================================

document
  .getElementById(
    "btnLimpiar"
  )
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
        .getElementById(
          "cliente"
        )
        .value =
          "";


      descuentoInput.value =
        0;


      btnGuardar.disabled =
        false;


      btnGuardar.textContent =
        "Guardar Cotización";


      document
        .querySelector(
          ".cotizacion-numero strong"
        )
        .textContent =
          "NUEVA";


      limpiarSeleccionProducto();

      renderDetalle();

    }
  );



// ======================================================
// AUXILIARES
// ======================================================

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


  tallaSelect.disabled =
    true;


  colorSelect.disabled =
    true;


  cantidadInput.disabled =
    true;


  btnAgregar.disabled =
    true;


  precioProducto.textContent =
    "0.00";

}



function reiniciarDesdeTalla() {

  colorSelect.innerHTML =
    `<option value="">
       Seleccionar
     </option>`;


  colorSelect.disabled =
    true;


  cantidadInput.disabled =
    true;


  btnAgregar.disabled =
    true;


  precioProducto.textContent =
    "0.00";

}



function limpiarSeleccionProducto() {

  productoSelect.value =
    "";


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



function escaparHTML(texto) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    String(texto);


  return div.innerHTML;

}



// ======================================================
// ARRANQUE
// ======================================================

cargarProductos();
