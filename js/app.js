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

async function renderGA(sel) {
  status('Cargando GA…');
  try {
    const a = await fetchPeriodo(sel.a.desde, sel.a.hasta);
    const compare = sel.modo === 'comparar' && sel.b;
    const b = compare ? await fetchPeriodo(sel.b.desde, sel.b.hasta) : null;

    renderFields(document, { resumen: a.resumen, config: { periodo: compare ? `${sel.a.label} vs ${sel.b.label}` : sel.a.label } });

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
    const [config, analisis, conversion, inscriptos] = await Promise.all(
      ['Config', 'Analisis', 'Conversion', 'Inscriptos'].map(fetchTab)
    );
    renderFields(document, {
      config: buildConfig(config.rows), analisis: buildConfig(analisis.rows), conversion: buildConfig(conversion.rows),
    });
    window.__inscriptosRows = inscriptos.rows;

    loadEvolucion(); // independiente del período; no bloquea

    initSelector(document, sel => {
      if (sel.a) renderGA(sel);
      const ins = inscriptosEnPeriodo(window.__inscriptosRows, sel.a.desde, sel.a.hasta);
      renderRows(document, 'inscriptos', ins, {
        curso_evento: i => i.curso_evento, inscriptos: i => esNum(i.inscriptos), fecha: i => i.fecha, nota: i => i.nota,
      });
    });
    status('');
  } catch (err) {
    status('No se pudieron cargar los datos. Reintentá en unos minutos.');
    console.error(err);
  }
}

main();
