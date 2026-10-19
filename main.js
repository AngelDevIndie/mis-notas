// Proceso principal de Electron: crea la ventana y es el ÚNICO que toca el disco.
// La interfaz (index.html) le pide cosas por los canales IPC que hay más abajo.
const { app, BrowserWindow, ipcMain, dialog, Menu, screen, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");

let ventana = null;

// La carpeta de datos se fija a mano (%APPDATA%\mis-notas). Si no, Electron la
// llama como "productName" ("Mis Notas") y la versión instalada no vería las
// notas guardadas con "npm start", ni al revés.
app.setPath("userData", path.join(app.getPath("appData"), "mis-notas"));

// --- Sesión (función 3): todo vive en la carpeta de datos de la app ---
// userData/sesion/indice.json   -> orden, pestaña activa y datos de cada una
// userData/sesion/pestana-N.txt -> el texto de la pestaña N
// userData/ventana.json         -> tamaño, posición y si estaba maximizada
const carpetaSesion = () => path.join(app.getPath("userData"), "sesion");
const archivoIndice = () => path.join(carpetaSesion(), "indice.json");
const archivoPestana = (id) => path.join(carpetaSesion(), `pestana-${id}.txt`);
const archivoVentana = () => path.join(app.getPath("userData"), "ventana.json");

// Escritura segura: primero un temporal, la versión anterior pasa a ".bak"
// y el temporal se renombra encima. Si se corta a medias, queda la copia.
async function escribirSeguro(ruta, contenido) {
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta + ".tmp", contenido, "utf8");
  await fs.copyFile(ruta, ruta + ".bak").catch(() => {}); // la primera vez no hay
  await fs.rename(ruta + ".tmp", ruta);
}

// Lectura segura: si el archivo falta o está roto, prueba con la copia ".bak".
// "comprobar" lanza un error si el contenido no vale (p. ej. JSON roto).
async function leerSeguro(ruta, comprobar = (t) => t) {
  for (const r of [ruta, ruta + ".bak"]) {
    try {
      return comprobar(await fs.readFile(r, "utf8"));
    } catch {
      // probamos con la siguiente
    }
  }
  return null;
}

// Último texto escrito de cada pestaña, para no reescribir las que no cambian.
const escritos = new Map();
// Cola: los guardados van de uno en uno para que no se pisen los temporales.
let cola = Promise.resolve();

async function guardarSesion({ pestanas, activaId }) {
  for (const p of pestanas) {
    if (escritos.get(p.id) === p.texto) continue;
    await escribirSeguro(archivoPestana(p.id), p.texto);
    escritos.set(p.id, p.texto);
  }
  // El índice lleva todo menos el texto (que va en su propio archivo).
  const indice = { activaId, pestanas: pestanas.map(({ texto, ...datos }) => datos) };
  await escribirSeguro(archivoIndice(), JSON.stringify(indice, null, 2));

  // Borra los archivos (y sus copias) de pestañas que ya no existen.
  const vivas = new Set(pestanas.map((p) => String(p.id)));
  for (const nombre of await fs.readdir(carpetaSesion())) {
    const m = /^pestana-(\d+)\.txt/.exec(nombre);
    if (m && !vivas.has(m[1])) {
      await fs.rm(path.join(carpetaSesion(), nombre), { force: true });
      escritos.delete(Number(m[1]));
    }
  }
}

async function cargarSesion() {
  const indice = await leerSeguro(archivoIndice(), JSON.parse);
  if (!indice || !Array.isArray(indice.pestanas) || !indice.pestanas.length) return null;
  for (const p of indice.pestanas) {
    p.texto = (await leerSeguro(archivoPestana(p.id))) ?? "";
    escritos.set(p.id, p.texto);
  }
  return indice;
}

// Tamaño y posición guardados. La posición solo se usa si sigue cayendo
// dentro de alguna pantalla (por si se desconectó un monitor).
function leerVentana() {
  try {
    const v = JSON.parse(fsSync.readFileSync(archivoVentana(), "utf8"));
    const z = screen.getDisplayMatching(v).workArea;
    const cabe = v.x < z.x + z.width && v.y < z.y + z.height && v.x + v.width > z.x && v.y + v.height > z.y;
    return cabe ? v : { width: v.width, height: v.height, maximizada: v.maximizada };
  } catch {
    return {}; // primera vez o archivo roto: tamaño por defecto
  }
}

// --- Ajustes (función 4): userData/ajustes.json ---
const archivoAjustes = () => path.join(app.getPath("userData"), "ajustes.json");
// Nombre del tema en la app -> nombre que entiende Electron.
const TEMAS = { claro: "light", oscuro: "dark", sistema: "system" };
let ajustes = null;

// Deja solo valores válidos (por si el archivo está roto o se editó a mano).
function limpiarAjustes(a = {}) {
  return {
    tema: TEMAS[a.tema] ? a.tema : "sistema",
    ajusteLinea: a.ajusteLinea !== false,
    barraEstado: a.barraEstado !== false,
    zoom: Math.min(300, Math.max(50, Math.round((Number(a.zoom) || 100) / 10) * 10)),
  };
}

// Se lee al arrancar, antes de crear la ventana (si falla, prueba la copia .bak).
function leerAjustes() {
  for (const r of [archivoAjustes(), archivoAjustes() + ".bak"]) {
    try {
      return limpiarAjustes(JSON.parse(fsSync.readFileSync(r, "utf8")));
    } catch {
      // probamos con la siguiente
    }
  }
  return limpiarAjustes();
}

// nativeTheme hace que la barra de título de Windows y el CSS
// "prefers-color-scheme" sigan el tema elegido. Devuelve el color de fondo.
function aplicarTema() {
  nativeTheme.themeSource = TEMAS[ajustes.tema];
  return nativeTheme.shouldUseDarkColors ? "#1e1f1d" : "#fbf8f1";
}

// Traduce un error del sistema a una frase clara en español.
function explicarError(err) {
  const motivos = {
    ENOENT: "El archivo o la carpeta ya no existe.",
    EACCES: "No tienes permiso para usar este archivo o carpeta.",
    EPERM: "No tienes permiso para usar este archivo o carpeta (puede ser de solo lectura).",
    EBUSY: "Otro programa está usando el archivo. Ciérralo y vuelve a probar.",
    EISDIR: "Has elegido una carpeta, no un archivo.",
    ENOSPC: "No queda espacio libre en el disco.",
    EROFS: "El disco es de solo lectura.",
  };
  return err.mensaje || motivos[err.code] || `Error inesperado (${err.code || err.message}).`;
}

// Ejecuta una acción de archivo. Si falla, devuelve { error } en vez de romper:
// el preload lo convierte en un error con un mensaje que se entiende.
async function conAviso(accion) {
  try {
    return await accion();
  } catch (err) {
    console.error(err);
    return { error: explicarError(err) };
  }
}

// Más de 50 MB no es una nota: el área de escritura se volvería muy lenta.
const TAM_MAXIMO = 50 * 1024 * 1024;

// Lee un archivo de texto en UTF-8 y comprueba que lo parece.
async function leerTexto(ruta) {
  const { size } = await fs.stat(ruta);
  if (size > TAM_MAXIMO) throw { mensaje: "El archivo es demasiado grande (más de 50 MB) para Mis Notas." };
  const datos = await fs.readFile(ruta);
  // El texto UTF-8 nunca lleva bytes 0: si los hay, es otro tipo de archivo.
  if (datos.includes(0)) throw { mensaje: "No parece un archivo de texto en UTF-8 (solo se abren archivos de texto)." };
  // Quita la marca invisible (BOM) que algunos programas ponen al principio.
  return datos.toString("utf8").replace(/^﻿/, "");
}

// Tipos de archivo que se ofrecen en los diálogos de abrir y guardar.
const FILTROS = [
  { name: "Texto", extensions: ["txt"] },
  { name: "Todos los archivos", extensions: ["*"] },
];

function crearVentana() {
  const v = leerVentana();
  ventana = new BrowserWindow({
    width: v.width || 1000,
    height: v.height || 700,
    x: v.x,
    y: v.y,
    minWidth: 480,
    minHeight: 320,
    title: "Mis Notas",
    icon: path.join(__dirname, "icono.png"), // icono propio (cuaderno con la esquina doblada)
    backgroundColor: aplicarTema(), // fondo del tema desde el primer instante
    show: false, // se enseña cuando ya está pintada (sin parpadeo)
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // la página no ve las variables del preload
      nodeIntegration: false, // la página no puede usar Node
      sandbox: true, // el preload solo usa contextBridge e ipcRenderer
    },
  });

  // Sin el menú por defecto (Archivo, Editar...): los atajos los gestiona la app.
  ventana.removeMenu();
  ventana.once("ready-to-show", () => {
    if (v.maximizada) ventana.maximize();
    ventana.show();
  });
  ventana.loadFile("index.html");

  // Si se suelta un archivo encima de la ventana, Electron intentaría abrirlo
  // EN LUGAR de la app. Se impide: la ventana solo muestra index.html.
  ventana.webContents.on("will-navigate", (e) => e.preventDefault());
  ventana.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Tamaño y posición: se guardan también al mover o redimensionar (con 1 s
  // de espera), por si el ordenador se apaga sin cerrar la ventana.
  let relojVentana = null;
  const guardarVentanaLuego = () => {
    clearTimeout(relojVentana);
    relojVentana = setTimeout(() => {
      if (!ventana || ventana.isDestroyed() || ventana.isMinimized()) return;
      const datos = { ...ventana.getNormalBounds(), maximizada: ventana.isMaximized() };
      cola = cola.then(() => escribirSeguro(archivoVentana(), JSON.stringify(datos))).catch(() => {});
    }, 1000);
  };
  for (const evento of ["resize", "move", "maximize", "unmaximize"]) ventana.on(evento, guardarVentanaLuego);

  // El zoom de la app es el tamaño de letra del área de escritura (lo hace la
  // interfaz). Se anula el zoom propio de Electron, que ampliaría toda la ventana.
  ventana.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  ventana.webContents.on("zoom-changed", () => ventana.webContents.setZoomLevel(0));

  // Sin menú no hay atajo para la consola: Ctrl+Mayús+I o F12 la abren y cierran.
  ventana.webContents.on("before-input-event", (e, tecla) => {
    const esI = tecla.control && tecla.shift && tecla.key.toLowerCase() === "i";
    if (tecla.type === "keyDown" && (esI || tecla.key === "F12")) {
      e.preventDefault();
      ventana.webContents.toggleDevTools();
    }
  });

  // Al cerrar NO se pregunta nada: se frena el cierre, se pide a la interfaz
  // un último guardado y, cuando termina (o a los 3 s), se destruye la ventana.
  // destroy() no vuelve a lanzar "close", así que no hay bucle.
  let cerrando = false;
  ventana.on("close", (e) => {
    if (cerrando) return;
    cerrando = true;
    e.preventDefault();
    clearTimeout(relojVentana);
    const datosVentana = { ...ventana.getNormalBounds(), maximizada: ventana.isMaximized() };
    let hecho = false;
    const terminar = async () => {
      if (hecho) return;
      hecho = true;
      clearTimeout(reloj);
      // En la cola, para no pisar otro guardado de la ventana a medias.
      cola = cola.then(() => escribirSeguro(archivoVentana(), JSON.stringify(datosVentana))).catch(() => {});
      await Promise.race([cola, new Promise((r) => setTimeout(r, 2000))]); // como mucho 2 s más
      if (ventana && !ventana.isDestroyed()) ventana.destroy();
    };
    const reloj = setTimeout(terminar, 3000); // por si la interfaz no responde
    // "cola" incluye el último guardado de la sesión: esperamos a que acabe.
    ipcMain.once("sesion:lista", () => cola.then(terminar));
    ventana.webContents.send("sesion:pedir");
  });
  ventana.on("closed", () => (ventana = null));
}

// --- Canales de la sesión ---
ipcMain.handle("sesion:cargar", () => cargarSesion().catch(() => null));
// Devuelve { error } si no se pudo escribir (la interfaz avisa una vez).
ipcMain.handle("sesion:guardar", (_e, datos) => {
  const intento = cola.then(() => guardarSesion(datos)).then(
    () => ({}),
    (err) => {
      console.error("Sesión:", err);
      return { error: explicarError(err) };
    }
  );
  cola = intento;
  return intento;
});

// --- Canales de los ajustes ---
// Lectura síncrona: el preload los tiene antes de que la página se pinte.
ipcMain.on("ajustes:leer", (e) => {
  e.returnValue = ajustes;
});
ipcMain.handle("ajustes:guardar", (_e, datos) => {
  ajustes = limpiarAjustes(datos);
  const fondo = aplicarTema();
  if (ventana) ventana.setBackgroundColor(fondo);
  // En la misma cola que la sesión: así el cierre también espera a esto.
  cola = cola
    .then(() => escribirSeguro(archivoAjustes(), JSON.stringify(ajustes, null, 2)))
    .catch((err) => console.error("Ajustes:", err));
  return cola;
});

// --- Canales IPC: uno por cada acción que pide la interfaz ---

// Abrir: muestra el diálogo y devuelve { ruta, texto } o null si se cancela.
// Si algo falla, devuelven { error: "frase en español" } (ver conAviso).
ipcMain.handle("archivo:abrir", () =>
  conAviso(async () => {
    const r = await dialog.showOpenDialog(ventana, {
      title: "Abrir",
      properties: ["openFile"],
      filters: FILTROS,
    });
    if (r.canceled || !r.filePaths.length) return null;
    const ruta = r.filePaths[0];
    return { ruta, texto: await leerTexto(ruta) };
  })
);

// Guardar en una ruta conocida. Devuelve la ruta.
ipcMain.handle("archivo:guardar", (_e, { ruta, texto }) =>
  conAviso(async () => {
    await fs.writeFile(ruta, texto, "utf8");
    return ruta;
  })
);

// Guardar como: pregunta nombre y carpeta. Devuelve la ruta o null.
ipcMain.handle("archivo:guardarComo", (_e, { texto, nombre }) =>
  conAviso(async () => {
    const r = await dialog.showSaveDialog(ventana, {
      title: "Guardar como",
      defaultPath: nombre || "Sin título.txt",
      filters: FILTROS,
    });
    if (r.canceled || !r.filePath) return null;
    await fs.writeFile(r.filePath, texto, "utf8");
    return r.filePath;
  })
);

// Aviso con un botón "Aceptar" (para errores). Se usa en vez de alert(),
// que en Electron puede dejar el área de escritura sin poder recibir el foco.
ipcMain.handle("dialogo:aviso", async (_e, mensaje) => {
  if (!ventana) return;
  await dialog.showMessageBox(ventana, {
    type: "warning",
    title: "Mis Notas",
    message: String(mensaje),
    buttons: ["Aceptar"],
    noLink: true,
  });
});

// Pregunta si guardar los cambios. Devuelve "guardar", "no-guardar" o "cancelar".
ipcMain.handle("dialogo:preguntarGuardar", async (_e, nombre) => {
  const r = await dialog.showMessageBox(ventana, {
    type: "question",
    title: "Mis Notas",
    message: `¿Quieres guardar los cambios de "${nombre}"?`,
    buttons: ["Guardar", "No guardar", "Cancelar"],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  return ["guardar", "no-guardar", "cancelar"][r.response];
});

// Cambia el título de la ventana.
ipcMain.handle("ventana:titulo", (_e, titulo) => {
  if (ventana) ventana.setTitle(String(titulo));
});

// Solo una copia de la app a la vez: dos copias se pisarían la sesión.
// Si se abre otra, se cierra y se trae al frente la que ya estaba.
const esLaPrimera = app.requestSingleInstanceLock();
if (!esLaPrimera) app.quit();
app.on("second-instance", () => {
  if (!ventana) return;
  if (ventana.isMinimized()) ventana.restore();
  ventana.focus();
});

app.whenReady().then(() => {
  if (!esLaPrimera) return; // esta copia se está cerrando: no abre ventana
  Menu.setApplicationMenu(null);
  ajustes = leerAjustes();
  crearVentana();
  // Con el tema "como el sistema", si Windows cambia de claro a oscuro,
  // el fondo de la ventana también cambia.
  nativeTheme.on("updated", () => {
    if (ventana && !ventana.isDestroyed()) ventana.setBackgroundColor(aplicarTema());
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
