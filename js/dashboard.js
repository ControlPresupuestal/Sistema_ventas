const API_URL =
  "https://script.google.com/macros/s/AKfycbz-_MhTQpHGe4QDduXkLVuOJe1TKyRvtfDbNMCUwPP828W_C2A9XoB8IkhCE9J1XHYH/exec";


const datosGuardados =
  sessionStorage.getItem("zareinaUsuario");


const usuario =
  datosGuardados ? JSON.parse(datosGuardados) : null;


if (!usuario || !usuario.token) {

  sessionStorage.removeItem("zareinaUsuario");

  window.location.replace("index.html");

  throw new Error("Sin sesión");
}


const nombreUsuario =
  document.getElementById("nombreUsuario");

const rolUsuario =
  document.getElementById("rolUsuario");

const tituloBienvenida =
  document.getElementById("tituloBienvenida");

const avatarUsuario =
  document.getElementById("avatarUsuario");

const btnSalir =
  document.getElementById("btnSalir");


nombreUsuario.textContent =
  usuario.nombre;


rolUsuario.textContent =
  usuario.rol;


tituloBienvenida.textContent =
  `Hola, ${usuario.nombre} 👋`;


avatarUsuario.textContent =
  obtenerIniciales(usuario.nombre);



if (
  String(usuario.rol || "").toUpperCase() !==
  "ADMINISTRADOR"
) {

  const elementosAdmin =
    document.querySelectorAll(
      "[data-admin]"
    );


  elementosAdmin.forEach(
    elemento => {

      elemento.style.display =
        "none";

    }
  );

}



btnSalir.addEventListener(
  "click",
  async () => {

    btnSalir.disabled = true;

    try {

      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          accion: "logout",
          token: usuario.token
        })
      });

    } catch (error) {
      console.error(error);
    }

    sessionStorage.removeItem(
      "zareinaUsuario"
    );

    window.location.href =
      "index.html";

  }
);



// ======================================================
// RESUMEN DEL DÍA
// ======================================================

const NOMBRES_METODO = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  SEPARADO: "Separados completados"
};


async function cargarResumen() {

  const esAdmin = String(usuario.rol || "").toUpperCase() === "ADMINISTRADOR";

  document.getElementById("resumenTitulo").textContent = esAdmin ? "Hoy en la tienda" : "Tu día";
  document.getElementById("resumenEtiquetaTotal").textContent = esAdmin ? "Vendido hoy" : "Tus ventas de hoy";
  const fecha = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("resumenFecha").textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  try {

    const parametros = new URLSearchParams({ accion: "resumenDia", token: usuario.token });
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

    mostrarResumen(datos.resumen);

  } catch (error) {

    console.error(error);

    document.getElementById("resumenVentas").textContent = "";
    document.getElementById("resumenDetalle").innerHTML =
      `<p class="resumen-error">No se pudo cargar el resumen del día. ${escaparTexto(error.message || "")}</p>`;
  }
}


function mostrarResumen(r) {

  const soles = n => "S/ " + Number(n || 0).toFixed(2);

  document.getElementById("resumenTotal").textContent = soles(r.total);
  document.getElementById("resumenVentas").textContent =
    r.ventas === 1 ? "1 venta" : `${r.ventas} ventas`;

  document.getElementById("resumenPendientes").textContent = r.pendientes;

  const soloBajos = Math.max(r.bajos - r.agotados, 0);

  document.getElementById("resumenBajos").textContent = soloBajos;
  document.getElementById("resumenAgotados").textContent =
    `${r.stockBajo} unidades o menos` + (r.agotados ? ` · ${r.agotados} agotado${r.agotados === 1 ? "" : "s"}` : "");

  document.getElementById("tarjetaStock").classList.toggle("alerta", r.bajos > 0);

  const bloques = [];

  if (r.porMetodo.length) {
    bloques.push(bloque("Por método de pago",
      r.porMetodo.map(x => [NOMBRES_METODO[x.nombre] || x.nombre, soles(x.total)])));
  }

  if (r.porVendedora.length) {
    bloques.push(bloque("Por vendedora",
      r.porVendedora.map(x => [x.nombre, soles(x.total)])));
  }

  if (r.productosBajos.length) {
    bloques.push(bloque("Reponer pronto",
      r.productosBajos.map(p => [
        [p.producto, p.talla, p.color].filter(Boolean).join(" · "),
        p.stock <= 0 ? '<span class="agotado">Agotado</span>' : `${p.stock} ud.`
      ]), true));
  }

  document.getElementById("resumenDetalle").innerHTML = bloques.join("");
}


function bloque(titulo, filas, valorEsHTML) {

  return `
    <div class="resumen-bloque">
      <h4>${escaparTexto(titulo)}</h4>
      <ul>
        ${filas.map(([nombre, valor]) => `
          <li>
            <span>${escaparTexto(nombre)}</span>
            <span>${valorEsHTML ? valor : escaparTexto(valor)}</span>
          </li>`).join("")}
      </ul>
    </div>`;
}


function escaparTexto(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto);
  return div.innerHTML;
}


cargarResumen();



function obtenerIniciales(nombre) {

  return nombre
    .trim()
    .split(" ")
    .slice(0, 2)
    .map(palabra =>
      palabra.charAt(0)
    )
    .join("")
    .toUpperCase();

}
