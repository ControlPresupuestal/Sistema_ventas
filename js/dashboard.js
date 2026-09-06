const datosGuardados =
  sessionStorage.getItem("zareinaUsuario");


if (!datosGuardados) {

  window.location.href =
    "index.html";

}


const usuario =
  JSON.parse(datosGuardados);


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
  usuario.rol.toUpperCase() !==
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
  () => {

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
