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

function bars(key, items, suffix = '') {
  items = items || [];
  const body = document.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  if (!items.length) {
    [...body.children].forEach(c => { if (c.tagName !== 'TEMPLATE') c.remove(); });
    const p = document.createElement('div');
    p.style.cssText = 'font-size:12px;color:var(--muted-2)';
    p.textContent = 'Sin datos para este período.';
    body.appendChild(p);
    return;
  }
  const max = Math.max(1, ...items.map(i => i.value));
  renderRows(document, key, items, { label: i => i.label, value: i => (i.value ? esNum(i.value) + suffix : '—') });
  body.querySelectorAll('.fill').forEach((el, i) => { if (items[i]) el.dataset.w = String((items[i].value / max) * 100); });
}

// Bloque demográfico: cada barra muestra número exacto · % y un total al pie.
function demoBlock(key, data) {
  const body = document.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  const items = (data && data.items) || [];
  const tot = document.querySelector(`[data-total="${key}"]`);
  if (!items.length) {
    [...body.children].forEach(c => { if (c.tagName !== 'TEMPLATE') c.remove(); });
    const p = document.createElement('div');
    p.style.cssText = 'font-size:12px;color:var(--muted-2)';
    p.textContent = 'Sin datos para este período.';
    body.appendChild(p);
    if (tot) tot.textContent = '';
    return;
  }
  const max = Math.max(1, ...items.map(i => i.pct));
  renderRows(document, key, items, { label: i => i.label, value: i => `${esNum(i.n)} · ${i.pct}%` });
  body.querySelectorAll('.fill').forEach((el, i) => { if (items[i]) el.dataset.w = String((items[i].pct / max) * 100); });
  if (tot) tot.textContent = `Total: ${esNum((data && data.total) || 0)}`;
}

async function renderGA(sel) {
  status('Cargando GA…');
  try {
    const a = await fetchPeriodo(sel.a.desde, sel.a.hasta);
    const compare = sel.modo === 'comparar' && sel.b;
    const b = compare ? await fetchPeriodo(sel.b.desde, sel.b.hasta) : null;

    renderFields(document, { resumen: a.resumen, analisis: a.analisis, registro: a.registro, config: { periodo: compare ? `${sel.a.label} vs ${sel.b.label}` : sel.a.label } });

    const headSimple = document.querySelector('[data-head="contenidos-simple"]');
    const headCompare = document.querySelector('[data-head="contenidos-compare"]');
    if (compare) {
      headSimple.hidden = true; headCompare.hidden = false;
      renderRows(document, 'contenidos', joinContenidos(a.contenidos, b.contenidos), contenidosCells(), '.tpl-compare');
    } else {
      headSimple.hidden = false; headCompare.hidden = true;
      renderRows(document, 'contenidos', a.contenidos, contenidosCellsSimple(), '.tpl-simple');
    }

    const demo = a.demografia || {};
    demoBlock('pais', demo.pais);
    demoBlock('ciudad', demo.ciudad);
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

// gviz devuelve las fechas como "Date(2025,9,24)" (mes 0-based). Pasarlas a YYYY-MM-DD.
function gvizDateISO(v) {
  if (v == null) return '';
  const m = /^Date\((\d+),(\d+),(\d+)/.exec(String(v));
  if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  return String(v).slice(0, 10);
}

// Conversión 2 (Registro → Pago) calculada desde la pestaña "Registros y Pagos" para el período.
function conv2EnPeriodo(rows, desde, hasta) {
  let reg = 0, pag = 0;
  for (const r of (rows || [])) {
    const f = gvizDateISO(r[0]);
    if (f && f >= desde && f <= hasta) { reg += Number(r[1]) || 0; pag += Number(r[2]) || 0; }
  }
  return { reg, pag, pct: reg ? Math.round((pag / reg) * 100) : null };
}

async function loadEvolucion() {
  try {
    const evo = await fetchEvolucion(new Date().toISOString().slice(0, 10));
    renderRows(document, 'evolucion', evo.evolucion, {
      mes: i => i.mes, home: i => esNum(i.paginas), activos: i => esNum(i.activos), nuevos: i => esNum(i.nuevos),
      pct_nuevos: i => (i.activos ? `${Math.round(i.nuevos / i.activos * 100)}%` : '—'),
      recurrentes: i => esNum(i.recurrentes),
      pct_recurrentes: i => (i.activos ? `${Math.round(i.recurrentes / i.activos * 100)}%` : '—'),
    });
  } catch (err) {
    console.error('evolución no disponible', err);
  }
}

async function main() {
  status('Cargando…');
  try {
    const [config, conversion, inscriptos, regPagos] = await Promise.all(
      ['Config', 'Conversion', 'Inscriptos', 'Registros y Pagos'].map(fetchTab)
    );
    const convCfg = buildConfig(conversion.rows);
    renderFields(document, { config: buildConfig(config.rows), conversion: convCfg });
    window.__inscriptosRows = inscriptos.rows;
    window.__regPagosRows = regPagos.rows;

    loadEvolucion(); // independiente del período; no bloquea

    initSelector(document, sel => {
      if (sel.a) renderGA(sel);
      const ins = inscriptosEnPeriodo(window.__inscriptosRows, sel.a.desde, sel.a.hasta);
      renderRows(document, 'inscriptos', ins, {
        curso_evento: i => i.curso_evento, inscriptos: i => esNum(i.inscriptos), fecha: i => i.fecha, nota: i => i.nota,
      });
      // Conversión 2: Pagos ÷ Registros del período (pestaña "Registros y Pagos")
      const c2 = conv2EnPeriodo(window.__regPagosRows, sel.a.desde, sel.a.hasta);
      renderFields(document, { conversion: {
        conv2_valor: c2.pct == null ? '—' : `${c2.pct}%`,
        conv2_registros: c2.reg ? esNum(c2.reg) : '—',
        conv2_pagaron: c2.reg ? esNum(c2.pag) : '—',
        conv2_texto: convCfg.conv2_texto || '',
      } });
    });
    status('');
  } catch (err) {
    status('No se pudieron cargar los datos. Reintentá en unos minutos.');
    console.error(err);
  }
}

main();
