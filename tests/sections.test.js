// tests/sections.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseGviz } from '../js/sheet.js';
import { getPath, mapColumns, buildConfig, buildContenidos } from '../js/sections.js';

const contenidos = parseGviz(readFileSync(
  fileURLToPath(new URL('../fixtures/gviz-contenidos.json', import.meta.url)), 'utf8'
));

test('getPath: nested lookup, missing -> undefined', () => {
  const o = { resumen: { usuarios: 979 } };
  assert.equal(getPath(o, 'resumen.usuarios'), 979);
  assert.equal(getPath(o, 'resumen.nope'), undefined);
  assert.equal(getPath(o, 'x.y.z'), undefined);
});

test('mapColumns: maps indices to keys, skips blank rows, coerces nums', () => {
  const out = mapColumns(contenidos.rows, [
    { key: 'name', idx: 0, type: 'str' },
    { key: 'va', idx: 1, type: 'num' },
  ]);
  assert.equal(out.length, 2); // blank row dropped
  assert.deepEqual(out[0], { name: 'Adolescencia', va: 395 });
});

test('buildConfig: key/value rows -> object', () => {
  const cfg = buildConfig([['periodo', '2 – 8 mar'], ['titulo', 'Panel'], [null, null]]);
  assert.deepEqual(cfg, { periodo: '2 – 8 mar', titulo: 'Panel' });
});

test('buildContenidos: maps the 7 columns and sorts by va+vm desc', () => {
  const items = buildContenidos(contenidos.rows);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'Adolescencia'); // 395+10 > 0+102
  assert.deepEqual(
    { va: items[0].va, ua: items[0].ua, ta: items[0].ta, vm: items[0].vm, um: items[0].um, tm: items[0].tm },
    { va: 395, ua: 212, ta: 133, vm: 10, um: 7, tm: 305 }
  );
});
