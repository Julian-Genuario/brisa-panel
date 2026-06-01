// netlify/functions/ga.js — consulta GA4 Data API con cuenta de servicio y devuelve JSON normalizado.
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import {
  reportRequests, evolucionRequest,
  normalizeResumen, normalizeBars, normalizeContenidos, normalizeGeografia, normalizeEvolucion,
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
    const responses = await Promise.all(
      reqs.map(({ key, ...rep }) => ga.runReport({ property: PROPERTY, ...rep }).then(([r]) => [key, r]))
    );
    const byKey = Object.fromEntries(responses);

    return json(200, {
      resumen: normalizeResumen(byKey.resumen),
      canales: normalizeBars(byKey.canales),
      contenidos: normalizeContenidos(byKey.contenidos),
      eventos: normalizeBars(byKey.eventos),
      geografia: normalizeGeografia(byKey.geografia),
    });
  } catch (err) {
    return json(502, { error: 'GA no disponible', detalle: String(err.message || err) });
  }
}
