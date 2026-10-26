// ═══════════════════════════════════════════════════════════
// datos/plaza.js — LevelConfig de la Plaza de Cristales.
// NO es un nivel: no está en NIVELES, no tiene objetivos, no suma
// puntos ni estrellas y no entra en la telemetría. Es el espacio
// donde se ve el progreso: un cristal por sector y el Monumento central.
// ═══════════════════════════════════════════════════════════
import { NIVELES } from './niveles.js';

/** @type {import('./niveles.js').LevelConfig} */
export const PLAZA = Object.freeze({
  id: 'plaza',
  numero: '★',
  titulo: 'Plaza de Cristales',
  sector: 'Plaza de la Reconstrucción',
  zona: { escena: 'plaza', spawn: [0, 1.7, 17] },
  paleta: {
    primario: '#ffd27a', secundario: '#5ff0e0',
    cielo: '#0a1230', horizonte: '#e08a52', niebla: '#3a2a4a',
    luzSol: '#ffd9a0', ambiente: '#6a7ab0',
  },
  musica: { pista: 'audio/nivel5-nucleo.ogg', volumen: 0.5 },
  contexto:
    'Cada sector que restauras enciende un cristal en esta plaza. Acércate a uno y pulsa E ' +
    'para repasar lo que aprendiste. El Monumento central solo despierta con todas las estrellas.',
  herramientas: NIVELES[NIVELES.length - 1].herramientas, // se muestran las que ya tienes
  objetivos: [],
  restricciones: { sinTiempoLimite: true, intentosMaximos: 0 },
  puntuacion: { base: 0, bonoEficiencia: 0, bonoReutilizacion: 0, bonoHerencia: 0, bonoPolimorfismo: 0, bonoTiempo: 0, reglas: [] },
  logros: [],
});