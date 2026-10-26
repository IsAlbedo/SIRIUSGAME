// ═══════════════════════════════════════════════════════════
// sistema/audio.js — feedback sonoro con WebAudio (sin assets).
// La música por pista (LevelConfig.musica) está pendiente.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';

export const audio = {
  /** @type {AudioContext|null} */ ctx: null,
  volumen: 0.4,

  /** Debe llamarse tras un gesto del usuario (clic / pointer lock). */
  asegurar(){
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {}
  },

  /**
   * @param {number} freq @param {number} [dur] @param {OscillatorType} [tipo]
   * @param {number} [vol] @param {number} [retraso] segundos
   */
  tono(freq, dur = .12, tipo = 'sine', vol = this.volumen, retraso = 0){
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + retraso;
    const osc = this.ctx.createOscillator();
    const gan = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = freq;
    gan.gain.setValueAtTime(0.0001, t0);
    gan.gain.linearRampToValueAtTime(vol, t0 + .012);
    gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gan).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + .05);
  },

  /** @param {'exito'|'error'|'logro'|'nivel'|'fallo'} nombre */
  feedback(nombre){
    this.asegurar();
    if (!this.ctx) return;
    switch (nombre){
      case 'exito':
        this.tono(660, .1, 'triangle');
        this.tono(880, .16, 'triangle', this.volumen, .1);
        break;
      case 'error':
        this.tono(180, .25, 'sawtooth', this.volumen * .6);
        break;
      case 'logro':
        [523, 659, 784, 1047].forEach((f, i) => this.tono(f, .14, 'triangle', this.volumen, i * .09));
        break;
      case 'nivel':
        [392, 523, 659].forEach((f, i) => this.tono(f, .2, 'sine', this.volumen, i * .12));
        break;
      case 'fallo':
        this.tono(220, .3, 'sawtooth', this.volumen * .5);
        this.tono(140, .4, 'sawtooth', this.volumen * .5, .18);
        break;
    }
  },

  iniciarSuscripciones(){
    bus.suscribir(EVENTOS.CODIGO_CORRECTO, () => this.feedback('exito'));
    bus.suscribir(EVENTOS.CODIGO_INCORRECTO, () => this.feedback('error'));
    bus.suscribir(EVENTOS.ACHIEVEMENT_UNLOCKED, () => this.feedback('logro'));
    bus.suscribir(EVENTOS.SKILL_UNLOCKED, () => this.feedback('exito'));
    bus.suscribir(EVENTOS.LEVEL_COMPLETED, () => this.feedback('nivel'));
    bus.suscribir(EVENTOS.LEVEL_FAILED, () => this.feedback('fallo'));
  },
};