// ═══════════════════════════════════════════════════════════
// datos/herramientas.js — registro de herramientas.
// Cada nivel desbloquea la suya al terminar el anterior.
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {Object} Herramienta
 * @property {string} id
 * @property {string} nombre
 * @property {string} descripcion
 * @property {string} conceptoAsociado — glosario mundo→programación
 * @property {string|null} desbloqueadaEn — id del nivel que la desbloquea (null = inicial)
 */

/** @type {Herramienta[]} */
export const HERRAMIENTAS = Object.freeze([
  {
    id: 'escaner-datos',
    nombre: 'Escáner de Datos',
    descripcion: 'Lee y clasifica fragmentos de datos (variables y tipos) del entorno.',
    conceptoAsociado: 'variables',
    desbloqueadaEn: null,
  },
  {
    id: 'ensamblador-modulos',
    nombre: 'Ensamblador de Módulos',
    descripcion: 'Agrupa instrucciones en módulos de construcción reutilizables (funciones).',
    conceptoAsociado: 'funciones',
    desbloqueadaEn: 'nivel-1',
  },
  {
    id: 'moldeador-ciudadanos',
    nombre: 'Molde de Ciudadanos',
    descripcion: 'Define moldes (clases) y crea ciudadanos digitales (objetos).',
    conceptoAsociado: 'clases',
    desbloqueadaEn: 'nivel-2',
  },
  {
    id: 'camara-jerarquias',
    nombre: 'Cámara de Jerarquías',
    descripcion: 'Especializa moldes existentes construyendo jerarquías (herencia).',
    conceptoAsociado: 'herencia',
    desbloqueadaEn: 'nivel-3',
  },
  {
    id: 'nucleo-polimorfico',
    nombre: 'Núcleo Polimórfico',
    descripcion: 'Firma contratos de conducta (interfaces) para un comportamiento flexible.',
    conceptoAsociado: 'polimorfismo',
    desbloqueadaEn: 'nivel-4',
  },
]);

/** @param {string} id @returns {Herramienta|null} */
export function herramientaPorId(id){
  return HERRAMIENTAS.find(h => h.id === id) ?? null;
}