// ═══════════════════════════════════════════════════════════
// datos/niveles.js — LevelConfig de los 5 niveles (GAME_BIBLE).
// Los 5 niveles tienen objetivos reales.
// Los diálogos (entrada/salida) son ids dentro de datos/dialogues.json.
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {Object} PaletaNivel
 * @property {string} primario   — acento principal (HUD y franjas)
 * @property {string} secundario — acento secundario
 * @property {string} cielo      — parte alta del cielo
 * @property {string} horizonte  — parte baja del cielo
 * @property {string} niebla     — color de niebla
 * @property {string} luzSol     — luz direccional principal
 * @property {string} ambiente   — luz hemisférica
 *
 * @typedef {Object} ObjetivoNivel
 * @property {string} id
 * @property {string} descripcion
 * @property {boolean} opcional
 * @property {number} puntos
 *
 * @typedef {Object} ReglaPuntuacion
 * @property {string} id
 * @property {'suma'|'flag'|'multiplica'|'tiempo'} tipo
 * @property {string} [metrica]  — nombre de la métrica que mide el nivel (suma/flag/multiplica)
 * @property {number} [valor]    — puntos: fijos (flag, tiempo) o por unidad (multiplica; negativo = penalización)
 * @property {number} [tope]     — máximo absoluto de puntos que aporta la regla (multiplica)
 * @property {number} [umbral]   — segundos máximos para ganar los puntos (tiempo)
 * @property {string} descripcion
 *
 * @typedef {Object} MetricasPuntuacion
 * @property {number} base              — completar el nivel: 100
 * @property {number} bonoEficiencia    — menos líneas (+5–20)
 * @property {number} bonoReutilizacion — por función reutilizada (+10 c/u)
 * @property {number} bonoHerencia      — herencia correcta (+15)
 * @property {number} bonoPolimorfismo  — solución elegante (+20)
 * @property {number} bonoTiempo        — tiempo (+5–15)
 * @property {ReglaPuntuacion[]} [reglas] — reglas de puntuación declarativas del nivel
 *
 * @typedef {Object} ZonaMundo
 * @property {string} escena — clave del registro LevelManager.CONSTRUCTORES
 * @property {[number, number, number]} spawn
 *
 * @typedef {Object} DialogosNivel
 * @property {string} entrada — id de diálogo en datos/dialogues.json
 * @property {string} salida  — id de diálogo en datos/dialogues.json
 *
 * @typedef {Object} LevelConfig
 * @property {string} id
 * @property {number} numero
 * @property {string} titulo
 * @property {string} sector
 * @property {ZonaMundo} zona
 * @property {PaletaNivel} paleta
 * @property {{pista: string, volumen: number}} musica
 * @property {string} contexto — texto narrativo de la intro
 * @property {string[]} herramientas — ids de datos/herramientas.js
 * @property {string} [editor] — tipo de editor del nivel ('bloques' | 'clases' | 'herencia' | 'gobierno')
 * @property {string[]} [apiMundo] — funciones del mundo disponibles para el jugador
 * @property {ObjetivoNivel[]} objetivos
 * @property {{sinTiempoLimite: boolean, intentosMaximos: number, maxPasos?: number, maxProfundidad?: number, tiempoMaxMs?: number}} restricciones
 * @property {MetricasPuntuacion} puntuacion
 * @property {DialogosNivel} dialogos
 * @property {string[]} logros — ids de datos/logros.js
 */

/** @type {LevelConfig[]} */
export const NIVELES = Object.freeze([
  {
    id: 'nivel-1', numero: 1,
    titulo: 'Recuperando la Memoria',
    sector: 'Sector Alfa — Servidores Caídos',
    zona: { escena: 'nivel1', spawn: [0, 1.7, 11] },
    paleta: {
      primario: '#7b5cff', secundario: '#3fb6ff',
      cielo: '#0a0f2e', horizonte: '#3b2a6b', niebla: '#241d4d',
      luzSol: '#b7a6ff', ambiente: '#5a4a9e',
    },
    musica: { pista: 'audio/nivel1-memoria.ogg', volumen: 0.6 },
    contexto:
      'Año 2148. El virus Eclipse ha corrompido la Red Neural Global. Los servidores del ' +
      'Sector Alfa cayeron y, con ellos, la memoria de la red. Un robot de rescate espera tus ' +
      'instrucciones para atravesar el laberinto de servidores y recuperar los fragmentos de datos.',
    herramientas: ['escaner-datos'],
    editor: 'bloques',
    apiMundo: ['moverAdelante','girar','recolectar','leerSensor','leerPanel','leerCodigo','abrirPuerta','mostrar'],
    objetivos: [
      { id: 'obj-1-1', descripcion: 'Secuencia: mover y girar en orden', opcional: false, puntos: 10 },
      { id: 'obj-1-2', descripcion: 'Variables: leer el panel y abrir la puerta', opcional: false, puntos: 10 },
      { id: 'obj-1-3', descripcion: 'Condicional if/else: decidir en los cruces', opcional: false, puntos: 10 },
      { id: 'obj-1-4', descripcion: 'switch: elegir el pasillo por código', opcional: false, puntos: 10 },
      { id: 'obj-1-5', descripcion: 'Bucle for: pasillo largo + predicción', opcional: false, puntos: 10 },
      { id: 'obj-1-6', descripcion: 'Bucle while: avanzar mientras esté libre', opcional: false, puntos: 10 },
      { id: 'obj-1-7', descripcion: 'Mini-jefe: corregir el programa corrupto', opcional: false, puntos: 40 },
    ],
    restricciones: { sinTiempoLimite: true, intentosMaximos: 0, maxPasos: 300, maxProfundidad: 16, tiempoMaxMs: 5000 },
    puntuacion: { base: 100, bonoEficiencia: 20, bonoReutilizacion: 0, bonoHerencia: 0, bonoPolimorfismo: 0, bonoTiempo: 15,
      reglas: [
        { id: 'subretos', tipo: 'suma', metrica: 'subretosPuntos', descripcion: 'Puntos de sub-retos' },
        { id: 'completar', tipo: 'flag', metrica: 'completado', valor: 30, descripcion: 'Completar el nivel' },
        { id: 'eficiencia', tipo: 'multiplica', metrica: 'subretosEficientes', valor: 3, tope: 20, descripcion: 'Mínimo de bloques por sub-reto' },
        { id: 'tiempo', tipo: 'tiempo', umbral: 900, valor: 15, descripcion: 'Menos de 15 min' },
      ],
    },
    dialogos: { entrada: 'intro-nivel-1', salida: 'outro-nivel-1' },
    logros: ['el-primero'],
  },

  {
    id: 'nivel-2', numero: 2,
    titulo: 'Automatizando la Reconstrucción',
    sector: 'Módulo de Construcción',
    zona: { escena: 'taller', spawn: [0, 1.7, 12] },
    paleta: {
      primario: '#5ad08a', secundario: '#b9c4ad',
      cielo: '#101a14', horizonte: '#2e4636', niebla: '#1d3226',
      luzSol: '#d6e8c8', ambiente: '#4c6a52',
    },
    musica: { pista: 'audio/nivel2-taller.ogg', volumen: 0.6 },
    contexto:
      'La reconstrucción no puede hacerse a mano: hace falta automatización. En el Módulo de ' +
      'Construcción, un robot ensamblador espera módulos de construcción —funciones— para ' +
      'levantar viviendas, almacenes y centros de comunicación.',
    herramientas: ['escaner-datos', 'ensamblador-modulos'],
    editor: 'bloques',
    apiMundo: ['moverAdelante','girar','colocarBloque','ponerPuerta','ponerVentana','pedirRecursos','agregarMaterial','materiales','mostrar'],
    objetivos: [
      { id: 'obj-2-1', descripcion: 'Función sin parámetros: construirPared()', opcional: false, puntos: 10 },
      { id: 'obj-2-2', descripcion: 'Parámetros: largo, alto y posicion', opcional: false, puntos: 10 },
      { id: 'obj-2-3', descripcion: 'Retorno: calcularMateriales alimenta pedirRecursos', opcional: false, puntos: 10 },
      { id: 'obj-2-4', descripcion: 'Ámbito: la variable local no existe afuera', opcional: false, puntos: 10 },
      { id: 'obj-2-5', descripcion: 'Valor vs referencia: la grúa y la lista compartida', opcional: false, puntos: 10 },
      { id: 'obj-2-6', descripcion: 'Modularización: vivienda, almacén y centro', opcional: false, puntos: 10 },
      { id: 'obj-2-7', descripcion: 'Jefe: refactorizar el glitch de Eclipse', opcional: false, puntos: 20 },
    ],
    restricciones: { sinTiempoLimite: true, intentosMaximos: 0, maxPasos: 600, maxProfundidad: 16, tiempoMaxMs: 6000 },
    puntuacion: { base: 100, bonoEficiencia: 15, bonoReutilizacion: 10, bonoHerencia: 0, bonoPolimorfismo: 0, bonoTiempo: 10,
      reglas: [
        { id: 'subretos', tipo: 'suma', metrica: 'subretosPuntos', descripcion: 'Puntos de sub-retos' },
        { id: 'completar', tipo: 'flag', metrica: 'completado', valor: 30, descripcion: 'Completar el nivel' },
        { id: 'eficiencia', tipo: 'multiplica', metrica: 'subretosEficientes', valor: 3, tope: 15, descripcion: 'Mínimo de bloques por sub-reto' },
        { id: 'reutilizacion', tipo: 'multiplica', metrica: 'funcionesReutilizadas', valor: 10, tope: 30, descripcion: 'Función propia llamada 2+ veces' },
        { id: 'duplicados', tipo: 'multiplica', metrica: 'duplicados', valor: -5, tope: 25, descripcion: 'Penalización por copiar/pegar' },
        { id: 'tiempo', tipo: 'tiempo', umbral: 600, valor: 10, descripcion: 'Menos de 10 min' },
      ],
    },
    dialogos: { entrada: 'intro-nivel-2', salida: 'outro-nivel-2' },
    logros: ['constructor-eficiente'],
  },

  {
    id: 'nivel-3', numero: 3,
    titulo: 'Poblando el Mundo Virtual',
    sector: 'Módulo de Ciudadanía',
    zona: { escena: 'ciudad', spawn: [0, 1.7, 16] },
    paleta: {
      primario: '#ffb454', secundario: '#ffe08a',
      cielo: '#241207', horizonte: '#c96a2e', niebla: '#5a3417',
      luzSol: '#ffd9a0', ambiente: '#8a5a2e',
    },
    musica: { pista: 'audio/nivel3-ciudad.ogg', volumen: 0.6 },
    contexto:
      'Una ciudad sin ciudadanos es solo un decorado. En el Módulo de Ciudadanía diseñarás el ' +
      'molde —la clase— del Ciudadano Digital y darás vida a Agricultor, Ingeniero, Médico y ' +
      'Comerciante para que la ciudad vuelva a funcionar. Acércate a la terminal de la plaza ' +
      'y pulsa E para abrir el Molde de Ciudadanos.',
    herramientas: ['escaner-datos', 'ensamblador-modulos', 'moldeador-ciudadanos'],
    editor: 'clases',
    apiMundo: ['aportar', 'anunciar', 'registrarCiudadano', 'estadoCiudad', 'mostrar'],
    objetivos: [
      { id: 'obj-3-1', descripcion: 'Clasificar clases, objetos y atributos', opcional: false, puntos: 12 },
      { id: 'obj-3-2', descripcion: 'Definir la clase Ciudadano (atributos y métodos)', opcional: false, puntos: 12 },
      { id: 'obj-3-3', descripcion: 'Constructor: nacer con valores iniciales', opcional: false, puntos: 12 },
      { id: 'obj-3-4', descripcion: 'Encapsulamiento: el glitch de Eclipse rebota', opcional: false, puntos: 12 },
      { id: 'obj-3-5', descripcion: 'Instanciar los 4 oficios y hacer funcionar la ciudad', opcional: false, puntos: 12 },
    ],
    restricciones: { sinTiempoLimite: true, intentosMaximos: 0, maxPasos: 900, maxProfundidad: 16, tiempoMaxMs: 6000 },
    puntuacion: { base: 100, bonoEficiencia: 10, bonoReutilizacion: 10, bonoHerencia: 0, bonoPolimorfismo: 0, bonoTiempo: 10,
      reglas: [
        { id: 'subretos', tipo: 'suma', metrica: 'subretosPuntos', descripcion: 'Puntos de sub-retos' },
        { id: 'completar', tipo: 'flag', metrica: 'completado', valor: 40, descripcion: 'Completar el nivel' },
        { id: 'eficiencia', tipo: 'multiplica', metrica: 'primerIntento', valor: 3, tope: 10, descripcion: 'Sub-reto al primer intento' },
        { id: 'tiempo', tipo: 'tiempo', umbral: 600, valor: 10, descripcion: 'Menos de 10 min' },
      ],
    },
    dialogos: { entrada: 'intro-nivel-3', salida: 'outro-nivel-3' },
    logros: ['poblador-del-mundo'],
  },

  {
    id: 'nivel-4', numero: 4,
    titulo: 'Construyendo Jerarquías',
    sector: 'Academia de Especialización',
    zona: { escena: 'academia', spawn: [0, 1.7, 14] },
    paleta: {
      primario: '#6fb0ff', secundario: '#e8f1fa',
      cielo: '#0c1830', horizonte: '#3f6ea8', niebla: '#25405f',
      luzSol: '#eaf4ff', ambiente: '#6a8ab0',
    },
    musica: { pista: 'audio/nivel4-academia.ogg', volumen: 0.6 },
    contexto:
      'La Academia de Especialización necesita jerarquías. Cuando el fuego amenaza, no basta un ' +
      'ciudadano genérico: hacen falta especialistas que hereden lo aprendido y lo superen. ' +
      'Bombero.extinguirFuego(), Médico.atenderHeridos(): cada uno responde a su manera. ' +
      'Acércate a la terminal de la academia y pulsa E para abrir el editor de jerarquías.',
    herramientas: ['escaner-datos', 'ensamblador-modulos', 'moldeador-ciudadanos', 'camara-jerarquias'],
    editor: 'herencia',
    apiMundo: ['registrarCiudadano', 'apagarFuego', 'curar', 'registrarAccion', 'anunciar', 'estadoAcademia', 'mostrar'],
    objetivos: [
      { id: 'obj-4-1', descripcion: 'Relación es-un vs tiene-un', opcional: false, puntos: 12 },
      { id: 'obj-4-2', descripcion: 'extends + super() con las 4 clases', opcional: false, puntos: 12 },
      { id: 'obj-4-3', descripcion: 'Override: Bombero y Médico especializados', opcional: false, puntos: 12 },
      { id: 'obj-4-4', descripcion: 'Emergencia: incendio resuelto en 3D', opcional: false, puntos: 12 },
      { id: 'obj-4-5', descripcion: 'Aperitivo de polimorfismo: referencia de tipo padre', opcional: false, puntos: 12 },
    ],
    restricciones: { sinTiempoLimite: true, intentosMaximos: 0, maxPasos: 600, maxProfundidad: 16, tiempoMaxMs: 6000 },
    puntuacion: { base: 100, bonoEficiencia: 10, bonoReutilizacion: 0, bonoHerencia: 15, bonoPolimorfismo: 0, bonoTiempo: 10,
      reglas: [
        { id: 'subretos', tipo: 'suma', metrica: 'subretosPuntos', descripcion: 'Puntos de sub-retos' },
        { id: 'completar', tipo: 'flag', metrica: 'completado', valor: 40, descripcion: 'Completar el nivel' },
        { id: 'herencia', tipo: 'flag', metrica: 'herenciaOk', valor: 15, descripcion: 'Herencia correcta' },
        { id: 'eficiencia', tipo: 'multiplica', metrica: 'primerIntento', valor: 2, tope: 10, descripcion: 'Sub-reto al primer intento' },
        { id: 'tiempo', tipo: 'tiempo', umbral: 600, valor: 10, descripcion: 'Menos de 10 min' },
      ],
    },
    dialogos: { entrada: 'intro-nivel-4', salida: 'outro-nivel-4' },
    logros: ['jerarca'],
  },

  {
    id: 'nivel-5', numero: 5,
    titulo: 'El Código Flexible',
    sector: 'Módulo de Gobierno — Núcleo de la RNG',
    zona: { escena: 'nucleo', spawn: [0, 1.7, 16] },
    paleta: {
      primario: '#5ff0e0', secundario: '#bfeef2',
      cielo: '#04141c', horizonte: '#1f6d78', niebla: '#0d3a42',
      luzSol: '#c8fff6', ambiente: '#3f8f99',
    },
    musica: { pista: 'audio/nivel5-nucleo.ogg', volumen: 0.6 },
    contexto:
      'El Módulo de Gobierno alberga el corazón de la RNG. Eclipse ha lanzado una catástrofe ' +
      'simulada para poner a prueba la red. La respuesta es el código flexible: contratos de ' +
      'conducta —interfaces— donde cada objeto decide cómo responderEmergencia().',
    herramientas: ['escaner-datos', 'ensamblador-modulos', 'moldeador-ciudadanos', 'camara-jerarquias', 'nucleo-polimorfico'],
    editor: 'gobierno',
    apiMundo: ['registrarResponsable','apagarFuego','curar','abastecer','neutralizarGlitch','informar','registrarAccion','estadoGobierno','mostrar'], 
    objetivos: [
      { id: 'obj-5-1', descripcion: 'Interfaces: el contrato IResponsable', opcional: false, puntos: 12 },
      { id: 'obj-5-1b', descripcion: 'Abstracta vs interfaz: la elección correcta', opcional: false, puntos: 12 },
      { id: 'obj-5-2', descripcion: 'Catástrofe final coordinada con polimorfismo', opcional: false, puntos: 40 },
      { id: 'obj-5-3', descripcion: 'Desacoplamiento: tipo nuevo sin tocar el coordinador', opcional: false, puntos: 12 },
      { id: 'obj-5-4', descripcion: 'Polimorfismo: un solo bucle para todos', opcional: false, puntos: 12 },
    ],
    restricciones: { sinTiempoLimite: true, intentosMaximos: 0, maxPasos: 900, maxProfundidad: 16, tiempoMaxMs: 6000 },
    puntuacion: { base: 100, bonoEficiencia: 10, bonoReutilizacion: 0, bonoHerencia: 0, bonoPolimorfismo: 20, bonoTiempo: 15,
      reglas: [
        { id: 'subretos', tipo: 'suma', metrica: 'subretosPuntos', descripcion: 'Puntos de sub-retos' },
        { id: 'completar', tipo: 'flag', metrica: 'completado', valor: 40, descripcion: 'Completar el nivel' },
        { id: 'polimorfismo', tipo: 'flag', metrica: 'polimorfismoOk', valor: 20, descripcion: 'Solución elegante con polimorfismo' },
        { id: 'eficiencia', tipo: 'multiplica', metrica: 'primerIntento', valor: 2, tope: 10, descripcion: 'Sub-reto al primer intento' },
        { id: 'tiempo', tipo: 'tiempo', umbral: 750, valor: 15, descripcion: 'Menos de 12,5 min' },
      ],
    },
    dialogos: { entrada: 'intro-nivel-5', salida: 'outro-nivel-5' },
    logros: ['flexible'],
  },
]);

/** @param {string} id @returns {LevelConfig|null} */
export function nivelPorId(id){
  return NIVELES.find(n => n.id === id) ?? null;
}