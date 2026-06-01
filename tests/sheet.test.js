// tests/sheet.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gvizUrl, parseGviz } from '../js/sheet.js';

const fixture = readFileSync(
  fileURLToPath(new URL('../fixtures/gviz-config.json', import.meta.url)),
  'utf8'
);

test('gvizUrl: builds the published-sheet JSON endpoint', () => {
  const url = gvizUrl('SHEET123', 'Config');
  assert.ok(url.startsWith('https://docs.google.com/spreadsheets/d/SHEET123/gviz/tq?'));
  assert.ok(url.includes('tqx=out%3Ajson'));
  assert.ok(url.includes('sheet=Config'));
  assert.ok(url.includes('headers=1'));
});

test('parseGviz: strips the JS wrapper and returns cols + rows', () => {
  const { cols, rows } = parseGviz(fixture);
  assert.deepEqual(cols, ['clave', 'valor']);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ['periodo', '2 – 8 mar 2026']);
  assert.deepEqual(rows[1], ['titulo', 'Panel Analítico — Brisa+']);
});

test('parseGviz: throws on garbage input', () => {
  assert.throws(() => parseGviz('not a gviz response'));
});
