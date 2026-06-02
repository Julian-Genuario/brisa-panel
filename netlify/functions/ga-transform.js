// netlify/functions/ga-transform.js — puro: requests GA4 + normalización de respuestas.

const NUM = v => Number((v ?? '0')) || 0;
const esNum = n => Number(n).toLocaleString('es-AR');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Palabras clave que marcan páginas que NO son contenido editorial
// (test, empleos/Interstaff, inscripción a eventos, legales, 404).
const NO_CONTENIDO = [
  'test', 'testing', 'página no encontrada', 'pagina no encontrada',
  'empleo', 'busquedas laborales', 'búsquedas laborales', 'interstaff',
  'inscripción evento', 'inscripcion evento', 'política de privacidad',
  'politica de privacidad', 'términos', 'terminos',
];

export function isSystemPage(title) {
  const t = String(title || '').trim();
  const low = t.toLowerCase();
  // Páginas de navegación/categoría: "BrisaPlus | X" o "Brisa+ | X", o la home a secas.
  if (/^brisa\s*plus\s*\|/i.test(t)) return true;
  if (/^brisa\+\s*\|/i.test(t)) return true;
  if (low === 'brisaplus' || low === 'brisa+') return true;
  // Resto de no-contenido por palabra clave.
  return NO_CONTENIDO.some(k => low.includes(k));
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
