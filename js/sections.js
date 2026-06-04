// js/sections.js — pure mappers from parsed Sheet rows to section data objects
import { sortByViews } from './format.js';
import { gvizDateISO } from './sheet.js';

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

// Profesión (campo "Target" del formulario de inscripción): filas [profesión, cantidad]
// -> { total, items:[{label, n, pct}] } ordenado por cantidad desc. Mismo shape que demoBlock.
export function profesionDist(rows) {
  const items = mapColumns(rows, [
    { key: 'label', idx: 0, type: 'str' },
    { key: 'n', idx: 1, type: 'num' },
  ]).filter(i => i.label);
  const total = items.reduce((s, i) => s + i.n, 0);
  return {
    total,
    items: items
      .sort((a, b) => b.n - a.n)
      .map(i => ({ label: i.label, n: i.n, pct: total ? Math.round((i.n / total) * 100) : 0 })),
  };
}

// Conversión 2 como COHORTE: de los registrados en [desde,hasta], cuántos de ESOS pagaron.
// rows: pestaña "Cohortes" [Fecha, Registrados, Pagaron]. pct siempre ≤ 100% (mismo grupo).
export function cohorteConv(rows, desde, hasta) {
  let reg = 0, pag = 0;
  for (const r of (rows || [])) {
    const f = gvizDateISO(r[0]);
    if (f && f >= desde && f <= hasta) { reg += Number(r[1]) || 0; pag += Number(r[2]) || 0; }
  }
  return { reg, pag, pct: reg ? Math.round((pag / reg) * 100) : null };
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
