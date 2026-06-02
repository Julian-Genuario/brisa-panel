// netlify/functions/ga.js — consulta GA4 Data API con cuenta de servicio y devuelve JSON normalizado.
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import {
  reportRequests, evolucionRequest, prevPeriod, picoRequest, regFormRequest,
  normalizeResumen, normalizeBars, normalizeContenidos, normalizeDemografia, normalizeEvolucion,
  tendenciaCard, picoCard, destacadoCard, registroFunnel,
} from './ga-transform.js';

const PROPERTY = `properties/${process.env.GA_PROPERTY_ID}`;

function client() {
  const credentials = JSON.parse(process.env.GA_SA_KEY);
  return new BetaAnalyticsDataClient({ credentials });
}

const json = (status, body) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  body: JSON.stringify(body),
});

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export async function handler(event) {
  const q = event.queryStringParameters || {};
  try {
    const ga = client();

    if (q.modo === 'evolucion') {
      const [resp] = await ga.runReport({ property: PROPERTY, ...evolucionRequest('2026-01-01', q.hasta || '2026-12-31') });
      return json(200, { evolucion: normalizeEvolucion(resp) });
    }

    if (!isDate(q.desde) || !isDate(q.hasta) || q.desde > q.hasta) {
      return json(400, { error: 'rango inválido (desde/hasta YYYY-MM-DD)' });
    }

    const reqs = reportRequests(q.desde, q.hasta);
    const prev = prevPeriod(q.desde, q.hasta);
    const [responses, prevResp, picoResp, regFormResp] = await Promise.all([
      Promise.all(reqs.map(({ key, ...rep }) => ga.runReport({ property: PROPERTY, ...rep }).then(([r]) => [key, r]))),
      ga.runReport({ property: PROPERTY, dateRanges: [{ startDate: prev.desde, endDate: prev.hasta }], metrics: [{ name: 'activeUsers' }] }).then(([r]) => r),
      ga.runReport({ property: PROPERTY, ...picoRequest(q.desde, q.hasta) }).then(([r]) => r),
      ga.runReport({ property: PROPERTY, ...regFormRequest(q.desde, q.hasta) }).then(([r]) => r),
    ]);
    const byKey = Object.fromEntries(responses);
    const contenidos = normalizeContenidos(byKey.contenidos);

    const curActivos = byKey.resumen.rows?.[0]?.metricValues?.[0]?.value || 0;
    const prevActivos = prevResp.rows?.[0]?.metricValues?.[0]?.value || 0;
    const analisis = { ...tendenciaCard(curActivos, prevActivos), ...picoCard(picoResp), ...destacadoCard(contenidos) };

    return json(200, {
      resumen: normalizeResumen(byKey.resumen),
      canales: normalizeBars(byKey.canales),
      contenidos,
      eventos: normalizeBars(byKey.eventos),
      demografia: {
        pais: normalizeDemografia(byKey.geografia, { top: 8 }),
        ciudad: normalizeDemografia(byKey.ciudad, { drop: ['(not set)'], top: 8 }),
      },
      analisis,
      registro: registroFunnel(regFormResp),
    });
  } catch (err) {
    return json(502, { error: 'GA no disponible', detalle: String(err.message || err) });
  }
}
