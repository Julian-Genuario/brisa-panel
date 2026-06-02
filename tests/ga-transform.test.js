// tests/ga-transform.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  reportRequests, isSystemPage,
  normalizeResumen, normalizeContenidos, normalizeBars, normalizeGeografia, normalizeEvolucion,
} from '../netlify/functions/ga-transform.js';

const load = n => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${n}`, import.meta.url)), 'utf8'));

test('reportRequests: arma las requests con el rango dado', () => {
  const reqs = reportRequests('2026-03-02', '2026-03-08');
  const resumen = reqs.find(r => r.key === 'resumen');
  assert.ok(resumen);
  assert.deepEqual(resumen.dateRanges, [{ startDate: '2026-03-02', endDate: '2026-03-08' }]);
  assert.ok(resumen.metrics.some(m => m.name === 'activeUsers'));
  assert.deepEqual(reqs.map(r => r.key).sort(),
    ['canales', 'contenidos', 'eventos', 'geografia', 'resumen']);
});

test('isSystemPage: filtra navegación / no-contenido', () => {
  assert.equal(isSystemPage('BrisaPlus | Empleo'), true);
  assert.equal(isSystemPage('BrisaPlus | Congresos'), true);
  assert.equal(isSystemPage('BrisaPlus | Buscar'), true);
  assert.equal(isSystemPage('BrisaPlus'), true);
  assert.equal(isSystemPage('hero testing | BrisaPlus'), true);
  assert.equal(isSystemPage('Busquedas laborales - Agencia Interstaff | BrisaPlus'), true);
  assert.equal(isSystemPage('Brisa+ | Inscripción Evento'), true);
  assert.equal(isSystemPage('Webinar de Brisa+'), true);
  assert.equal(isSystemPage('Webinar: El músculo ¿es el órgano de la longevidad? (EN VIVO) | BrisaPlus'), false);
  assert.equal(isSystemPage('Capacitación de RCP y DEA certificada | BrisaPlus'), false);
  assert.equal(isSystemPage('Adolescencia, Salud Mental'), false);
});

test('normalizeResumen: KPIs formateados es-AR + min:seg', () => {
  const r = normalizeResumen(load('ga-resumen.json'));
  assert.equal(r.usuarios_activos, '979');
  assert.equal(r.usuarios_nuevos, '802');
  assert.equal(r.paginas_vistas, '4.431');
  assert.equal(r.min_sesion, '1:59');
});

test('normalizeContenidos: excluye sistema, ordena por vistas, tiempo medio', () => {
  const items = normalizeContenidos(load('ga-contenidos.json'));
  assert.equal(items.length, 2); // "Iniciar sesión" excluido
  assert.equal(items[0].name, 'Adolescencia, Salud Mental');
  assert.equal(items[0].vistas, 395);
  assert.equal(items[0].usuarios, 212);
  assert.equal(items[0].tiempo, 133); // 52535/395 ≈ 133s
});

test('normalizeBars: dimension+metric -> [{label,value}]', () => {
  const resp = {
    rows: [
      { dimensionValues: [{ value: 'Direct' }], metricValues: [{ value: '432' }] },
      { dimensionValues: [{ value: 'Paid Social' }], metricValues: [{ value: '273' }] },
    ],
  };
  assert.deepEqual(normalizeBars(resp), [
    { label: 'Direct', value: 432 }, { label: 'Paid Social', value: 273 },
  ]);
});

test('normalizeGeografia: agrega % sobre el total', () => {
  const resp = { rows: [
    { dimensionValues: [{ value: 'Argentina' }], metricValues: [{ value: '48' }] },
    { dimensionValues: [{ value: 'Venezuela' }], metricValues: [{ value: '12' }] },
  ] };
  const g = normalizeGeografia(resp);
  assert.equal(g[0].label, 'Argentina');
  assert.equal(g[0].value, 80); // 48/60 * 100
});

test('normalizeEvolucion: yearMonth -> filas mensuales con recurrentes', () => {
  const resp = { rows: [
    { dimensionValues: [{ value: '202601' }], metricValues: [{ value: '358' }, { value: '299' }, { value: '1000' }] },
  ] };
  const e = normalizeEvolucion(resp);
  assert.deepEqual(e[0], { mes: 'Enero 2026', activos: 358, nuevos: 299, recurrentes: 59, paginas: 1000 });
});
