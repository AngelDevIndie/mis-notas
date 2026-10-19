// Pestañas y archivos (función 1): pintar la fila de pestañas y las acciones
// de crear, cerrar, cambiar, abrir, guardar y guardar como.

const editor = document.getElementById("editor");
const filaPestanas = document.getElementById("pestanas");

// Ayudante para crear elementos: el("div", { class: "x" }, hijo1, [hijo2, hijo3]).
// Aplana listas y descarta null/false/undefined (replaceChildren no lo hace).
function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === false || valor === undefined) continue;
    if (clave.startsWith("on")) nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(clave, valor === true ? "" : valor);
  }
  nodo.append(...limpiar(hijos));
  return nodo;
}

function limpiar(lista) {
  return lista.flat(Infinity).filter((h) => h !== null && h !== false && h !== undefined);
}

// Copia el texto, la selección y el scroll del editor a la pestaña activa.
function recogerEditor() {
  const p = Estado.activa();
  if (!p) return;
  p.texto = editor.value;
  p.selInicio = editor.selectionStart;
  p.selFin = editor.selectionEnd;
  p.scroll = editor.scrollTop;
}

// Pone en el editor el texto y el cursor de la pestaña activa.
function cargarEditor() {
  const p = Estado.activa();
  editor.value = p.texto;
  editor.setSelectionRange(p.selInicio, p.selFin);
  editor.scrollTop = p.scroll;
  editor.focus();
}

// Vuelve a dibujar la fila de pestañas y el título de la ventana.
function pintarPestanas() {
  filaPestanas.replaceChildren(
    ...limpiar(
      Estado.pestanas.map((p) => {
        const activa = p.id === Estado.activaId;
        return el(
          "div",
          {
            class: activa ? "pestana activa" : "pestana",
            role: "tab",
            "aria-selected": activa ? "true" : "false",
            title: p.ruta || "Sin título",
            "data-id": p.id,
            onclick: () => activar(p.id),
            oncontextmenu: (e) => abrirMenuPestana(e, p.id),
          },
          el("span", { class: "pestana-nombre" }, Estado.nombre(p)),
          p.modificado && el("span", { class: "pestana-punto", title: "Cambios sin guardar" }),
          el(
            "button",
            {
              class: "pestana-cerrar",
              title: "Cerrar (Ctrl+W)",
              "aria-label": "Cerrar pestaña",
              onclick: (e) => {
                e.stopPropagation(); // que no active la pestaña a la vez
                enExclusiva(() => cerrar(p.id)); // un solo diálogo a la vez
              },
            },
            "×"
          )
        );
      })
    )
  );

  // Que la pestaña activa se vea si hay muchas.
  const activaNodo = filaPestanas.querySelector(".activa");
  if (activaNodo) activaNodo.scrollIntoView({ block: "nearest", inline: "nearest" });

  const p = Estado.activa();
  if (p) window.api.ponerTitulo(`${Estado.nombre(p)}${p.modificado ? " •" : ""} · Mis Notas`);

  // Funciones 3 y 5 (sesion.js y barra-estado.js): cualquier cambio en las
  // pestañas (cambiar, crear, cerrar, reordenar) se guarda casi al momento.
  actualizarBarra();
  programarGuardado(100);
  refrescarBusqueda(); // función 2: si la barra de búsqueda está abierta, recuenta
}

// Cambia a otra pestaña conservando el texto y el cursor de la actual.
function activar(id) {
  if (id === Estado.activaId) return editor.focus();
  recogerEditor();
  Estado.activaId = id;
  cargarEditor();
  pintarPestanas();
}

// Crea una pestaña y la activa. Se coloca justo a la derecha de la activa.
function nuevaPestana(datos) {
  recogerEditor();
  const p = Estado.crear(datos);
  const i = Estado.indice(Estado.activaId);
  Estado.pestanas.splice(i === -1 ? Estado.pestanas.length : i + 1, 0, p);
  Estado.activaId = p.id;
  cargarEditor();
  pintarPestanas();
  return p;
}

// Pasa a la pestaña siguiente (+1) o anterior (-1), dando la vuelta.
function moverPestana(paso) {
  const n = Estado.pestanas.length;
  const i = Estado.indice(Estado.activaId);
  activar(Estado.pestanas[(i + paso + n) % n].id);
}

// Guarda una pestaña. "como" = true pregunta siempre nombre y carpeta.
// Devuelve true si se guardó y false si se canceló o falló.
async function guardar(p, como = false) {
  if (p.id === Estado.activaId) recogerEditor();
  try {
    let ruta;
    if (p.ruta && !como) ruta = await window.api.guardar(p.ruta, p.texto);
    else ruta = await window.api.guardarComo(p.texto, p.ruta ? Estado.nombre(p) : "Sin título.txt");
    if (!ruta) return false;
    // Si otra pestaña tenía abierto ese mismo archivo (al "Guardar como"
    // encima de él), esa pestaña pasa a "Sin título" con su texto intacto,
    // para que no haya dos pestañas guardando en el mismo archivo.
    const otra = Estado.buscarPorRuta(ruta);
    if (otra && otra !== p) {
      otra.ruta = null;
      otra.modificado = true;
    }
    p.ruta = ruta;
    p.modificado = false;
    pintarPestanas();
    return true;
  } catch (err) {
    await window.api.aviso(
      `No se ha podido guardar "${Estado.nombre(p)}".\n\n${err.message}\n\nTu texto sigue aquí. Prueba con "Guardar como" (Ctrl+Mayús+S) en otra carpeta.`
    );
    return false;
  } finally {
    if (p.id === Estado.activaId) editor.focus();
  }
}

// Abre un archivo: si ya está abierto salta a su pestaña; si no, crea una nueva.
async function abrir() {
  try {
    const r = await window.api.abrir();
    if (!r) return;
    const ya = Estado.buscarPorRuta(r.ruta);
    if (ya) return activar(ya.id);
    nuevaPestana({ ruta: r.ruta, texto: r.texto });
  } catch (err) {
    await window.api.aviso("No se ha podido abrir el archivo.\n\n" + err.message);
  } finally {
    editor.focus();
  }
}

// Cierra una pestaña. Si tiene cambios sin guardar en disco, pregunta.
// La última pestaña nunca desaparece: queda una nota vacía nueva.
// Devuelve false si la persona cancela (para parar "cerrar las demás").
async function cerrar(id) {
  const p = Estado.pestanas.find((x) => x.id === id);
  if (!p) return true;
  if (p.id === Estado.activaId) recogerEditor();

  if (p.modificado) {
    const respuesta = await window.api.preguntarGuardar(Estado.nombre(p));
    if (respuesta === "cancelar") {
      editor.focus();
      return false;
    }
    if (respuesta === "guardar" && !(await guardar(p))) return false;
  }

  const i = Estado.indice(id);
  if (i === -1) return true; // ya se cerró mientras se preguntaba
  Estado.pestanas.splice(i, 1);

  if (Estado.pestanas.length === 0) Estado.pestanas.push(Estado.crear());
  if (id === Estado.activaId) {
    // Activa la de la derecha (o la de la izquierda si era la última).
    Estado.activaId = Estado.pestanas[Math.min(i, Estado.pestanas.length - 1)].id;
    cargarEditor();
  } else {
    editor.focus();
  }
  pintarPestanas();
  return true;
}

// Al escribir: se marca la pestaña con cambios sin guardar en disco.
editor.addEventListener("input", () => {
  const p = Estado.activa();
  if (p && !p.modificado) {
    p.modificado = true;
    pintarPestanas();
  }
});

// --- Reordenar arrastrando (eventos de puntero: valen con ratón y con el dedo) ---
let arrastre = null; // { id, nodo, x0, moviendo }
let acabaDeArrastrar = false;

filaPestanas.addEventListener("pointerdown", (e) => {
  const nodo = e.target.closest(".pestana");
  if (!nodo || e.button !== 0 || e.target.closest(".pestana-cerrar")) return;
  arrastre = { id: Number(nodo.dataset.id), nodo, x0: e.clientX, moviendo: false };
});

filaPestanas.addEventListener("pointermove", (e) => {
  if (!arrastre) return;
  if (!arrastre.moviendo) {
    // Si se soltó el botón fuera de la fila antes de empezar, no hay arrastre.
    if (!(e.buttons & 1)) return (arrastre = null);
    // Umbral: hasta moverse 6 px es un clic, no un arrastre.
    if (Math.abs(e.clientX - arrastre.x0) < 6) return;
    arrastre.moviendo = true;
    // La captura va en la fila (que nunca se mueve), no en la pestaña.
    filaPestanas.setPointerCapture(e.pointerId);
    arrastre.nodo.classList.add("arrastrando");
  }
  // La pestaña se coloca delante de la primera cuyo centro quede a la derecha del puntero.
  const otras = [...filaPestanas.children].filter((n) => n !== arrastre.nodo);
  const destino =
    otras.find((n) => {
      const r = n.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2;
    }) || null;
  if (destino !== arrastre.nodo.nextSibling) filaPestanas.insertBefore(arrastre.nodo, destino);
});

function soltarPestana() {
  if (!arrastre) return;
  const { id, moviendo } = arrastre;
  arrastre = null;
  if (!moviendo) return; // era un clic normal
  acabaDeArrastrar = true;
  setTimeout(() => (acabaDeArrastrar = false), 0);
  // El nuevo orden es el que se ve en pantalla.
  const orden = [...filaPestanas.children].map((n) => Number(n.dataset.id));
  Estado.pestanas.sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id));
  if (id !== Estado.activaId) activar(id);
  else {
    pintarPestanas(); // también guarda la sesión
    editor.focus();
  }
}
filaPestanas.addEventListener("pointerup", soltarPestana);
filaPestanas.addEventListener("pointercancel", soltarPestana);
// Que el clic que llega al soltar no haga nada más.
filaPestanas.addEventListener(
  "click",
  (e) => {
    if (acabaDeArrastrar) e.stopPropagation();
  },
  true
);

// Con muchas pestañas la fila se desplaza de lado: la rueda del ratón
// (arriba/abajo) la mueve a izquierda/derecha.
filaPestanas.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || filaPestanas.scrollWidth <= filaPestanas.clientWidth) return;
    e.preventDefault();
    filaPestanas.scrollLeft += e.deltaY || e.deltaX;
  },
  { passive: false }
);

// --- Menú de clic derecho en las pestañas ---
const menuPestana = document.getElementById("menu-pestana");
let idMenu = null;

function abrirMenuPestana(e, id) {
  e.preventDefault();
  idMenu = id;
  const i = Estado.indice(id);
  menuPestana.querySelector('[data-accion="demas"]').disabled = Estado.pestanas.length === 1;
  menuPestana.querySelector('[data-accion="derecha"]').disabled = i === Estado.pestanas.length - 1;
  menuPestana.hidden = false;
  // Que no se salga por la derecha de la ventana.
  menuPestana.style.left = Math.min(e.clientX, innerWidth - menuPestana.offsetWidth - 4) + "px";
  menuPestana.style.top = e.clientY + "px";
  menuPestana.querySelector("button:not(:disabled)").focus();
}

function cerrarMenuPestana() {
  menuPestana.hidden = true;
}

menuPestana.addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-accion]");
  if (!boton) return;
  cerrarMenuPestana();
  const accion = boton.dataset.accion;
  const id = idMenu;
  const i = Estado.indice(id);
  if (i === -1) return;
  let ids = [id];
  if (accion === "demas") ids = Estado.pestanas.filter((p) => p.id !== id).map((p) => p.id);
  if (accion === "derecha") ids = Estado.pestanas.slice(i + 1).map((p) => p.id);
  enExclusiva(async () => {
    // Se queda a la vista la pestaña del clic derecho.
    if (accion !== "esta") activar(id);
    // Una a una; si en alguna se pulsa "Cancelar", se para.
    for (const x of ids) if (!(await cerrar(x))) break;
  });
});
