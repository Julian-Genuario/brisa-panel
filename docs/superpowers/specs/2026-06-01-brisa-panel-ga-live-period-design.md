# Panel Brisa+ — GA en vivo + selector de período (diseño)

Fecha: 2026-06-01
Estado: en revisión del usuario

## Objetivo

Que el panel deje de depender de números de GA cargados a mano y permita **elegir el período** a ver, con tres modos:

1. **Semana** (lun–dom) — el caso principal.
2. **Mes** — vista mensual.
3. **Comparar** — dos períodos lado a lado con su Δ (ej. Abril vs Mayo, o semana vs semana).

Las secciones derivadas de GA se piden **en vivo** a la API de GA4 Data para el rango elegido; las fuentes manuales (backend, inscriptos, análisis) siguen en la Sheet, ahora etiquetadas por período.

## Decisiones

- **Conexión a GA:** una **función serverless en Netlify** (`/.netlify/functions/ga`) consulta la **Google Analytics Data API v1** (propiedad "Brisa plus", id 509383322) y devuelve JSON normalizado por sección.
- **Auth:** **cuenta de servicio** de Google con rol *Lector* en la propiedad GA4. La llave JSON vive como **variable de entorno en Netlify** (`GA_SA_KEY`, `GA_PROPERTY_ID`), nunca en el repo.
- **Sin backend propio ni servidor:** la función serverless cubre la llamada autenticada; el front sigue siendo estático.
- **El front llama a la función**, no más pestañas de GA en la Sheet. Las pestañas manuales se conservan.
- **Selector único a nivel reporte** (una sola página): el rango elegido aplica a todo, nunca se resetea — resuelve el dolor histórico de Looker que marcó G.

## Reparto de fuentes

| En vivo desde GA (por período) | Manual en la Sheet (etiquetado por período) |
|---|---|
| Resumen (activos, nuevos, sesiones, páginas, min/sesión) | Conversión 2 (registro→pago, backend) |
| Canales de adquisición | Inscriptos |
| Contenidos editoriales (excluye login/home/perfil/registro/etc.) | Análisis y curiosidades (texto) |
| Eventos principales | Registros/Pagos (backend) |
| Geografía (lista completa de países) | |
| Evolución mensual (desde enero, por mes) | |

## Modos del selector

- **Semana:** desplegable de semanas lun–dom desde enero 2026 hasta la última semana cerrada. Default = última semana completa.
- **Mes:** desplegable de meses desde enero 2026.
- **Comparar:** dos selectores (Período A / Período B), cada uno semana o mes. Cada sección muestra A, B y Δ (reutiliza la lógica de deltas de `brisa_report.py` ya portada: flecha solo si ambos > 0).

En modo Comparar, las tablas (Resumen con badges Δ, Contenidos, Evolución) son las más ricas; las barras (Canales, Geografía, Eventos) muestran el Período A con una nota del B.

## Arquitectura

```
[Selector de período] --(desde,hasta [,desdeB,hastaB])-->
   app.js
     ├─ fetch /.netlify/functions/ga?desde&hasta   --> GA4 Data API --> JSON GA
     └─ fetch Sheet (pestañas manuales)             --> filtra por período
   --> render de cada sección (mismas funciones del panel actual)
```

### Función serverless `ga`
- Runtime Node en Netlify Functions.
- Lee la cuenta de servicio de `process.env.GA_SA_KEY`, autentica contra GA4 Data API.
- Una sola invocación corre varios `runReport` (KPIs, canales, contenidos por pagePath/title, eventos, geografía) para el rango; los junta y devuelve `{ resumen, canales, contenidos, eventos, geografia }`.
- Para Comparar, el front la llama dos veces (A y B) y arma los Δ.
- Cachea por rango (header `Cache-Control`) para no repegar GA en cada recarga.

### Contenidos desde GA
- Dimensión `pageTitle` (o `pagePath`), métricas `screenPageViews`, `totalUsers`, `userEngagementDuration`.
- **Filtro de exclusión** de páginas de sistema (login, home, registro, recuperar, suscripciones, mi perfil, gracias, términos…) — lista afinada con el equipo; arranca con un set por defecto y se ajusta.

### Datos manuales por período
- Las pestañas `Inscriptos`, `Registros y Pagos`, `Analisis`, `Conversion` reciben una columna **`semana`** (fecha del lunes) y/o **`mes`**. El front filtra las filas que matchean el período elegido. Si una pestaña no tiene fila para ese período, la sección muestra "sin datos" prolijo.

## Manejo de errores
- Si la función GA falla (auth, cuota, rango inválido) → las secciones GA muestran "sin datos de GA para este período" y el resto (manual) sigue andando.
- Estado de carga al cambiar de período.
- Validación de rango en la función (formato fecha, A≤B).

## Qué se reutiliza
- Todo el panel actual (HTML/CSS/render). Solo cambia el origen de los datos GA (función en vez de Sheet) y se agrega el selector.
- Lógica de deltas/tiempos/orden ya portada de `brisa_report.py`.

## Setup que requiere la cuenta del usuario (Google Cloud / GA)
1. Proyecto en Google Cloud + habilitar **Google Analytics Data API**.
2. Crear **cuenta de servicio** + descargar **llave JSON**.
3. GA4 → Administrar → Acceso → agregar el email de la cuenta de servicio como **Lector** de "Brisa plus".
4. Cargar la llave como variable de entorno en Netlify (`GA_SA_KEY`) + `GA_PROPERTY_ID=509383322`.

## Fuera de alcance (por ahora)
- Engagement por país (G: no se mide aún).
- Identidad de usuarios (quién clickea Biotienda) — sigue requiriendo backend.
- Deploy automático desde git (seguimos con deploy manual por zip, o se evalúa conectar el repo a Netlify para que las funciones se publiquen solas — ver nota).

## Nota sobre deploy de la función
Las Netlify Functions necesitan publicarse junto al sitio. El deploy manual por zip soporta funciones si se incluye la carpeta `netlify/functions`. Alternativa más cómoda: conectar el repo de GitHub a Netlify (build automático en cada push). A decidir al implementar.
