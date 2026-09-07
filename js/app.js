const API_URL =
  "https://script.google.com/macros/s/AKfycbwRtoQGreKj8V-sY7DmK596CpMxvPim001r2VT-_dYHn73djudhq0Duja5uOt5uf_lL/exec";

const formLogin =
  document.getElementById("formLogin");

const usuarioInput =
  document.getElementById("usuario");

const claveInput =
  document.getElementById("clave");

const btnMostrarClave =
  document.getElementById("btnMostrarClave");

const mensajeLogin =
  document.getElementById("mensajeLogin");


btnMostrarClave.addEventListener("click", () => {

  const esPassword =
    claveInput.type === "password";

  claveInput.type =
    esPassword ? "text" : "password";

  btnMostrarClave.textContent =
    esPassword ? "🙈" : "👁";
});


formLogin.addEventListener("submit", async (event) => {

  event.preventDefault();

  const usuario =
    usuarioInput.value.trim();

  const clave =
    claveInput.value.trim();

  mensajeLogin.textContent = "";
  mensajeLogin.style.color = "#a63d3d";


  if (!usuario || !clave) {

    mensajeLogin.textContent =
      "Ingresa tu usuario y contraseña.";

    return;
  }


  mensajeLogin.style.color = "#6f442f";
  mensajeLogin.textContent =
    "Validando acceso...";


  try {

    const url =
      `${API_URL}?accion=login` +
      `&usuario=${encodeURIComponent(usuario)}` +
      `&clave=${encodeURIComponent(clave)}`;


    const respuesta =
      await fetch(url);


    const datos =
      await respuesta.json();


if (!datos.ok) {

  mensajeLogin.style.color =
    "#a63d3d";

  mensajeLogin.textContent =
    datos.mensaje;

  return;
}


sessionStorage.setItem(
  "zareinaUsuario",
  JSON.stringify(datos.usuario)
);


mensajeLogin.style.color =
  "#6f442f";

mensajeLogin.textContent =
  `Bienvenida, ${datos.usuario.nombre}`;


setTimeout(() => {

  window.location.href =
    "dashboard.html";

}, 500);


    console.log(
      "Usuario conectado:",
      datos.usuario
    );


  } catch (error) {

    console.error(error);

    mensajeLogin.style.color = "#a63d3d";

    mensajeLogin.textContent =
      "No se pudo conectar con el sistema.";

  }

});
