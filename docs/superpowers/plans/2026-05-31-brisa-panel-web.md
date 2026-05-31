# Panel Brisa+ Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static web dashboard that reuses the validated Brisa+ mockup design and fills itself by reading a published Google Sheet, hosted publicly on Netlify.

**Architecture:** Vanilla ES-module JS, no framework. Pure modules (formatting, gviz parsing, row→section mapping) are unit-tested with Node's built-in test runner. A generic DOM renderer fills the mockup markup via `data-field` / `data-rows` annotations, reusing the mockup's existing CSS and load-animation script. `app.js` fetches each Sheet tab via the gviz JSON endpoint and wires data to the renderer.

**Tech Stack:** HTML/CSS/vanilla JS (ES modules), Node `node:test` for unit tests (zero npm deps), Google Sheets `gviz/tq` endpoint as data source, Netlify static hosting.

**Key references:**
- Design mockup (CSS + markup to reuse): `C:\Users\Juli\Downloads\brisaplus-panel-mockup.html`
- Formatting logic to port: `C:\Users\Juli\brisa_report.py` (`fmt_time`, `delta_cell`, sort by views)
- Backend Google Sheet (existing): id `1FPsE8AaefOM8Jayz60-YbvhX4q3TrSkHdrA9FfspClY`
- Spec: `docs/superpowers/specs/2026-05-31-brisa-panel-web-design.md`

**Scope of this plan:** Phases 1–4 of the spec — a working public site that reads the Sheet with GA4 numbers entered manually into a tab. Phase 5 (a local Python script that auto-writes GA4 numbers into the Sheet) is a separate future plan.

---

## File Structure

```
brisa-panel/
  index.html              # markup shell from the mockup, values replaced by data-field / data-rows hooks
  css/styles.css          # CSS extracted verbatim from the mockup
  js/
    format.js             # pure: fmtTime, fmtNum, delta, sortByViews  (port of brisa_report.py)
    sheet.js              # pure: gvizUrl(id,tab), parseGviz(text) -> {cols, rows}
    sections.js           # pure: getPath, mapColumns, buildConfig, buildContenidos, ... (rows -> section data)
    render.js             # DOM: getPath-based renderFields, renderRows, lineChart
    app.js                # entry: fetch each tab, build data object, call renderers
  tests/
    format.test.js
    sheet.test.js
    sections.test.js
  fixtures/
    gviz-config.json      # sample gviz response (Config tab)
    gviz-contenidos.json  # sample gviz response (Contenidos tab)
  netlify.toml
  package.json            # only a "test" script: node --test
  .gitignore
```

Boundaries: `format.js`, `sheet.js`, `sections.js` are pure and fully unit-tested. `render.js` and `app.js` touch the DOM / network and are verified in the browser. The mockup's existing `window.load` animation script (reads `data-w` and `data-pct`) is kept, so the renderer only sets values and those attributes.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `netlify.toml`
- Create: `css/` `js/` `tests/` `fixtures/` (directories, via the files below)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "brisa-panel",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.DS_Store
.netlify/
```

- [ ] **Step 3: Create `netlify.toml`**

```toml
[build]
  publish = "."
  command = ""

[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=300"
```

- [ ] **Step 4: Verify Node test runner is available**

Run: `node --test`
Expected: exits 0 with "tests 0" (no tests yet) — confirms Node >= 18 with built-in runner.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore netlify.toml
git commit -m "chore: scaffold brisa-panel static project"
```

---

### Task 2: Formatting module (port of brisa_report.py)

**Files:**
- Create: `js/format.js`
- Test: `tests/format.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/format.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtTime, fmtNum, delta, sortByViews } from '../js/format.js';

test('fmtTime: zero or negative -> dash', () => {
  assert.equal(fmtTime(0), '-');
  assert.equal(fmtTime(-5), '-');
});

test('fmtTime: under a minute -> seconds', () => {
  assert.equal(fmtTime(47), '47 s');
});

test('fmtTime: minutes with zero-padded seconds', () => {
  assert.equal(fmtTime(133), '2 min 13 s');
});

test('fmtTime: hours with zero-padded minutes', () => {
  assert.equal(fmtTime(3660), '1 h 01 min');
});

test('fmtNum: es-AR thousands separator', () => {
  assert.equal(fmtNum(4431), '4.431');
  assert.equal(fmtNum(802), '802');
});

test('fmtNum: non-numeric -> dash', () => {
  assert.equal(fmtNum('x'), '-');
});

test('delta: needs both values > 0, else none', () => {
  assert.deepEqual(delta(0, 10), { dir: 'none', pct: null, text: '-' });
  assert.deepEqual(delta(10, 0), { dir: 'none', pct: null, text: '-' });
});

test('delta: up rounds percent', () => {
  const d = delta(100, 150);
  assert.equal(d.dir, 'up');
  assert.equal(d.text, '▲ +50 %');
});

test('delta: down', () => {
  assert.equal(delta(100, 50).text, '▼ -50 %');
});

test('delta: equal -> flat', () => {
  assert.equal(delta(10, 10).dir, 'flat');
});

test('sortByViews: descending by va+vm, original array untouched', () => {
  const rows = [{ va: 1, vm: 1 }, { va: 10, vm: 0 }, { va: 2, vm: 3 }];
  const out = sortByViews(rows);
  assert.deepEqual(out.map(r => r.va), [10, 2, 1]);
  assert.equal(rows[0].va, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/format.test.js`
Expected: FAIL — "Cannot find module '../js/format.js'".

- [ ] **Step 3: Write `js/format.js`**

```js
// js/format.js — pure formatting helpers (port of brisa_report.py)

export function fmtTime(s) {
  s = Number(s) || 0;
  if (s <= 0) return '-';
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m} min ${String(sec).padStart(2, '0')} s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h} h ${String(mm).padStart(2, '0')} min`;
}

export function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toLocaleString('es-AR');
}

export function delta(a, b) {
  a = Number(a);
  b = Number(b);
  if (!(a > 0) || !(b > 0)) return { dir: 'none', pct: null, text: '-' };
  if (a === b) return { dir: 'flat', pct: 0, text: '→ 0 %' };
  const pct = ((b - a) / a) * 100;
  if (b > a) return { dir: 'up', pct, text: `▲ +${Math.round(pct)} %` };
  return { dir: 'down', pct, text: `▼ ${Math.round(pct)} %` };
}

export function sortByViews(rows) {
  return [...rows].sort((x, y) => (y.va + y.vm) - (x.va + x.vm));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/format.test.js`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add js/format.js tests/format.test.js
git commit -m "feat: formatting helpers ported from brisa_report.py"
```

---

### Task 3: Google Sheet gviz parser

**Files:**
- Create: `js/sheet.js`
- Create: `fixtures/gviz-config.json`
- Test: `tests/sheet.test.js`

- [ ] **Step 1: Create the fixture** (`fixtures/gviz-config.json` — a literal gviz response body)

```
/*O_o*/
google.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"ok","sig":"123","table":{"cols":[{"id":"A","label":"clave","type":"string"},{"id":"B","label":"valor","type":"string"}],"rows":[{"c":[{"v":"periodo"},{"v":"2 – 8 mar 2026"}]},{"c":[{"v":"titulo"},{"v":"Panel Analítico — Brisa+"}]}]}});
```

- [ ] **Step 2: Write the failing tests**

```js
// tests/sheet.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gvizUrl, parseGviz } from '../js/sheet.js';

const fixture = readFileSync(
  fileURLToPath(new URL('../fixtures/gviz-config.json', import.meta.url)),
  'utf8'
);

test('gvizUrl: builds the published-sheet JSON endpoint', () => {
  const url = gvizUrl('SHEET123', 'Config');
  assert.ok(url.startsWith('https://docs.google.com/spreadsheets/d/SHEET123/gviz/tq?'));
  assert.ok(url.includes('tqx=out%3Ajson'));
  assert.ok(url.includes('sheet=Config'));
});

test('parseGviz: strips the JS wrapper and returns cols + rows', () => {
  const { cols, rows } = parseGviz(fixture);
  assert.deepEqual(cols, ['clave', 'valor']);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ['periodo', '2 – 8 mar 2026']);
  assert.deepEqual(rows[1], ['titulo', 'Panel Analítico — Brisa+']);
});

test('parseGviz: throws on garbage input', () => {
  assert.throws(() => parseGviz('not a gviz response'));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/sheet.test.js`
Expected: FAIL — "Cannot find module '../js/sheet.js'".

- [ ] **Step 4: Write `js/sheet.js`**

```js
// js/sheet.js — pure helpers for the Google Sheets gviz endpoint

export function gvizUrl(sheetId, tabName) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const params = new URLSearchParams({ tqx: 'out:json', sheet: tabName });
  return `${base}?${params.toString()}`;
}

export function parseGviz(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Respuesta gviz inválida');
  }
  const json = JSON.parse(text.slice(start, end + 1));
  const table = json.table || {};
  const cols = (table.cols || []).map(c => c.label || c.id || '');
  const rows = (table.rows || []).map(r =>
    (r.c || []).map(cell => (cell ? cell.v : null))
  );
  return { cols, rows };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/sheet.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/sheet.js tests/sheet.test.js fixtures/gviz-config.json
git commit -m "feat: gviz URL builder and response parser"
```

---

### Task 4: Section mapping (rows -> section data)

**Files:**
- Create: `js/sections.js`
- Create: `fixtures/gviz-contenidos.json`
- Test: `tests/sections.test.js`

- [ ] **Step 1: Create the fixture** (`fixtures/gviz-contenidos.json`)

```
/*O_o*/
google.visualization.Query.setResponse({"version":"0.6","status":"ok","table":{"cols":[{"label":"contenido"},{"label":"vistas_abr"},{"label":"usuarios_abr"},{"label":"tiempo_abr"},{"label":"vistas_may"},{"label":"usuarios_may"},{"label":"tiempo_may"}],"rows":[{"c":[{"v":"Adolescencia"},{"v":395},{"v":212},{"v":133},{"v":10},{"v":7},{"v":305}]},{"c":[{"v":"Fentanilo y Propofol"},{"v":0},{"v":0},{"v":0},{"v":102},{"v":25},{"v":310}]},{"c":[{"v":null},{"v":null},{"v":null},{"v":null},{"v":null},{"v":null},{"v":null}]}]}});
```

- [ ] **Step 2: Write the failing tests**

```js
// tests/sections.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGviz } from '../js/sheet.js';
import { getPath, mapColumns, buildConfig, buildContenidos } from '../js/sections.js';

const contenidos = parseGviz(readFileSync(
  fileURLToPath(new URL('../fixtures/gviz-contenidos.json', import.meta.url)), 'utf8'
));

test('getPath: nested lookup, missing -> undefined', () => {
  const o = { resumen: { usuarios: 979 } };
  assert.equal(getPath(o, 'resumen.usuarios'), 979);
  assert.equal(getPath(o, 'resumen.nope'), undefined);
  assert.equal(getPath(o, 'x.y.z'), undefined);
});

test('mapColumns: maps indices to keys, skips blank rows, coerces nums', () => {
  const out = mapColumns(contenidos.rows, [
    { key: 'name', idx: 0, type: 'str' },
    { key: 'va', idx: 1, type: 'num' },
  ]);
  assert.equal(out.length, 2); // blank row dropped
  assert.deepEqual(out[0], { name: 'Adolescencia', va: 395 });
});

test('buildConfig: key/value rows -> object', () => {
  const cfg = buildConfig([['periodo', '2 – 8 mar'], ['titulo', 'Panel'], [null, null]]);
  assert.deepEqual(cfg, { periodo: '2 – 8 mar', titulo: 'Panel' });
});

test('buildContenidos: maps the 7 columns and sorts by va+vm desc', () => {
  const items = buildContenidos(contenidos.rows);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'Adolescencia'); // 395+10 > 0+102
  assert.deepEqual(
    { va: items[0].va, ua: items[0].ua, ta: items[0].ta, vm: items[0].vm, um: items[0].um, tm: items[0].tm },
    { va: 395, ua: 212, ta: 133, vm: 10, um: 7, tm: 305 }
  );
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/sections.test.js`
Expected: FAIL — "Cannot find module '../js/sections.js'".

- [ ] **Step 4: Write `js/sections.js`**

```js
// js/sections.js — pure mappers from parsed Sheet rows to section data objects
import { sortByViews } from './format.js';

export function getPath(obj, path) {
  return path.split('.').reduce(
    (acc, key) => (acc == null ? undefined : acc[key]),
    obj
  );
}

export function mapColumns(rows, fields) {
  return rows
    .filter(r => r.some(v => v !== null && v !== ''))
    .map(r => {
      const o = {};
      for (const f of fields) {
        const raw = r[f.idx];
        o[f.key] = f.type === 'num' ? (Number(raw) || 0) : (raw == null ? '' : String(raw));
      }
      return o;
    });
}

export function buildConfig(rows) {
  const o = {};
  for (const r of rows) {
    if (r[0] !== null && r[0] !== '' && r[0] !== undefined) {
      o[String(r[0])] = r[1] == null ? '' : String(r[1]);
    }
  }
  return o;
}

export function buildContenidos(rows) {
  const items = mapColumns(rows, [
    { key: 'name', idx: 0, type: 'str' },
    { key: 'va', idx: 1, type: 'num' },
    { key: 'ua', idx: 2, type: 'num' },
    { key: 'ta', idx: 3, type: 'num' },
    { key: 'vm', idx: 4, type: 'num' },
    { key: 'um', idx: 5, type: 'num' },
    { key: 'tm', idx: 6, type: 'num' },
  ]);
  return sortByViews(items);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/sections.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/sections.js tests/sections.test.js fixtures/gviz-contenidos.json
git commit -m "feat: section mappers (config, contenidos) + getPath/mapColumns"
```

---

### Task 5: Extract CSS and build the annotated HTML shell

**Files:**
- Create: `css/styles.css`
- Create: `index.html`
- Read: `C:\Users\Juli\Downloads\brisaplus-panel-mockup.html`

- [ ] **Step 1: Extract the CSS verbatim**

Copy everything between `<style>` and `</style>` in the mockup into `css/styles.css` unchanged. The brand variables, cards, charts, bars, donut, table, and the `.fill` / `.ring` animation styles must all be preserved.

- [ ] **Step 2: Build `index.html` from the mockup body, replacing dynamic values with hooks**

Start from the mockup's `<body>` markup. Replace the `<link>`/`<style>` head block with `<link rel="stylesheet" href="css/styles.css">`. Keep the sidebar, topbar, all sections, footer, and the existing `<script>` load-animation block intact. Replace each hard-coded value with a hook:

- Single values → wrap in a span: `<span data-field="resumen.usuarios_activos">—</span>` (KPI numbers, config strings like the title and period, KPI sub-labels).
- Bar fills → keep `class="fill"` but make width data-driven: leave `style="width:0"` and set `data-w` from JS (do NOT hard-code `data-w` in HTML for dynamic bars).
- Donut rings → keep `class="ring"`, set `data-pct` from JS.
- Repeating table/bar bodies → mark the container and provide a `<template>`:

```html
<!-- Contenidos table body -->
<tbody data-rows="contenidos">
  <template>
    <tr>
      <td class="pgname" data-cell="name"></td>
      <td class="r tnum" data-cell="va"></td>
      <td class="r tnum" data-cell="vm"></td>
      <td class="r delta" data-cell="delta_v"></td>
      <td class="r tnum total-cell" data-cell="total_v"></td>
      <td class="r tnum" data-cell="ua"></td>
      <td class="r tnum" data-cell="um"></td>
      <td class="r delta" data-cell="delta_u"></td>
      <td class="r tnum" data-cell="ta"></td>
      <td class="r tnum" data-cell="tm"></td>
      <td class="r delta" data-cell="delta_t"></td>
    </tr>
  </template>
</tbody>
```

Add an `id="app-status"` empty div at the top of `.content` for load/error messages.

- [ ] **Step 3: Verify it renders (static, no data yet) in the browser**

Run: `start index.html` (PowerShell) — opens in the default browser.
Expected: the full panel layout renders with the mockup styling; dynamic spots show the `—` placeholders and empty table bodies. No console errors except the (expected) absence of data.

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat: annotated HTML shell + extracted CSS from mockup"
```

---

### Task 6: DOM renderer

**Files:**
- Create: `js/render.js`

- [ ] **Step 1: Write `js/render.js`**

```js
// js/render.js — fills the annotated markup from a data object.
// Pure value setting only; the mockup's window.load script animates .fill / .ring.
import { getPath } from './sections.js';
import { fmtNum, fmtTime, delta } from './format.js';

// Fill every [data-field] from data via dotted path.
export function renderFields(root, data) {
  root.querySelectorAll('[data-field]').forEach(el => {
    const val = getPath(data, el.dataset.field);
    if (val !== undefined && val !== null) el.textContent = val;
  });
}

// Fill a [data-rows="<key>"] body by cloning its <template> per item.
// cellFns maps a data-cell name to (item) => string.
export function renderRows(root, key, items, cellFns) {
  const body = root.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  const tpl = body.querySelector('template');
  if (!tpl) return;
  body.querySelectorAll(':scope > tr').forEach(tr => tr.remove());
  for (const item of items) {
    const row = tpl.content.firstElementChild.cloneNode(true);
    row.querySelectorAll('[data-cell]').forEach(cell => {
      const fn = cellFns[cell.dataset.cell];
      if (fn) cell.innerHTML = fn(item);
    });
    body.appendChild(row);
  }
}

// Cell builders for the contenidos table (reuses format helpers).
export function contenidosCells() {
  const dcell = (a, b) => {
    const d = delta(a, b);
    return `<span class="${d.dir === 'none' ? 'empty' : d.dir}">${d.text}</span>`;
  };
  return {
    name: i => i.name,
    va: i => (i.va ? fmtNum(i.va) : '<span class="empty">-</span>'),
    vm: i => (i.vm ? fmtNum(i.vm) : '<span class="empty">-</span>'),
    delta_v: i => dcell(i.va, i.vm),
    total_v: i => fmtNum(i.va + i.vm),
    ua: i => (i.ua ? fmtNum(i.ua) : '<span class="empty">-</span>'),
    um: i => (i.um ? fmtNum(i.um) : '<span class="empty">-</span>'),
    delta_u: i => dcell(i.ua, i.um),
    ta: i => fmtTime(i.ta),
    tm: i => fmtTime(i.tm),
    delta_t: i => dcell(i.ta, i.tm),
  };
}

// Set a bar fill width (the load script reads data-w to animate).
export function setBar(root, selector, pct) {
  const el = root.querySelector(selector);
  if (el) el.dataset.w = String(pct);
}

// Build an SVG polyline points string for the evolución line chart.
// series: array of numbers; w/h/pad define the viewBox box.
export function lineChartPoints(series, w, h, pad) {
  const max = Math.max(1, ...series);
  const n = series.length;
  const step = n > 1 ? (w - pad * 2) / (n - 1) : 0;
  return series
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
```

- [ ] **Step 2: Verify renderer with injected fixture data in the browser**

Create a throwaway `dev.html` (do NOT commit) that imports the renderer and feeds a small literal data object plus a contenidos array, then calls `renderFields`, `renderRows(document, 'contenidos', items, contenidosCells())`, and re-runs the mockup's animation by dispatching `window.dispatchEvent(new Event('load'))`.

```html
<!-- dev.html (temporary) -->
<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="css/styles.css"></head><body>
<!-- paste the index.html body here -->
<script type="module">
import { renderFields, renderRows, contenidosCells } from './js/render.js';
const data = { resumen: { usuarios_activos: '979' }, config: { titulo: 'Panel Analítico — Brisa+' } };
const items = [
  { name: 'Adolescencia', va: 395, ua: 212, ta: 133, vm: 10, um: 7, tm: 305 },
  { name: 'Fentanilo y Propofol', va: 0, ua: 0, ta: 0, vm: 102, um: 25, tm: 310 },
];
renderFields(document, data);
renderRows(document, 'contenidos', items, contenidosCells());
window.dispatchEvent(new Event('load'));
</script></body></html>
```

Run: `start dev.html`
Expected: KPI shows 979, the contenidos table shows both rows with deltas (▲/▼/-) and formatted times, bars/donuts animate. Then delete `dev.html`.

- [ ] **Step 3: Commit**

```bash
git add js/render.js
git commit -m "feat: DOM renderer (fields, template rows, line chart points)"
```

---

### Task 7: Structure and publish the Google Sheet

**Files:** none (Google Sheet `1FPsE8AaefOM8Jayz60-YbvhX4q3TrSkHdrA9FfspClY`, edited in the browser; use the shared Playwright session inheriting the user's login).

> This task configures the data source. Tab names and column order below are the contract the code in Tasks 4/6/8 depends on — match them exactly. Row 1 is the header in every tab.

- [ ] **Step 1: Create/confirm the tabs with these exact names and header columns**

- `Config` — A:`clave`, B:`valor`. Rows: `titulo`, `periodo`, `publicado`, `actualizado`.
- `Resumen` — A:`metrica`, B:`valor`, C:`sub`. Rows: `usuarios_activos`, `usuarios_nuevos`, `min_sesion`, `paginas_vistas`.
- `Canales` — A:`canal`, B:`usuarios`.
- `Conversion` — A:`mes`, B:`registro_pago_pct`.
- `Contenidos` — A:`contenido`, B:`vistas_abr`, C:`usuarios_abr`, D:`tiempo_abr`, E:`vistas_may`, F:`usuarios_may`, G:`tiempo_may`.
- `Geografia` — A:`pais`, B:`pct`, C:`etiqueta`.
- `Eventos` — A:`evento`, B:`volumen`.
- `Biotienda` — A:`seccion`, B:`visitas`, C:`unicos`.
- `Inscriptos` — A:`curso_evento`, B:`inscriptos`, C:`fecha`, D:`nota`. (Datos que hoy viven en el Excel de Drive; el equipo los carga acá. Columnas ajustables al ver el archivo real.)
- `Analisis` — A:`clave`, B:`texto` (tendencia, pico, curiosidad, nota_estrategia).

- [ ] **Step 2: Seed each tab with the current week's real values**

Use the figures from the mockup / `brisa_report.py` as the first week's data so the live site shows real content immediately.

- [ ] **Step 3: Publish the Sheet to the web**

In the Sheet: Archivo → Compartir → Publicar en la web → Publicar (entire document). Also set general access to "Cualquier persona con el enlace: Lector" so the gviz endpoint is reachable.

- [ ] **Step 4: Verify the gviz endpoint returns data**

Run (PowerShell):
```powershell
(Invoke-WebRequest "https://docs.google.com/spreadsheets/d/1FPsE8AaefOM8Jayz60-YbvhX4q3TrSkHdrA9FfspClY/gviz/tq?tqx=out:json&sheet=Config").Content.Substring(0,80)
```
Expected: output starts with `/*O_o*/` then `google.visualization.Query.setResponse(` — confirms the tab is publicly readable as JSON.

---

### Task 8: Wire app.js to the live Sheet and deploy

**Files:**
- Create: `js/app.js`
- Modify: `index.html` (add `<script type="module" src="js/app.js"></script>` before `</body>`, before the existing animation script)

- [ ] **Step 1: Write `js/app.js`**

```js
// js/app.js — fetch each Sheet tab, build the data object, render, then animate.
import { gvizUrl, parseGviz } from './sheet.js';
import { buildConfig, buildContenidos, mapColumns } from './sections.js';
import { renderFields, renderRows, contenidosCells, setBar } from './render.js';

const SHEET_ID = '1FPsE8AaefOM8Jayz60-YbvhX4q3TrSkHdrA9FfspClY';

async function fetchTab(tab) {
  const res = await fetch(gvizUrl(SHEET_ID, tab));
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${tab}`);
  return parseGviz(await res.text());
}

function status(msg) {
  const el = document.getElementById('app-status');
  if (el) el.textContent = msg;
}

async function main() {
  status('Cargando datos…');
  try {
    const [config, resumen, contenidos, canales, geografia, eventos] = await Promise.all(
      ['Config', 'Resumen', 'Contenidos', 'Canales', 'Geografia', 'Eventos'].map(fetchTab)
    );

    const cfg = buildConfig(config.rows);
    const res = {};
    for (const r of mapColumns(resumen.rows, [
      { key: 'metrica', idx: 0, type: 'str' },
      { key: 'valor', idx: 1, type: 'str' },
      { key: 'sub', idx: 2, type: 'str' },
    ])) {
      res[r.metrica] = r.valor;
      res[`${r.metrica}__sub`] = r.sub;
    }

    const data = { config: cfg, resumen: res };
    renderFields(document, data);
    renderRows(document, 'contenidos', buildContenidos(contenidos.rows), contenidosCells());

    // Canales / Geografia / Eventos bars: set widths relative to the max value.
    renderBars(canales.rows, 'canales', 0, 1);
    renderBars(geografia.rows, 'geografia', 0, 1);
    renderBars(eventos.rows, 'eventos', 0, 1);

    status('');
  } catch (err) {
    status('No se pudieron cargar los datos. Reintentá en unos minutos.');
    console.error(err);
  } finally {
    // (Re)trigger the mockup animation now that values/data-w are set.
    window.dispatchEvent(new Event('load'));
  }
}

// Generic bar block: rows of [label, value] -> fill widths + value labels by data-rows key.
function renderBars(rows, key, labelIdx, valueIdx) {
  const items = mapColumns(rows, [
    { key: 'label', idx: labelIdx, type: 'str' },
    { key: 'value', idx: valueIdx, type: 'num' },
  ]);
  const max = Math.max(1, ...items.map(i => i.value));
  renderRows(document, key, items, {
    label: i => i.label,
    value: i => i.value.toLocaleString('es-AR'),
  });
  // After rows exist, set each fill width by max.
  const body = document.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  body.querySelectorAll('.fill').forEach((el, i) => {
    if (items[i]) el.dataset.w = String((items[i].value / max) * 100);
  });
}

main();
```

- [ ] **Step 2: Mark the bar blocks in `index.html`**

For the Canales, Geografía and Eventos `.bars` containers, convert them to the `data-rows` + `<template>` pattern (one `.bar-row` template with `data-cell="label"` on `.bl`, `data-cell="value"` on `.bv`, and a `.fill` inside `.track`). Mirror the contenidos pattern from Task 5.

- [ ] **Step 3: Verify end-to-end against the live Sheet**

Serve locally (gviz needs http(s), not file://):
```powershell
Set-Location "C:\Users\Juli\brisa-panel"; python -m http.server 8000
```
Open `http://localhost:8000/`.
Expected: status clears, KPIs/title/period show the seeded values, contenidos table and the three bar blocks fill from the Sheet, animations play. Edit a value in the Sheet, wait ~5 min, hard-reload → the new value appears. Stop the server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add js/app.js index.html
git commit -m "feat: wire app to live Sheet (fetch, render, error handling)"
```

- [ ] **Step 5: Deploy to Netlify**

Install once if needed: `npm i -g netlify-cli`. Then:
```powershell
Set-Location "C:\Users\Juli\brisa-panel"; netlify deploy --dir . --prod
```
Follow the login/site-create prompts (the user runs the interactive login via `! netlify login` if required).
Expected: Netlify prints a public URL. Open it and confirm the panel loads with live Sheet data over HTTPS.

- [ ] **Step 6: Commit deploy config**

```bash
git add netlify.toml
git commit -m "chore: netlify production deploy of brisa-panel"
```

---

## Self-Review notes

- **Spec coverage:** Sheet-as-source (Tasks 3,4,7,8) ✓; static front-end reusing mockup (Tasks 5,6) ✓; auto-refresh via published Sheet (Task 7 step 3 + Task 8 step 3) ✓; Netlify public hosting (Task 8 step 5) ✓; GA4 manual-entry phase (Task 7 `Resumen`/seed) ✓; error/empty handling (renderers skip null; `app.js` status message) ✓; es-AR formatting (Task 2) ✓; reuse of brisa_report.py logic (Task 2) ✓. GA4 automation (spec phase 5) is intentionally deferred to a future plan and noted under Scope.
- **Type consistency:** `getPath`, `mapColumns`, `buildConfig`, `buildContenidos`, `contenidosCells`, `renderFields`, `renderRows`, `setBar`, `lineChartPoints`, `gvizUrl`, `parseGviz` are defined once and consumed with matching signatures. Contenidos item shape `{name,va,ua,ta,vm,um,tm}` is identical in fixture, mapper, tests, and cell builders.
- **Open detail for execution:** the Resumen/KPI `data-field` paths in `index.html` (Task 5) must match the keys written in `app.js` (`resumen.usuarios_activos`, etc.) — set them consistently when annotating the shell.
```
