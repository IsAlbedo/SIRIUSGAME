// sistema/logros.js — motor de logros: condiciones declarativas (ver datos/logros.js).
// Se evalúa al completar un nivel, al recoger un registro de Gustaff y al cambiar
// una preferencia (para el nombre del Arquitecto).
import { bus, EVENTOS } from './eventos.js';
import { progreso } from './progreso.js';
import { NIVELES } from '../../datos/niveles.js';
import { LOGROS } from '../../datos/logros.js';

const MS_MISMO_ERROR = 400; // un mismo fallo puede llegar por dos eventos a la vez: se cuenta una vez

export const logros = {
  /** @type {Record<string, number>} errores de código (y fallos de nivel) por nivel en la sesión */
  fallos: {},
  nivelId: null,
  _tFallo: 0,

  iniciar(){
    bus.suscribir(EVENTOS.LEVEL_STARTED, ({ config }) => { this.nivelId = config.id; });
    bus.suscribir(EVENTOS.LEVEL_FAILED, ({ config }) => this._sumarFallo(config?.id, true));
    bus.suscribir(EVENTOS.MOTOR_ERROR, () => this._sumarFallo(this.nivelId));
    bus.suscribir(EVENTOS.CODIGO_INCORRECTO, () => this._sumarFallo(this.nivelId));
    bus.suscribir(EVENTOS.LEVEL_COMPLETED, resultado => this.evaluar({ config: resultado.config, resultado }));
    bus.suscribir(EVENTOS.REGISTRO_RECOGIDO, () => this.evaluar({}));
    bus.suscribir(EVENTOS.PREFERENCIAS_CAMBIADAS, () => this.evaluar({}));
  },

  _sumarFallo(id, directo = false){
    if (!id) return;
    const ahora = Date.now();
    if (!directo && ahora - this._tFallo < MS_MISMO_ERROR) return;
    this._tFallo = ahora;
    this.fallos[id] = (this.fallos[id] ?? 0) + 1;
  },

  /** Otorga todos los logros cuya condición se cumpla con este contexto. */
  evaluar(ctx = {}){
    for (const logro of LOGROS){
      if (progreso.tieneLogro(logro.id)) continue;
      if (this.cumple(logro.condicion, ctx)) progreso.otorgarLogro(logro.id);
    }
  },

  cumple(cond, ctx){
    const nivel = ctx.config?.id;
    switch (cond.tipo){
      case 'nivel':
        return nivel === cond.nivel;
      case 'todosLosNiveles':
        return NIVELES.every(n => progreso.nivelCompletado(n.id));
      case 'nivelEficiente': {
        if (nivel !== cond.nivel) return false;
        const regla = (ctx.resultado?.desglose ?? []).find(d => d.id === cond.regla);
        return !!regla && regla.puntos > 0;
      }
      case 'persistente':
        return !!nivel && (this.fallos[nivel] ?? 0) >= (cond.fallos ?? 3);
      case 'nombre':
        return String(progreso.preferencia('nombreArquitecto') ?? '').trim().length > 0;
      case 'sinPistas':
        return !!nivel && progreso.pistasUsadas(nivel) === 0;
      case 'sinErrores':
        return !!nivel && (this.fallos[nivel] ?? 0) === 0;
      case 'registros':
        return NIVELES.every(n => progreso.tieneRegistro(n.id));
      case 'todasLasEstrellas':
        return NIVELES.every(n => progreso.estrellasDe(n.id) >= 3);
      default:
        return false;
    }
  },
};