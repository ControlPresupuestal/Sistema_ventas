const formLogin = document.getElementById("formLogin");
const usuarioInput = document.getElementById("usuario");
const claveInput = document.getElementById("clave");
const btnMostrarClave = document.getElementById("btnMostrarClave");
const mensajeLogin = document.getElementById("mensajeLogin");

btnMostrarClave.addEventListener("click", () => {
  const esPassword = claveInput.type === "password";

  claveInput.type = esPassword ? "text" : "password";
  btnMostrarClave.textContent = esPassword ? "🙈" : "👁";
});

formLogin.addEventListener("submit", (event) => {
  event.preventDefault();

  const usuario = usuarioInput.value.trim();
  const clave = claveInput.value.trim();

  mensajeLogin.textContent = "";

  if (!usuario || !clave) {
    mensajeLogin.textContent =
      "Ingresa tu usuario y contraseña.";
    return;
  }

  mensajeLogin.style.color = "#6f442f";
  mensajeLogin.textContent =
    "Login visual listo. Falta conectar con Google Sheets.";
});
