/**
 * setup-sheet.gs — crea/rellena las pestañas que lee el Panel Brisa+.
 * Pegar en Extensiones → Apps Script de la planilla "Backend Brisa+" y ejecutar setupPanel().
 * Es idempotente: si la pestaña existe la limpia y reescribe. No toca "Registros y Pagos" ni "Campañas".
 */
function setupPanel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var tabs = {
    Config: [
      ['clave', 'valor'],
      ['titulo', 'Panel Analítico — Brisa+'],
      ['subtitulo', 'Reporte semanal · lunes a domingo · se publica el lunes siguiente'],
      ['actualizado', 'Actualizado hoy'],
      ['periodo', 'Abril vs Mayo 2026'],
    ],
    Resumen: [
      ['metrica', 'valor', 'sub'],
      ['usuarios_activos', '979', '▲ 18,1% recurrentes'],
      ['usuarios_nuevos', '802', '81,9% del total de usuarios'],
      ['min_sesion', '1:59', '▲ vs 1:17 en marzo'],
      ['paginas_vistas', '4.431', '4,53 por usuario · 1.431 sesiones'],
    ],
    Analisis: [
      ['clave', 'texto'],
      ['tendencia_valor', '▲ +12,4%'],
      ['tendencia_texto', 'Usuarios activos suben respecto a la semana previa. Recurrentes crecen más rápido que nuevos → mejor retención.'],
      ['pico_valor', 'Mié.'],
      ['pico_texto', 'El mayor tráfico coincide con el envío de comunicación / newsletter.'],
      ['curiosidad_valor', '149'],
      ['curiosidad_texto', 'interacciones con Recuperar clave. ¿Posible fricción en el login?'],
      ['estrategia', 'La agenda la marca la actualidad de salud que es tendencia (Adolescencia, Fentanilo, Fútbol). [Pendiente: cargar el brief de criterios de contenido exitoso de G.]'],
    ],
    Canales: [
      ['canal', 'usuarios'],
      ['Direct', 432],
      ['Paid Social', 273],
      ['Organic Social', 45],
      ['Paid Other', 35],
      ['Organic Search', 11],
      ['Referral', 6],
    ],
    Conversion: [
      ['clave', 'valor'],
      ['conv1_valor', '45,1%'],
      ['conv1_texto', '% de usuarios nuevos que completan el formulario de registro. Mide si la Home convierte. (Sale de GA.)'],
      ['conv2_valor', '38,7%'],
      ['conv2_texto', '% de registrados que se vuelven suscriptores pagos. Sale del backend — GA no lo ve. Verificar contra pasarelas.'],
    ],
    Evolucion: [
      ['mes', 'home', 'activos', 'nuevos', 'recurrentes'],
      ['Enero', 1000, 358, 299, 59],
      ['Febrero', 1100, 369, 284, 85],
      ['Marzo', 2900, 2600, 2400, 200],
      ['30 mar – 12 abr', 1983, 979, 802, 177],
    ],
    Contenidos: [
      ['contenido', 'vistas_abr', 'usuarios_abr', 'tiempo_abr', 'vistas_may', 'usuarios_may', 'tiempo_may'],
      ['Adolescencia, Salud Mental y Violencia en las Escuelas', 395, 212, 133, 10, 7, 305],
      ['Fentanilo y Propofol: situación actual de consumo', 0, 0, 0, 102, 25, 310],
      ['Capacitación de RCP y DEA certificada', 97, 37, 778, 3, 3, 652],
      ['Cuidado de los hijos en otoño', 0, 0, 0, 43, 18, 60],
      ['Prevención 360: Presión arterial', 28, 15, 166, 5, 2, 449],
      ['Comer en silencio: tradición budista coreana', 22, 12, 24, 0, 0, 0],
      ['Búsquedas laborales — Agencia Interstaff', 14, 6, 36, 3, 1, 38],
      ['Orejas: evolución, cultura y cuidado del cuerpo', 13, 8, 27, 3, 2, 36],
      ['Enfermedad celíaca', 13, 4, 92, 1, 1, 16],
      ['Enfermeros/as latinoamericanos — Visa EB-3 (EEUU)', 13, 6, 55, 0, 0, 0],
      ['Trivia Mundial de Fútbol 2026', 0, 0, 0, 12, 7, 26],
      ['Maniobra de Heimlich: historia y actualización', 7, 6, 345, 7, 5, 544],
      ['Miniwebinar: Enfermería forense', 9, 3, 58, 3, 3, 24],
      ['Alerta por Hantavirus', 0, 0, 0, 10, 6, 4],
      ['Comer en un mundo que cambia', 3, 1, 64, 7, 3, 41],
      ['El músculo, ¿órgano de la longevidad?', 6, 6, 284, 3, 3, 71],
      ['Historia de Enfermeros Latinoamericanos 1', 6, 2, 6, 3, 2, 14],
      ['Enfermeros/as mexicanos — Visa TN (EEUU)', 9, 4, 27, 0, 0, 0],
      ['Entre lo que se siente y lo que se dice: salud mental en México', 0, 0, 0, 9, 3, 30],
      ['Del aula al hospital: momento revelación', 8, 6, 15, 1, 1, 2],
      ['Alimentación saludable para mejor control de la diabetes', 8, 2, 816, 0, 0, 0],
      ['Webinar de Brisa+', 0, 0, 0, 8, 5, 31],
      ['Meta Smart Glasses: dilema ético de la salud', 0, 0, 0, 7, 4, 18],
      ['Científicos: objetivo prometedor contra tuberculosis', 7, 2, 59, 0, 0, 0],
      ['Aspirina y cáncer', 2, 1, 16, 4, 3, 18],
      ['Latidos del Fútbol: cultura del fútbol en Reino Unido', 5, 2, 93, 1, 1, 23],
      ['Adolescentes con TDAH: ansiedad y depresión', 6, 5, 56, 0, 0, 0],
      ['Arsénico en el agua: riesgos y prevención', 6, 5, 119, 0, 0, 0],
      ['Beneficio exclusivo: 15 % OFF en Biotienda.club', 6, 3, 6, 0, 0, 0],
    ],
    Inscriptos: [
      ['curso_evento', 'inscriptos', 'fecha', 'nota'],
      ['Inscripción al Evento Adolescencia', 212, '2026-04', 'Pico de marzo/abril'],
      ['Capacitación RCP y DEA certificada', 37, '2026-04', 'Con certificado'],
      ['Webinar Fentanilo y Propofol', 25, '2026-05', 'En vivo'],
    ],
    Geografia: [
      ['pais', 'pct', 'etiqueta'],
      ['Argentina', 48.1, 'foco 2026'],
      ['Venezuela', 19.0, 'emergente'],
      ['Paraguay', 8.9, ''],
      ['Ecuador', 3.2, ''],
      ['Nicaragua', 3.1, ''],
      ['Colombia', 3.0, ''],
      ['Estados Unidos', 2.6, ''],
      ['México', 0, 'objetivo · webinar junio'],
    ],
    Eventos: [
      ['evento', 'volumen'],
      ['click_general', 11000],
      ['page_view', 4400],
      ['scroll', 1700],
      ['session_start', 1400],
      ['user_engagement', 1100],
      ['form_start', 921],
      ['first_visit', 802],
    ],
    Biotienda: [
      ['seccion', 'visitas', 'unicos'],
      ['Interstaff', 20, 8],
      ['Biotienda', 9, 4],
    ],
  };

  Object.keys(tabs).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.clear();
    var data = tabs[name];
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    sheet.getRange(1, 1, 1, data[0].length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  SpreadsheetApp.getUi().alert('Panel Brisa+: pestañas creadas/actualizadas ✓');
}
