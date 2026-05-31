// js/render.js — fills the annotated markup from a data object.
// Pure value setting only; the page's window.load script animates .fill / .ring.
import { getPath } from './sections.js';
import { fmtNum, fmtTime, delta } from './format.js';

// Fill every [data-field] from data via dotted path.
export function renderFields(root, data) {
  root.querySelectorAll('[data-field]').forEach(el => {
    const val = getPath(data, el.dataset.field);
    if (val !== undefined && val !== null && val !== '') el.textContent = val;
  });
}

// Fill a [data-rows="<key>"] container by cloning its <template> per item.
// cellFns maps a data-cell name to (item) => HTML string.
export function renderRows(root, key, items, cellFns) {
  const body = root.querySelector(`[data-rows="${key}"]`);
  if (!body) return;
  const tpl = body.querySelector('template');
  if (!tpl) return;
  // Remove previously rendered nodes (anything that is not the template).
  [...body.children].forEach(c => { if (c.tagName !== 'TEMPLATE') c.remove(); });
  for (const item of items) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelectorAll('[data-cell]').forEach(cell => {
      const fn = cellFns[cell.dataset.cell];
      if (fn) cell.innerHTML = fn(item);
    });
    body.appendChild(node);
  }
}

// Delta cell helper shared by table builders.
function dcell(a, b) {
  const d = delta(a, b);
  return `<span class="${d.dir === 'none' ? 'empty' : d.dir}">${d.text}</span>`;
}

// Cell builders for the contenidos comparison table.
export function contenidosCells() {
  const num = v => (v ? fmtNum(v) : '<span class="empty">-</span>');
  return {
    name: i => i.name,
    va: i => num(i.va),
    vm: i => num(i.vm),
    delta_v: i => dcell(i.va, i.vm),
    total_v: i => fmtNum(i.va + i.vm),
    ua: i => num(i.ua),
    um: i => num(i.um),
    delta_u: i => dcell(i.ua, i.um),
    ta: i => fmtTime(i.ta),
    tm: i => fmtTime(i.tm),
    delta_t: i => dcell(i.ta, i.tm),
  };
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
