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
