// js/app.js — fetch each Sheet tab, build the data object, render, then animate.
import { gvizUrl, parseGviz } from './sheet.js';
import { buildConfig, buildContenidos, mapColumns } from './sections.js';
import { renderFields, renderRows, contenidosCells } from './render.js';

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

const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
const esNum = n => Number(n).toLocaleString('es-AR');

async function main() {
  status('Cargando datos…');
  try {
    const tabs = ['Config', 'Resumen', 'Analisis', 'Conversion', 'Evolucion',
                  'Canales', 'Contenidos', 'Inscriptos', 'Geografia', 'Eventos', 'Biotienda'];
    const r = {};
    const results = await Promise.all(tabs.map(fetchTab));
    tabs.forEach((t, i) => { r[t] = results[i]; });

    // key/value tabs -> objects
    const config = buildConfig(r.Config.rows);
    const analisis = buildConfig(r.Analisis.rows);
    const conversion = buildConfig(r.Conversion.rows);

    // Resumen: metrica/valor/sub -> resumen.<metrica> and resumen.<metrica>__sub
    const resumen = {};
    for (const row of mapColumns(r.Resumen.rows, [
      { key: 'm', idx: 0, type: 'str' },
      { key: 'v', idx: 1, type: 'str' },
      { key: 's', idx: 2, type: 'str' },
    ])) {
      resumen[row.m] = row.v;
      resumen[`${row.m}__sub`] = row.s;
    }

    renderFields(document, { config, analisis, conversion, resumen });

    // Contenidos (editorial only, all of it, sorted by views)
    renderRows(document, 'contenidos', buildContenidos(r.Contenidos.rows), contenidosCells());

    // Evolución mensual (compute % nuevos / recurrentes)
    const evo = mapColumns(r.Evolucion.rows, [
      { key: 'mes', idx: 0, type: 'str' },
      { key: 'home', idx: 1, type: 'num' },
      { key: 'activos', idx: 2, type: 'num' },
      { key: 'nuevos', idx: 3, type: 'num' },
      { key: 'recurrentes', idx: 4, type: 'num' },
    ]);
    renderRows(document, 'evolucion', evo, {
      mes: i => i.mes,
      home: i => esNum(i.home),
      activos: i => esNum(i.activos),
      nuevos: i => esNum(i.nuevos),
      pct_nuevos: i => pct(i.nuevos, i.activos),
      recurrentes: i => esNum(i.recurrentes),
      pct_recurrentes: i => pct(i.recurrentes, i.activos),
    });

    // Inscriptos
    const ins = mapColumns(r.Inscriptos.rows, [
      { key: 'curso_evento', idx: 0, type: 'str' },
      { key: 'inscriptos', idx: 1, type: 'num' },
      { key: 'fecha', idx: 2, type: 'str' },
      { key: 'nota', idx: 3, type: 'str' },
    ]);
    renderRows(document, 'inscriptos', ins, {
      curso_evento: i => i.curso_evento,
      inscriptos: i => esNum(i.inscriptos),
      fecha: i => i.fecha,
      nota: i => i.nota,
    });

    // Biotienda (compute visitas/usuario)
    const bio = mapColumns(r.Biotienda.rows, [
      { key: 'seccion', idx: 0, type: 'str' },
      { key: 'visitas', idx: 1, type: 'num' },
      { key: 'unicos', idx: 2, type: 'num' },
    ]);
    renderRows(document, 'biotienda', bio, {
      seccion: i => i.seccion,
      visitas: i => esNum(i.visitas),
      unicos: i => esNum(i.unicos),
      ratio: i => (i.unicos > 0 ? (i.visitas / i.unicos).toFixed(2).replace('.', ',') : '—'),
    });

    // Bar blocks (canales, geografia, eventos): [label, value]
    bars('canales', r.Canales.rows);
    bars('geografia', r.Geografia.rows);
    bars('eventos', r.Eventos.rows);

    status('');
  } catch (err) {
    status('No se pudieron cargar los datos. Verificá que la Sheet esté publicada y reintentá en unos minutos.');
    console.error(err);
  } finally {
    // (Re)trigger the animation now that values / data-w are set.
    window.dispatchEvent(new Event('load'));
  }
}

// Generic bar block: rows of [label, value] -> fill widths + value labels.
function bars(key, rows) {
  const items = mapColumns(rows, [
    { key: 'label', idx: 0, type: 'str' },
    { key: 'value', idx: 1, type: 'num' },
  ]);
  const max = Math.max(1, ...items.map(i => i.value));
  renderRows(document, key, items, {
    label: i => i.label,
    value: i => (i.value ? esNum(i.value) : '—'),
  });
  const body = document.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  body.querySelectorAll('.fill').forEach((el, i) => {
    if (items[i]) el.dataset.w = String((items[i].value / max) * 100);
  });
}

main();
