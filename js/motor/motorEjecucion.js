// ═══════════════════════════════════════════════════════════
// motor/motorEjecucion.js — runner: bombea el generador, aplica
// límites (pasos / recursión / tiempo) y emite eventos MOTOR_*.
// ═══════════════════════════════════════════════════════════
import { evaluarPrograma } from './interprete.js';
import { analizar } from './analizar.js';
import { ErrorMotor, Categorias } from './errores.js';
import { EVENTOS } from '../sistema/eventos.js';

const dormir = ms => new Promise(r => setTimeout(r, ms));

export class MotorEjecucion {
  /** @param {Object} bus */
  constructor(bus){ this.bus = bus; this.detenerse = false; }

  /**
   * @param {Object} ast
   * @param {Object} api — RegistroAPI
   * @param {{maxPasos:number,maxProfundidad:number,tiempoMaxMs:number}} limites
   * @param {{animado?:boolean, pasoAPaso?:boolean, delayMundo?:number, delayPaso?:number}} [opciones]
   * @returns {Promise<{ok:boolean, error:ErrorMotor|null, pasos:number, ms:number, resultado:any}>}
   */
  async ejecutar(ast, api, limites, opciones = {}){
    const { animado = true, pasoAPaso = animado, delayMundo = 320, delayPaso = 60 } = opciones;
    this.detenerse = false;
    this.bus.emitir(EVENTOS.MOTOR_INICIO, {});

    const semanticos = analizar(ast);
    if (semanticos.length){
      const err = semanticos[0];
      this.bus.emitir(EVENTOS.MOTOR_ERROR, err);
      this.bus.emitir(EVENTOS.CODIGO_INCORRECTO, { categoria: err.categoria });
      this.bus.emitir(EVENTOS.MOTOR_FIN, { ok: false, pasos: 0, ms: 0 });
      return { ok: false, error: err, pasos: 0, ms: 0, resultado: null };
    }

    const ctx = { api, limites };
    const gen = evaluarPrograma(ast, ctx);
    let pasos = 0, resultado = null, error = null, ultimaLinea = 0;
    const t0 = performance.now();

    // Tiempo total que el motor estuvo "dormido" por la animación.
    // No cuenta contra el límite: ese límite es para cálculo, no para la animación.
    let dormido = 0;
    const pausa = async ms => {
      const a = performance.now();
      await dormir(ms);
      dormido += performance.now() - a;
    };

    try {
      for (;;){
        if (this.detenerse) break;
        pasos++;
        if (pasos > limites.maxPasos){
          throw new ErrorMotor(Categorias.INFINITE_LOOP,
            'El programa superó el límite de pasos', ultimaLinea);
        }
        if (performance.now() - t0 - dormido > limites.tiempoMaxMs){
          throw new ErrorMotor(Categorias.RUNTIME, 'Tiempo de ejecución agotado', ultimaLinea);
        }
        const { value, done } = gen.next();
        if (done){ resultado = value; break; }
        if (value?.nodo?.linea) ultimaLinea = value.nodo.linea;
        if (pasoAPaso){
          this.bus.emitir(EVENTOS.MOTOR_PASO, value);
          if (value.tipo === 'mundo'){
            this.bus.emitir(EVENTOS.MOTOR_MUNDO, value.extra);
            if (animado) await pausa(delayMundo);
          } else if (animado && delayPaso) await pausa(delayPaso);
        } else if (value.tipo === 'mundo'){
          this.bus.emitir(EVENTOS.MOTOR_MUNDO, value.extra);
        }
      }
    } catch (e){
      error = e instanceof ErrorMotor
        ? e
        : new ErrorMotor(Categorias.RUNTIME, e?.message ?? 'Error inesperado', ultimaLinea);
    }

    const ms = Math.round(performance.now() - t0 - dormido);
    const ok = !error && !this.detenerse;
    if (error) this.bus.emitir(EVENTOS.MOTOR_ERROR, error);
    this.bus.emitir(EVENTOS.MOTOR_FIN, { ok, pasos, ms, resultado });
    this.bus.emitir(ok ? EVENTOS.CODIGO_CORRECTO : EVENTOS.CODIGO_INCORRECTO,
      { categoria: error?.categoria ?? null });
    return { ok, error, pasos, ms, resultado };
  }

  detener(){ this.detenerse = true; }
}