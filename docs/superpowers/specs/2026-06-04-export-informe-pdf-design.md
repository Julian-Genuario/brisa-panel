# Export del informe a PDF — diseño

Fecha: 2026-06-04

## Objetivo

Agregar al panel Brisa+ un botón **"Descargar informe"** que genere un PDF
del panel, en versión clara para imprimir, con el período actualmente
seleccionado.

## Decisiones

- **Enfoque A**: print stylesheet (`@media print`) + `window.print()`. Cero
  dependencias. El PDF conserva texto real (seleccionable, nítido). El usuario
  confirma "Guardar como PDF" en el diálogo del navegador.
- Descartado enfoque B (html2canvas+jsPDF): pesado, rasteriza, glitches de color.
- Descartado enfoque C (Puppeteer serverless): overkill para Vercel Hobby.
- Label del botón: **"Descargar informe"** (no "PDF" — más claro/producto).
- La sección **"En vivo · ahora mismo"** se **oculta** en el PDF (dato de los
  últimos 30 min, no aporta a un informe impreso estático).
- El contenido del panel YA es claro (fondo `--paper`, tarjetas blancas); solo
  el sidebar es oscuro. La versión print solo oculta cromo y limpia para papel.

## Componentes

### 1. Botón "Descargar informe" (`index.html`)
En la topbar, junto a los controles de período. `id="btn-export"`, dispara
`window.print()`. Oculto en `@media print`.

### 2. Encabezado solo-impresión (`index.html`)
`<div id="print-header">` oculto en pantalla, visible solo en print. Contiene:
- Título "Brisa+ · Panel Analítico"
- Período seleccionado (ej. "Semana 26/5 – 1/6" o "Mes: Mayo 2026")
- "Generado el DD/MM/AAAA"

Se rellena en el handler `beforeprint` leyendo el modo/selector activo y la
fecha actual.

### 3. Bloque `@media print` (`css/styles.css`)
- Ocultar: `.sidebar`, `.topbar`, `.live`/`#rt-chip`, `#app-status`,
  `#btn-export`, y la sección `#sRT` (En vivo).
- Mostrar: `#print-header`.
- `.main { margin-left: 0 }`, `body { background:#fff }`.
- Tarjetas: sin sombra, borde `1px solid var(--line)` para definición.
- `.sec`, `.card` → `break-inside: avoid` (no partir secciones/tablas).
- `print-color-adjust: exact` (global) → conservar acentos y barras.
- `@page { size: A4; margin: 14mm }`.

### 4. JS (`js/app.js` o inline en `index.html`)
- `btn-export` → `window.print()`.
- `window.addEventListener('beforeprint', ...)` → poblar `#print-header` con
  período activo + fecha. Lee el `.modo-btn.active` y el `<select>` visible.

## Flujo

1. Usuario elige período → clic "Descargar informe".
2. `beforeprint` rellena el encabezado de impresión.
3. Diálogo del navegador → "Guardar como PDF" → archivo en Descargas.

## Testing

- Verificación visual vía Playwright con `emulateMedia({ media: 'print' })` +
  screenshot: confirmar sidebar/topbar/En-vivo ocultos, header de impresión
  visible con período correcto, barras y colores conservados, sin cortes feos.

## Deploy

Manual a Vercel (no conectado a GitHub):
`vercel --prod --yes --scope juliange --token $(cat ~/.vercel-token)`
Agrupar con otros cambios pendientes para no gastar deploys de a uno.

## Fuera de alcance (por ahora)

- Informe curado/editorial para Giulia (texto redactado).
- Export de datos crudos (CSV/Excel).
