# Panel Brisa+ — Web autónoma (diseño)

Fecha: 2026-05-31
Estado: aprobado por el usuario, listo para plan de implementación

## Problema

El panel analítico de Brisa+ vive hoy en Looker Studio, que limita el control del
diseño y obliga a operar dentro de su UI. Queremos una web propia que:

1. Use el diseño custom que ya validamos (el mockup `brisaplus-panel-mockup.html`:
   sidebar charcoal, acento naranja, KPIs, evolución, canales, conversión doble,
   contenidos, geografía, eventos, biotienda, definiciones).
2. Permita que **el equipo complete los datos en un archivo de Drive** y que la web
   se actualice **sola**, sin que nadie suba nada a mano ni toque código.
3. Mantenga las dos fuentes ya definidas: GA4 (automático) + planilla backend
   (registros/pagos y contenidos, carga manual).

## Decisiones tomadas

- **Fuente de datos = Google Sheet publicada** ("Backend Brisa+", la existente,
  ampliada con más pestañas). El equipo la completa; es lo que ya saben hacer.
- **Front-end = sitio estático** (HTML/CSS/JS) que reutiliza el CSS y la estructura
  del mockup, pero se rellena leyendo la Sheet al cargar.
- **Hosting = Netlify** (gratis, URL pública fija). Alternativas equivalentes:
  Vercel, GitHub Pages.
- **Acceso = link público** (decisión del usuario). Opción futura: clave simple por
  front-end si se necesita, sin rehacer la arquitectura.
- **Sin backend ni servidor**: todo se resuelve client-side leyendo la Sheet. Esto
  evita mantenimiento y puntos de quiebre frente a una conexión viva a la API de GA4.
- **GA4 en dos fases**: (1) arranque = los números se pegan a mano en una pestaña de
  la Sheet cada semana; (2) después = un script local (patrón `brisa_report.py`) los
  baja de GA4 y los escribe solo en la Sheet.

## Arquitectura

Tres piezas:

1. **Google Sheet "Backend Brisa+"** — fuente única de verdad. Una pestaña por bloque
   del panel. Publicada (Archivo → Compartir → Publicar en la web) para exponer un
   endpoint de lectura.
2. **Web estática** — el diseño del mockup, separando datos de markup. Al cargar,
   hace fetch de la Sheet, mapea cada pestaña a su sección y renderiza.
3. **Netlify** — sirve la web en una URL pública.

### Flujo de datos

```
Equipo edita la Sheet
   -> Sheet publicada (JSON via gviz/tq o CSV por pestaña)
   -> la web la lee al cargar (fetch client-side)
   -> render de cada seccion del panel
   -> URL publica en Netlify
```

Google cachea la publicación ~5 min, así que el efecto es casi en vivo: editan la
planilla, se recarga, aparece.

## Componentes

### 1. Google Sheet estructurada

Una pestaña por bloque, con columnas claras y rotuladas para que el equipo cargue sin
ambigüedad. Pestañas previstas:

- **Config** — período (lun–dom), fecha de publicación, texto de cabecera, "actualizado hace".
- **Resumen** — KPIs (usuarios activos, nuevos, min/sesión, páginas vistas) + deltas.
- **Evolución** — serie mensual (visitas Home, usuarios activos/nuevos/recurrentes, %).
- **Canales** — usuarios nuevos por canal de adquisición.
- **Conversión** — registro→pago por mes (backend). Home→registro sale de GA4.
- **Contenidos** — listado editorial completo (nombre, vistas/usuarios/tiempo por mes,
  delta). Estructura tomada de `brisa_report.py`.
- **Geografía** — usuarios por país + flags y etiquetas (objetivo, etc.).
- **Eventos** — eventos GA4 principales con su volumen.
- **Biotienda** — métricas Interstaff/Biotienda (visitas, únicos, visitas/usuario).
- **Análisis** — texto del analista de la semana (tendencia, pico, curiosidad, notas).

### 2. Front-end (estático)

- `index.html` — markup del mockup, con los valores reemplazados por placeholders/
  contenedores que llena el JS.
- CSS — el del mockup, intacto (variables de marca, cards, charts SVG, animaciones).
- `data.js` (o módulo) — capa de datos: hace el fetch de cada pestaña vía el endpoint
  gviz/tq JSON, normaliza y devuelve un objeto por sección.
- `render.js` — toma el objeto de datos y rellena cada sección (KPIs, barras, donuts,
  tablas, notas). Reutiliza la lógica de formato de `brisa_report.py` (tiempos, deltas
  con flechita, orden por vistas) portada a JS.

### 3. Hosting (Netlify)

- Deploy del sitio estático. URL pública fija.
- Sin build server necesario (es estático puro); opcionalmente un paso de build si se
  agrega bundling, pero no es requisito.

## Manejo de errores / robustez

- **Fetch fallido o pestaña vacía** → la sección muestra un estado "sin datos" prolijo,
  no se rompe el layout.
- **Estado de carga** mientras se traen los datos (skeleton o spinner liviano).
- **Formato es-AR**: miles con punto, decimales con coma, `tabular-nums` (ya en el CSS).
- **Datos faltantes en una fila** → celda con guión, sin flechita de delta (regla ya
  resuelta en `brisa_report.py`: delta solo cuando ambos períodos tienen valor > 0).

## Qué se reutiliza

- Todo el CSS y la estructura visual de `brisaplus-panel-mockup.html`.
- La lógica de `brisa_report.py`: `fmt_time`, `delta_cell`, orden por suma de vistas.
- La Google Sheet "Backend Brisa+" existente (id `1FPsE8AaefOM8Jayz60-YbvhX4q3TrSkHdrA9FfspClY`),
  ampliándola con las pestañas faltantes.

## Secuencia de construcción

1. Estructurar las pestañas de la Sheet (definir columnas claras para el equipo).
2. Separar datos de diseño en el HTML (plantilla que se llena por JS).
3. Conectar la lectura de la Sheet (gviz/tq) + mapeo a cada sección + render.
4. Deploy a Netlify → entregar la URL.
5. (Fase 2) Script GA4 → Sheet para automatizar los números de tráfico.

## Fuera de alcance (YAGNI por ahora)

- Conexión viva a la API de GA4 desde el front-end.
- Backend/servidor propio.
- Autenticación con usuarios (el acceso es link público; clave simple queda como
  opción futura).
- Engagement por país (decidido: no se mide aún).
- Embudo único registro→login→pago por usuario (GA4 no identifica por persona; se
  miden dos conversiones independientes).

## Pendientes heredados (no bloquean el build, se resuelven con el equipo)

- Definir "Inscripción al Evento", "Webinar Brisa+", las 3 "Maniobra de Heimlich",
  "Calendario de Huertas".
- Articular fechas de campañas con Max para el cruce campaña ↔ registros/logins.
