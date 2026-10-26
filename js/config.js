// ═══════════════════════════════════════════════════════════
// config.js — todos los parámetros ajustables en un solo lugar
// ═══════════════════════════════════════════════════════════
export const CONFIG = {
  camara: {
    fov: 75,
    fovSprint: 83,
    nieblaInicio: 14,
    nieblaFin: 68,
  },
  render: {
    pixelRatioMax: 1.75, // bájalo a 1 si tu PC va justa
  },
  jugador: {
    alturaOjos: 1.7,
    radio: 0.45,
    velCaminar: 5.2,
    velCorrer: 9.2,
    aceleracion: 30,
    frenado: 16,
    gravedad: 24,
    fuerzaSalto: 8.2,
    sensibilidad: 0.0022,
    vidaMax: 100,
    resistenciaMax: 100,
    costeCorrer: 26,        // puntos/segundo
    regenResistencia: 30,   // puntos/segundo
    umbralDanoCaida: 13,    // velocidad de impacto a partir de la cual hay daño
    danoZona: 22,           // puntos/segundo dentro de una zona térmica
  },
  arena: { mitad: 60 },
};