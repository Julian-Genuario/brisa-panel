// js/sheet.js — pure helpers for the Google Sheets gviz endpoint

export function gvizUrl(sheetId, tabName) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const params = new URLSearchParams({ tqx: 'out:json', sheet: tabName, headers: '1' });
  return `${base}?${params.toString()}`;
}

export function parseGviz(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Respuesta gviz inválida');
  }
  const json = JSON.parse(text.slice(start, end + 1));
  const table = json.table || {};
  const cols = (table.cols || []).map(c => c.label || c.id || '');
  const rows = (table.rows || []).map(r =>
    (r.c || []).map(cell => (cell ? cell.v : null))
  );
  return { cols, rows };
}
