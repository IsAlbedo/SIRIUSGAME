// ═══════════════════════════════════════════════════════════
// sistema/pistas.js — pistas de Aria desde el HUD (tecla P).
// Cada petición queda registrada en progreso y telemetría.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';
import { estado, Fases, Modos } from './estado.js';
import { progreso } from './progreso.js';
import { dialogos } from './dialogos.js';
import { telemetria } from './telemetria.js';
import { NIVELES } from '../../datos/niveles.js';
import { TEXTOS } from '../../datos/textos.js';

export const pistas = {
  /** @type {import('../hud.js').HUD|null} */ hud: null,

  /** @param {import('../hud.js').HUD} hud */
  iniciar(hud){
    this.hud = hud;
    const btn = document.getElementById('btn-pista');
    btn.textContent = TEXTOS.hud.pedirPista;
    btn.addEventListener('click', () => this.pedir());
  },

  pedir(){
    if (estado.fase !== Fases.NIVEL || estado.modo !== Modos.EXPLORANDO) return;
    const config = NIVELES[estado.nivelActual];
    if (!config) return;
    const lista = dialogos.pistasDe(config.id);
    const usadas = progreso.pistasUsadas(config.id);
    if (usadas >= lista.length){
      this.hud.avisar(TEXTOS.avisos.sinPistas);
      return;
    }
    progreso.incrementarPistas(config.id);
    telemetria.registrar('pista_pedida', { nivel: config.id, indice: usadas });
    bus.emitir(EVENTOS.PISTA_PEDIDA, { nivel: config.id, indice: usadas });
    this.hud.setPistas(usadas + 1, lista.length);
    const valorar = entendida => telemetria.registrar('pista_valorada', { nivel: config.id, indice: usadas, entendida });
    dialogos.abrirNodo({
      id: `pista-${config.id}-${usadas}`, hablante: 'aria', texto: lista[usadas],
      // si la saltan sin elegir, simplemente no hay valoración
      opciones: [
        { texto: TEXTOS.hud.pistaEntendida ?? 'Sí, la entendí', alElegir: () => valorar(true) },
        { texto: TEXTOS.hud.pistaNoEntendida ?? 'No del todo', siguiente: 'pista-no-entendida', alElegir: () => valorar(false) },
      ],
    });
  },
};