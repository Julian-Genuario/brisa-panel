// js/selector.js — arma el selector (semana/mes/comparar) y notifica el período elegido.
import { weeksSince, monthsSince } from './period.js';

const START = '2026-01-01';

function todayISO() { return new Date().toISOString().slice(0, 10); }

function optionsFor(modo) {
  const list = modo === 'mes' ? monthsSince(START, todayISO()) : weeksSince(START, todayISO());
  return list.slice().reverse(); // más reciente primero
}

function fill(sel, items, selectedId) {
  sel.innerHTML = '';
  for (const it of items) {
    const o = document.createElement('option');
    o.value = it.id; o.textContent = it.label;
    o.dataset.desde = it.desde; o.dataset.hasta = it.hasta;
    if (it.id === selectedId) o.selected = true;
    sel.appendChild(o);
  }
}

const rangeOf = sel => {
  const o = sel.selectedOptions[0];
  return o ? { id: o.value, desde: o.dataset.desde, hasta: o.dataset.hasta, label: o.textContent } : null;
};

// onChange recibe { modo, a, b } donde a/b son {id,desde,hasta,label} (b null salvo comparar).
export function initSelector(root, onChange) {
  const a = root.querySelector('#periodo-a');
  const b = root.querySelector('#periodo-b');
  const vs = root.querySelector('#periodo-vs');
  const btns = [...root.querySelectorAll('.modo-btn')];
  let modo = 'semana';

  function rebuild() {
    const items = optionsFor(modo === 'mes' || modo === 'comparar' ? 'mes' : 'semana');
    fill(a, items, items[0]?.id);
    const compare = modo === 'comparar';
    b.hidden = !compare; vs.hidden = !compare;
    if (compare) fill(b, items, items[1]?.id || items[0]?.id);
    emit();
  }
  function emit() {
    onChange({ modo, a: rangeOf(a), b: modo === 'comparar' ? rangeOf(b) : null });
  }
  btns.forEach(btn => btn.addEventListener('click', () => {
    btns.forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    modo = btn.dataset.modo; rebuild();
  }));
  a.addEventListener('change', emit);
  b.addEventListener('change', emit);
  rebuild();
}
