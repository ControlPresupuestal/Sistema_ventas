const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";


// ======================================================
// SESIÓN
// ======================================================

const sesion =
  sessionStorage.getItem(
    "zareinaUsuario"
  );


const usuario =
  sesion ? JSON.parse(sesion) : null;


if (!usuario || !usuario.token) {

  sessionStorage.removeItem("zareinaUsuario");

  window.location.replace("index.html");

  throw new Error("Sin sesión");
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
        numero: numero,
        token: usuario.token
      });


    const respuesta =
      await fetch(
        `${API_URL}?${parametros.toString()}`
      );


    const datos =
      await respuesta.json();


    if (!datos.ok) {

      if (datos.sesionExpirada) {

        sessionStorage.removeItem("zareinaUsuario");

        alert(datos.mensaje);

        window.location.replace("index.html");

        return;
      }

      throw new Error(
        datos.mensaje
      );

    }


    mostrarCotizacion(
      datos.cotizacion
    );


    numeroCargado =
      datos.cotizacion.numero;

    btnPDF.disabled = false;
    btnImagen.disabled = false;


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

const btnPDF =
  document.getElementById("btnPDF");

const btnImagen =
  document.getElementById("btnImagen");

let numeroCargado = "";


// Se activan solo cuando la cotización ya cargó
btnPDF.disabled = true;
btnImagen.disabled = true;


async function capturarDocumento() {

  if (typeof html2canvas === "undefined") {
    throw new Error(
      "No se pudo cargar la herramienta de captura. Revisa tu conexión y recarga la página."
    );
  }

  const documento =
    document.getElementById(
      "documentoCotizacion"
    );

  // Siempre se captura con diseño de escritorio,
  // aunque se use desde el celular.
  return html2canvas(documento, {
    scale: 2,
    logging: false,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: 1100,
    onclone: (doc) => {
      const copia =
        doc.getElementById("documentoCotizacion");
      copia.style.width = "1000px";
      copia.style.boxShadow = "none";
      const encabezado = copia.querySelector("thead tr");
      if (encabezado) encabezado.style.background = "#6f442f";
    }
  });

}


function nombreArchivo(extension) {
  return `Cotizacion-${numeroCargado || "ZAREINA"}.${extension}`;
}


function descargarBlob(blob, nombre) {

  const url =
    URL.createObjectURL(blob);

  const enlace =
    document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

}


async function ejecutarConBoton(boton, textoTrabajando, accion) {

  const textoOriginal =
    boton.textContent;

  btnPDF.disabled = true;
  btnImagen.disabled = true;

  boton.textContent =
    textoTrabajando;

  try {

    await accion();

  } catch (error) {

    if (error && error.name === "AbortError") {
      return; // El usuario cerró el menú de compartir
    }

    console.error(error);

    alert(
      "No se pudo generar el archivo:\n" +
      (error.message || error)
    );

  } finally {

    boton.textContent =
      textoOriginal;

    btnPDF.disabled = false;
    btnImagen.disabled = false;

  }

}


// ---------- IMAGEN (PNG) ----------
// En el celular abre el menú de compartir (WhatsApp, etc.).
// En la computadora descarga el archivo.

btnImagen.addEventListener(
  "click",
  () => ejecutarConBoton(
    btnImagen,
    "Generando...",
    async () => {

      const canvas =
        await capturarDocumento();

      const blob =
        await new Promise(resolve =>
          canvas.toBlob(resolve, "image/png")
        );

      const nombre =
        nombreArchivo("png");

      const archivo =
        new File([blob], nombre, { type: "image/png" });

      if (
        navigator.canShare &&
        navigator.canShare({ files: [archivo] })
      ) {

        await navigator.share({
          files: [archivo],
          title: nombre
        });

      } else {

        descargarBlob(blob, nombre);

      }

    }
  )
);


// ---------- PDF (A4) ----------

btnPDF.addEventListener(
  "click",
  () => ejecutarConBoton(
    btnPDF,
    "Generando...",
    async () => {

      if (!window.jspdf) {
        throw new Error(
          "No se pudo cargar la herramienta de PDF. Revisa tu conexión y recarga la página."
        );
      }

      const canvas =
        await capturarDocumento();

      const { jsPDF } =
        window.jspdf;

      const pdf =
        new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4"
        });

      const margen = 10;

      const anchoPagina =
        pdf.internal.pageSize.getWidth() - margen * 2;

      const altoPagina =
        pdf.internal.pageSize.getHeight() - margen * 2;

      const altoImagen =
        canvas.height * anchoPagina / canvas.width;

      const imagen =
        canvas.toDataURL("image/jpeg", 0.95);

      // Si el documento es más alto que una hoja,
      // se reparte en varias páginas.
      let posicion = 0;

      pdf.addImage(imagen, "JPEG", margen, margen, anchoPagina, altoImagen);

      while (altoImagen - posicion > altoPagina) {

        posicion += altoPagina;

        pdf.addPage();

        pdf.addImage(
          imagen,
          "JPEG",
          margen,
          margen - posicion,
          anchoPagina,
          altoImagen
        );

      }

      pdf.save(
        nombreArchivo("pdf")
      );

    }
  )
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
