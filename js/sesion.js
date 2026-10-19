// Nada se pierde (función 3): guarda la sesión sola y la recupera al arrancar.
// La interfaz solo prepara los datos; el disco lo toca main.js (window.api).

let relojSesion = null;
// Hasta que se haya cargado la sesión no se guarda nada, para no pisarla.
let sesionLista = false;

// Lo que se guarda de cada pestaña (el texto va a su propio archivo).
function datosSesion() {
  recogerEditor();
  return {
    activaId: Estado.activaId,
    pestanas: Estado.pestanas.map(({ id, ruta, texto, modificado, selInicio, selFin, scroll }) => ({
      id, ruta, texto, modificado, selInicio, selFin, scroll,
    })),
  };
}

// Si el guardado automático falla (disco lleno, sin permiso...), se avisa
// una sola vez para no molestar; vuelve a avisar si falla después de ir bien.
let avisoSesionDado = false;

// Guarda ya. Devuelve una promesa que acaba cuando está escrito en disco.
function guardarSesionYa() {
  clearTimeout(relojSesion);
  if (!sesionLista) return Promise.resolve();
  return window.api
    .guardarSesion(datosSesion())
    .then((r) => {
      if (!r || !r.error) return (avisoSesionDado = false);
      if (avisoSesionDado) return;
      avisoSesionDado = true;
      window.api.aviso(
        "No se ha podido guardar la sesión automáticamente.\n\n" +
          r.error +
          "\n\nTus notas siguen en pantalla. Guarda las importantes con Ctrl+S."
      );
    })
    .catch(() => {});
}

// Guarda dentro de "ms" milisegundos; si antes hay otro cambio, vuelve a esperar.
function programarGuardado(ms = 1000) {
  if (!sesionLista) return;
  clearTimeout(relojSesion);
  relojSesion = setTimeout(guardarSesionYa, ms);
}

// Al escribir: guardar un segundo después de dejar de escribir.
editor.addEventListener("input", () => programarGuardado(1000));

// Al cerrar la ventana: último guardado (main.js espera a que termine).
window.api.alCerrar(guardarSesionYa);

// Recupera las pestañas guardadas. Devuelve false si no había sesión.
async function restaurarSesion() {
  const s = await window.api.cargarSesion().catch(() => null);
  if (!s) return false;
  Estado.pestanas = s.pestanas.map((p) => ({
    id: Number(p.id),
    ruta: p.ruta || null,
    texto: String(p.texto ?? ""),
    modificado: !!p.modificado,
    selInicio: p.selInicio | 0,
    selFin: p.selFin | 0,
    scroll: p.scroll | 0,
  }));
  // Los ids nuevos siguen a partir del mayor, para no repetir archivos.
  Estado.siguienteId = Math.max(...Estado.pestanas.map((p) => p.id)) + 1;
  Estado.activaId = Estado.pestanas.some((p) => p.id === s.activaId) ? s.activaId : Estado.pestanas[0].id;
  return true;
}
