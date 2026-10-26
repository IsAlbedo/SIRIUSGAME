// datos/logros.js — los 13 logros: texto narrativo + condición declarativa.

/**
 * Tipos de condición (interpretados por js/sistema/logros.js):
 *  {tipo:'nivel', nivel}              → completar ese nivel
 *  {tipo:'todosLosNiveles'}           → los cinco completados
 *  {tipo:'nivelEficiente', nivel, regla} → completar el nivel ganando la regla de desglose indicada
 *  {tipo:'persistente', fallos}       → superar el nivel tras N errores de código (o fallos de nivel) o más
 *  {tipo:'nombre'}                    → haberle puesto nombre al Arquitecto
 *  {tipo:'sinPistas'}                 → superar un nivel sin haber pedido ninguna pista en él
 *  {tipo:'sinErrores'}                → superar un nivel sin ningún error de código en la sesión
 *  {tipo:'registros'}                 → tener los cinco registros del Doctor Gustaff
 *  {tipo:'todasLasEstrellas'}         → tres estrellas en los cinco niveles
 */
export const LOGROS = Object.freeze([
  { id: 'el-primero', nombre: 'El Primero',
    texto: '«Todo sistema renace con un primer paso.» — Aria',
    descripcion: 'Completa «Recuperando la Memoria».',
    condicion: { tipo: 'nivel', nivel: 'nivel-1' } },
  { id: 'constructor-eficiente', nombre: 'Constructor Eficiente',
    texto: '«Menos líneas, más ciudad.» — Aria',
    descripcion: 'Completa «Automatizando la Reconstrucción».',
    condicion: { tipo: 'nivel', nivel: 'nivel-2' } },
  { id: 'poblador-del-mundo', nombre: 'Poblador del Mundo',
    texto: '«Un molde, mil vidas: así se funda un mundo.» — Aria',
    descripcion: 'Completa «Poblando el Mundo Virtual».',
    condicion: { tipo: 'nivel', nivel: 'nivel-3' } },
  { id: 'jerarca', nombre: 'Jerarca',
    texto: '«Honra a tu clase base y supérala.» — Gustaff',
    descripcion: 'Completa «Construyendo Jerarquías».',
    condicion: { tipo: 'nivel', nivel: 'nivel-4' } },
  { id: 'flexible', nombre: 'Flexible',
    texto: '«El código rígido se rompe; el flexible sobrevive.» — Aria',
    descripcion: 'Completa «El Código Flexible».',
    condicion: { tipo: 'nivel', nivel: 'nivel-5' } },
  { id: 'arquitecto-completo', nombre: 'Arquitecto Completo',
    texto: '«La red late gracias a ti, Arquitecto.» — Aria',
    descripcion: 'Completa los cinco niveles.',
    condicion: { tipo: 'todosLosNiveles' } },
  { id: 'eficiente', nombre: 'Eficiente',
    texto: '«La elegancia también se programa.» — Gustaff',
    descripcion: 'Supera el Nivel 1 con el mínimo de bloques (bonus de eficiencia).',
    condicion: { tipo: 'nivelEficiente', nivel: 'nivel-1', regla: 'eficiencia' } },
  { id: 'persistente', nombre: 'Persistente',
    texto: '«Caer es un paso; levantarse, el algoritmo.» — Gustaff',
    descripcion: 'Supera un nivel tras fallar tres veces o más.',
    condicion: { tipo: 'persistente', fallos: 3 } },
  { id: 'identidad-propia', nombre: 'Identidad Propia',
    texto: '«Un nombre propio: así empieza una leyenda.» — Aria',
    descripcion: 'Ponle nombre a tu Arquitecto (botón ARQUITECTO del menú).',
    condicion: { tipo: 'nombre' } },
  { id: 'sin-ayuda', nombre: 'Sin Ayuda',
    texto: '«Pensaste solo, y llegaste lejos.» — Gustaff',
    descripcion: 'Supera un nivel sin pedirle ninguna pista a Aria.',
    condicion: { tipo: 'sinPistas' } },
  { id: 'codigo-limpio', nombre: 'Código Limpio',
    texto: '«Ni un error: así se ve el orden.» — Aria',
    descripcion: 'Supera un nivel sin ningún error de código en la sesión.',
    condicion: { tipo: 'sinErrores' } },
  { id: 'archivista', nombre: 'Archivista de Gustaff',
    texto: '«Cada registro guardado es una lección que no se pierde.» — Aria',
    descripcion: 'Recoge los cinco registros del Doctor Gustaff.',
    condicion: { tipo: 'registros' } },
  { id: 'perfeccionista', nombre: 'Perfeccionista',
    texto: '«Tres estrellas en cada sector: eso ya es maestría.» — Aria',
    descripcion: 'Consigue las tres estrellas en los cinco niveles.',
    condicion: { tipo: 'todasLasEstrellas' } },
]);

export function logroPorId(id){ return LOGROS.find(l => l.id === id) ?? null; }