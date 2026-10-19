// Puente seguro entre la interfaz y el proceso principal.
// La página solo ve window.api con estas funciones, nada más de Node.
const { contextBridge, ipcRenderer } = require("electron");

// Pide algo de archivos al proceso principal. Si allí falló, llega
// { error: "frase en español" } y aquí se convierte en un error normal,
// para que la interfaz lo recoja con try/catch y enseñe esa frase.
async function pedirArchivo(canal, datos) {
  const r = await ipcRenderer.invoke(canal, datos);
  if (r && r.error) throw new Error(r.error);
  return r;
}

contextBridge.exposeInMainWorld("api", {
  abrir: () => pedirArchivo("archivo:abrir"),
  guardar: (ruta, texto) => pedirArchivo("archivo:guardar", { ruta, texto }),
  guardarComo: (texto, nombre) => pedirArchivo("archivo:guardarComo", { texto, nombre }),
  preguntarGuardar: (nombre) => ipcRenderer.invoke("dialogo:preguntarGuardar", nombre),
  // Aviso de error con el diálogo de Windows (en lugar de alert()).
  aviso: (mensaje) => ipcRenderer.invoke("dialogo:aviso", mensaje),
  ponerTitulo: (titulo) => ipcRenderer.invoke("ventana:titulo", titulo),
  // Ajustes (función 4): se leen ya, de forma síncrona, para pintar con el tema bueno.
  ajustes: ipcRenderer.sendSync("ajustes:leer"),
  guardarAjustes: (datos) => ipcRenderer.invoke("ajustes:guardar", datos),
  // Sesión (función 3). guardarSesion devuelve { error } si no se pudo escribir.
  cargarSesion: () => ipcRenderer.invoke("sesion:cargar"),
  guardarSesion: (datos) => ipcRenderer.invoke("sesion:guardar", datos),
  // Al cerrar la ventana, el proceso principal pide un último guardado;
  // cuando "accion" termina se le avisa con "sesion:lista".
  alCerrar: (accion) =>
    ipcRenderer.on("sesion:pedir", async () => {
      try {
        await accion();
      } finally {
        ipcRenderer.send("sesion:lista");
      }
    }),
});
