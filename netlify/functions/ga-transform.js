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
  // Página genérica "Webinar de Brisa+" (sin definir) — los webinars reales tienen otro título.
  if (low === 'webinar de brisa+' || low === 'webinar de brisa') return true;
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
      metrics: [{ name: 'eventCount' }], orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 30 },
    { key: 'geografia', dateRanges, dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 15 },
    { key: 'ciudad', dateRanges, dimensions: [{ name: 'city' }],
      metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 },
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

// Distribución % de una dimensión (edad/género): descarta valores en `drop`, traduce con `map`.
export function normalizeDist(resp, opts = {}) {
  const drop = (opts.drop || []).map(s => s.toLowerCase());
  const map = opts.map || {};
  let rows = (resp.rows || [])
    .map(r => ({ label: r.dimensionValues[0].value || '', users: NUM(r.metricValues[0].value) }))
    .filter(r => r.label && !drop.includes(r.label.toLowerCase()));
  const total = rows.reduce((s, r) => s + r.users, 0) || 1;
  return rows.map(r => ({ label: map[r.label.toLowerCase()] || r.label, value: Math.round((r.users / total) * 100) }));
}

export function normalizeGeografia(resp) {
  const rows = (resp.rows || []).map(r => ({
    label: r.dimensionValues[0].value, users: NUM(r.metricValues[0].value),
  }));
  const total = rows.reduce((s, r) => s + r.users, 0) || 1;
  return rows.map(r => ({ label: r.label, value: Math.round((r.users / total) * 100) }));
}

// --- Análisis automático ---

// Período anterior de igual longitud, terminando el día antes de `desde`.
export function prevPeriod(desde, hasta) {
  const d0 = new Date(desde + 'T00:00:00Z');
  const d1 = new Date(hasta + 'T00:00:00Z');
  const lenDays = Math.round((d1 - d0) / 86400000) + 1;
  const prevHasta = new Date(d0); prevHasta.setUTCDate(prevHasta.getUTCDate() - 1);
  const prevDesde = new Date(prevHasta); prevDesde.setUTCDate(prevDesde.getUTCDate() - (lenDays - 1));
  const iso = d => d.toISOString().slice(0, 10);
  return { desde: iso(prevDesde), hasta: iso(prevHasta) };
}

// Request GA por día (para el pico).
export function picoRequest(desde, hasta) {
  return {
    dateRanges: [{ startDate: desde, endDate: hasta }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  };
}

export function tendenciaCard(cur, prev) {
  cur = NUM(cur); prev = NUM(prev);
  if (!prev) return { tendencia_valor: '—', tendencia_texto: 'Sin período anterior para comparar.' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  const valor = pct > 0 ? `▲ +${pct}%` : (pct < 0 ? `▼ ${pct}%` : '→ 0%');
  const verbo = pct > 0 ? 'suben' : (pct < 0 ? 'bajan' : 'se mantienen');
  return { tendencia_valor: valor, tendencia_texto: `Usuarios activos ${verbo} vs. el período anterior (${esNum(prev)} → ${esNum(cur)}).` };
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export function picoCard(byDayResp) {
  const rows = (byDayResp.rows || []).map(r => ({ date: r.dimensionValues[0].value, v: NUM(r.metricValues[0].value) }));
  if (!rows.length) return { pico_valor: '—', pico_texto: 'Sin datos diarios en el período.' };
  rows.sort((a, b) => b.v - a.v);
  const top = rows[0];
  const y = +top.date.slice(0, 4), m = +top.date.slice(4, 6) - 1, d = +top.date.slice(6, 8);
  const dia = DIAS[new Date(Date.UTC(y, m, d)).getUTCDay()];
  const label = `${dia} ${d}/${m + 1}`;
  return { pico_valor: label, pico_texto: `Día de mayor tráfico: ${label} con ${esNum(top.v)} sesiones.` };
}

// Report: eventos de formulario cruzados por la página donde ocurren.
export function regFormRequest(desde, hasta) {
  return {
    dateRanges: [{ startDate: desde, endDate: hasta }],
    dimensions: [{ name: 'pageTitle' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: ['form_start', 'form_submit'] } } },
    limit: 250,
  };
}

const REGISTRO_RE = /registr|suscrib|crear cuenta|sign[\s-]?up|sumate|sumáte/i;

// Embudo del formulario de REGISTRO: suma form_start/form_submit solo en páginas de registro.
export function registroFunnel(regFormResp, pattern = REGISTRO_RE) {
  let ini = 0, fin = 0;
  const paginas = new Set();
  for (const r of (regFormResp.rows || [])) {
    const page = r.dimensionValues[0].value || '';
    const ev = r.dimensionValues[1].value;
    const n = NUM(r.metricValues[0].value);
    if (!pattern.test(page)) continue;
    paginas.add(page);
    if (ev === 'form_start') ini += n;
    else if (ev === 'form_submit') fin += n;
  }
  const pct = ini ? Math.round((fin / ini) * 100) : 0;
  return {
    visitas: esNum(ini),
    completaron: esNum(fin),
    pct: ini ? `${pct}%` : '—',
    texto: ini
      ? `De ${esNum(ini)} que iniciaron el registro, ${esNum(fin)} lo completaron.`
      : 'Sin datos del formulario de registro en el período.',
    _paginas: [...paginas],
  };
}

export function destacadoCard(contenidos) {
  if (!contenidos || !contenidos.length) return { curiosidad_valor: '—', curiosidad_texto: 'Sin contenidos en el período.' };
  const top = contenidos[0]; // ya ordenado por vistas
  const name = top.name.replace(/\s*\|\s*BrisaPlus\s*$/i, '');
  return { curiosidad_valor: esNum(top.vistas), curiosidad_texto: `Lo más visto: “${name}”.` };
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
