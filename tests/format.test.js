// tests/format.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtTime, fmtNum, delta, sortByViews } from '../js/format.js';

test('fmtTime: zero or negative -> dash', () => {
  assert.equal(fmtTime(0), '-');
  assert.equal(fmtTime(-5), '-');
});

test('fmtTime: under a minute -> seconds', () => {
  assert.equal(fmtTime(47), '47 s');
});

test('fmtTime: minutes with zero-padded seconds', () => {
  assert.equal(fmtTime(133), '2 min 13 s');
});

test('fmtTime: hours with zero-padded minutes', () => {
  assert.equal(fmtTime(3660), '1 h 01 min');
});

test('fmtNum: es-AR thousands separator', () => {
  assert.equal(fmtNum(4431), '4.431');
  assert.equal(fmtNum(802), '802');
});

test('fmtNum: non-numeric -> dash', () => {
  assert.equal(fmtNum('x'), '-');
});

test('delta: needs both values > 0, else none', () => {
  assert.deepEqual(delta(0, 10), { dir: 'none', pct: null, text: '-' });
  assert.deepEqual(delta(10, 0), { dir: 'none', pct: null, text: '-' });
});

test('delta: up rounds percent', () => {
  const d = delta(100, 150);
  assert.equal(d.dir, 'up');
  assert.equal(d.text, '▲ +50 %');
});

test('delta: down', () => {
  assert.equal(delta(100, 50).text, '▼ -50 %');
});

test('delta: equal -> flat', () => {
  assert.equal(delta(10, 10).dir, 'flat');
});

test('sortByViews: descending by va+vm, original array untouched', () => {
  const rows = [{ va: 1, vm: 1 }, { va: 10, vm: 0 }, { va: 2, vm: 3 }];
  const out = sortByViews(rows);
  assert.deepEqual(out.map(r => r.va), [10, 2, 1]);
  assert.equal(rows[0].va, 1);
});
