// A tu gusto (función 4): tema, ajuste de línea, barra de estado y zoom.
// Los ajustes llegan ya leídos del disco (window.api.ajustes) y se guardan con
// window.api.guardarAjustes, que además cambia el tema de la ventana de Windows.

const panelAjustes = document.getElementById("panel-ajustes");
const btnAjustes = document.getElementById("btn-ajustes");
const casillaAjuste = document.getElementById("aj-ajuste");
const casillaBarra = document.getElementById("aj-barra");
const textoZoom = document.getElementById("zoom-valor");

const ajustes = { tema: "sistema", ajusteLinea: true, barraEstado: true, zoom: 100, ...window.api.ajustes };
const TAM_BASE = 15; // tamaño de letra del área al 100 %

// Pone en pantalla los ajustes actuales.
function aplicarAjustes() {
  document.documentElement.dataset.tema = ajustes.tema;
  // El zoom es solo el tamaño de letra del área de escritura.
  document.documentElement.style.setProperty("--tam-editor", (TAM_BASE * ajustes.zoom) / 100 + "px");
  // Ajuste de línea: "soft" baja las líneas largas; "off" saca barra horizontal.
  editor.wrap = ajustes.ajusteLinea ? "soft" : "off";
  editor.classList.toggle("sin-ajuste", !ajustes.ajusteLinea);
  mostrarBarraEstado(ajustes.barraEstado);
  ponerZoomBarra(ajustes.zoom);
  ocultarEspejo(); // cambia la letra: el resaltado de búsqueda ya no cuadra

  // Que los controles del panel reflejen lo elegido.
  for (const r of panelAjustes.querySelectorAll('input[name="tema"]')) r.checked = r.value === ajustes.tema;
  casillaAjuste.checked = ajustes.ajusteLinea;
  casillaBarra.checked = ajustes.barraEstado;
  textoZoom.textContent = `${ajustes.zoom} %`;
}

// Cambia uno o varios ajustes, los aplica y los guarda.
function cambiarAjustes(cambios) {
  Object.assign(ajustes, cambios);
  aplicarAjustes();
  window.api.guardarAjustes({ ...ajustes }).catch(() => {});
}

// paso = +1 (más grande), -1 (más pequeño) o 0 (volver al 100 %). De 10 en 10.
function cambiarZoom(paso) {
  const zoom = paso === 0 ? 100 : Math.min(300, Math.max(50, ajustes.zoom + paso * 10));
  if (zoom !== ajustes.zoom) cambiarAjustes({ zoom });
}

// --- Panel desplegable ---
function abrirPanel() {
  const r = btnAjustes.getBoundingClientRect();
  panelAjustes.style.top = r.bottom + 4 + "px";
  panelAjustes.style.right = Math.max(8, innerWidth - r.right) + "px";
  // En una ventana baja, el panel no se sale: lo que no cabe se desplaza.
  panelAjustes.style.maxHeight = innerHeight - r.bottom - 12 + "px";
  panelAjustes.hidden = false;
  btnAjustes.setAttribute("aria-expanded", "true");
}
function cerrarPanel() {
  panelAjustes.hidden = true;
  btnAjustes.setAttribute("aria-expanded", "false");
}
btnAjustes.addEventListener("click", () => (panelAjustes.hidden ? abrirPanel() : cerrarPanel()));

// --- Controles del panel ---
panelAjustes.addEventListener("change", (e) => {
  if (e.target.name === "tema") cambiarAjustes({ tema: e.target.value });
  if (e.target === casillaAjuste) cambiarAjustes({ ajusteLinea: casillaAjuste.checked });
  if (e.target === casillaBarra) cambiarAjustes({ barraEstado: casillaBarra.checked });
});
document.getElementById("zoom-menos").addEventListener("click", () => cambiarZoom(-1));
document.getElementById("zoom-mas").addEventListener("click", () => cambiarZoom(1));
document.getElementById("zoom-reset").addEventListener("click", () => cambiarZoom(0));
document.getElementById("aj-fecha").addEventListener("click", () => {
  cerrarPanel();
  insertarFecha();
});

// Ctrl+rueda: zoom de la letra (y no de toda la ventana).
window.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    cambiarZoom(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false }
);

aplicarAjustes();
