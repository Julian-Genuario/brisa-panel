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
