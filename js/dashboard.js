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
