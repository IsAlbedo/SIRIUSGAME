// ═══════════════════════════════════════════════════════════
// sistema/estado.js — máquina de estados del juego.
// Fases (flujo): MENU → (CINE) → INTRO → NIVEL → RESULTADO → CIERRE.
// Modos (input dentro de la fase): EXPLORANDO/LIBRE/DIALOGO/EDITOR/PAUSA.
// `estado.explorando()` sigue siendo lo que lee player.js.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';

/** @readonly @enum {string} */
export const Fases = Object.freeze({
  MENU: 'MENU',
  CINE: 'CINE',
  INTRO: 'INTRO',
  NIVEL: 'NIVEL',
  RESULTADO: 'RESULTADO',
  CIERRE: 'CIERRE',
});

/** @readonly @enum {string} */
export const Modos = Object.freeze({
  EXPLORANDO: 'EXPLORANDO',
  DIALOGO: 'DIALOGO',
  EDITOR: 'EDITOR',
  PAUSA: 'PAUSA',
  LIBRE: 'LIBRE',     // puntero libre (Alt): cursor suelto, mundo activo
});

/** Transiciones de modo (referencia; cambiarModo no las impone). */
const TRANSICIONES_MODO = Object.freeze({
  EXPLORANDO: [Modos.LIBRE, Modos.PAUSA, Modos.DIALOGO, Modos.EDITOR],
  LIBRE:      [Modos.EXPLORANDO, Modos.PAUSA, Modos.DIALOGO, Modos.EDITOR],
  DIALOGO:    [Modos.EXPLORANDO, Modos.EDITOR, Modos.PAUSA],
  EDITOR:     [Modos.EXPLORANDO, Modos.DIALOGO, Modos.PAUSA],
  PAUSA:      [Modos.EXPLORANDO],
});

/** @type {Record<string, string[]>} */
const TRANSICIONES_FASE = Object.freeze({
  MENU:      [Fases.CINE, Fases.INTRO],
  CINE:      [Fases.INTRO, Fases.MENU],
  INTRO:     [Fases.NIVEL, Fases.MENU],
  NIVEL:     [Fases.INTRO, Fases.RESULTADO, Fases.MENU],
  RESULTADO: [Fases.INTRO, Fases.NIVEL, Fases.CIERRE, Fases.MENU],
  CIERRE:    [Fases.MENU],
});

export const estado = {
  /** @type {string} */ fase: Fases.MENU,
  /** @type {string} */ modo: Modos.PAUSA,
  /** @type {number} índice del nivel actual (0-based); -1 si no hay */
  nivelActual: -1,

  /**
   * @param {string} nueva
   * @param {number} [nivelIndice] — fija estado.nivelActual si se pasa
   * @returns {boolean}
   */
  cambiarFase(nueva, nivelIndice){
    if (nueva === this.fase) return true;
    if (!TRANSICIONES_FASE[this.fase]?.includes(nueva)){
      console.warn(`[estado] Transición rechazada: ${this.fase} → ${nueva}`);
      return false;
    }
    const anterior = this.fase;
    this.fase = nueva;
    this.modo = Modos.PAUSA;
    if (typeof nivelIndice === 'number') this.nivelActual = nivelIndice;
    bus.emitir(EVENTOS.FASE_CAMBIADA, { anterior, actual: nueva, nivel: this.nivelActual });
    return true;
  },

  /**
   * @param {string} nuevo — uno de Modos
   * @returns {boolean}
   */
  cambiarModo(nuevo){
    if (!Object.values(Modos).includes(nuevo)) return false;
    if (nuevo === this.modo) return true;
    const anterior = this.modo;
    this.modo = nuevo;
    bus.emitir(EVENTOS.MODO_CAMBIADO, { anterior, actual: nuevo });
    return true;
  },

  /** ¿El jugador puede moverse? (lo lee player.js sin cambios) */
  explorando(){
    return this.fase === Fases.NIVEL && this.modo === Modos.EXPLORANDO;
  },

  /** ¿El mundo debe seguir actualizándose? (incluye LIBRE) */
  mundoActivo(){
    return this.fase === Fases.NIVEL &&
           (this.modo === Modos.EXPLORANDO || this.modo === Modos.LIBRE);
  },

  /** ¿El cursor está capturado? (solo EXPLORANDO) */
  cursorCapturado(){
    return this.modo === Modos.EXPLORANDO;
  },
};