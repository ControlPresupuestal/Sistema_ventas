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
// FECHAS
// ======================================================

const desdeInput = document.getElementById("desde");
const hastaInput = document.getElementById("hasta");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

function iso(fecha) {
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${m}-${d}`;
}

function desdeISO(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function fechaCorta(texto) {
  const f = desdeISO(texto);
  return `${f.getDate()} ${MESES[f.getMonth()]}`;
}

function rangoDe(periodo) {

  const hoy = new Date();
  let desde = new Date(hoy);
  let hasta = new Date(hoy);

  if (periodo === "7") desde.setDate(hoy.getDate() - 6);
  if (periodo === "30") desde.setDate(hoy.getDate() - 29);
  if (periodo === "mes") desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (periodo === "mesAnterior") {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  }

  return { desde: iso(desde), hasta: iso(hasta) };
}


document.getElementById("periodos").addEventListener("click", (event) => {

  const boton = event.target.closest("button[data-periodo]");

  if (!boton) return;

  marcarPeriodo(boton.dataset.periodo);

  const r = rangoDe(boton.dataset.periodo);
  desdeInput.value = r.desde;
  hastaInput.value = r.hasta;

  cargarReporte();
});


function marcarPeriodo(periodo) {
  document.querySelectorAll("#periodos button").forEach(b =>
    b.classList.toggle("activo", b.dataset.periodo === periodo)
  );
}


document.getElementById("btnAplicar").addEventListener("click", () => {
  marcarPeriodo("");
  cargarReporte();
});


// ======================================================
// CARGAR
// ======================================================

const estado = document.getElementById("estadoReporte");
const contenido = document.getElementById("contenidoReporte");

let reporte = null;
let peticion = 0;


async function cargarReporte() {

  const desde = desdeInput.value;
  const hasta = hastaInput.value;

  if (!desde || !hasta || desde > hasta) {
    estado.textContent = "Elige un rango de fechas válido.";
    estado.style.display = "block";
    contenido.style.display = "none";
    return;
  }

  const numero = ++peticion;

  estado.textContent = "Cargando reporte...";
  estado.style.display = "block";
  contenido.style.opacity = ".5";

  try {

    const parametros = new URLSearchParams({ accion: "reportes", token: usuario.token, desde, hasta });
    const respuesta = await fetch(`${API_URL}?${parametros.toString()}`);
    const datos = await respuesta.json();

    if (numero !== peticion) return; // llegó una respuesta más nueva

    if (!datos.ok) {
      if (datos.sesionExpirada) {
        sessionStorage.removeItem("zareinaUsuario");
        alert(datos.mensaje);
        window.location.replace("index.html");
        return;
      }
      throw new Error(datos.mensaje);
    }

    reporte = datos.reporte;

    estado.style.display = "none";
    contenido.style.display = "block";
    contenido.style.opacity = "1";

    render();

  } catch (error) {

    console.error(error);
    estado.textContent = "No se pudo cargar el reporte: " + error.message;
    contenido.style.display = "none";
  }
}


// ======================================================
// MOSTRAR
// ======================================================

function soles(n) {
  return "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function render() {

  const r = reporte;

  document.getElementById("kTotal").textContent = soles(r.totalVendido);
  document.getElementById("kPeriodo").textContent =
    r.desde === r.hasta ? fechaCorta(r.desde) : `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;

  // Ganancia: solo se puede calcular en ventas cuyos productos tienen costo (Mercadería)
  const ganancia = document.getElementById("kGanancia");

  if (ganancia) {
    ganancia.textContent = r.ventasConCosto
      ? `Ganancia estimada ${soles(r.ganancia)}` + (r.ventasConCosto < r.ventas ? ` (en ${r.ventasConCosto} de ${r.ventas} ventas con costo)` : "")
      : "Registra costos en Mercadería para ver la ganancia";
  }

  document.getElementById("kVentas").textContent = r.ventas;
  document.getElementById("kAnuladas").textContent = r.anuladas ? `${r.anuladas} anulada(s), no suman` : "sin anulaciones";

  document.getElementById("kTicket").textContent = soles(r.ticketPromedio);

  document.getElementById("kCotizaciones").textContent = r.cotizaciones;
  document.getElementById("kConversion").textContent = r.cotizaciones
    ? `${Math.round(r.ventas / r.cotizaciones * 100)}% se vendieron`
    : "—";

  dibujarColumnas(agruparSerie(r.porDia));

  const metodos = (r.porMetodo || []).map(x => x.nombre === "SEPARADO" ? Object.assign({}, x, { nombre: "Separados (pagados en partes)" }) : x);

  barras("barrasMetodo", metodos, x => soles(x.total), x => `${x.ventas} venta(s)`, "total");
  barras("barrasVendedora", r.porVendedora, x => soles(x.total), x => `${x.ventas} venta(s)`, "total");
  barras("barrasProductos", r.productos, x => `${x.unidades} und.`, x => soles(x.total), "unidades");
}


// Para rangos largos se agrupa por mes (más de 62 días) para que el gráfico se lea bien.
function agruparSerie(porDia) {

  if (porDia.length <= 62) {
    document.getElementById("tituloSerie").textContent = "Ventas por día";
    return porDia.map(d => ({ etiqueta: fechaCorta(d.fecha), clave: d.fecha, total: d.total, ventas: d.ventas }));
  }

  document.getElementById("tituloSerie").textContent = "Ventas por mes";

  const meses = {};

  porDia.forEach(d => {
    const clave = d.fecha.slice(0, 7);
    meses[clave] = meses[clave] || { etiqueta: "", clave, total: 0, ventas: 0 };
    meses[clave].total += d.total;
    meses[clave].ventas += d.ventas;
  });

  return Object.values(meses).map(m => {
    const [a, mes] = m.clave.split("-").map(Number);
    m.etiqueta = `${MESES[mes - 1]} ${String(a).slice(2)}`;
    return m;
  });
}


// Escala "bonita" para el eje (1, 2, 5 × 10^n)
function escala(maximo) {
  if (maximo <= 0) return { tope: 100, paso: 25 };
  const bruto = maximo / 4;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 5, 10].map(f => f * potencia).find(p => p >= bruto);
  return { tope: Math.ceil(maximo / paso) * paso, paso };
}


function dibujarColumnas(serie) {

  const contenedor = document.getElementById("graficoDias");
  const tooltip = document.getElementById("tooltip");

  // El gráfico se dibuja al ancho real de la pantalla para que el texto se lea bien
  const ancho = Math.max(contenedor.clientWidth || 900, 280);
  const alto = ancho < 500 ? 220 : 260;
  const margen = { izq: ancho < 500 ? 44 : 58, der: 8, sup: 12, inf: 28 };
  const areaAncho = ancho - margen.izq - margen.der;
  const areaAlto = alto - margen.sup - margen.inf;

  const { tope, paso } = escala(Math.max(...serie.map(s => s.total), 0));

  const n = serie.length;
  const franja = areaAncho / Math.max(n, 1);
  const grosor = Math.max(Math.min(franja - 2, 28), 2); // 2px de separación entre barras
  const y = v => margen.sup + areaAlto - (v / tope) * areaAlto;

  let svg = `<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Total vendido por periodo">`;

  // Guías horizontales y eje Y
  for (let v = 0; v <= tope + 0.0001; v += paso) {
    const yy = y(v).toFixed(1);
    svg += `<line class="${v === 0 ? "linea-base" : "linea-guia"}" x1="${margen.izq}" x2="${ancho - margen.der}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text class="eje-texto" x="${margen.izq - 8}" y="${yy}" text-anchor="end" dominant-baseline="middle">${v >= 1000 ? (v / 1000).toLocaleString("es-PE") + " mil" : v}</text>`;
  }

  // Etiquetas del eje X: como máximo ~10 para que no se amontonen
  const cada = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(areaAncho / 70))));

  serie.forEach((s, i) => {

    const x = margen.izq + i * franja + (franja - grosor) / 2;
    const alturaBarra = Math.max(areaAlto - (y(s.total) - margen.sup), 0);
    const yTop = margen.sup + areaAlto - alturaBarra;
    const radio = Math.min(4, grosor / 2, alturaBarra);

    // Zona de toque más grande que la barra
    svg += `<rect class="zona" data-i="${i}" x="${(margen.izq + i * franja).toFixed(1)}" y="${margen.sup}" width="${franja.toFixed(1)}" height="${areaAlto}" fill="transparent"/>`;

    if (alturaBarra > 0) {
      // Esquinas redondeadas solo arriba; la base queda recta sobre el eje
      svg += `<path class="barra" data-i="${i}" d="M${x.toFixed(1)},${(margen.sup + areaAlto).toFixed(1)}
        V${(yTop + radio).toFixed(1)} Q${x.toFixed(1)},${yTop.toFixed(1)} ${(x + radio).toFixed(1)},${yTop.toFixed(1)}
        H${(x + grosor - radio).toFixed(1)} Q${(x + grosor).toFixed(1)},${yTop.toFixed(1)} ${(x + grosor).toFixed(1)},${(yTop + radio).toFixed(1)}
        V${(margen.sup + areaAlto).toFixed(1)} Z"/>`;
    }

    if (i % cada === 0) {
      svg += `<text class="eje-texto" x="${(x + grosor / 2).toFixed(1)}" y="${alto - 8}" text-anchor="middle">${escaparHTML(s.etiqueta)}</text>`;
    }
  });

  svg += "</svg>";

  contenedor.innerHTML = svg;

  // Tooltip
  const svgEl = contenedor.querySelector("svg");
  const barrasEl = svgEl.querySelectorAll(".barra");

  const mostrar = (i, evento) => {

    const s = serie[i];

    tooltip.innerHTML = `<strong>${soles(s.total)}</strong>${escaparHTML(s.etiqueta)} · ${s.ventas} venta(s)`;
    tooltip.style.display = "block";

    const caja = contenedor.getBoundingClientRect();
    const tarjeta = contenedor.parentElement.getBoundingClientRect();
    const escalaX = caja.width / ancho;
    const centro = (margen.izq + i * franja + franja / 2) * escalaX;

    let izquierda = caja.left - tarjeta.left + centro - tooltip.offsetWidth / 2;
    izquierda = Math.max(8, Math.min(izquierda, tarjeta.width - tooltip.offsetWidth - 8));

    tooltip.style.left = izquierda + "px";
    tooltip.style.top = (caja.top - tarjeta.top + (y(s.total) * escalaX) - tooltip.offsetHeight - 10) + "px";

    barrasEl.forEach(b => b.classList.toggle("activa", Number(b.dataset.i) === i));
  };

  const ocultar = () => {
    tooltip.style.display = "none";
    barrasEl.forEach(b => b.classList.remove("activa"));
  };

  svgEl.querySelectorAll(".zona").forEach(z => {
    z.addEventListener("mouseenter", e => mostrar(Number(z.dataset.i), e));
    z.addEventListener("click", e => mostrar(Number(z.dataset.i), e));
  });

  svgEl.addEventListener("mouseleave", ocultar);

  ultimaSerie = serie;

  // Vista en tabla
  document.getElementById("tablaDias").innerHTML = `
    <table class="tabla-cotizacion">
      <thead><tr><th>Periodo</th><th class="historial-derecha">Ventas</th><th class="historial-derecha">Total</th></tr></thead>
      <tbody>
        ${serie.map(s => `<tr><td>${escaparHTML(s.etiqueta)}</td><td class="historial-derecha">${s.ventas}</td><td class="historial-derecha">${soles(s.total)}</td></tr>`).join("")}
      </tbody>
    </table>`;
}


// Redibujar al girar el celular o cambiar el tamaño de la ventana
let ultimaSerie = null;
let temporizadorResize;

window.addEventListener("resize", () => {
  clearTimeout(temporizadorResize);
  temporizadorResize = setTimeout(() => {
    if (ultimaSerie && document.getElementById("graficoDias").style.display !== "none") {
      dibujarColumnas(ultimaSerie);
    }
  }, 150);
});


document.getElementById("btnVerTabla").addEventListener("click", (event) => {

  const tabla = document.getElementById("tablaDias");
  const grafico = document.getElementById("graficoDias");
  const mostrarTabla = tabla.style.display === "none";

  tabla.style.display = mostrarTabla ? "block" : "none";
  grafico.style.display = mostrarTabla ? "none" : "block";
  document.getElementById("tooltip").style.display = "none";
  event.target.textContent = mostrarTabla ? "Ver gráfico" : "Ver tabla";
});


function barras(idContenedor, lista, valorPrincipal, valorSecundario, campo) {

  const contenedor = document.getElementById(idContenedor);

  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `<p class="reporte-vacio">Sin ventas en este periodo.</p>`;
    return;
  }

  const maximo = Math.max(...lista.map(x => x[campo]), 1);

  contenedor.innerHTML = lista.map(x => `
    <div class="barra-fila" title="${escaparHTML(x.nombre)}: ${escaparHTML(valorPrincipal(x))} · ${escaparHTML(valorSecundario(x))}">
      <span class="barra-nombre">${escaparHTML(nombreBonito(x.nombre))}</span>
      <div class="barra-pista"><div class="barra-relleno" style="width:${(x[campo] / maximo * 100).toFixed(1)}%"></div></div>
      <span class="barra-valor">${escaparHTML(valorPrincipal(x))}<small>${escaparHTML(valorSecundario(x))}</small></span>
    </div>`).join("");
}


function nombreBonito(texto) {
  const t = String(texto || "");
  return t === t.toUpperCase() && t.length > 3 ? t.charAt(0) + t.slice(1).toLowerCase() : t;
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


// ======================================================
// ARRANQUE: este mes
// ======================================================

(() => {
  const r = rangoDe("mes");
  desdeInput.value = r.desde;
  hastaInput.value = r.hasta;
  cargarReporte();
})();
