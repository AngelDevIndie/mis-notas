// Arranque de la app: botones, atajos de teclado y recuperar la sesión.

// Para que una acción no se lance dos veces mientras sale un diálogo.
let ocupado = false;
async function enExclusiva(accion) {
  if (ocupado) return;
  ocupado = true;
  try {
    await accion();
  } finally {
    ocupado = false;
  }
}

// --- Botones ---
document.getElementById("btn-nueva").addEventListener("click", () => nuevaPestana());
document.getElementById("btn-abrir").addEventListener("click", () => enExclusiva(abrir));
document.getElementById("btn-guardar").addEventListener("click", () =>
  enExclusiva(() => guardar(Estado.activa()))
);

// --- Atajos de teclado ---
document.addEventListener("keydown", (e) => {
  if (!e.ctrlKey || e.altKey) return;
  if (dialogoLinea.open) return; // con "Ir a la línea" abierto, nada más

  // Zoom: se mira e.key porque "+" está en sitios distintos según el teclado.
  // Ctrl++ y también Ctrl+= (mismo botón sin Mayús en teclados ingleses).
  const zoom = { "+": 1, "=": 1, "-": -1, 0: 0 }[e.key];
  if (zoom !== undefined) {
    e.preventDefault();
    return cambiarZoom(zoom);
  }

  // e.code no cambia con Mayús ni con la distribución del teclado.
  const atajos = {
    KeyT: () => nuevaPestana(),
    KeyW: () => enExclusiva(() => cerrar(Estado.activaId)),
    KeyO: () => enExclusiva(abrir),
    KeyS: () => enExclusiva(() => guardar(Estado.activa(), e.shiftKey)),
    Tab: () => moverPestana(e.shiftKey ? -1 : 1),
    KeyF: () => abrirBuscar(false),
    KeyH: () => abrirBuscar(true),
    KeyG: () => abrirIrALinea(),
  };
  const accion = atajos[e.code];
  if (!accion) return;
  e.preventDefault();
  accion();
});

// F5: insertar fecha y hora en el cursor (sin Ctrl).
document.addEventListener("keydown", (e) => {
  if (e.key !== "F5" || e.ctrlKey || e.altKey || e.metaKey) return;
  e.preventDefault();
  if (dialogoLinea.open) return;
  insertarFecha();
});

// Escape: cierra lo que esté abierto (menú, ajustes o barra de búsqueda).
// "Ir a la línea" se cierra solo, porque es un <dialog>.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || dialogoLinea.open) return;
  if (!menuPestana.hidden) cerrarMenuPestana();
  else if (!panelAjustes.hidden) cerrarPanel();
  else if (!barraBuscar.hidden) return cerrarBuscar();
  else return;
  editor.focus();
});

// Clic fuera del menú o del panel: se cierran. No se cancela el evento,
// así ese mismo clic sigue haciendo lo suyo (no se lo "come").
document.addEventListener(
  "pointerdown",
  (e) => {
    if (!menuPestana.hidden && !menuPestana.contains(e.target)) cerrarMenuPestana();
    if (!panelAjustes.hidden && !panelAjustes.contains(e.target) && !btnAjustes.contains(e.target)) cerrarPanel();
  },
  true
);
window.addEventListener("blur", cerrarMenuPestana);
// Si la ventana cambia de tamaño, el menú y el panel podrían quedar fuera de sitio.
window.addEventListener("resize", () => {
  cerrarMenuPestana();
  cerrarPanel();
});

// Tab en el área de escritura escribe una tabulación (en vez de saltar
// al siguiente botón). Con execCommand se puede deshacer con Ctrl+Z.
editor.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
  e.preventDefault();
  if (!document.execCommand("insertText", false, "\t")) {
    editor.setRangeText("\t", editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input"));
  }
});

// Soltar un archivo encima de la ventana no hace nada (para abrir: Ctrl+O).
// Sin esto, Electron intentaría mostrar el archivo en lugar de la app.
// Soltar texto seleccionado en el área de escritura sigue funcionando.
for (const tipo of ["dragover", "drop"]) {
  document.addEventListener(tipo, (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault();
  });
}

// --- Arranque: recuperar la sesión o, la primera vez, una nota vacía ---
(async () => {
  if (!(await restaurarSesion())) {
    Estado.pestanas = [Estado.crear()]; // una pestaña "Sin título" vacía
    Estado.activaId = Estado.pestanas[0].id;
  }
  cargarEditor();
  pintarPestanas();
  // A partir de aquí ya se puede guardar la sesión.
  sesionLista = true;
  guardarSesionYa();
})();
