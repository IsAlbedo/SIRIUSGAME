// ═══════════════════════════════════════════════════════════
// sistema/cine.js — cinemática de introducción.
// No toca la fase al terminar: emite CINE_TERMINADO y main decide.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';
import { progreso } from './progreso.js';
import { dialogos } from './dialogos.js';

const SECUENCIA = ['cine-01', 'cine-02', 'cine-03', 'cine-04'];

export const cine = {
  activo: false,
 
  iniciar(){
    if (this.activo) return;
    this.activo = true;
    const el = document.getElementById('cine');
    el.classList.remove('oculto', 'revelado');
    this._paso(0);
  },

  _paso(i){
    if (!this.activo) return;
    const id = SECUENCIA[i];
    dialogos.abrirPorId(id, () => {
      if (!this.activo) return;
      if (id === 'cine-03'){
        document.getElementById('cine').classList.add('revelado');
      }
      if (i < SECUENCIA.length - 1) this._paso(i + 1);
      else this.finalizar();
    });
  },

  finalizar(){
    this.activo = false;
    progreso.marcarIntroVista();
    document.getElementById('cine').classList.add('oculto');
    bus.emitir(EVENTOS.CINE_TERMINADO, {});
  },

  /** Para debug o para saltar la cinemática. */
  cancelar(){
    if (!this.activo) return;
    this.finalizar();
  },
};