// ═══════════════════════════════════════════════════════════
// sistema/progreso.js — PlayerProgress: habilidades desbloqueadas,
// puntuación, logros, pistas y registros, con persistencia en localStorage.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';

const CLAVE = 'adc_progreso_v1';

/** Estado inicial: solo el Escáner de Datos viene de serie. */
const INICIAL = Object.freeze({
  habilidades: ['escaner-datos'],
  nivelesCompletados: [],
  puntuaciones: {},
  logros: [],
  total: 0,
  pistas: {},         // ← añadir
  registros: {},      // ← añadir
  introVista: false,  // ← añadir
  estrellas: {},      // mejor calificación (1–3) por nivel
  // Ajustes del jugador: sobreviven a «Reiniciar progreso».
  preferencias: {
    tema: 'neon',            // neon | terminal | atardecer | alto-contraste
    fuente: 'original',      // original | legible | sistema
    tamano: 'normal',        // chico | normal | grande | muygrande
    vozActiva: true,         // false = ARIA silenciada
    nombreArquitecto: '',    // vacío = «Arquitecto»; no entra a la telemetría
    emblema: 'nucleo',       // icono de la tarjeta del Arquitecto en el HUD
  },
});
const copiaInicial = () => JSON.parse(JSON.stringify(INICIAL));

export const progreso = {
  /** @type {{habilidades:string[], nivelesCompletados:string[], puntuaciones:Object<string,number>, logros:string[], total:number, pistas:Object<string,number>, registros:Object<string,boolean>, introVista:boolean, estrellas:Object<string,number>, preferencias:Object<string,string|boolean>}} */
  datos: copiaInicial(),

  /** Carga desde localStorage (mezclando con el estado inicial). */
  iniciar(){
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE));
      if (guardado && typeof guardado === 'object'){
        this.datos = { ...copiaInicial(), ...guardado };
        // un guardado antiguo o con null no debe dejar objetos/arrays sin definir
        const base = copiaInicial();
        for (const k of Object.keys(base)){
          if (this.datos[k] == null || typeof this.datos[k] !== typeof base[k]
              || Array.isArray(this.datos[k]) !== Array.isArray(base[k])){
            this.datos[k] = base[k];
          }
        }
        // preferencias: conserva las guardadas y rellena las que falten (guardados antiguos)
        const guardadas = guardado.preferencias;
        this.datos.preferencias = {
          ...base.preferencias,
          ...(guardadas && typeof guardadas === 'object' && !Array.isArray(guardadas) ? guardadas : {}),
        };
      }
    } catch { /* datos corruptos: arranca limpio */ }
  },

  guardar(){
    try { localStorage.setItem(CLAVE, JSON.stringify(this.datos)); } catch {}
  },

  /** @param {string} id */
  herramientaDesbloqueada(id){
    return this.datos.habilidades.includes(id);
  },

  /** @param {string} id */
  desbloquearHabilidad(id){
    if (this.datos.habilidades.includes(id)) return;
    this.datos.habilidades.push(id);
    this.guardar();
    bus.emitir(EVENTOS.SKILL_UNLOCKED, { id });
  },

  /** @param {string} id */
  nivelCompletado(id){
    return this.datos.nivelesCompletados.includes(id);
  },

  /** @param {string} id */
  completarNivel(id){
    if (!this.datos.nivelesCompletados.includes(id)){
      this.datos.nivelesCompletados.push(id);
      this.guardar();
    }
  },

  /**
   * Guarda la mejor puntuación del nivel y recalcula el total.
   * @param {string} nivelId @param {number} puntos
   */
  puntuar(nivelId, puntos){
    this.datos.puntuaciones[nivelId] = Math.max(this.datos.puntuaciones[nivelId] ?? 0, puntos);
    this.datos.total = Object.values(this.datos.puntuaciones).reduce((a, b) => a + b, 0);
    this.guardar();
  },

  /** @param {string} id */
  tieneLogro(id){
    return this.datos.logros.includes(id);
  },

  /** @param {string} id */
  otorgarLogro(id){
    if (this.datos.logros.includes(id)) return;
    this.datos.logros.push(id);
    this.guardar();
    bus.emitir(EVENTOS.ACHIEVEMENT_UNLOCKED, { id });
  },

  resetear(){
    const preferencias = this.datos.preferencias; // los ajustes no son progreso
    this.datos = copiaInicial();
    this.datos.preferencias = preferencias;
    this.guardar();
  },

  /** @param {string} clave @returns {string|boolean|undefined} */
  preferencia(clave){ return this.datos.preferencias[clave]; },

  /** @param {string} clave @param {string|boolean} valor */
  fijarPreferencia(clave, valor){
    if (!(clave in INICIAL.preferencias)) return;
    if (this.datos.preferencias[clave] === valor) return;
    this.datos.preferencias[clave] = valor;
    this.guardar();
    bus.emitir(EVENTOS.PREFERENCIAS_CAMBIADAS, { clave, valor });
  },

  restablecerPreferencias(){
    this.datos.preferencias = { ...INICIAL.preferencias };
    this.guardar();
    bus.emitir(EVENTOS.PREFERENCIAS_CAMBIADAS, { clave: null, valor: null });
  },

  marcarIntroVista(){
    if (this.datos.introVista) return;
    this.datos.introVista = true;
    this.guardar();
  },

  /** @param {string} nivelId @returns {number} */
  pistasUsadas(nivelId){ return this.datos.pistas[nivelId] ?? 0; },
  /** @param {string} nivelId */
  incrementarPistas(nivelId){
    this.datos.pistas[nivelId] = this.pistasUsadas(nivelId) + 1;
    this.guardar();
  },

  /** @param {string} nivelId @returns {number} 0 si el nivel no tiene calificación guardada */
  estrellasDe(nivelId){ return this.datos.estrellas[nivelId] ?? 0; },
  /** Guarda la mejor calificación del nivel (nunca baja). @param {string} nivelId @param {number} n */
  registrarEstrellas(nivelId, n){
    if (n <= (this.datos.estrellas[nivelId] ?? 0)) return;
    this.datos.estrellas[nivelId] = n;
    this.guardar();
  },
  /** @returns {number} suma de estrellas de todos los niveles */
  totalEstrellas(){
    return Object.values(this.datos.estrellas).reduce((a, b) => a + b, 0);
  },

  /** @param {string} nivelId @returns {boolean} */
  tieneRegistro(nivelId){ return !!this.datos.registros[nivelId]; },
  /** @param {string} nivelId */
  marcarRegistro(nivelId){
    if (this.tieneRegistro(nivelId)) return;
    this.datos.registros[nivelId] = true;
    this.guardar();
    bus.emitir(EVENTOS.REGISTRO_RECOGIDO, { nivelId });
  },
};