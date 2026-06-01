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

export function secToMinSec(s) {
  s = Math.round(Number(s) || 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
