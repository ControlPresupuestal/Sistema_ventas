const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";


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
// OBTENER NÚMERO DE LA URL
// ======================================================

const parametrosURL =
  new URLSearchParams(
    window.location.search
  );


const numero =
  parametrosURL.get(
    "numero"
  );


if (!numero) {

  mostrarError(
    "No se indicó el número de cotización."
  );

} else {

  cargarCotizacion(numero);

}



// ======================================================
// CARGAR COTIZACIÓN
// ======================================================

async function cargarCotizacion(numero) {

  try {

    const parametros =
      new URLSearchParams({
        accion: "vercotizacion",
        numero: numero
      });


    const respuesta =
      await fetch(
        `${API_URL}?${parametros.toString()}`
      );


    const datos =
      await respuesta.json();


    if (!datos.ok) {

      throw new Error(
        datos.mensaje
      );

    }


    mostrarCotizacion(
      datos.cotizacion
    );


  } catch (error) {

    console.error(error);

    mostrarError(
      error.message
    );

  }

}



// ======================================================
// MOSTRAR COTIZACIÓN
// ======================================================

function mostrarCotizacion(cotizacion) {

  document
    .getElementById(
      "numeroCotizacion"
    )
    .textContent =
      cotizacion.numero;


  document
    .getElementById(
      "clienteCotizacion"
    )
    .textContent =
      cotizacion.cliente;


  document
    .getElementById(
      "fechaCotizacion"
    )
    .textContent =
      cotizacion.fecha;


  document
    .getElementById(
      "estadoCotizacion"
    )
    .textContent =
      cotizacion.estado;


  document
    .getElementById(
      "subtotalCotizacion"
    )
    .textContent =
      Number(
        cotizacion.subtotal
      ).toFixed(2);


  document
    .getElementById(
      "descuentoCotizacion"
    )
    .textContent =
      Number(
        cotizacion.descuento
      ).toFixed(2);


  document
    .getElementById(
      "totalCotizacion"
    )
    .textContent =
      Number(
        cotizacion.total
      ).toFixed(2);


  mostrarProductos(
    cotizacion.productos || []
  );

}



// ======================================================
// PRODUCTOS
// ======================================================

function mostrarProductos(productos) {

  const tbody =
    document.getElementById(
      "productosCotizacion"
    );


  tbody.innerHTML = "";


  if (productos.length === 0) {

    tbody.innerHTML =
      `
      <tr>
        <td
          colspan="6"
          class="cotizacion-vacia">
          No hay productos registrados.
        </td>
      </tr>
      `;

    return;

  }


  productos.forEach(
    producto => {

      const fila =
        document.createElement(
          "tr"
        );


      fila.innerHTML =
        `
        <td>
          <strong>
            ${escaparHTML(
              producto.producto
            )}
          </strong>
        </td>

        <td>
          ${escaparHTML(
            producto.talla
          )}
        </td>

        <td>
          ${escaparHTML(
            producto.color
          )}
        </td>

        <td>
          ${Number(
            producto.cantidad
          )}
        </td>

        <td>
          S/ ${Number(
            producto.precio
          ).toFixed(2)}
        </td>

        <td>
          <strong>
            S/ ${Number(
              producto.total
            ).toFixed(2)}
          </strong>
        </td>
        `;


      tbody.appendChild(
        fila
      );

    }
  );

}



// ======================================================
// ERROR
// ======================================================

function mostrarError(mensaje) {

  const documento =
    document.getElementById(
      "documentoCotizacion"
    );


  const error =
    document.getElementById(
      "errorCotizacion"
    );


  documento.style.display =
    "none";


  error.style.display =
    "block";


  error.innerHTML =
    `
      <strong>
        No pudimos cargar la cotización.
      </strong>

      <p>
        ${escaparHTML(mensaje)}
      </p>

      <a
        href="dashboard.html"
        class="btn-cotizacion-principal">
        Volver al inicio
      </a>
    `;

}



// ======================================================
// BOTONES PDF / IMAGEN
// ======================================================

// Por ahora solo comprobamos
// que la vista funcione.
// En el siguiente paso los activamos.

document
  .getElementById(
    "btnPDF"
  )
  .addEventListener(
    "click",
    () => {

      alert(
        "El PDF será el siguiente paso."
      );

    }
  );


document
  .getElementById(
    "btnImagen"
  )
  .addEventListener(
    "click",
    () => {

      alert(
        "La imagen será el siguiente paso."
      );

    }
  );



// ======================================================
// AUXILIARES
// ======================================================

function obtenerIniciales(nombre) {

  return nombre
    .trim()
    .split(" ")
    .slice(0, 2)
    .map(
      palabra =>
        palabra.charAt(0)
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
