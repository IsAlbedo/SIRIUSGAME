// ═══════════════════════════════════════════════════════════
// sistema/ayudaAria.js — ayuda de ARIA dentro de los editores:
// botón para silenciarla y aviso propio tras varios fallos seguidos.
// No consume pistas ni toca su telemetría: solo sugiere pedirlas.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';
import { progreso } from './progreso.js';
import { telemetria } from './telemetria.js';
import { TEXTOS } from '../../datos/textos.js';

const UMBRAL_FALLOS = 3; // ARIA interviene cada 3 fallos seguidos en el mismo sub-reto
const T = TEXTOS.ariaAyuda;

export const vozAriaActiva = () => progreso.preferencia('vozActiva') !== false;

/** Silencia o reactiva la voz de ARIA. Devuelve el estado nuevo (true = activada). */
export function alternarVozAria(){
  progreso.fijarPreferencia('vozActiva', !vozAriaActiva());
  return vozAriaActiva();
}

/**
 * @param {{pantalla:string, botonPista:string, consola:(t:string,c?:string)=>void, subreto:()=>string|undefined}} cfg
 */
export function crearAyudaAria({ pantalla, botonPista, consola, subreto }){
  const fallos = {};
  let intervenciones = 0;

  // botón de voz, junto al de pista
  const btnPista = document.getElementById(botonPista);
  const btnVoz = document.createElement('button');
  btnVoz.type = 'button';
  btnVoz.className = btnPista?.className ?? 'btn btn-sec';
  const pintar = () => {
    btnVoz.textContent = vozAriaActiva() ? T.botonVozOn : T.botonVozOff;
    btnVoz.title = T.botonVozTitulo;
    btnVoz.setAttribute('aria-pressed', String(!vozAriaActiva()));
  };
  btnVoz.addEventListener('click', () => {
    const activa = alternarVozAria();
    consola(activa ? T.vozOn : T.vozOff, 'msg-aria');
  });
  btnPista?.insertAdjacentElement('beforebegin', btnVoz);
  pintar();
  bus.suscribir(EVENTOS.PREFERENCIAS_CAMBIADAS, pintar);

  return {
    /** Llamar cuando el jugador falla (error, respuesta mala o reto incompleto). */
    fallo(){
      if (document.getElementById(pantalla)?.classList.contains('oculto')) return; // editor cerrado
      const id = subreto();
      if (!id) return;
      const n = fallos[id] = (fallos[id] ?? 0) + 1;
      if (n % UMBRAL_FALLOS !== 0) return;
      consola(`🗨 Aria: ${T.frases[intervenciones++ % T.frases.length]}`, 'msg-aria');
      try { telemetria.registrar('aria_intervencion', { subreto: id, fallos: n }); } catch {}
    },
    /** Llamar cuando el sub-reto se supera: reinicia la cuenta. */
    acierto(){
      const id = subreto();
      if (id) fallos[id] = 0;
    },
  };
}