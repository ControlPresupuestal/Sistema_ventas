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

    if (datos.configuracion) {
      aplicarConfiguracion(datos.configuracion, datos.cotizacion);
    }


    numeroCargado =
      datos.cotizacion.numero;

    prepararVenta(datos.cotizacion);

    prepararAnulacion(datos.cotizacion);

    prepararWhatsapp(datos.cotizacion, datos.configuracion || null, datos.clienteTelefono || "");

    avisoVentaRapida(datos.cotizacion.numero);

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
// DATOS DE LA TIENDA (Configuración)
// ======================================================

function aplicarConfiguracion(config, cotizacion) {

  const poner = (id, texto) => {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  };

  const nombre = config.tiendaNombre || "ZAREINA";

  poner("docTiendaNombre", nombre);
  poner("docTiendaEslogan", config.tiendaEslogan || "");
  poner("docPieNombre", nombre);
  poner("docMensajeTitulo", config.mensajeTitulo || "");
  poner("docMensajeTexto", config.mensajeTexto || "");

  document.title = `${nombre} | Cotización`;

  // Contacto: RUC, dirección, teléfono, Instagram, correo
  const contacto = [
    config.tiendaRuc ? `RUC ${config.tiendaRuc}` : "",
    config.tiendaDireccion,
    config.tiendaTelefono ? `Tel. ${config.tiendaTelefono}` : "",
    config.tiendaInstagram,
    config.tiendaEmail
  ].filter(Boolean);

  poner("docTiendaContacto", contacto.join("  ·  "));

  // Validez
  poner("docPieValidez", textoValidez(cotizacion.fecha, Number(config.validezDias) || 0));

  // Formas de pago
  const activos = config.metodosActivos || [];

  const nombres = {
    EFECTIVO: "Efectivo",
    YAPE: "Yape",
    PLIN: "Plin",
    TRANSFERENCIA: "Transferencia",
    TARJETA: "Tarjeta"
  };

  const datosMetodo = {
    YAPE: config.yapeNumero,
    PLIN: config.plinNumero,
    TRANSFERENCIA: config.cuentaBancaria
  };

  const pagos = activos.map(m => datosMetodo[m]
    ? `<li><strong>${escaparHTML(nombres[m] || m)}:</strong> ${escaparHTML(datosMetodo[m])}</li>`
    : `<li>${escaparHTML(nombres[m] || m)}</li>`);

  // Solo se muestra si hay algún dato útil para pagar
  const hayDatosPago = activos.some(m => datosMetodo[m]);

  document.getElementById("docPagosLista").innerHTML = pagos.join("");
  document.getElementById("docPagos").style.display = hayDatosPago ? "" : "none";

  // Condiciones (una por línea)
  const condiciones = String(config.condiciones || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  document.getElementById("docCondicionesLista").innerHTML =
    condiciones.map(c => `<li>${escaparHTML(c)}</li>`).join("");
  document.getElementById("docCondiciones").style.display = condiciones.length ? "" : "none";

  const extras = document.getElementById("docExtras");
  extras.style.display = hayDatosPago || condiciones.length ? "" : "none";
  extras.classList.toggle("una-columna", !(hayDatosPago && condiciones.length));

  // Métodos que se pueden elegir al registrar la venta
  document.querySelectorAll("#metodosPago button[data-metodo]").forEach(boton => {
    boton.style.display = activos.includes(boton.dataset.metodo) ? "" : "none";
  });
}


function textoValidez(fecha, dias) {

  const partes = String(fecha || "").split("/").map(Number);

  if (!dias || partes.length !== 3 || partes.some(isNaN)) {
    return "Cotización válida según disponibilidad de stock.";
  }

  const limite = new Date(partes[2], partes[1] - 1, partes[0] + dias);
  const dd = String(limite.getDate()).padStart(2, "0");
  const mm = String(limite.getMonth() + 1).padStart(2, "0");

  return `Válida hasta el ${dd}/${mm}/${limite.getFullYear()}, sujeta a disponibilidad de stock.`;
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
// REGISTRAR VENTA
// ======================================================

const btnVender = document.getElementById("btnVender");
const modalVenta = document.getElementById("modalVenta");
const btnConfirmarVenta = document.getElementById("btnConfirmarVenta");
const modalError = document.getElementById("modalError");

let metodoElegido = "";
let enviandoVenta = false;


function prepararVenta(cotizacion) {

  const estado = String(cotizacion.estado || "").trim().toUpperCase();

  document.getElementById("modalNumero").textContent = cotizacion.numero;
  document.getElementById("modalTotal").textContent = Number(cotizacion.total).toFixed(2);

  btnVender.style.display =
    estado === "VENDIDO" || estado === "ANULADO" ? "none" : "inline-flex";
}


function abrirModalVenta() {

  metodoElegido = "";
  modalError.textContent = "";
  btnConfirmarVenta.disabled = true;
  btnConfirmarVenta.textContent = "Confirmar venta";

  document
    .querySelectorAll("#metodosPago button")
    .forEach(b => b.classList.remove("activo"));

  modalVenta.style.display = "flex";
}


function cerrarModalVenta() {

  if (enviandoVenta) return;

  modalVenta.style.display = "none";
}


btnVender.addEventListener("click", abrirModalVenta);

document.getElementById("btnCancelarVenta").addEventListener("click", cerrarModalVenta);

modalVenta.addEventListener("click", (event) => {
  if (event.target === modalVenta) cerrarModalVenta();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalVenta.style.display !== "none") cerrarModalVenta();
});

document.getElementById("metodosPago").addEventListener("click", (event) => {

  const boton = event.target.closest("button[data-metodo]");

  if (!boton || enviandoVenta) return;

  document
    .querySelectorAll("#metodosPago button")
    .forEach(b => b.classList.toggle("activo", b === boton));

  metodoElegido = boton.dataset.metodo;
  btnConfirmarVenta.disabled = false;
});


function mostrarAvisoVenta(venta) {

  const aviso = document.getElementById("avisoVenta");

  aviso.innerHTML = `
    <strong>✓ Venta ${escaparHTML(venta.numero)} registrada</strong>
    <span>
      ${escaparHTML(venta.metodoPago)} · S/ ${Number(venta.total).toFixed(2)} ·
      el stock ya fue descontado.
    </span>
    <a href="ventas.html">Ver ventas →</a>
  `;

  aviso.style.display = "flex";
}


// Aviso que deja la venta rápida al venir desde Nueva cotización
function avisoVentaRapida(numero) {

  try {

    const guardado = sessionStorage.getItem("zareinaAvisoVenta");

    if (!guardado) return;

    sessionStorage.removeItem("zareinaAvisoVenta");

    const venta = JSON.parse(guardado);

    if (String(venta.cotizacion).toUpperCase() === String(numero).toUpperCase()) {
      mostrarAvisoVenta(venta);
    }

  } catch (error) {
    console.error(error);
  }
}


btnConfirmarVenta.addEventListener("click", async () => {

  if (!metodoElegido || enviandoVenta) return;

  enviandoVenta = true;
  btnConfirmarVenta.disabled = true;
  btnConfirmarVenta.textContent = "Registrando...";
  modalError.textContent = "";

  try {

    const respuesta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "registrarVenta",
        token: usuario.token,
        numero: numeroCargado,
        metodoPago: metodoElegido
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

    const venta = datos.venta;

    enviandoVenta = false;
    cerrarModalVenta();

    document.getElementById("estadoCotizacion").textContent = "VENDIDO";
    btnVender.style.display = "none";

    prepararAnulacion({ numero: numeroCargado, estado: "VENDIDO" });

    mostrarAvisoVenta(venta);

    document.getElementById("avisoVenta").scrollIntoView({ behavior: "smooth", block: "center" });

  } catch (error) {

    console.error(error);

    modalError.textContent = error.message || "No se pudo registrar la venta.";
    btnConfirmarVenta.disabled = false;
    btnConfirmarVenta.textContent = "Confirmar venta";

  } finally {

    enviandoVenta = false;
  }
});



// ======================================================
// ANULAR
// ======================================================

const btnAnular = document.getElementById("btnAnular");
const modalAnular = document.getElementById("modalAnular");
const motivoInput = document.getElementById("motivoAnulacion");
const btnConfirmarAnular = document.getElementById("btnConfirmarAnular");
const modalAnularError = document.getElementById("modalAnularError");

const esAdministradora =
  String(usuario.rol || "").trim().toUpperCase() === "ADMINISTRADOR";

let estadoCargado = "";
let enviandoAnulacion = false;


function prepararAnulacion(cotizacion) {

  estadoCargado = String(cotizacion.estado || "").trim().toUpperCase();

  const puede =
    estadoCargado !== "ANULADO" &&
    (estadoCargado !== "VENDIDO" || esAdministradora);

  btnAnular.style.display = puede ? "inline-flex" : "none";
}


function abrirModalAnular() {

  const vendida = estadoCargado === "VENDIDO";

  document.getElementById("tituloModalAnular").textContent =
    vendida ? "Anular venta" : "Anular cotización";

  document.getElementById("textoAnular").innerHTML = vendida
    ? `La cotización <strong>${escaparHTML(numeroCargado)}</strong> ya fue vendida.
       Al anularla se <strong>devolverá el stock</strong> de sus productos y la venta
       quedará como <strong>ANULADA</strong>. Esta acción no se puede deshacer.`
    : `La cotización <strong>${escaparHTML(numeroCargado)}</strong> quedará como
       <strong>ANULADO</strong> y ya no se podrá vender. Esta acción no se puede deshacer.`;

  motivoInput.value = "";
  modalAnularError.textContent = "";
  btnConfirmarAnular.disabled = true;
  btnConfirmarAnular.textContent = vendida ? "Anular venta" : "Anular";

  modalAnular.style.display = "flex";
  motivoInput.focus();
}


function cerrarModalAnular() {

  if (enviandoAnulacion) return;

  modalAnular.style.display = "none";
}


btnAnular.addEventListener("click", abrirModalAnular);

document.getElementById("btnCancelarAnular").addEventListener("click", cerrarModalAnular);

modalAnular.addEventListener("click", (event) => {
  if (event.target === modalAnular) cerrarModalAnular();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalAnular.style.display !== "none") cerrarModalAnular();
});

motivoInput.addEventListener("input", () => {
  btnConfirmarAnular.disabled = motivoInput.value.trim().length < 3;
});


btnConfirmarAnular.addEventListener("click", async () => {

  const motivo = motivoInput.value.trim();

  if (motivo.length < 3 || enviandoAnulacion) return;

  enviandoAnulacion = true;
  btnConfirmarAnular.disabled = true;
  btnConfirmarAnular.textContent = "Anulando...";
  modalAnularError.textContent = "";

  try {

    const respuesta = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "anularCotizacion",
        token: usuario.token,
        numero: numeroCargado,
        motivo: motivo
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

    const anulacion = datos.anulacion;

    enviandoAnulacion = false;
    cerrarModalAnular();

    document.getElementById("estadoCotizacion").textContent = "ANULADO";
    btnVender.style.display = "none";
    btnAnular.style.display = "none";
    estadoCargado = "ANULADO";

    const devuelto = (anulacion.stockDevuelto || [])
      .map(d => `${d.cantidad} × ${escaparHTML(d.producto)}`)
      .join(", ");

    const aviso = document.getElementById("avisoVenta");

    aviso.className = "aviso-venta aviso-anulado";

    aviso.innerHTML = anulacion.venta
      ? `<strong>Venta ${escaparHTML(anulacion.venta)} anulada</strong>
         <span>Stock devuelto: ${devuelto || "—"}.</span>`
      : `<strong>Cotización ${escaparHTML(anulacion.cotizacion)} anulada</strong>
         <span>Motivo: ${escaparHTML(motivo)}</span>`;

    aviso.style.display = "flex";

    aviso.scrollIntoView({ behavior: "smooth", block: "center" });

  } catch (error) {

    console.error(error);

    modalAnularError.textContent = error.message || "No se pudo anular.";
    btnConfirmarAnular.disabled = false;
    btnConfirmarAnular.textContent =
      estadoCargado === "VENDIDO" ? "Anular venta" : "Anular";

  } finally {

    enviandoAnulacion = false;
  }
});



// ======================================================
// ENVIAR POR WHATSAPP
// ======================================================

const btnWhatsapp = document.getElementById("btnWhatsapp");
const modalWhatsapp = document.getElementById("modalWhatsapp");
const telefonoWhatsapp = document.getElementById("telefonoWhatsapp");
const btnCompartirImagen = document.getElementById("btnCompartirImagen");

let datosWhatsapp = null;
let imagenWhatsapp = null;

btnWhatsapp.disabled = true;


function prepararWhatsapp(cotizacion, config, telefono) {

  datosWhatsapp = { cotizacion, config: config || {}, telefono: telefono || "" };
  btnWhatsapp.disabled = false;
}


function mensajeWhatsapp() {

  const { cotizacion, config } = datosWhatsapp;

  const tienda = config.tiendaNombre || "ZAREINA";
  const cliente = String(cotizacion.cliente || "").trim();
  const nombre = cliente && cliente.toLowerCase() !== "cliente de mostrador"
    ? " " + cliente.split(" ")[0]
    : "";

  const vendida = String(cotizacion.estado || "").toUpperCase() === "VENDIDO";
  const soles = n => `S/ ${Number(n || 0).toFixed(2)}`;

  const lineas = [];

  lineas.push(`Hola${nombre} 👋`);
  lineas.push(vendida
    ? `Gracias por tu compra en ${tienda}. Este es el detalle (${cotizacion.numero}):`
    : `Te comparto tu cotización ${cotizacion.numero} de ${tienda}:`);
  lineas.push("");

  (cotizacion.productos || []).forEach(p => {
    const variante = [p.talla, p.color].filter(Boolean).join(", ");
    lineas.push(`• ${p.producto}${variante ? ` (${variante})` : ""} x${p.cantidad} — ${soles(p.total)}`);
  });

  lineas.push("");

  if (Number(cotizacion.descuento) > 0) {
    lineas.push(`Subtotal: ${soles(cotizacion.subtotal)}`);
    lineas.push(`Descuento: -${soles(cotizacion.descuento)}`);
  }

  lineas.push(`*Total: ${soles(cotizacion.total)}*`);

  if (!vendida) {

    lineas.push(textoValidez(cotizacion.fecha, Number(config.validezDias) || 0));

    const pagos = [
      config.yapeNumero && (config.metodosActivos || []).includes("YAPE") ? `Yape: ${config.yapeNumero}` : "",
      config.plinNumero && (config.metodosActivos || []).includes("PLIN") ? `Plin: ${config.plinNumero}` : "",
      config.cuentaBancaria && (config.metodosActivos || []).includes("TRANSFERENCIA") ? `Transferencia: ${config.cuentaBancaria}` : ""
    ].filter(Boolean);

    if (pagos.length) {
      lineas.push("");
      lineas.push("Formas de pago:");
      pagos.forEach(x => lineas.push(x));
    }
  }

  lineas.push("");
  lineas.push(`¡Gracias por elegir ${tienda}! ✨`);

  return lineas.join("\n");
}


// Deja el número listo para wa.me (Perú: 9 dígitos → 51 + número)
function numeroWhatsapp(texto) {

  const digitos = String(texto || "").replace(/\D/g, "").replace(/^00/, "");

  if (/^9\d{8}$/.test(digitos)) return "51" + digitos;
  if (/^51\d{9}$/.test(digitos)) return digitos;
  if (digitos.length >= 10 && digitos.length <= 15) return digitos;

  return "";
}


async function abrirWhatsapp() {

  if (!datosWhatsapp) return;

  telefonoWhatsapp.value = datosWhatsapp.telefono;
  document.getElementById("previaWhatsapp").textContent = mensajeWhatsapp();
  document.getElementById("errorWhatsapp").textContent = "";

  modalWhatsapp.style.display = "flex";

  // La imagen se prepara al abrir: el celular solo permite compartir
  // justo después de un toque, y generarla toma unos segundos.
  const puedeCompartir =
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });

  btnCompartirImagen.style.display = puedeCompartir ? "" : "none";
  document.getElementById("ayudaImagenPC").style.display = puedeCompartir ? "none" : "";

  if (puedeCompartir && !imagenWhatsapp) {

    btnCompartirImagen.disabled = true;
    btnCompartirImagen.querySelector("small").textContent = "Preparando imagen...";

    try {
      const canvas = await capturarDocumento();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      imagenWhatsapp = new File([blob], nombreArchivo("png"), { type: "image/png" });
      btnCompartirImagen.querySelector("small").textContent = "Elige WhatsApp y el chat del cliente";
    } catch (error) {
      console.error(error);
      btnCompartirImagen.querySelector("small").textContent = "No se pudo preparar la imagen";
    } finally {
      btnCompartirImagen.disabled = !imagenWhatsapp;
    }
  }
}


function cerrarWhatsapp() {
  modalWhatsapp.style.display = "none";
}


btnWhatsapp.addEventListener("click", abrirWhatsapp);

document.getElementById("btnCerrarWhatsapp").addEventListener("click", cerrarWhatsapp);

modalWhatsapp.addEventListener("click", (event) => {
  if (event.target === modalWhatsapp) cerrarWhatsapp();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalWhatsapp.style.display !== "none") cerrarWhatsapp();
});


document.getElementById("btnEnviarMensaje").addEventListener("click", () => {

  const escrito = telefonoWhatsapp.value.trim();
  const numero = numeroWhatsapp(escrito);

  if (escrito && !numero) {
    document.getElementById("errorWhatsapp").textContent =
      "El número no parece válido. Déjalo vacío para elegir el contacto en WhatsApp.";
    telefonoWhatsapp.focus();
    return;
  }

  const texto = encodeURIComponent(mensajeWhatsapp());

  window.open(
    numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`,
    "_blank",
    "noopener"
  );
});


btnCompartirImagen.addEventListener("click", async () => {

  if (!imagenWhatsapp) return;

  try {

    await navigator.share({ files: [imagenWhatsapp], text: mensajeWhatsapp() });

  } catch (error) {

    if (error && error.name === "AbortError") return;

    console.error(error);
    document.getElementById("errorWhatsapp").textContent = "No se pudo compartir la imagen.";
  }
});



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
