// js/app.js — GA en vivo por período + fuentes manuales de la Sheet.
import { gvizUrl, parseGviz } from './sheet.js';
import { buildConfig, mapColumns, profesionDist, cohorteConv } from './sections.js';
import { renderFields, renderRows, contenidosCells, contenidosCellsSimple, joinContenidos } from './render.js';
import { fetchPeriodo, fetchEvolucion, fetchRealtime } from './gaclient.js';
import { initSelector } from './selector.js';

const SHEET_ID = '1FPsE8AaefOM8Jayz60-YbvhX4q3TrSkHdrA9FfspClY';
const esNum = n => Number(n).toLocaleString('es-AR');

async function fetchTab(tab) {
  const res = await fetch(gvizUrl(SHEET_ID, tab));
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${tab}`);
  return parseGviz(await res.text());
}
const status = msg => { const el = document.getElementById('app-status'); if (el) el.textContent = msg; };

function bars(key, items, suffix = '', emptyMsg = 'Sin datos para este período.') {
  items = items || [];
  const body = document.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  if (!items.length) {
    [...body.children].forEach(c => { if (c.tagName !== 'TEMPLATE') c.remove(); });
    const p = document.createElement('div');
    p.style.cssText = 'font-size:12px;color:var(--muted-2)';
    p.textContent = emptyMsg;
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

// Tiempo real: activos en los últimos 30 min + qué ven + desde dónde. Se auto-refresca.
let rtTimer = null;
async function loadRealtime() {
  try {
    const { realtime } = await fetchRealtime();
    renderFields(document, { realtime: { activos: esNum(realtime.activos) } });
    bars('rt-paginas', realtime.paginas, '', 'Nadie navegando ahora mismo.');
    bars('rt-paises', realtime.paises, '', '—');
    // En los refrescos no hay un nuevo evento 'load', así que aplico los anchos a mano.
    document.querySelectorAll('#sRT .fill').forEach(f => { f.style.width = (f.dataset.w || 0) + '%'; });
  } catch (err) {
    console.error('realtime no disponible', err);
  }
}

// Profesión: dona (anillo) con el total al centro + leyenda. Colores de marca.
const PIE_COLORS = ['#ff8048', '#2b5c9b', '#15a06a', '#c4521f', '#7a3c1c', '#9aa1ab'];
function renderProfesionPie(data) {
  const wrap = document.getElementById('profesion-pie');
  if (!wrap) return;
  const items = (data && data.items) || [];
  const total = (data && data.total) || 0;
  if (!items.length || !total) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--muted-2)">Sin datos.</div>';
    return;
  }
  let cum = 0;
  const segs = items.map((it, i) => {
    const frac = (it.n / total) * 100;
    const seg = `<circle class="pie-seg" cx="18" cy="18" r="15.915" fill="none" stroke="${PIE_COLORS[i % PIE_COLORS.length]}" stroke-width="5" stroke-dasharray="${frac.toFixed(3)} ${(100 - frac).toFixed(3)}" stroke-dashoffset="${(-cum).toFixed(3)}"></circle>`;
    cum += frac;
    return seg;
  }).join('');
  const legend = items.map((it, i) =>
    `<li><i style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></i><span class="dl-label">${it.label}</span><span class="dl-val tnum">${esNum(it.n)} · ${it.pct}%</span></li>`
  ).join('');
  wrap.innerHTML =
    `<div class="pie"><svg viewBox="0 0 36 36" role="img" aria-label="Distribución por profesión"><circle cx="18" cy="18" r="15.915" fill="none" stroke="#f0f2f5" stroke-width="5"></circle>${segs}</svg><div class="pie-center"><b class="tnum">${esNum(total)}</b><span>inscriptos</span></div></div>` +
    `<ul class="pie-legend">${legend}</ul>`;
}

// Profesión: snapshot del backend (pestaña "Profesion": Profesión | Cantidad). No depende del período.
async function loadProfesion() {
  try {
    const t = await fetchTab('Profesion');
    renderProfesionPie(profesionDist(t.rows));
  } catch (err) {
    console.error('profesión no disponible', err);
  }
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
  // Tiempo real: independiente de la Sheet y del selector; arranca ya y se refresca cada 30 s.
  loadRealtime();
  if (!rtTimer) rtTimer = setInterval(loadRealtime, 30000);
  try {
    const [config, conversion, inscriptos, cohortes] = await Promise.all(
      ['Config', 'Conversion', 'Inscriptos', 'Cohortes'].map(fetchTab)
    );
    const convCfg = buildConfig(conversion.rows);
    renderFields(document, { config: buildConfig(config.rows), conversion: convCfg });
    window.__inscriptosRows = inscriptos.rows;
    window.__cohortesRows = cohortes.rows;

    loadEvolucion(); // independiente del período; no bloquea
    loadProfesion(); // snapshot del backend; no bloquea

    initSelector(document, sel => {
      if (sel.a) renderGA(sel);
      const ins = inscriptosEnPeriodo(window.__inscriptosRows, sel.a.desde, sel.a.hasta);
      renderRows(document, 'inscriptos', ins, {
        curso_evento: i => i.curso_evento, inscriptos: i => esNum(i.inscriptos), fecha: i => i.fecha, nota: i => i.nota,
      });
      // Conversión 2 (cohorte): de los registrados en el período, cuántos de ESOS pagaron.
      const c2 = cohorteConv(window.__cohortesRows, sel.a.desde, sel.a.hasta);
      renderFields(document, { conversion: {
        conv2_valor: c2.pct == null ? '—' : `${c2.pct}%`,
        conv2_registros: c2.reg ? esNum(c2.reg) : '—',
        conv2_pagaron: c2.reg ? esNum(c2.pag) : '—',
        conv2_texto: c2.reg
          ? `De ${esNum(c2.reg)} que se registraron en el período, ${esNum(c2.pag)} ya pagaron (${c2.pct}%). Cohorte por fecha de alta · backend.`
          : 'Sin registros nuevos en el período.',
      } });
    });
    status('');
  } catch (err) {
    status('No se pudieron cargar los datos. Reintentá en unos minutos.');
    console.error(err);
  }
}

main();
