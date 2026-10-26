// ═══════════════════════════════════════════════════════════
// sistema/puntuacion.js — motor de puntuación declarativo.
// Las reglas viven en LevelConfig.puntuacion.reglas (datos),
// nunca en el código.
// ═══════════════════════════════════════════════════════════

/**
 * @typedef {Object} ReglaPuntuacion
 * @property {string} id — identificador de la regla (aparece en el desglose)
 * @property {'suma'|'multiplica'|'flag'|'tiempo'} tipo
 *   suma       → puntos += metricas[metrica]
 *   multiplica → puntos += metricas[metrica] × valor (limitado por tope, admite negativos)
 *   flag       → puntos += valor si metricas[metrica] es truthy
 *   tiempo     → puntos += valor si metricas.segundos <= umbral
 * @property {string} [metrica]
 * @property {number} [valor]
 * @property {number} [tope]
 * @property {number} [umbral]
 * @property {string} [descripcion]
 */

/**
 * @param {Object} config — LevelConfig
 * @param {Object} metricas — contadores que aporta el mundo del nivel
 * @returns {{total:number, desglose:{id:string,puntos:number}[]}}
 */
export function calcularPuntuacion(config, metricas = {}){
  const reglas = config.puntuacion?.reglas ?? [];
  const desglose = [];
  let total = 0;
  for (const r of reglas){
    let puntos = 0;
    const v = metricas[r.metrica];
    switch (r.tipo){
      case 'suma':
        puntos = Number(v) || 0;
        break;
      case 'multiplica': {
        puntos = (Number(v) || 0) * (r.valor ?? 0);
        if (r.tope != null){
          const limite = Math.abs(r.tope);
          puntos = Math.max(-limite, Math.min(limite, puntos));
        }
        break;
      }
      case 'flag':
        puntos = v ? (r.valor ?? 0) : 0;
        break;
      case 'tiempo':
        puntos = (metricas.segundos != null && metricas.segundos <= (r.umbral ?? Infinity))
          ? (r.valor ?? 0) : 0;
        break;
    }
    puntos = Math.round(puntos);
    if (puntos !== 0) desglose.push({ id: r.id, puntos });
    total += puntos;
  }
  return { total: Math.max(0, total), desglose };
}

/**
 * Máximo alcanzable en un nivel según sus objetivos y reglas (ignora penalizaciones).
 * @param {Object} config — LevelConfig
 * @returns {number}
 */
export function puntuacionMaxima(config){
  const objetivos = (config.objetivos ?? [])
    .filter(o => !o.opcional)
    .reduce((a, o) => a + (o.puntos ?? 0), 0);
  let extra = 0;
  for (const r of config.puntuacion?.reglas ?? []){
    if (r.tipo === 'flag' || r.tipo === 'tiempo') extra += r.valor ?? 0;
    else if (r.tipo === 'multiplica' && (r.valor ?? 0) > 0) extra += r.tope ?? 0;
  }
  return objetivos + extra;
}

/**
 * Calificación de 1 a 3 estrellas según el porcentaje del máximo logrado.
 * @param {Object} config — LevelConfig
 * @param {number} total — puntos obtenidos
 * @returns {1|2|3}
 */
export function estrellasPara(config, total){
  const max = puntuacionMaxima(config);
  if (!max) return 1;
  const p = total / max;
  return p >= 0.9 ? 3 : p >= 0.6 ? 2 : 1;
}