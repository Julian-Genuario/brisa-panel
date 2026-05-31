// tests/render.test.js — pure helpers from render.js (DOM parts verified in browser)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineChartPoints } from '../js/render.js';

test('lineChartPoints: maps a series into "x,y x,y" within the box', () => {
  const pts = lineChartPoints([0, 50, 100], 100, 100, 10);
  const pairs = pts.split(' ');
  assert.equal(pairs.length, 3);
  // first x = pad, last x = w - pad
  assert.equal(pairs[0].split(',')[0], '10.0');
  assert.equal(pairs[2].split(',')[0], '90.0');
  // max value sits at the top (y = pad), min at the bottom (y = h - pad)
  assert.equal(pairs[2].split(',')[1], '10.0'); // value 100 -> top
  assert.equal(pairs[0].split(',')[1], '90.0'); // value 0 -> bottom
});

test('lineChartPoints: single point sits at the left, flat baseline', () => {
  const pts = lineChartPoints([42], 100, 100, 10);
  assert.equal(pts, '10.0,10.0');
});
