// api/ga.js — función serverless de Vercel: consulta GA4 Data API con cuenta de servicio
// y devuelve JSON normalizado. Misma lógica que la vieja función de Netlify.
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import {
  reportRequests, evolucionRequest, prevPeriod, picoRequest, regFormRequest, realtimeRequests,
  normalizeResumen, normalizeBars, normalizeContenidos, normalizeDemografia, normalizeEvolucion,
  tendenciaCard, picoCard, destacadoCard, registroFunnel, normalizeRealtime,
} from '../lib/ga-transform.js';

const PROPERTY = `properties/${process.env.GA_PROPERTY_ID}`;

function client() {
  const credentials = JSON.parse(process.env.GA_SA_KEY);
  return new BetaAnalyticsDataClient({ credentials });
}

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export default async function handler(req, res) {
  const q = req.query || {};
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'public, max-age=300');
  try {
    const ga = client();

    if (q.modo === 'evolucion') {
      const [resp] = await ga.runReport({ property: PROPERTY, ...evolucionRequest('2026-01-01', q.hasta || '2026-12-31') });
      return res.status(200).json({ evolucion: normalizeEvolucion(resp) });
    }

    if (q.modo === 'realtime') {
      const rt = realtimeRequests();
      const [total, paginas, paises] = await Promise.all([
        ga.runRealtimeReport({ property: PROPERTY, ...rt.total }).then(([r]) => r),
        ga.runRealtimeReport({ property: PROPERTY, ...rt.paginas }).then(([r]) => r),
        ga.runRealtimeReport({ property: PROPERTY, ...rt.paises }).then(([r]) => r),
      ]);
      res.setHeader('cache-control', 'no-store'); // los datos en vivo cambian cada segundos
      return res.status(200).json({ realtime: normalizeRealtime({ total, paginas, paises }) });
    }

    if (!isDate(q.desde) || !isDate(q.hasta) || q.desde > q.hasta) {
      return res.status(400).json({ error: 'rango inválido (desde/hasta YYYY-MM-DD)' });
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

    return res.status(200).json({
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
    return res.status(502).json({ error: 'GA no disponible', detalle: String(err.message || err) });
  }
}
