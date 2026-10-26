// ═══════════════════════════════════════════════════════════
// sistema/eventos.js — bus de eventos central.
// Se suscriben: HUD, audio, telemetría, logros, pantallas y main.
// ═══════════════════════════════════════════════════════════

/** @typedef {(payload: any) => void} ManejadorEvento */

class BusEventos {
  constructor(){
    /** @type {Map<string, Set<ManejadorEvento>>} */
    this._suscriptores = new Map();
  }

  /**
   * @param {string} evento
   * @param {ManejadorEvento} manejador
   * @returns {() => void} función para desuscribirse
   */
  suscribir(evento, manejador){
    if (!this._suscriptores.has(evento)) this._suscriptores.set(evento, new Set());
    this._suscriptores.get(evento).add(manejador);
    return () => this._suscriptores.get(evento)?.delete(manejador);
  }

  /**
   * @param {string} evento
   * @param {ManejadorEvento} manejador
   * @returns {() => void}
   */
  unaVez(evento, manejador){
    const off = this.suscribir(evento, p => { off(); manejador(p); });
    return off;
  }

  /**
   * @param {string} evento
   * @param {any} [payload]
   */
  emitir(evento, payload){
    const set = this._suscriptores.get(evento);
    if (!set) return;
    for (const manejador of [...set]) manejador(payload);
  }
}

export const bus = new BusEventos();

/** Nombres canónicos (entre comentarios, la nomenclatura pedida). */
export const EVENTOS = Object.freeze({
  // flujo de juego
  FASE_CAMBIADA: 'fase:cambiada',
  MODO_CAMBIADO: 'modo:cambiado',
  // ciclo de nivel
  LEVEL_STARTED: 'nivel:iniciado',           // levelStarted
  OBJECTIVE_COMPLETED: 'nivel:objetivo',     // objectiveCompleted
  LEVEL_COMPLETED: 'nivel:completado',       // levelCompleted
  LEVEL_FAILED: 'nivel:fallido',             // levelFailed
  // progreso
  SKILL_UNLOCKED: 'progreso:habilidad',
  ACHIEVEMENT_UNLOCKED: 'logro:desbloqueado',
  // jugador
  JUGADOR_DANO: 'jugador:dano',
  JUGADOR_REAPARECE: 'jugador:reaparece',
  // código del estudiante (los emitirá el editor en el futuro)
  CODIGO_CORRECTO: 'codigo:correcto',
  CODIGO_INCORRECTO: 'codigo:incorrecto',
  // UI → flujo (los emiten las pantallas, los consume main.js)
  UI_INICIAR_NIVEL: 'ui:iniciar-nivel',
  UI_SIGUIENTE: 'ui:siguiente',
  UI_REPETIR: 'ui:repetir',
  UI_MENU: 'ui:menu',
  UI_DEBUG: 'ui:debug',
  TELEMETRIA: 'telemetria:evento',
  CINE_TERMINADO: 'cine:terminado',
  DIALOGO_ABIERTO: 'dialogo:abierto',
  DIALOGO_TERMINADO: 'dialogo:terminado',
  PISTA_PEDIDA: 'pista:pedida',
  PREFERENCIAS_CAMBIADAS: 'preferencias:cambiadas',
  REGISTRO_RECOGIDO: 'registro:recogido',
  MOTOR_INICIO: 'motor:inicio', MOTOR_PASO: 'motor:paso', MOTOR_MUNDO: 'motor:mundo',
  MOTOR_ERROR: 'motor:error', MOTOR_FIN: 'motor:fin', EDITOR_CERRADO: 'editor:cerrado',
});