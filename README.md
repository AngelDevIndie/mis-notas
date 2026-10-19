# Mis Notas

Un bloc de notas de escritorio para Windows con pestañas, pensado para que **nunca pierdas una nota**: todo lo que escribes se guarda solo, aunque cierres sin guardar.

Inspirada en el Bloc de notas de Windows. No es una app oficial ni contiene nada del original; mira [LEGAL.md](LEGAL.md).

## Qué hace (las 5 funciones)

1. **Pestañas y archivos.** Varias notas abiertas a la vez, cada una en su pestaña. Crea (botón "+"), cierra ("×"), cambia con un clic y reordena arrastrando. Con clic derecho en una pestaña: cerrar esta, las demás o las de la derecha. Abre y guarda archivos `.txt` (en UTF-8). Un punto en la pestaña indica cambios sin guardar en el archivo; al cerrarla te pregunta si quieres guardar.
2. **Buscar y reemplazar.** Una barra encima del texto que cuenta las coincidencias ("3 de 12"), con opción de distinguir mayúsculas y de volver al principio. Reemplaza una a una o todas a la vez (se deshace con Ctrl+Z). También **ir a la línea**.
3. **Nada se pierde.** Un segundo después de dejar de escribir, se guarda todo solo. Al volver a abrir aparecen las mismas pestañas, en el mismo orden, con su texto, la pestaña activa y el cursor donde estaba. Cerrar la ventana no pregunta nada. También recuerda el tamaño y la posición de la ventana.
4. **A tu gusto.** Desde la rueda dentada: tema claro, oscuro o como el sistema; ajuste de línea; mostrar u ocultar la barra de estado; zoom de la letra (50 % a 300 %). Todo se recuerda.
5. **Barra de estado y fecha.** Abajo se ve la línea y la columna del cursor, los caracteres (o los seleccionados), el zoom y "UTF-8". F5 escribe la fecha y la hora, por ejemplo "19/10/2026 14:35".

## Cómo probarla

Necesitas [Node.js](https://nodejs.org) instalado. Abre una terminal **en esta carpeta** (`clones/mis-notas/app/`) y escribe:

```bash
npm install
npm start
```

- `npm install` descarga Electron (la pieza que convierte una página web en una ventana de escritorio). Solo hace falta la primera vez; tarda un par de minutos.
- `npm start` abre la ventana de Mis Notas. No se abre en el navegador.

**Si lo lanzas desde la terminal de VS Code y no se abre la ventana:** VS Code a veces deja puesta una variable llamada `ELECTRON_RUN_AS_NODE`, que hace que Electron se comporte como Node y no pinte ventanas. Quítala y vuelve a probar. En PowerShell:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE; npm start
```

## Atajos de teclado

| Atajo | Qué hace |
| --- | --- |
| Ctrl+T | Pestaña nueva |
| Ctrl+W | Cerrar la pestaña |
| Ctrl+Tab / Ctrl+Mayús+Tab | Pestaña siguiente / anterior |
| Ctrl+O | Abrir un archivo |
| Ctrl+S | Guardar |
| Ctrl+Mayús+S | Guardar como |
| Ctrl+F | Buscar |
| Ctrl+H | Buscar y reemplazar |
| Intro / Mayús+Intro (en la barra) | Siguiente / anterior coincidencia |
| Ctrl+G | Ir a la línea |
| Ctrl++ / Ctrl+- / Ctrl+0 | Agrandar / reducir / letra al 100 % (también Ctrl+rueda del ratón) |
| F5 | Insertar fecha y hora |
| Tab | Escribir una tabulación |
| Escape | Cerrar la barra de búsqueda, el menú o los ajustes |
| Ctrl+Mayús+I o F12 | Abrir la consola de desarrollo (para buscar errores) |

## Dónde guarda tus datos

Todo se queda en tu ordenador; la app no usa internet. Tus notas y ajustes están en la carpeta de datos de la app:

```
%APPDATA%\mis-notas\
  sesion\indice.json      orden de las pestañas, la activa, el cursor y la ruta de cada archivo
  sesion\pestana-N.txt    el texto de cada pestaña
  ajustes.json            tema, zoom, ajuste de línea y barra de estado
  ventana.json            tamaño y posición de la ventana
```

(Pega `%APPDATA%\mis-notas` en la barra de direcciones del Explorador de archivos para abrirla.) Cada archivo se escribe de forma segura: si algo se corta a medias, la app usa la copia `.bak`.

Para empezar de cero, cierra la app y borra la carpeta `sesion`. Los archivos `.txt` que abres o guardas están donde tú los elijas.

## Cómo publicarla

Es una app de escritorio, no una web, así que no va en Vercel.

- **El código** sí se puede subir a GitHub para compartirlo o guardarlo (solo esta carpeta `app/`; `node_modules/` ya está excluida en `.gitignore`). Con `/desplegar` en Claude Code te guía paso a paso con Git y GitHub.
- **Un instalador `.exe`** para que otras personas la instalen con doble clic: en PowerShell, `.\construir.ps1`. Crea en `dist\` un instalador y una versión portable. Todos los detalles y los problemas conocidos están en [BUILD.md](BUILD.md).

## Cómo está hecha

- **Electron** con la interfaz en HTML + CSS + JavaScript, sin herramientas de compilación. La única dependencia es `electron`.
- `main.js` es el proceso principal: crea la ventana y es el **único** que toca el disco.
- `preload.js` es el puente seguro: la página solo ve `window.api` (aislamiento de contexto activado y sin Node en la página).
- `index.html`, `style.css` y la carpeta `js/` son la interfaz: `estado.js` (lista de pestañas), `pestanas.js`, `buscar.js`, `sesion.js`, `ajustes.js`, `barra-estado.js` y `app.js` (atajos y arranque).
- `icono.png` es el icono de la ventana: un cuaderno con la esquina doblada, dibujado para esta app.

## Limitaciones conocidas

- Solo lee y guarda en UTF-8; los archivos en otras codificaciones no se abren (la app avisa).
- El historial de deshacer (Ctrl+Z) no se conserva al cambiar de pestaña.
- El clic derecho dentro del texto no muestra menú (copiar y pegar van con Ctrl+C / Ctrl+V).
- Si un archivo abierto cambia fuera de la app, la pestaña conserva el texto de la sesión.
