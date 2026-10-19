// Barra de estado y fecha (función 5).

const barraEstado = document.getElementById("barra-estado");
const zonaPosicion = document.getElementById("estado-posicion");
const zonaCaracteres = document.getElementById("estado-caracteres");
const zonaZoom = document.getElementById("estado-zoom");

// El zoom lo pone ajustes.js llamando a ponerZoomBarra().
let zoomBarra = 100;
const numero = (n) => n.toLocaleString("es-ES");

// Calcula línea y columna del cursor y cuenta caracteres (o seleccionados).
function actualizarBarra() {
  if (barraEstado.hidden) return;
  const { value, selectionStart: ini, selectionEnd: fin } = editor;
  // El cursor está al final de la selección, salvo si se seleccionó hacia atrás.
  const cursor = editor.selectionDirection === "backward" ? ini : fin;
  const antes = value.slice(0, cursor);
  const linea = antes.split("\n").length;
  const columna = cursor - antes.lastIndexOf("\n");
  zonaPosicion.textContent = `Lín ${numero(linea)}, Col ${numero(columna)}`;
  zonaCaracteres.textContent =
    fin > ini ? `${numero(fin - ini)} seleccionados` : `${numero(value.length)} caracteres`;
  zonaZoom.textContent = `${zoomBarra} %`;
}

function ponerZoomBarra(porcentaje) {
  zoomBarra = porcentaje;
  actualizarBarra();
}

// Para el interruptor "mostrar barra de estado" de los ajustes (ajustes.js).
function mostrarBarraEstado(visible) {
  barraEstado.hidden = !visible;
  actualizarBarra();
}

// Se actualiza al escribir, al moverse con las flechas y al hacer clic.
for (const evento of ["input", "keyup", "mouseup", "select", "focus"]) {
  editor.addEventListener(evento, actualizarBarra);
}

// Inserta la fecha y hora actuales en el cursor, p. ej. "19/10/2026 14:35".
function insertarFecha() {
  const texto = new Date()
    .toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(",", "");
  editor.focus();
  // execCommand("insertText") entra en el historial, así Ctrl+Z la deshace.
  // Si no está disponible, setRangeText (que no se puede deshacer).
  if (!document.execCommand("insertText", false, texto)) {
    editor.setRangeText(texto, editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input")); // marca cambios y guarda la sesión
  }
}
