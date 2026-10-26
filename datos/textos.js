// ═══════════════════════════════════════════════════════════
// datos/textos.js — TODO el texto visible del juego vive aquí.
// ═══════════════════════════════════════════════════════════

/**
 * @param {string} plantilla
 * @param {Record<string, string|number>} [valores]
 * @returns {string}
 */
export function formatear(plantilla, valores = {}){
  return plantilla.replace(/\{(\w+)\}/g, (m, clave) =>
    clave in valores ? String(valores[clave]) : m
  );
}

export const TEXTOS = Object.freeze({
  ui: {
    tituloPagina: 'Arquitectos del Código · La Reconstrucción Digital',
    marca: 'RED NEURAL GLOBAL · PROTOCOLO DE RECONSTRUCCIÓN',
    titulo: 'ARQUITECTOS',
    tituloAcento: 'DEL CÓDIGO',
    subtitulo: 'La Reconstrucción Digital — Alianza de la Reconstrucción',
    botonIniciar: '▶ INICIAR',
    botonContinuar: '▶ CONTINUAR',
    botonReanudar: '▶ REANUDAR',
    notaInicial: 'Pulsa para entrar · el cursor quedará capturado',
    notaPausa: 'En pausa · pulsa para reanudar',
    notaMenu: 'Pulsa para entrar al nivel {nivel} · El cursor quedará capturado',
    botonControles: '⌨ CONTROLES',
        controles: [
      { tecla: 'W A S D', accion: 'moverse' },
      { tecla: 'RATÓN', accion: 'mirar' },
      { tecla: 'SHIFT', accion: 'correr' },
      { tecla: 'ESPACIO', accion: 'saltar' },
      { tecla: 'E', accion: 'interactuar' },
      { tecla: 'P', accion: 'pedir pista' },
      { tecla: 'V', accion: 'silenciar / activar a Aria' },
      { tecla: 'M', accion: 'ver misión' },
      { tecla: 'ALT', accion: 'puntero libre / cámara' },
      { tecla: 'ESC', accion: 'pausa' },
    ],
    hint: [
      { tecla: 'WASD', texto: 'MOVER' },
      { tecla: 'SHIFT', texto: 'CORRER' },
      { tecla: 'ESPACIO', texto: 'SALTAR' },
      { tecla: 'E', texto: 'INTERACTUAR' },
      { tecla: 'P', texto: 'PISTA' },
    ],
  },
  hud: {
    vida: 'VIDA',
    resistencia: 'RESISTENCIA',
    fps: 'FPS',
    mision: 'MISIÓN',
    objetivos: 'OBJETIVOS',
    herramientas: 'HERRAMIENTAS',
    bloqueada: 'BLOQUEADA',
    pedirPista: '💡 PEDIR PISTA (P)',
    registros: 'REGISTROS DE GUSTAFF',
    progreso: 'PROGRESO DEL NIVEL',
  },
  avisos: {
    exploracionIniciada: 'EXPLORACIÓN INICIADA',
    dano: '−{n} VIDA',
    curar: '+{n} VIDA',
    vidaCompleta: 'VIDA COMPLETA',
    reaparecido: 'REAPARECIDO',
    zonaTermica: '⚠ ZONA TÉRMICA',
    nivelCargado: 'SECTOR «{nombre}» RESTAURADO',
    objetivo: 'OBJETIVO ✓ · QUEDAN {restantes}',
    logroNuevo: 'LOGRO: {nombre}',
    herramientaNueva: 'NUEVA HERRAMIENTA: {nombre}',
    progresoReiniciado: 'PROGRESO REINICIADO',
    sinPistas: 'SIN PISTAS RESTANTES',
    registro: 'REGISTRO DE GUSTAFF RECUPERADO',
    vozAriaOn: 'ARIA ACTIVADA',
    vozAriaOff: 'ARIA SILENCIADA · seguirá ayudando por texto',
  },
  registro: { // prompt del coleccionable
    prompt: 'PULSA E — REGISTRO DE GUSTAFF DETECTADO',
  },
  intro: {
    marca: 'NIVEL {numero} · {sector}',
    boton: '▶ COMENZAR MISIÓN',
  },
  resultado: {
    tituloOk: 'NIVEL SUPERADO',
    tituloFail: 'NIVEL FALLIDO',
    mensajeOk: '«{nombre}» restaurado con éxito. La Alianza registra tu progreso.',
    mensajeFail: 'Motivo: {motivo}. La red sigue inestable: reintenta cuando estés listo.',
    etPuntos: 'PUNTOS',
    etTiempo: 'TIEMPO',
    etObjetivos: 'OBJETIVOS',
    etDesglose: 'DESGLOSE DE PUNTOS',
    botonSiguiente: 'SIGUIENTE NIVEL ▶',
    botonFinalizar: 'FINALIZAR RECONSTRUCCIÓN ▶',
    botonRepetir: 'REPETIR',
    botonMenu: 'MENÚ',
  },
  editor: {
    subreto: 'SUBRETO {i}/{n}',
    bloques: 'BLOQUES',
    minimo: 'mínimo para bonus',
  },
  cierre: {
    marca: 'RED NEURAL GLOBAL · ESTADO: ESTABLE',
    titulo: 'RECONSTRUCCIÓN COMPLETA',
    texto:
      'Eclipse ha sido contenido y la Red Neural Global vuelve a latir. Los ciudadanos ' +
      'digitales reconstruyen sus ciudades con el código que tú escribiste. Gustaff, ' +
      'dondequiera que estén sus datos, puede descansar: su obra continúa en ti, Arquitecto.',
    guion: [
      { autor: 'ARIA', texto: 'Red Neural Global, informa.' },
      { autor: 'SISTEMA', texto: 'Estado: ESTABLE. Eclipse: contenido. Ciudadanía digital: activa.' },
      { autor: 'GUSTAFF · HOLOGRAMA', texto: '¿Lo ves? No construiste muros ni torres: construiste ideas que se ejecutan. Secuencias que ordenan el caos, funciones que se reutilizan, objetos que viven, jerarquías que se especializan y contratos que se cumplen. Eso es todo lo que hay.' },
      { autor: 'ARIA', texto: 'Y algo más: alguien que lo entiende. Hasta siempre, Arquitecto.' },
    ],
    conceptos: [
      'Secuencia lógica', 'Variables y tipos', 'Condicionales (if/else, switch)', 'Bucles (for, while)',
      'Funciones: parámetros, retorno y ámbito', 'Valor vs referencia', 'Clases y objetos', 'Constructores',
      'Encapsulamiento (getters/setters)', 'Herencia, super y override', 'Clases abstractas vs interfaces',
      'Polimorfismo', 'Programar hacia una interfaz', 'Depuración de errores',
    ],
    creditos: [
      'Serious game desarrollado para investigación educativa',
      'Hipótesis: H1 mejora de habilidades de programación · H2 mayor motivación',
      'Motor: intérprete propio (tokenizer → AST → evaluador paso a paso) · sin eval/Function',
      'Tecnologías: HTML · CSS · JavaScript (ES Modules) · Three.js · Blockly',
      'Narrativa: Aria, el Dr. Gustaff y la Alianza de la Reconstrucción',
    ],
    etiquetaRango: 'RANGO FINAL',
    estrellas: '{n} de {max} estrellas',
    pistaPlaza: 'Desde 🗺 MAPA puedes visitar la Plaza de Cristales: cada sector restaurado enciende un cristal, y el Monumento central despierta cuando reúnes todas las estrellas.',
    // `desde` = fracción de las estrellas posibles (se elige el rango más alto alcanzado)
    rangos: [
      { id: 'aprendiz', desde: 0, nombre: 'ARQUITECTO APRENDIZ',
        texto: 'La red late de nuevo, pero aún puedes dominar mejor varios sectores. Repite niveles para conseguir más estrellas.' },
      { id: 'constructor', desde: 0.5, nombre: 'ARQUITECTO CONSTRUCTOR',
        texto: 'Tu código ya sostiene ciudades. Con algo más de práctica en los sectores difíciles llegarás más lejos.' },
      { id: 'maestro', desde: 0.8, nombre: 'ARQUITECTO MAESTRO',
        texto: 'Pocos errores y soluciones elegantes. Solo unos cuantos sectores te separan de la perfección.' },
      { id: 'legendario', desde: 1, nombre: 'ARQUITECTO LEGENDARIO',
        texto: 'Tres estrellas en cada sector. Gustaff estaría orgulloso: lo que construiste ya no se puede derrumbar.' },
    ],
    botonReiniciar: 'REINICIAR PROGRESO',
    botonMenu: 'MENÚ',
  },
  ajustes: {
    titulo: 'AJUSTES',
    boton: '⚙ AJUSTES',
    cerrar: '← VOLVER',
    restablecer: 'RESTABLECER',
    nota: 'Los cambios se aplican al instante y se guardan en este dispositivo.',
    tema: {
      etiqueta: 'TEMA DE COLOR',
      opciones: [
        { id: 'neon', nombre: 'Neón' },
        { id: 'terminal', nombre: 'Terminal' },
        { id: 'atardecer', nombre: 'Atardecer' },
        { id: 'alto-contraste', nombre: 'Alto contraste' },
      ],
    },
    fuente: {
      etiqueta: 'FUENTE',
      opciones: [
        { id: 'original', nombre: 'Original' },
        { id: 'legible', nombre: 'Legible' },
        { id: 'sistema', nombre: 'Del sistema' },
      ],
    },
    tamano: {
      etiqueta: 'TAMAÑO DEL TEXTO',
      opciones: [
        { id: 'chico', nombre: 'Pequeño', valor: 0.9 },
        { id: 'normal', nombre: 'Normal', valor: 1 },
        { id: 'grande', nombre: 'Grande', valor: 1.15 },
        { id: 'muygrande', nombre: 'Muy grande', valor: 1.3 },
      ],
    },
    voz: {
      etiqueta: 'VOZ DE ARIA',
      opciones: [
        { id: 'activada', nombre: 'Activada' },
        { id: 'silenciada', nombre: 'Silenciada' },
      ],
    },
  },
  reglas: {
    titulo: 'REGLAS DEL JUEGO',
    boton: '📖 REGLAS',
    cerrar: '← VOLVER',
    secciones: [
      { titulo: 'OBJETIVO', texto: 'Cada nivel es un sector de la Red Neural Global. Completa sus objetivos y supera los retos de código para restaurarlo y avanzar al siguiente.' },
      { titulo: 'EXPLORAR', texto: 'Muévete por el sector con W A S D, mira con el ratón y salta con ESPACIO. Todas las teclas están en ⌨ CONTROLES. Con ALT sueltas el puntero y con ESC pausas el juego.' },
      { titulo: 'VIDA', texto: 'Las zonas térmicas y otros peligros te quitan vida. Pulsa H para curarte. Si te quedas sin vida, reapareces.' },
            { titulo: 'RETOS DE CÓDIGO', texto: 'Acércate a la terminal y pulsa E para abrir el editor. Cada reto tiene varios sub-retos: resuelve uno para pasar al siguiente. Tu código se ejecuta paso a paso y puedes volver al mundo cuando quieras.' },
      { titulo: 'PISTAS', texto: 'Pulsa P en el mundo o el botón 💡 PISTA dentro del editor. Aria te da las pistas de una en una, de la más suave a la más directa.' },
      { titulo: 'ARIA', texto: 'Aria te acompaña y puede hablarte durante los retos. Si no quieres su voz, pulsa V, usa el botón de ARIA del editor o abre AJUSTES: aunque la silencies, seguirá ayudándote por texto.' },
      { titulo: 'REGISTROS DE GUSTAFF', texto: 'Algunos sectores esconden registros del Dr. Gustaff. Pulsa E cuando uno te lo indique para recuperarlo.' },
      { titulo: 'PUNTOS Y ESTRELLAS', texto: 'Al terminar un nivel verás cuántos puntos ganaste, de dónde salieron y cuántas estrellas (de 1 a 3) obtuviste. Si repites un nivel, se conservan tu mejor puntuación y tu mejor calificación. Algunos sectores también desbloquean emblemas para tu Arquitecto (botón ARQUITECTO).' },
      { titulo: 'PLAZA DE CRISTALES', texto: 'Cada sector restaurado enciende un cristal en la Plaza. Ábrela desde 🗺 MAPA y pulsa E junto a un cristal para repasar lo que aprendiste y tu calificación. El Monumento central despierta cuando consigues todas las estrellas. Para salir, pulsa E sobre el círculo dorado.' },
      { titulo: 'TU PARTIDA', texto: 'Tu progreso y tus ajustes se guardan en este dispositivo. «Reiniciar progreso» borra el avance, pero no tus ajustes.' },
    ],
  },
  ariaAyuda: {
    botonVozOn: '🔊 ARIA',
    botonVozOff: '🔇 ARIA',
    botonVozTitulo: 'Activar o silenciar la voz de Aria (ella seguirá ayudando por texto)',
    vozOn: 'Voz de Aria activada.',
    vozOff: 'Voz de Aria silenciada. Seguiré ayudándote por escrito.',
    frases: [
      'Llevas varios intentos. Respira: un error es información, no un castigo. Si quieres, pulsa 💡 PISTA y te doy una.',
      'Sigues atascado, y eso también forma parte de programar. Relee el objetivo con calma; si hace falta, pídeme una pista.',
      'Cada intento fallido descarta una posibilidad. Ya falta menos. ¿Probamos con una pista?',
    ],
  },
  aprendizaje: {
    etiqueta: 'LO QUE APRENDISTE',
    etiquetaPremios: 'RECOMPENSAS',
    herramienta: 'Herramienta desbloqueada',
    logro: 'Logro',
    etiquetaLogrosCierre: 'LOGROS OBTENIDOS',
    emblema: 'Emblema desbloqueado',
    emblemaDesc: 'Ya puedes usarlo en el botón ARQUITECTO.',
    sinLogros: 'Aún sin logros: repite niveles para conseguirlos.',
    niveles: {
      'nivel-1': {
        resumen: 'Diste instrucciones en orden, guardaste datos en variables, decidiste con if/else y switch, repetiste con for y while, y depuraste un programa con errores.',
        temas: ['Secuencia', 'Variables', 'if/else', 'switch', 'Bucle for', 'Bucle while', 'Depuración'],
      },
      'nivel-2': {
        resumen: 'Empaquetaste instrucciones en funciones: con parámetros, con valor de retorno, con variables locales, y las reutilizaste para construir sin repetir código.',
        temas: ['Funciones', 'Parámetros', 'Retorno', 'Ámbito', 'Valor vs referencia', 'Modularización', 'Refactorización'],
      },
      'nivel-3': {
        resumen: 'Definiste el molde Ciudadano y creaste objetos a partir de él, con su constructor y sus datos protegidos por encapsulamiento.',
        temas: ['Clases y objetos', 'Atributos y métodos', 'Constructor', 'Encapsulamiento', 'Instanciación'],
      },
      'nivel-4': {
        resumen: 'Distinguiste «es-un» de «tiene-un» y construiste una jerarquía: los hijos heredan del padre, llaman a super() y sobrescriben lo que necesitan.',
        temas: ['Herencia (es-un)', 'extends y super()', 'Override', 'Especialización', 'Referencia de tipo padre'],
      },
      'nivel-5': {
        resumen: 'Firmaste contratos con interfaces, elegiste entre clase abstracta e interfaz, y coordinaste a todos con un solo bucle sin tocar el código existente.',
        temas: ['Interfaces', 'Abstracta vs interfaz', 'Polimorfismo', 'Desacoplamiento', 'Programar hacia una interfaz'],
      },
    },
  },
  mapa: {
    titulo: 'MAPA DE MISIÓN',
    boton: '🗺 MAPA',
    cerrar: '← VOLVER',
    resumen: '{hechos}/{total} sectores restaurados · {puntos} puntos',
    restaurado: 'RESTAURADO',
    disponible: 'DISPONIBLE',
    bloqueado: 'BLOQUEADO',
    puntos: 'mejor puntuación {n}',
    registro: '📼 registro de Gustaff',
    notaSoloVer: 'Estás a mitad de un nivel: el mapa es solo de consulta. Para elegir otro sector, vuelve al menú principal.',
    notaBloqueado: 'Restaura el sector anterior para desbloquearlo.',
    plazaVisitar: 'VISITAR',
    plazaBloqueada: 'se abre al restaurar el primer sector',
  },
  plaza: {
    promptSalida: 'PULSA E — SALIR AL MENÚ',
    promptCristal: 'PULSA E — EXAMINAR',
    resumenHud: 'ESTRELLAS: {n}/{max}',
    etiquetaSinRestaurar: '· sin restaurar ·',
    etiquetaMonumento: 'MONUMENTO',
    etiquetaSalida: 'SALIDA',
    etiquetaSalidaSub: 'pulsa E para volver al menú',
    cristalApagado: 'Este cristal sigue apagado. Restaura «{titulo}» para encenderlo.',
    cristalEncendido: '«{titulo}» restaurado. {resumen}',
    temas: 'Temas: {temas}.',
    calificacion: 'Calificación: {estrellas} · mejor puntuación {puntos}.',
    monumentoApagado: 'El Monumento duerme todavía. Rango actual: {rango} ({n} de {max} estrellas). Consigue las tres estrellas en cada sector para despertarlo.',
    monumentoEncendido: 'El Monumento brilla con toda su fuerza. {rango}: {texto}',
  },
  privacidad: {
    titulo: 'AVISO DE PRIVACIDAD Y CONSENTIMIENTO',
    texto:
      'Este juego recoge datos ANÓNIMOS de uso (tiempos, intentos, errores y puntuaciones) ' +
      'con fines de investigación educativa. Se te asignará un identificador aleatorio: nunca ' +
      'se piden ni almacenan nombre, correo ni datos personales. La información se guarda solo ' +
      'en este dispositivo y puede exportarse o borrarse en cualquier momento.',
    id: 'Tu identificador anónimo: {id}',
    aceptar: 'ACEPTO PARTICIPAR',
    rechazar: 'CONTINUAR SIN COMPARTIR DATOS',
  },
});