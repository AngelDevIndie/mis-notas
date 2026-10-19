# Cómo crear el instalador de Mis Notas

Una **build** convierte el proyecto en un programa de Windows que cualquiera puede instalar y abrir **sin Node.js ni `npm start`**. Se hace con [electron-builder](https://www.electron.build), que solo se usa para fabricar el instalador: no va dentro de la app.

## Qué necesitas

- Windows 10 u 11 (64 bits).
- [Node.js](https://nodejs.org) 20 o más reciente (trae `npm`).
- Conexión a internet la primera vez: se descargan Electron y las herramientas del instalador (unos 150 MB en total).

## La forma fácil: el script

En PowerShell, dentro de la carpeta del proyecto:

```powershell
.\construir.ps1
```

Tarda de 1 a 4 minutos. Al terminar, en la carpeta `dist\` tendrás:

| Archivo | Qué es |
| --- | --- |
| `Mis-Notas-Setup-<versión>.exe` | **Instalador**: crea un acceso directo en el escritorio y en el menú Inicio, y se puede desinstalar desde Configuración → Aplicaciones. |
| `Mis-Notas-Portable-<versión>.exe` | **Versión portable**: un solo `.exe` que se abre sin instalar (por ejemplo, desde un USB). Tarda un poco más en arrancar. |

Para una prueba rápida, sin instalador:

```powershell
.\construir.ps1 -Rapido
```

Crea `dist\win-unpacked\Mis Notas.exe`, que se abre directamente.

### Si PowerShell no deja ejecutar el script

Windows bloquea por defecto los scripts descargados. Para permitirlo solo en esa ventana de PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\construir.ps1
```

## Publicar una versión: GitHub la construye por ti

El repositorio trae un **workflow** (`.github/workflows/release.yml`): unas instrucciones que GitHub ejecuta en un Windows en la nube, gratis. Así la build no depende de tu ordenador.

Para publicar una versión nueva:

1. Sube el número de `"version"` en `package.json` (por ejemplo `0.2.0` → `0.3.0`) y ejecuta `npm install --package-lock-only` para que `package-lock.json` diga lo mismo.
2. Haz el commit y súbelo: `git add .`, `git commit -m "..."` y `git push`.
3. Escribe las notas de la versión en un archivo fuera del proyecto (por ejemplo `notas.md`) y crea la **etiqueta** con ellas:
   ```bash
   git tag -a v0.3.0 -F notas.md
   git push origin v0.3.0
   ```
4. En la pestaña **Actions** del repositorio verás el workflow trabajando (unos 5 minutos). Al terminar, en **Releases** estará la versión con el instalador, la portable y tus notas.

El workflow comprueba que la etiqueta coincide con `package.json`; si no, se para sin publicar nada. Si la Release ya existía, solo vuelve a subir los `.exe`.

Para construir **sin publicar**: Actions → "Construir y publicar" → **Run workflow**. Los `.exe` quedan en el apartado "Artifacts" de esa ejecución.

## Qué hace el script, paso a paso

1. Comprueba que tienes `npm`.
2. Quita la variable `ELECTRON_RUN_AS_NODE`, que pone la terminal de VS Code y hace que Electron no funcione.
3. Comprueba que Mis Notas no está abierta desde esta carpeta (si lo está, Windows no deja reinstalar Electron).
4. `npm ci`: instala las versiones exactas de `package-lock.json`.
5. `npm run dist` (o `npm run pack` con `-Rapido`): empaqueta la app.
6. Enseña los archivos creados.

También puedes lanzar los pasos a mano: `npm ci` y después `npm run dist` o `npm run pack`.

## La configuración

Está en `package.json`, en el apartado `"build"`:

- `appId` y `productName`: identificador y nombre que verá Windows.
- `files`: lo **único** que entra en el instalador (el código de la app, el icono y la licencia). La documentación y `node_modules` se quedan fuera.
- `win.target`: los dos formatos (`nsis` = instalador y `portable`).
- `win.icon`: `icono.png` (256 × 256 o más).
- `nsis`: el instalador pregunta dónde instalar y crea accesos directos.

Para sacar una versión nueva, sube el número de `"version"` en `package.json` (por ejemplo `0.1.0` → `0.2.0`) antes de construir.

## Problemas conocidos

**"Cannot create symbolic link: El cliente no dispone de un privilegio requerido".**
electron-builder descarga unas herramientas (`winCodeSign`) que incluyen dos enlaces simbólicos de macOS, y Windows no deja crearlos sin permisos de administrador. El script lo arregla solo: extrae esas herramientas ignorando los dos enlaces (en Windows no se usan) y vuelve a intentarlo. Otra solución es activar el **Modo de desarrollador** en Configuración → Sistema → Para programadores.

**"spawn UNKNOWN" al crear el instalador, o "Una directiva de Control de aplicaciones bloqueó este archivo".**
Es **Smart App Control** (Control inteligente de aplicaciones) de Windows 11. Para fabricar el desinstalador, electron-builder genera y ejecuta un `.exe` temporal sin firmar, y Smart App Control lo bloquea si no le da buena reputación (depende de cada archivo, así que unas veces pasa y otras no). La app en sí (`dist\win-unpacked\Mis Notas.exe`) sí arranca. Soluciones:
- **Construir en GitHub** (apartado anterior). Es la recomendada.
- `.\construir.ps1 -Rapido` para tener la app sin instalador.
- No desactives Smart App Control solo por esto: en muchas versiones de Windows 11, una vez apagado no se puede volver a encender sin reinstalar Windows.

**"EBUSY: resource busy or locked".**
Mis Notas está abierta. Ciérrala y repite.

**Windows SmartScreen avisa al abrir el instalador.**
El `.exe` no está **firmado** con un certificado de código. Para abrirlo: "Más información" → "Ejecutar de todas formas". En ordenadores con **Smart App Control** activado puede que ni siquiera deje abrir el instalador. La solución definitiva es firmarlo; un servicio asequible es Azure Trusted Signing de Microsoft. Queda para más adelante.

**`npm audit` avisa de vulnerabilidades.**
Están en las herramientas de construcción, que no van dentro de la app: `npm audit --omit=dev` no da ninguna. Lo que sí va dentro es **Electron**, y conviene tenerlo en una versión que reciba parches de seguridad (desde la 0.2.0, Mis Notas usa Electron 44). Para actualizarlo, hazlo en una rama de Git y repite las pruebas antes de publicar.

**La primera vez que se usa Electron tarda un poco más.**
Desde la versión 44, Electron no se descarga al hacer `npm ci`, sino la primera vez que se usa (con `npm start`, por ejemplo). Es normal ver "Downloading Electron binary...". La build no lo necesita: electron-builder descarga su propia copia.

## Dónde guarda los datos

Tanto con `npm start` como instalada o portable, Mis Notas usa la misma carpeta: `%APPDATA%\mis-notas\`. Desinstalar la app **no** borra tus notas. Para empezar de cero, borra esa carpeta con la app cerrada.
