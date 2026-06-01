// js/gaclient.js — llama a la función serverless de GA. Lanza error si falla (el caller maneja "sin datos").
const BASE = '/.netlify/functions/ga';

export async function fetchPeriodo(desde, hasta) {
  const res = await fetch(`${BASE}?desde=${desde}&hasta=${hasta}`);
  if (!res.ok) throw new Error(`GA ${res.status}`);
  return res.json(); // { resumen, canales, contenidos, eventos, geografia }
}

export async function fetchEvolucion(hasta) {
  const res = await fetch(`${BASE}?modo=evolucion&hasta=${hasta}`);
  if (!res.ok) throw new Error(`GA evolucion ${res.status}`);
  return res.json(); // { evolucion: [...] }
}
