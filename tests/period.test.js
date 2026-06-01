// tests/period.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mondayOf, sundayOf, iso, weeksSince, monthsSince } from '../js/period.js';

test('mondayOf: devuelve el lunes de la semana (UTC)', () => {
  // 2026-03-04 es miércoles -> lunes 2026-03-02
  assert.equal(iso(mondayOf(new Date('2026-03-04T00:00:00Z'))), '2026-03-02');
  // un lunes se devuelve a sí mismo
  assert.equal(iso(mondayOf(new Date('2026-03-02T00:00:00Z'))), '2026-03-02');
  // un domingo -> lunes anterior
  assert.equal(iso(mondayOf(new Date('2026-03-08T00:00:00Z'))), '2026-03-02');
});

test('sundayOf: domingo de esa semana', () => {
  assert.equal(iso(sundayOf(new Date('2026-03-04T00:00:00Z'))), '2026-03-08');
});

test('weeksSince: semanas lun-dom desde el inicio hasta la última completa', () => {
  // desde 2026-01-01, "hoy" 2026-03-10 (martes) -> última semana completa termina 2026-03-08
  const ws = weeksSince('2026-01-01', '2026-03-10');
  const last = ws[ws.length - 1];
  assert.equal(last.desde, '2026-03-02');
  assert.equal(last.hasta, '2026-03-08');
  assert.equal(last.id, 'w2026-03-02');
  assert.match(last.label, /2.*8.*mar/);
  // la primera arranca en el lunes de la semana del 1-ene-2026 (2025-12-29)
  assert.equal(ws[0].desde, '2025-12-29');
});

test('monthsSince: meses completos/parciales desde enero', () => {
  const ms = monthsSince('2026-01-01', '2026-03-10');
  assert.equal(ms.length, 3);
  assert.deepEqual(
    { id: ms[2].id, desde: ms[2].desde, hasta: ms[2].hasta },
    { id: 'm2026-03', desde: '2026-03-01', hasta: '2026-03-31' }
  );
  assert.match(ms[2].label, /[Mm]arzo 2026/);
});
