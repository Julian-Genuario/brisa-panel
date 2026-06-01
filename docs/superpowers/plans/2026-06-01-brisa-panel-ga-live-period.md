# GA en vivo + selector de período — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el Panel Brisa+ traiga las métricas de GA en vivo desde la API de GA4 Data según un período elegible (semana / mes / comparación A-vs-B), vía una función serverless en Netlify, manteniendo las fuentes manuales en la Sheet.

**Architecture:** Front estático (el panel actual) + una **Netlify Function** (`/.netlify/functions/ga`) que se autentica con una **cuenta de servicio** de Google y consulta la **GA4 Data API**. La lógica pura (rangos de fechas, armado de requests, normalización de la respuesta de GA) vive en módulos testeables con `node:test`. El front gana un **selector de período** que dispara llamadas a la función y, en modo comparación, pide dos rangos y arma los Δ. Deploy vía **repo GitHub conectado a Netlify** (build automático que instala las deps de la función).

**Tech Stack:** Vanilla JS (ES modules), Netlify Functions (Node 20, ESM), `@google-analytics/data`, GA4 Data API v1beta, `node:test`.

**Referencias:**
- Spec: `docs/superpowers/specs/2026-06-01-brisa-panel-ga-live-period-design.md`
- Front actual: `index.html`, `js/app.js`, `js/render.js`, `js/sections.js`, `js/format.js`
- GA4 property id: **509383322** ("Brisa plus")
- Sitio Netlify ya creado: `polite-starship-ca9220`

---

## File Structure

```
brisa-panel/
  js/
    period.js          # NUEVO puro: semanas/meses desde ene-2026, rangos {desde,hasta,label,id}
    selector.js        # NUEVO DOM: arma el selector (semana/mes/comparar) y emite el período elegido
    gaclient.js        # NUEVO: fetch a /.netlify/functions/ga (período y evolución) con manejo de error
    app.js             # MODIF: GA desde la función (no Sheet); selector; modo comparar; Inscriptos por período
    render.js          # MODIF: contenidos en 2 layouts (simple / comparación); badge Δ en KPIs
    format.js          # MODIF: + secToMinSec (segundos -> "m:ss")
  netlify/
    functions/
      ga.js            # NUEVO handler: auth cuenta de servicio + runReport + transform -> JSON
      ga-transform.js  # NUEVO puro: requests GA4 + normalización de respuestas (testeable)
  tests/
    period.test.js
    ga-transform.test.js
    format.test.js     # MODIF: + tests de secToMinSec
  fixtures/
    ga-resumen.json    # respuesta GA4 runReport de ejemplo (KPIs)
    ga-contenidos.json # respuesta GA4 runReport de ejemplo (pageTitle)
  package.json         # MODIF: dependency @google-analytics/data
  netlify.toml         # MODIF: [functions] node_bundler + directorio
  index.html           # MODIF: markup del selector; header tabla contenidos por modo
```

Boundaries: `period.js`, `ga-transform.js`, `format.js` son puros y se testean con `node:test`. `ga.js` (red+auth), `selector.js`, `app.js`, `render.js` se verifican en el navegador / tras deploy.

---

### Task 1: Lógica de períodos (`js/period.js`)

**Files:**
- Create: `js/period.js`
- Test: `tests/period.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/period.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mondayOf, sundayOf, iso, weeksSince, monthsSince } from '../js/period.js';

test('mondayOf: devuelve el lunes de la semana (UTC)', () => {
  // 2026-03-04 es miércoles -> lunes 2026-03-02
  assert.equal(iso(mondayOf(new Date('2026-03-04T00:00:00Z'))), '2026-03-02');
  // un lunes se devuelve a sí mismo
  assert.equal(iso(mondayOf(new Date('2026-03-02T00:00:00Z'))), '2026-03-02');
  // un domingo -> lunes anterior
  assert.equal(iso(mondayOf(new Date('2026-03-08T00:00:00Z'))), '2026-03-02');
});

test('sundayOf: domingo de esa semana', () => {
  assert.equal(iso(sundayOf(new Date('2026-03-04T00:00:00Z'))), '2026-03-08');
});

test('weeksSince: semanas lun-dom desde el inicio hasta la última completa', () => {
  // desde 2026-01-01, "hoy" 2026-03-10 (martes) -> última semana completa termina 2026-03-08
  const ws = weeksSince('2026-01-01', '2026-03-10');
  const last = ws[ws.length - 1];
  assert.equal(last.desde, '2026-03-02');
  assert.equal(last.hasta, '2026-03-08');
  assert.equal(last.id, 'w2026-03-02');
  assert.match(last.label, /2.*8.*mar/);
  // la primera arranca en el lunes de la semana del 1-ene-2026 (2025-12-29)
  assert.equal(ws[0].desde, '2025-12-29');
});

test('monthsSince: meses completos/parciales desde enero', () => {
  const ms = monthsSince('2026-01-01', '2026-03-10');
  assert.equal(ms.length, 3);
  assert.deepEqual(
    { id: ms[2].id, desde: ms[2].desde, hasta: ms[2].hasta },
    { id: 'm2026-03', desde: '2026-03-01', hasta: '2026-03-31' }
  );
  assert.match(ms[2].label, /[Mm]arzo 2026/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/period.test.js`
Expected: FAIL — "Cannot find module '../js/period.js'".

- [ ] **Step 3: Write `js/period.js`**

```js
// js/period.js — rangos de fechas puros (UTC) para el selector de período.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio',
  'agosto','septiembre','octubre','noviembre','diciembre'];
const MES_ABBR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // lunes=0 ... domingo=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

export function sundayOf(date) {
  const m = mondayOf(date);
  m.setUTCDate(m.getUTCDate() + 6);
  return m;
}

export function weeksSince(startISO, todayISO) {
  const out = [];
  let cur = mondayOf(new Date(startISO + 'T00:00:00Z'));
  const lastMonday = mondayOf(new Date(todayISO + 'T00:00:00Z'));
  // última semana COMPLETA: el lunes de la semana de "hoy" ya empezó pero no cerró;
  // incluimos hasta la semana cuyo domingo <= hoy.
  const today = new Date(todayISO + 'T00:00:00Z');
  while (cur <= lastMonday) {
    const sun = new Date(cur); sun.setUTCDate(sun.getUTCDate() + 6);
    if (sun <= today) {
      out.push({
        id: 'w' + iso(cur),
        desde: iso(cur),
        hasta: iso(sun),
        label: `${cur.getUTCDate()}–${sun.getUTCDate()} ${MES_ABBR[sun.getUTCMonth()]} ${sun.getUTCFullYear()}`,
      });
    }
    cur = new Date(cur); cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return out;
}

export function monthsSince(startISO, todayISO) {
  const out = [];
  const start = new Date(startISO + 'T00:00:00Z');
  const today = new Date(todayISO + 'T00:00:00Z');
  let y = start.getUTCFullYear(), m = start.getUTCMonth();
  while (y < today.getUTCFullYear() || (y === today.getUTCFullYear() && m <= today.getUTCMonth())) {
    const first = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(y, m + 1, 0));
    const mm = String(m + 1).padStart(2, '0');
    out.push({
      id: `m${y}-${mm}`,
      desde: iso(first),
      hasta: iso(last),
      label: `${MESES[m][0].toUpperCase()}${MESES[m].slice(1)} ${y}`,
    });
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/period.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/period.js tests/period.test.js
git commit -m "feat: period.js (semanas/meses desde enero, rangos UTC)"
```

---

### Task 2: `secToMinSec` en format.js

**Files:**
- Modify: `js/format.js`
- Modify: `tests/format.test.js`

- [ ] **Step 1: Add the failing test** (append to `tests/format.test.js`)

```js
import { secToMinSec } from '../js/format.js';

test('secToMinSec: segundos -> "m:ss"', () => {
  assert.equal(secToMinSec(119), '1:59');
  assert.equal(secToMinSec(77), '1:17');
  assert.equal(secToMinSec(5), '0:05');
  assert.equal(secToMinSec(0), '0:00');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/format.test.js`
Expected: FAIL — `secToMinSec is not a function` / import error.

- [ ] **Step 3: Add `secToMinSec` to `js/format.js`** (append)

```js
export function secToMinSec(s) {
  s = Math.round(Number(s) || 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/format.test.js`
Expected: PASS (todos los tests de format, incluidos los nuevos).

- [ ] **Step 5: Commit**

```bash
git add js/format.js tests/format.test.js
git commit -m "feat: secToMinSec para min/sesión desde GA (segundos)"
```

---

### Task 3: Transforms puros de GA (`netlify/functions/ga-transform.js`)

**Files:**
- Create: `netlify/functions/ga-transform.js`
- Create: `fixtures/ga-resumen.json`
- Create: `fixtures/ga-contenidos.json`
- Test: `tests/ga-transform.test.js`

- [ ] **Step 1: Create fixtures** (respuestas `runReport` de GA4 recortadas)

`fixtures/ga-resumen.json`:
```json
{
  "metricHeaders": [
    {"name": "activeUsers"}, {"name": "newUsers"}, {"name": "sessions"},
    {"name": "screenPageViews"}, {"name": "averageSessionDuration"}
  ],
  "rows": [
    {"metricValues": [{"value": "979"}, {"value": "802"}, {"value": "1431"}, {"value": "4431"}, {"value": "119.0"}]}
  ]
}
```

`fixtures/ga-contenidos.json`:
```json
{
  "dimensionHeaders": [{"name": "pageTitle"}],
  "metricHeaders": [{"name": "screenPageViews"}, {"name": "totalUsers"}, {"name": "userEngagementDuration"}],
  "rows": [
    {"dimensionValues": [{"value": "Adolescencia, Salud Mental"}], "metricValues": [{"value": "395"}, {"value": "212"}, {"value": "52535"}]},
    {"dimensionValues": [{"value": "Iniciar sesión"}], "metricValues": [{"value": "731"}, {"value": "500"}, {"value": "24000"}]},
    {"dimensionValues": [{"value": "Fentanilo y Propofol"}], "metricValues": [{"value": "102"}, {"value": "25"}, {"value": "31000"}]}
  ]
}
```

- [ ] **Step 2: Write the failing tests**

```js
// tests/ga-transform.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  reportRequests, isSystemPage,
  normalizeResumen, normalizeContenidos, normalizeBars, normalizeGeografia, normalizeEvolucion,
} from '../netlify/functions/ga-transform.js';

const load = n => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${n}`, import.meta.url)), 'utf8'));

test('reportRequests: arma las requests con el rango dado', () => {
  const reqs = reportRequests('2026-03-02', '2026-03-08');
  const resumen = reqs.find(r => r.key === 'resumen');
  assert.ok(resumen);
  assert.deepEqual(resumen.dateRanges, [{ startDate: '2026-03-02', endDate: '2026-03-08' }]);
  assert.ok(resumen.metrics.some(m => m.name === 'activeUsers'));
  assert.deepEqual(reqs.map(r => r.key).sort(),
    ['canales', 'contenidos', 'eventos', 'geografia', 'resumen']);
});

test('isSystemPage: filtra páginas de sistema', () => {
  assert.equal(isSystemPage('Iniciar sesión'), true);
  assert.equal(isSystemPage('Login'), true);
  assert.equal(isSystemPage('Mi perfil'), true);
  assert.equal(isSystemPage('Registro'), true);
  assert.equal(isSystemPage('Adolescencia, Salud Mental'), false);
});

test('normalizeResumen: KPIs formateados es-AR + min:seg', () => {
  const r = normalizeResumen(load('ga-resumen.json'));
  assert.equal(r.usuarios_activos, '979');
  assert.equal(r.usuarios_nuevos, '802');
  assert.equal(r.paginas_vistas, '4.431');
  assert.equal(r.min_sesion, '1:59');
});

test('normalizeContenidos: excluye sistema, ordena por vistas, tiempo medio', () => {
  const items = normalizeContenidos(load('ga-contenidos.json'));
  assert.equal(items.length, 2); // "Iniciar sesión" excluido
  assert.equal(items[0].name, 'Adolescencia, Salud Mental');
  assert.equal(items[0].vistas, 395);
  assert.equal(items[0].usuarios, 212);
  assert.equal(items[0].tiempo, 133); // 52535/395 ≈ 133s
});

test('normalizeBars: dimension+metric -> [{label,value}]', () => {
  const resp = {
    rows: [
      { dimensionValues: [{ value: 'Direct' }], metricValues: [{ value: '432' }] },
      { dimensionValues: [{ value: 'Paid Social' }], metricValues: [{ value: '273' }] },
    ],
  };
  assert.deepEqual(normalizeBars(resp), [
    { label: 'Direct', value: 432 }, { label: 'Paid Social', value: 273 },
  ]);
});

test('normalizeGeografia: agrega % sobre el total', () => {
  const resp = { rows: [
    { dimensionValues: [{ value: 'Argentina' }], metricValues: [{ value: '48' }] },
    { dimensionValues: [{ value: 'Venezuela' }], metricValues: [{ value: '12' }] },
  ] };
  const g = normalizeGeografia(resp);
  assert.equal(g[0].label, 'Argentina');
  assert.equal(g[0].value, 80); // 48/60 * 100
});

test('normalizeEvolucion: yearMonth -> filas mensuales con recurrentes', () => {
  const resp = { rows: [
    { dimensionValues: [{ value: '202601' }], metricValues: [{ value: '358' }, { value: '299' }, { value: '1000' }] },
  ] };
  const e = normalizeEvolucion(resp);
  assert.deepEqual(e[0], { mes: 'Enero 2026', activos: 358, nuevos: 299, recurrentes: 59, paginas: 1000 });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/ga-transform.test.js`
Expected: FAIL — "Cannot find module '../netlify/functions/ga-transform.js'".

- [ ] **Step 4: Write `netlify/functions/ga-transform.js`**

```js
// netlify/functions/ga-transform.js — puro: requests GA4 + normalización de respuestas.

const NUM = v => Number((v ?? '0')) || 0;
const esNum = n => Number(n).toLocaleString('es-AR');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const SYSTEM = [
  'login', 'iniciar sesión', 'iniciar sesion', 'home', 'inicio', 'registro',
  'recuperar', 'suscripci', 'mi perfil', 'perfil', 'gracias', 'términos',
  'terminos', 'favoritos', 'buscador', 'categoría', 'categoria', 'paypal',
];

export function isSystemPage(title) {
  const t = String(title || '').toLowerCase();
  return SYSTEM.some(s => t.includes(s));
}

function secToMinSec(s) {
  s = Math.round(Number(s) || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function reportRequests(desde, hasta) {
  const dateRanges = [{ startDate: desde, endDate: hasta }];
  return [
    { key: 'resumen', dateRanges, metrics: [
      { name: 'activeUsers' }, { name: 'newUsers' }, { name: 'sessions' },
      { name: 'screenPageViews' }, { name: 'averageSessionDuration' }] },
    { key: 'canales', dateRanges, dimensions: [{ name: 'firstUserDefaultChannelGroup' }],
      metrics: [{ name: 'newUsers' }], orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }] },
    { key: 'contenidos', dateRanges, dimensions: [{ name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'userEngagementDuration' }],
      limit: 200 },
    { key: 'eventos', dateRanges, dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }], orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 10 },
    { key: 'geografia', dateRanges, dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 15 },
  ];
}

export function evolucionRequest(desdeISO, hastaISO) {
  return {
    dateRanges: [{ startDate: desdeISO, endDate: hastaISO }],
    dimensions: [{ name: 'yearMonth' }],
    metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'screenPageViews' }],
    orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
  };
}

export function normalizeResumen(resp) {
  const m = (resp.rows?.[0]?.metricValues || []).map(x => x.value);
  const [activos, nuevos, sesiones, paginas, avgDur] = m;
  const pctNuevos = NUM(activos) ? Math.round((NUM(nuevos) / NUM(activos)) * 100) : 0;
  return {
    usuarios_activos: esNum(NUM(activos)),
    usuarios_nuevos: esNum(NUM(nuevos)),
    usuarios_activos__sub: `${pctNuevos}% nuevos`,
    usuarios_nuevos__sub: `${pctNuevos}% del total`,
    sesiones: esNum(NUM(sesiones)),
    paginas_vistas: esNum(NUM(paginas)),
    paginas_vistas__sub: `${NUM(sesiones) ? (NUM(paginas) / NUM(sesiones)).toFixed(2).replace('.', ',') : 0} por sesión`,
    min_sesion: secToMinSec(avgDur),
    min_sesion__sub: 'promedio de sesión',
  };
}

export function normalizeBars(resp) {
  return (resp.rows || []).map(r => ({
    label: r.dimensionValues[0].value,
    value: NUM(r.metricValues[0].value),
  }));
}

export function normalizeContenidos(resp) {
  return (resp.rows || [])
    .map(r => {
      const name = r.dimensionValues[0].value;
      const vistas = NUM(r.metricValues[0].value);
      const usuarios = NUM(r.metricValues[1].value);
      const eng = NUM(r.metricValues[2].value);
      return { name, vistas, usuarios, tiempo: vistas ? Math.round(eng / vistas) : 0 };
    })
    .filter(c => !isSystemPage(c.name))
    .sort((a, b) => b.vistas - a.vistas);
}

export function normalizeGeografia(resp) {
  const rows = (resp.rows || []).map(r => ({
    label: r.dimensionValues[0].value, users: NUM(r.metricValues[0].value),
  }));
  const total = rows.reduce((s, r) => s + r.users, 0) || 1;
  return rows.map(r => ({ label: r.label, value: Math.round((r.users / total) * 100) }));
}

export function normalizeEvolucion(resp) {
  return (resp.rows || []).map(r => {
    const ym = r.dimensionValues[0].value; // "YYYYMM"
    const y = ym.slice(0, 4), mi = Number(ym.slice(4, 6)) - 1;
    const activos = NUM(r.metricValues[0].value);
    const nuevos = NUM(r.metricValues[1].value);
    return {
      mes: `${MESES[mi]} ${y}`, activos, nuevos,
      recurrentes: Math.max(0, activos - nuevos), paginas: NUM(r.metricValues[2].value),
    };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/ga-transform.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/ga-transform.js tests/ga-transform.test.js fixtures/ga-resumen.json fixtures/ga-contenidos.json
git commit -m "feat: transforms puros GA4 (requests + normalización) con tests"
```

---

### Task 4: Handler serverless (`netlify/functions/ga.js`) + deps

**Files:**
- Create: `netlify/functions/ga.js`
- Modify: `package.json`
- Modify: `netlify.toml`

- [ ] **Step 1: Add the dependency**

Run:
```powershell
Set-Location "C:\Users\Juli\brisa-panel"; npm install @google-analytics/data
```
Expected: agrega `@google-analytics/data` a `package.json` y crea `node_modules/` + `package-lock.json`.

- [ ] **Step 2: Configure functions en `netlify.toml`** (agregar al final)

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

- [ ] **Step 3: Write `netlify/functions/ga.js`**

```js
// netlify/functions/ga.js — consulta GA4 Data API con cuenta de servicio y devuelve JSON normalizado.
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import {
  reportRequests, evolucionRequest,
  normalizeResumen, normalizeBars, normalizeContenidos, normalizeGeografia, normalizeEvolucion,
} from './ga-transform.js';

const PROPERTY = `properties/${process.env.GA_PROPERTY_ID}`;

function client() {
  const credentials = JSON.parse(process.env.GA_SA_KEY);
  return new BetaAnalyticsDataClient({ credentials });
}

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  body: JSON.stringify(body),
});

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export async function handler(event) {
  const q = event.queryStringParameters || {};
  try {
    const ga = client();

    if (q.modo === 'evolucion') {
      const [resp] = await ga.runReport({ property: PROPERTY, ...evolucionRequest('2026-01-01', q.hasta || '2026-12-31') });
      return json(200, { evolucion: normalizeEvolucion(resp) });
    }

    if (!isDate(q.desde) || !isDate(q.hasta) || q.desde > q.hasta) {
      return json(400, { error: 'rango inválido (desde/hasta YYYY-MM-DD)' });
    }

    const reqs = reportRequests(q.desde, q.hasta);
    const responses = await Promise.all(
      reqs.map(({ key, ...rep }) => ga.runReport({ property: PROPERTY, ...rep }).then(([r]) => [key, r]))
    );
    const byKey = Object.fromEntries(responses);

    return json(200, {
      resumen: normalizeResumen(byKey.resumen),
      canales: normalizeBars(byKey.canales),
      contenidos: normalizeContenidos(byKey.contenidos),
      eventos: normalizeBars(byKey.eventos),
      geografia: normalizeGeografia(byKey.geografia),
    });
  } catch (err) {
    return json(502, { error: 'GA no disponible', detalle: String(err.message || err) });
  }
}
```

- [ ] **Step 4: Add `node_modules` y la key local a `.gitignore`** (verificar/append)

```
node_modules/
.env
```

- [ ] **Step 5: Smoke-test del bundling (sin credenciales reales todavía)**

Run:
```powershell
Set-Location "C:\Users\Juli\brisa-panel"; node -e "import('./netlify/functions/ga-transform.js').then(m=>console.log('transform OK', typeof m.reportRequests))"
```
Expected: `transform OK function` (confirma que el módulo de transform importa; el handler se prueba en vivo tras configurar credenciales en Task 6-7).

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/ga.js package.json package-lock.json netlify.toml .gitignore
git commit -m "feat: Netlify function ga (GA4 Data API con cuenta de servicio)"
```

---

### Task 5: Cliente GA del front (`js/gaclient.js`)

**Files:**
- Create: `js/gaclient.js`

- [ ] **Step 1: Write `js/gaclient.js`**

```js
// js/gaclient.js — llama a la función serverless de GA. Devuelve null si falla (el caller maneja "sin datos").
const BASE = '/.netlify/functions/ga';

export async function fetchPeriodo(desde, hasta) {
  const res = await fetch(`${BASE}?desde=${desde}&hasta=${hasta}`);
  if (!res.ok) throw new Error(`GA ${res.status}`);
  return res.json(); // { resumen, canales, contenidos, eventos, geografia }
}

export async function fetchEvolucion(hasta) {
  const res = await fetch(`${BASE}?modo=evolucion&hasta=${hasta}`);
  if (!res.ok) throw new Error(`GA evolucion ${res.status}`);
  return res.json(); // { evolucion: [...] }
}
```

- [ ] **Step 2: Verify it imports (browser dev console o node)**

Run:
```powershell
Set-Location "C:\Users\Juli\brisa-panel"; node -e "import('./js/gaclient.js').then(m=>console.log('gaclient OK', typeof m.fetchPeriodo, typeof m.fetchEvolucion))"
```
Expected: `gaclient OK function function`.

- [ ] **Step 3: Commit**

```bash
git add js/gaclient.js
git commit -m "feat: gaclient (fetch a la función serverless de GA)"
```

---

### Task 6: Selector de período (`js/selector.js` + markup)

**Files:**
- Create: `js/selector.js`
- Modify: `index.html` (reemplazar el control de período estático del topbar)

- [ ] **Step 1: Replace the static period control en `index.html`**

Buscar en el topbar el bloque:
```html
    <div class="ctrl"><span class="ic">⇄</span> vs semana anterior</div>
    <div class="ctrl primary"><span class="ic">▦</span> <span data-field="config.periodo">Período</span></div>
```
Reemplazarlo por:
```html
    <div class="ctrl" id="modo-toggle" role="tablist" aria-label="Modo de período">
      <button class="modo-btn active" data-modo="semana">Semana</button>
      <button class="modo-btn" data-modo="mes">Mes</button>
      <button class="modo-btn" data-modo="comparar">Comparar</button>
    </div>
    <div class="ctrl primary"><span class="ic">▦</span>
      <select id="periodo-a" aria-label="Período A"></select>
      <span id="periodo-vs" hidden>vs</span>
      <select id="periodo-b" aria-label="Período B" hidden></select>
    </div>
```
Y agregar al `css/styles.css` (al final):
```css
.modo-btn{background:none;border:none;font:inherit;font-size:13px;font-weight:600;color:var(--muted);padding:4px 8px;border-radius:8px;cursor:pointer}
.modo-btn.active{background:var(--orange-soft);color:#c4521f}
.ctrl.primary select{background:transparent;border:none;font:inherit;font-weight:700;color:#fff;cursor:pointer}
.ctrl.primary select option{color:#1a1d21}
```

- [ ] **Step 2: Write `js/selector.js`**

```js
// js/selector.js — arma el selector (semana/mes/comparar) y notifica el período elegido.
import { weeksSince, monthsSince } from './period.js';

const START = '2026-01-01';

function todayISO() { return new Date().toISOString().slice(0, 10); }

function optionsFor(modo) {
  const list = modo === 'mes' ? monthsSince(START, todayISO()) : weeksSince(START, todayISO());
  return list.slice().reverse(); // más reciente primero
}

function fill(sel, items, selectedId) {
  sel.innerHTML = '';
  for (const it of items) {
    const o = document.createElement('option');
    o.value = it.id; o.textContent = it.label;
    o.dataset.desde = it.desde; o.dataset.hasta = it.hasta;
    if (it.id === selectedId) o.selected = true;
    sel.appendChild(o);
  }
}

const rangeOf = sel => {
  const o = sel.selectedOptions[0];
  return o ? { id: o.value, desde: o.dataset.desde, hasta: o.dataset.hasta, label: o.textContent } : null;
};

// onChange recibe { modo, a, b } donde a/b son {desde,hasta,label} (b null salvo comparar).
export function initSelector(root, onChange) {
  const a = root.querySelector('#periodo-a');
  const b = root.querySelector('#periodo-b');
  const vs = root.querySelector('#periodo-vs');
  const btns = [...root.querySelectorAll('.modo-btn')];
  let modo = 'semana';

  function rebuild() {
    const items = optionsFor(modo === 'mes' ? 'mes' : modo === 'comparar' ? 'mes' : 'semana');
    fill(a, items, items[0]?.id);
    const compare = modo === 'comparar';
    b.hidden = !compare; vs.hidden = !compare;
    if (compare) fill(b, items, items[1]?.id || items[0]?.id);
    emit();
  }
  function emit() {
    onChange({ modo, a: rangeOf(a), b: modo === 'comparar' ? rangeOf(b) : null });
  }
  btns.forEach(btn => btn.addEventListener('click', () => {
    btns.forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    modo = btn.dataset.modo; rebuild();
  }));
  a.addEventListener('change', emit);
  b.addEventListener('change', emit);
  rebuild();
}
```

- [ ] **Step 3: Verify en el navegador (sin GA todavía)**

Crear `dev-selector.html` temporal (no commitear) que importe `initSelector` y loguee los cambios; servir con `python -m http.server 8000` y abrir. Cambiar Semana/Mes/Comparar y los selects.
Expected: en Semana/Mes hay un select con períodos (más reciente primero); en Comparar aparecen dos selects + "vs"; cada cambio loguea `{modo, a, b}` con `desde`/`hasta` correctos. Borrar `dev-selector.html`.

- [ ] **Step 4: Commit**

```bash
git add js/selector.js index.html css/styles.css
git commit -m "feat: selector de período (semana/mes/comparar) en el topbar"
```

---

### Task 7: Rewire de `app.js` (GA en vivo + período + comparar) y `render.js`

**Files:**
- Modify: `js/app.js`
- Modify: `js/render.js`
- Modify: `index.html` (header de la tabla de contenidos según modo)

- [ ] **Step 1: Add contenidos render helpers en `js/render.js`** (append; reusa `delta`, `fmtNum`, `fmtTime`)

```js
// Contenidos en modo simple: name | vistas | usuarios | tiempo
export function contenidosCellsSimple() {
  return {
    name: i => i.name,
    vistas: i => fmtNum(i.vistas),
    usuarios: i => fmtNum(i.usuarios),
    tiempo: i => fmtTime(i.tiempo),
  };
}

// Contenidos en modo comparar: une A y B por nombre -> {name, va,ua,ta, vm,um,tm}
export function joinContenidos(a, b) {
  const map = new Map();
  for (const c of a) map.set(c.name, { name: c.name, va: c.vistas, ua: c.usuarios, ta: c.tiempo, vm: 0, um: 0, tm: 0 });
  for (const c of b) {
    const e = map.get(c.name) || { name: c.name, va: 0, ua: 0, ta: 0, vm: 0, um: 0, tm: 0 };
    e.vm = c.vistas; e.um = c.usuarios; e.tm = c.tiempo; map.set(c.name, e);
  }
  return [...map.values()].sort((x, y) => (y.va + y.vm) - (x.va + x.vm));
}
```

- [ ] **Step 2: Make the contenidos table header switchable en `index.html`**

Reemplazar el `<thead>` de la sección Contenidos (id `s5`) por dos thead conmutables:
```html
<thead data-head="contenidos-simple">
  <tr><th>Contenido</th><th class="r">Vistas</th><th class="r">Usuarios</th><th class="r">Tiempo</th></tr>
</thead>
<thead data-head="contenidos-compare" hidden>
  <tr><th>Contenido</th><th class="r">Vistas A</th><th class="r">Vistas B</th><th class="r">Δ</th>
      <th class="r">Usuarios A</th><th class="r">Usuarios B</th><th class="r">Δ</th>
      <th class="r">Tiempo A</th><th class="r">Tiempo B</th><th class="r">Δ</th></tr>
</thead>
```
Y poner dos `<template>` en el `<tbody data-rows="contenidos">`: uno para 4 columnas (`data-cell` name/vistas/usuarios/tiempo) y otro para 11 columnas (name/va/vm/delta_v/total_v/ua/um/delta_u/ta/tm/delta_t). `app.js` elegirá cuál clonar según el modo (ver Step 3, usa `renderRows` apuntando al template correcto vía un atributo `data-tpl`).

Para soportar elegir template, modificar `renderRows` en `render.js` para aceptar un 5º arg `tplSelector` opcional:
```js
export function renderRows(root, key, items, cellFns, tplSelector) {
  const body = root.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  const tpl = tplSelector ? body.querySelector(tplSelector) : body.querySelector('template');
  if (!tpl) return;
  [...body.children].forEach(c => { if (c.tagName !== 'TR') return; c.remove(); });
  [...body.querySelectorAll(':scope > tr')].forEach(tr => tr.remove());
  for (const item of items) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelectorAll('[data-cell]').forEach(cell => {
      const fn = cellFns[cell.dataset.cell]; if (fn) cell.innerHTML = fn(item);
    });
    body.appendChild(node);
  }
}
```
Dar a los dos templates `class="tpl-simple"` y `class="tpl-compare"`.

- [ ] **Step 3: Rewrite `js/app.js`**

```js
// js/app.js — GA en vivo por período + fuentes manuales de la Sheet.
import { gvizUrl, parseGviz } from './sheet.js';
import { buildConfig, mapColumns } from './sections.js';
import { renderFields, renderRows, contenidosCells, contenidosCellsSimple, joinContenidos } from './render.js';
import { fetchPeriodo, fetchEvolucion } from './gaclient.js';
import { initSelector } from './selector.js';

const SHEET_ID = '1FPsE8AaefOM8Jayz60-YbvhX4q3TrSkHdrA9FfspClY';
const esNum = n => Number(n).toLocaleString('es-AR');

async function fetchTab(tab) {
  const res = await fetch(gvizUrl(SHEET_ID, tab));
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${tab}`);
  return parseGviz(await res.text());
}
const status = msg => { const el = document.getElementById('app-status'); if (el) el.textContent = msg; };

function bars(key, items) {
  const max = Math.max(1, ...items.map(i => i.value));
  renderRows(document, key, items, { label: i => i.label, value: i => (i.value ? esNum(i.value) : '—') });
  const body = document.querySelector(`[data-rows="${key}"]`);
  if (body) body.querySelectorAll('.fill').forEach((el, i) => { if (items[i]) el.dataset.w = String((items[i].value / max) * 100); });
}

function renderResumenDelta(a, b) {
  // En comparar, agrega un badge Δ de usuarios activos al sub.
  const el = document.querySelector('[data-field="resumen.usuarios_activos__sub"]');
  if (el && b) {
    const va = Number(String(a.usuarios_activos).replace(/\./g, '')) || 0;
    const vb = Number(String(b.usuarios_activos).replace(/\./g, '')) || 0;
    el.textContent = `A ${a.usuarios_activos} · B ${b.usuarios_activos}`;
  }
}

async function renderGA(sel) {
  status('Cargando GA…');
  try {
    const a = await fetchPeriodo(sel.a.desde, sel.a.hasta);
    const compare = sel.modo === 'comparar' && sel.b;
    const b = compare ? await fetchPeriodo(sel.b.desde, sel.b.hasta) : null;

    renderFields(document, { resumen: a.resumen, config: { periodo: sel.a.label } });
    if (compare) renderResumenDelta(a.resumen, b.resumen);

    // Contenidos: simple o comparación
    const headSimple = document.querySelector('[data-head="contenidos-simple"]');
    const headCompare = document.querySelector('[data-head="contenidos-compare"]');
    if (compare) {
      headSimple.hidden = true; headCompare.hidden = false;
      renderRows(document, 'contenidos', joinContenidos(a.contenidos, b.contenidos), contenidosCells(), '.tpl-compare');
    } else {
      headSimple.hidden = false; headCompare.hidden = true;
      renderRows(document, 'contenidos', a.contenidos, contenidosCellsSimple(), '.tpl-simple');
    }

    bars('canales', a.canales);
    bars('geografia', a.geografia);
    bars('eventos', a.eventos);
    status('');
  } catch (err) {
    status('Sin datos de GA para este período. Probá otra fecha o reintentá.');
    console.error(err);
  } finally {
    window.dispatchEvent(new Event('load'));
  }
}

function inscriptosEnPeriodo(rows, desde, hasta) {
  const items = mapColumns(rows, [
    { key: 'curso_evento', idx: 0, type: 'str' }, { key: 'inscriptos', idx: 1, type: 'num' },
    { key: 'fecha', idx: 2, type: 'str' }, { key: 'nota', idx: 3, type: 'str' },
  ]);
  return items.filter(i => !i.fecha || (i.fecha >= desde.slice(0, 7) && i.fecha <= hasta));
}

async function main() {
  status('Cargando…');
  try {
    const [config, analisis, conversion, inscriptos, evo] = await Promise.all(
      ['Config', 'Analisis', 'Conversion', 'Inscriptos'].map(fetchTab).concat(fetchEvolucion(new Date().toISOString().slice(0, 10)))
    );
    renderFields(document, {
      config: buildConfig(config.rows), analisis: buildConfig(analisis.rows), conversion: buildConfig(conversion.rows),
    });
    // Evolución (siempre desde enero, no depende del período)
    renderRows(document, 'evolucion', evo.evolucion, {
      mes: i => i.mes, home: i => esNum(i.paginas), activos: i => esNum(i.activos), nuevos: i => esNum(i.nuevos),
      pct_nuevos: i => (i.activos ? `${Math.round(i.nuevos / i.activos * 100)}%` : '—'),
      recurrentes: i => esNum(i.recurrentes),
      pct_recurrentes: i => (i.activos ? `${Math.round(i.recurrentes / i.activos * 100)}%` : '—'),
    });
    window.__inscriptosRows = inscriptos.rows;

    initSelector(document, sel => {
      if (sel.a) renderGA(sel);
      const ins = inscriptosEnPeriodo(window.__inscriptosRows, sel.a.desde, sel.a.hasta);
      renderRows(document, 'inscriptos', ins, {
        curso_evento: i => i.curso_evento, inscriptos: i => esNum(i.inscriptos), fecha: i => i.fecha, nota: i => i.nota,
      });
    });
  } catch (err) {
    status('No se pudieron cargar los datos. Reintentá en unos minutos.');
    console.error(err);
  }
}

main();
```

- [ ] **Step 4: Quick load smoke-test (sin GA real)**

Run:
```powershell
Set-Location "C:\Users\Juli\brisa-panel"; node --test
```
Expected: PASS (los tests existentes siguen verdes; este task no rompe módulos puros).

- [ ] **Step 5: Commit**

```bash
git add js/app.js js/render.js index.html
git commit -m "feat: app.js con GA en vivo, selector de período y modo comparar"
```

---

### Task 8 (ops): Cuenta de servicio Google Cloud + acceso GA4

**Files:** ninguno (consola de Google Cloud y GA, vía el navegador compartido con el login del usuario). Requiere aprobación del usuario en los pasos de permisos.

- [ ] **Step 1: Crear/usar proyecto y habilitar la API**

En `https://console.cloud.google.com/`: crear (o elegir) un proyecto. En *APIs y servicios → Biblioteca*, buscar **"Google Analytics Data API"** y **Habilitar**.

- [ ] **Step 2: Crear la cuenta de servicio + llave JSON**

*APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio*. Nombre: `brisa-panel-ga`. Sin roles de proyecto (no hacen falta). Al crearla, entrar a la cuenta → *Claves → Agregar clave → Crear clave nueva → JSON*. Se descarga un `.json`. **Guardarlo fuera del repo** (ej. `C:\Users\Juli\brisa-ga-key.json`).

- [ ] **Step 3: Dar acceso de Lector en GA4**

En `https://analytics.google.com/` → *Administrar* → propiedad **"Brisa plus"** → *Gestión de accesos a la propiedad* → **+** → agregar el **email de la cuenta de servicio** (`...@....iam.gserviceaccount.com`) con rol **Lector** (Viewer), sin notificar por email.

- [ ] **Step 4: Confirmar el property id**

En *Administrar → Configuración de la propiedad* (o Detalles), verificar el **ID de propiedad** = `509383322`. Anotarlo para `GA_PROPERTY_ID`.

(No hay verificación automatizable aquí; la prueba real es la llamada a la función tras el deploy en Task 9.)

---

### Task 9 (ops): Repo en GitHub + Netlify conectado + variables + verificación

**Files:** ninguno nuevo (operaciones de git/GitHub/Netlify). Requiere login del usuario.

- [ ] **Step 1: Publicar el repo en GitHub**

Crear un repo **privado** `brisa-panel` en la cuenta GitHub del usuario y empujar:
```powershell
Set-Location "C:\Users\Juli\brisa-panel"
gh repo create brisa-panel --private --source . --remote origin --push
```
Expected: el repo queda en GitHub con todo el historial. (Confirmar que `node_modules/`, `dist/`, `*.zip`, `.env` y la llave JSON NO están versionados — ya cubiertos por `.gitignore`.)

- [ ] **Step 2: Conectar el sitio Netlify existente al repo**

En `https://app.netlify.com/projects/polite-starship-ca9220/configuration/deploys` → *Build & deploy → Continuous deployment → Link repository* → elegir GitHub → `brisa-panel`. Build command: vacío. Publish directory: `.`. Functions directory: `netlify/functions` (lo toma de `netlify.toml`).

- [ ] **Step 3: Cargar las variables de entorno**

En *Site configuration → Environment variables*: 
- `GA_PROPERTY_ID` = `509383322`
- `GA_SA_KEY` = **contenido completo** del JSON de la cuenta de servicio (pegar el texto del archivo descargado en Task 8).

- [ ] **Step 4: Disparar el deploy y verificar la función**

Push para gatillar build (o *Trigger deploy*). Cuando termine:
```powershell
curl "https://polite-starship-ca9220.netlify.app/.netlify/functions/ga?desde=2026-03-02&hasta=2026-03-08"
```
Expected: JSON con `resumen`, `canales`, `contenidos`, `eventos`, `geografia` poblados con datos reales de GA4. Si da `502`, revisar `GA_SA_KEY` y el acceso Lector en GA.

- [ ] **Step 5: Verificar el panel end-to-end en el navegador**

Abrir `https://polite-starship-ca9220.netlify.app/`. 
Expected: el selector muestra semanas; al cambiar de semana/mes los KPIs, canales, contenidos (sin login/home), eventos y geografía se actualizan en vivo; en **Comparar** la tabla de contenidos muestra A/B/Δ; Inscriptos filtra por el período; cero errores de consola (salvo favicon).

- [ ] **Step 6: Commit/cierre**

Actualizar el footer/nota del panel si hace falta y commit final. El deploy ya es automático en cada push a partir de acá.

---

## Self-Review

**Spec coverage:**
- Selector semana/mes/comparar → Task 6 ✓; modo comparar con Δ → Task 7 (joinContenidos + contenidosCells) ✓.
- GA en vivo (resumen, canales, contenidos, eventos, geografía) → Tasks 3-4-7 ✓; evolución mensual → `evolucionRequest`/`normalizeEvolucion` + Task 7 ✓.
- Exclusión de páginas de sistema en contenidos → `isSystemPage` (Task 3) ✓.
- Cuenta de servicio + GA4 Data API + env vars → Tasks 8-9 ✓.
- Fuentes manuales en la Sheet (Conversión, Análisis, Inscriptos por período) → Task 7 (Inscriptos filtrado por fecha; Conversión/Análisis quedan "actual") ✓. **Nota:** el spec menciona columna `semana` en todas las manuales; este plan filtra Inscriptos por su `fecha` existente y deja Conversión/Análisis como "actual" para acotar alcance — registrar como follow-up si se quiere período estricto en esas dos.
- Deploy con función vía GitHub→Netlify → Task 9 ✓.

**Placeholder scan:** sin TBD/TODO; todos los steps con código o comando concreto.

**Type consistency:** las secciones GA devueltas por `ga.js` (`resumen` objeto, `canales/eventos/geografia` `[{label,value}]`, `contenidos` `[{name,vistas,usuarios,tiempo}]`) coinciden con lo que consumen `bars`, `contenidosCellsSimple` y `joinContenidos`. `renderRows` con 5º arg opcional es retrocompatible con las llamadas existentes (Tasks previas pasan 4 args). `joinContenidos` produce `{name,va,ua,ta,vm,um,tm}`, idéntico a lo que espera `contenidosCells()` del panel actual.

**Riesgo conocido:** los nombres de dimensiones/métricas GA4 (`firstUserDefaultChannelGroup`, `userEngagementDuration`, `yearMonth`) y la lista de exclusión de `isSystemPage` se afinan contra datos reales en Task 9 Step 5 (los títulos reales de páginas de Brisa+ pueden requerir ajustar `SYSTEM`).
