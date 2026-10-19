// Buscar y reemplazar + ir a la línea (función 2).

const barraBuscar = document.getElementById("barra-buscar");
const filaReemplazar = document.getElementById("fila-reemplazar");
const campoBuscar = document.getElementById("buscar-texto");
const campoReemplazar = document.getElementById("reemplazar-texto");
const contador = document.getElementById("buscar-contador");
const casillaMayus = document.getElementById("buscar-mayus");
const casillaVuelta = document.getElementById("buscar-vuelta");
// El "espejo" es una copia invisible del texto, con la misma letra, detrás del
// área de escritura. Sirve para medir dónde cae una posición (y desplazar la
// vista) y para resaltar el resultado mientras el foco está en el buscador.
const espejo = document.getElementById("espejo");

// Posiciones de todas las coincidencias en el texto.
function coincidencias() {
  const buscado = campoBuscar.value;
  if (!buscado) return [];
  const mayus = casillaMayus.checked;
  const texto = mayus ? editor.value : editor.value.toLowerCase();
  const b = mayus ? buscado : buscado.toLowerCase();
  const lista = [];
  for (let i = texto.indexOf(b); i !== -1; i = texto.indexOf(b, i + b.length)) lista.push(i);
  return lista;
}

// Número de la coincidencia que está seleccionada ahora (o -1 si ninguna).
function actualSeleccionada(lista) {
  const largo = campoBuscar.value.length;
  return lista.findIndex((i) => i === editor.selectionStart && editor.selectionEnd - i === largo);
}

// Escribe "3 de 12", "12 coincidencias" o "Sin resultados" (o un mensaje).
function pintarContador(lista = coincidencias(), mensaje = "") {
  let texto = "";
  if (campoBuscar.value) {
    const n = actualSeleccionada(lista);
    if (!lista.length) texto = "Sin resultados";
    else if (n !== -1) texto = `${n + 1} de ${lista.length}`;
    else texto = lista.length === 1 ? "1 coincidencia" : `${lista.length} coincidencias`;
  }
  contador.textContent = mensaje ? `${mensaje} · ${texto}` : texto;
  contador.classList.toggle("sin-resultados", !!campoBuscar.value && !lista.length);
}

function ocultarEspejo() {
  espejo.classList.remove("visible");
}

// Desplaza el área para que se vea el trozo [inicio, fin] y, si "resaltar",
// lo marca en el espejo (la selección real no se ve sin foco).
function verPosicion(inicio, fin, resaltar) {
  const estilo = getComputedStyle(editor);
  espejo.style.whiteSpace = estilo.whiteSpace;
  espejo.style.overflowWrap = estilo.overflowWrap;
  espejo.style.width = editor.clientWidth + "px";
  espejo.style.height = editor.clientHeight + "px";
  // "​" (carácter invisible) para poder medir aunque no haya texto.
  const marca = el("mark", {}, editor.value.slice(inicio, fin) || "​");
  espejo.replaceChildren(editor.value.slice(0, inicio), marca, editor.value.slice(fin) + "\n");

  const { offsetTop: arriba, offsetHeight: alto, offsetLeft: izq, offsetWidth: ancho } = marca;
  if (arriba < editor.scrollTop || arriba + alto > editor.scrollTop + editor.clientHeight) {
    editor.scrollTop = Math.max(0, arriba - editor.clientHeight / 3);
  }
  if (izq < editor.scrollLeft || izq + ancho > editor.scrollLeft + editor.clientWidth) {
    editor.scrollLeft = Math.max(0, izq - editor.clientWidth / 3);
  }
  espejo.scrollTop = editor.scrollTop;
  espejo.scrollLeft = editor.scrollLeft;
  espejo.classList.toggle("visible", resaltar);
}

// Selecciona una coincidencia y la deja a la vista.
// La selección se pone con el foco un instante en el editor: si no, tras
// escribir en él, Chromium recupera el cursor antiguo al siguiente clic y
// la selección nueva se pierde (reemplazar y "siguiente" dejaban de ir).
function seleccionar(inicio, fin) {
  const volver = document.activeElement;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(inicio, fin);
  if (volver && volver !== editor) volver.focus({ preventScroll: true });
  verPosicion(inicio, fin, volver !== editor);
  actualizarBarra();
}

// Siguiente (+1) o anterior (-1). Con "desde" = true no avanza: busca desde el cursor.
function buscar(paso, desde = false) {
  const lista = coincidencias();
  if (!lista.length) {
    ocultarEspejo();
    return pintarContador(lista);
  }
  const ini = editor.selectionStart;
  const actual = desde ? -1 : actualSeleccionada(lista);
  let n;
  if (paso > 0) n = actual !== -1 ? actual + 1 : lista.findIndex((i) => i >= ini);
  else n = lista.findLastIndex((i) => i < ini);
  if (n === -1 || n >= lista.length) {
    // Llegó al final (o al principio): da la vuelta solo si está marcado.
    if (!casillaVuelta.checked) return pintarContador(lista, "No hay más");
    n = paso > 0 ? 0 : lista.length - 1;
  }
  seleccionar(lista[n], lista[n] + campoBuscar.value.length);
  pintarContador(lista);
}

// Escribe en el editor sustituyendo el trozo [inicio, fin]. execCommand entra
// en el historial, así Ctrl+Z lo deshace (necesita el foco un instante).
// Como en seleccionar(), la selección se pone DESPUÉS de dar el foco al
// editor: si no, Chromium podría recuperar el cursor antiguo y escribir en otro sitio.
function escribirEnEditor(texto, inicio, fin) {
  const volver = document.activeElement;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(inicio, fin);
  const hecho = texto ? document.execCommand("insertText", false, texto) : document.execCommand("delete");
  if (!hecho) {
    editor.setRangeText(texto, editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input")); // marca cambios y guarda la sesión
  }
  if (volver && volver !== editor) volver.focus({ preventScroll: true });
}

// Reemplaza la coincidencia seleccionada y salta a la siguiente.
function reemplazarUno() {
  const lista = coincidencias();
  const n = actualSeleccionada(lista);
  if (n !== -1) escribirEnEditor(campoReemplazar.value, lista[n], lista[n] + campoBuscar.value.length);
  buscar(1);
}

// Reemplaza todas de una vez (un solo paso de Ctrl+Z).
function reemplazarTodos() {
  const lista = coincidencias();
  if (!lista.length) return pintarContador(lista);
  const largo = campoBuscar.value.length;
  const nuevo = campoReemplazar.value;
  let texto = "";
  let desde = 0;
  for (const i of lista) {
    texto += editor.value.slice(desde, i) + nuevo;
    desde = i + largo;
  }
  texto += editor.value.slice(desde);
  escribirEnEditor(texto, 0, editor.value.length); // todo el texto de golpe
  // El cursor queda donde estaba la primera coincidencia.
  seleccionar(lista[0], lista[0] + nuevo.length);
  const quedan = coincidencias();
  ocultarEspejo();
  pintarContador(quedan, `${lista.length} reemplazadas`);
}

// Ctrl+F (solo buscar) o Ctrl+H (buscar y reemplazar).
function abrirBuscar(conReemplazar) {
  // Si hay texto seleccionado en una sola línea, se busca eso.
  const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (document.activeElement === editor && sel && !sel.includes("\n")) campoBuscar.value = sel;
  filaReemplazar.hidden = !conReemplazar;
  barraBuscar.hidden = false;
  campoBuscar.focus();
  campoBuscar.select();
  if (campoBuscar.value) buscar(1, true);
  else pintarContador();
}

// Escape: se cierra y el cursor vuelve al texto (con el resultado seleccionado).
function cerrarBuscar() {
  barraBuscar.hidden = true;
  ocultarEspejo();
  espejo.replaceChildren();
  editor.focus();
}

// Lo llama pintarPestanas() (p. ej. al cambiar de pestaña): recuenta.
function refrescarBusqueda() {
  if (barraBuscar.hidden) return;
  ocultarEspejo();
  pintarContador();
}

// --- Eventos de la barra ---
campoBuscar.addEventListener("input", () => buscar(1, true));
casillaMayus.addEventListener("change", () => buscar(1, true));
casillaVuelta.addEventListener("change", () => pintarContador());
document.getElementById("buscar-siguiente").addEventListener("click", () => buscar(1));
document.getElementById("buscar-anterior").addEventListener("click", () => buscar(-1));
document.getElementById("buscar-cerrar").addEventListener("click", cerrarBuscar);
document.getElementById("reemplazar-uno").addEventListener("click", reemplazarUno);
document.getElementById("reemplazar-todos").addEventListener("click", reemplazarTodos);

// Intro = siguiente, Mayús+Intro = anterior. En "reemplazar", Intro reemplaza.
campoBuscar.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  buscar(e.shiftKey ? -1 : 1);
});
campoReemplazar.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  reemplazarUno();
});

// El espejo acompaña al scroll; al volver al texto o escribir, sobra.
editor.addEventListener("scroll", () => {
  espejo.scrollTop = editor.scrollTop;
  espejo.scrollLeft = editor.scrollLeft;
});
editor.addEventListener("focus", ocultarEspejo);
editor.addEventListener("input", () => {
  ocultarEspejo();
  if (!barraBuscar.hidden) pintarContador();
});

// --- Ir a la línea (Ctrl+G) ---
const dialogoLinea = document.getElementById("dialogo-linea");
const campoLinea = document.getElementById("linea-numero");
const totalLineas = () => editor.value.split("\n").length;

function abrirIrALinea() {
  if (dialogoLinea.open) return;
  const total = totalLineas();
  campoLinea.max = total;
  campoLinea.value = editor.value.slice(0, editor.selectionStart).split("\n").length;
  document.getElementById("linea-total").textContent = `(1 a ${numero(total)})`;
  dialogoLinea.showModal();
  campoLinea.select();
}

function irALinea() {
  const total = totalLineas();
  // Si el número es mayor que el total, va a la última.
  const n = Math.min(Math.max(1, parseInt(campoLinea.value, 10) || 1), total);
  let pos = 0;
  for (let i = 1; i < n; i++) pos = editor.value.indexOf("\n", pos) + 1;
  dialogoLinea.close();
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(pos, pos);
  verPosicion(pos, pos, false);
  actualizarBarra();
}

// Intro acepta: se frena aquí para que no siga hasta el texto ni reabra nada.
campoLinea.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  irALinea();
});
document.getElementById("form-linea").addEventListener("submit", (e) => {
  e.preventDefault();
  irALinea();
});
document.getElementById("linea-cancelar").addEventListener("click", () => dialogoLinea.close());
// Escape lo cierra el propio <dialog>.
