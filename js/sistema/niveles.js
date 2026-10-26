// ═══════════════════════════════════════════════════════════
// sistema/niveles.js — LevelManager:
// carga un LevelConfig, prepara la zona (paleta → luces/niebla/cielo),
// bloquea herramientas no desbloqueadas y emite levelStarted,
// objectiveCompleted, levelCompleted y levelFailed.
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { crearMundo } from '../world.js';
import { bus, EVENTOS } from './eventos.js';
import { estado, Fases } from './estado.js';
import { HERRAMIENTAS } from '../../datos/herramientas.js';
import { calcularPuntuacion, estrellasPara } from './puntuacion.js';
import { crearSectorAlfa } from '../mundo/sectorAlfa.js';
import { crearTaller } from '../mundo/tallerConstruccion.js';
import { crearCiudad } from '../mundo/moduloCiudadania.js';
import { crearAcademia } from '../mundo/academiaEspecializacion.js';
import { crearNucleo } from '../mundo/nucleoGobierno.js';
import { crearPlaza } from '../mundo/plazaCristales.js';

/** 
 * Libera geometrías, materiales y texturas de un Object3D y sus hijos.
 * @param {Object} raiz
 */
function liberarRecursos(raiz){
  raiz.traverse(nodo => {
    if (nodo.geometry) nodo.geometry.dispose();
    const materiales = Array.isArray(nodo.material)
      ? nodo.material
      : nodo.material ? [nodo.material] : [];
    for (const mat of materiales){
      for (const clave of Object.keys(mat)){
        const valor = mat[clave];
        if (valor && valor.isTexture) valor.dispose();
      }
      mat.dispose();
    }
  });
}

export class LevelManager {
  /**
   * @param {Object} escena — THREE.Scene creada en main.js
   * @param {number} anisotropia
   * @param {typeof import('./progreso.js').progreso} progreso
   */
  constructor(escena, anisotropia, progreso){
    this.escena = escena;
    this.anisotropia = anisotropia;
    this.progreso = progreso;
    /** @type {Object|null} mundo activo {colisionadores, zonasDano, update} */
    this.mundo = null;
    /** @type {import('../../datos/niveles.js').LevelConfig|null} */
    this.defActual = null;
    /** @type {Set<string>} */ this.objetivosPendientes = new Set();
    /** @type {number} */ this._inicioNivel = 0;
    /** @type {number} */ this._fallos = 0;
    /** @type {Record<string, number|boolean>} métricas acumuladas de los objetivos */
    this._metricas = {};
  }

  /**
   * Carga un LevelConfig: construye la zona, aplica paleta, evalúa
   * herramientas y emite LEVEL_STARTED (levelStarted).
   * @param {import('../../datos/niveles.js').LevelConfig} config
   * @returns {Object} el mundo construido
   */
  cargar(config){
    if (this.defActual?.id === config.id && this.mundo
        && this.objetivosPendientes.size === config.objetivos.length && this._fallos === 0){
      // ya cargado y sin tocar: solo refrescar paleta y reenviar LEVEL_STARTED
      this.aplicarPaleta(config.paleta);
      bus.emitir(EVENTOS.LEVEL_STARTED, {
        config, mundo: this.mundo,
        herramientas: this.prepararHerramientas(config),
      });
      this.reiniciarCronometro();
      return this.mundo;
    }
    this.descargar();
    const constructor = LevelManager.CONSTRUCTORES[config.zona.escena];
    if (!constructor){
      console.warn(`[niveles] Escena «${config.zona.escena}» sin construir: se reutiliza el Sector Alfa.`);
    }
    const construir = constructor ?? LevelManager.CONSTRUCTORES.alfa;
    this.mundo = construir(this.escena, this.anisotropia);
    // si el constructor del nivel no creó luces, se añade una iluminación base con la paleta del nivel
    let hayHemi = false, hayDir = false;
    this.escena.traverse(n => { if (n.isHemisphereLight) hayHemi = true; if (n.isDirectionalLight) hayDir = true; });
    if (!hayHemi) this.escena.add(new THREE.HemisphereLight(config.paleta.ambiente, '#1a1a22', 1.5));
    if (!hayDir){
      const sol = new THREE.DirectionalLight(config.paleta.luzSol, 2.2);
      sol.position.set(14, 26, 12);
      this.escena.add(sol);
    }
    this.defActual = config;
    this.objetivosPendientes = new Set(config.objetivos.map(o => o.id));
    this._fallos = 0;
    this._metricas = {};
    this._inicioNivel = Date.now();
    this.aplicarPaleta(config.paleta);
    const herramientas = this.prepararHerramientas(config);
    bus.emitir(EVENTOS.LEVEL_STARTED, { config, mundo: this.mundo, herramientas });
    return this.mundo;
  }

  /**
   * Reconstruye el nivel en curso desde cero: mundo, sub-retos, objetivos pendientes,
   * fallos y cronómetro. Descarga antes para que cargar() no tome el atajo de
   * «ya cargado y sin tocar», que dejaría el mundo como estaba.
   * @returns {Object|null} el mundo nuevo, o null si no hay nivel cargado
   */
  reiniciar(){
    const config = this.defActual;
    if (!config) return null;
    this.descargar();
    return this.cargar(config);
  }

  /** Reinicia el cronómetro (p. ej. al pasar de INTRO a NIVEL). */
  reiniciarCronometro(){
    this._inicioNivel = Date.now();
  }

  /**
   * Herramientas del nivel con su estado de bloqueo según PlayerProgress.
   * @param {import('../../datos/niveles.js').LevelConfig} config
   * @returns {{def: Object, desbloqueada: boolean}[]}
   */
  prepararHerramientas(config){
    return config.herramientas
      .map(id => HERRAMIENTAS.find(h => h.id === id))
      .filter(Boolean)
      .map(def => ({ def, desbloqueada: this.progreso.herramientaDesbloqueada(def.id) }));
  }

  /**
   * Aplica la paleta del nivel mutando el mundo existente:
   * niebla, hemisférica, direccional, cielo (shader) y franjas de muros.
   * Además fija el acento del HUD vía variables CSS.
   * @param {import('../../datos/niveles.js').PaletaNivel} p
   */
  aplicarPaleta(p){
    if (this.escena.fog) this.escena.fog.color.set(p.niebla);
    this.escena.traverse(nodo => {
      if (nodo.isHemisphereLight) nodo.color.set(p.ambiente);
      if (nodo.isDirectionalLight) nodo.color.set(p.luzSol);
      if (nodo.material?.uniforms?.uArriba){
        nodo.material.uniforms.uArriba.value.set(p.cielo);
        nodo.material.uniforms.uHorizonte.value.set(p.horizonte);
      }
      const m = nodo.material;
      if (m?.isMeshBasicMaterial && m.fog !== false){
        if (m.color.getHexString() === 'ffb454') m.userData.esFranja = true;
        if (m.userData.esFranja) m.color.set(p.secundario);
      }
    });
    document.documentElement.style.setProperty('--acento-nivel', p.primario);
    document.documentElement.style.setProperty('--acento-nivel-2', p.secundario);
  }

  /**
   * Marca un objetivo como hecho y emite OBJECTIVE_COMPLETED.
   * Acumula las métricas que reporte el objetivo (extra.metricas), de modo que
   * no se pierdan si el último objetivo en cerrarse es otro.
   * Si no quedan objetivos, dispara completarNivel(extra).
   * @param {string} idObjetivo
   * @param {{puntos?: number, desglose?: Object, metricas?: Object}} [extra]
   * @returns {boolean}
   */
  completarObjetivo(idObjetivo, extra){
    if (!this.defActual || !this.objetivosPendientes.has(idObjetivo)) return false;
    this.objetivosPendientes.delete(idObjetivo);
    if (extra?.metricas) this._metricas = { ...this._metricas, ...extra.metricas };
    const objetivo = this.defActual.objetivos.find(o => o.id === idObjetivo);
    bus.emitir(EVENTOS.OBJECTIVE_COMPLETED, {
      config: this.defActual, objetivo, restantes: this.objetivosPendientes.size,
    });
    if (this.objetivosPendientes.size === 0) this.completarNivel(extra);
    return true;
  }

  /**
   * Emite LEVEL_COMPLETED (levelCompleted) y pasa a RESULTADO.
   * La puntuación sale de config.puntuacion.reglas aplicadas a las métricas
   * que reporta el mundo; extra.puntos / extra.desglose la sobrescriben.
   * @param {{puntos?: number, desglose?: Object, metricas?: Object}} [extra]
   */
  completarNivel(extra = {}){
    if (!this.defActual) return;
    const config = this.defActual;
    const segundos = Math.round((Date.now() - this._inicioNivel) / 1000);
    const metricas = { segundos, ...this._metricas, ...(extra.metricas ?? {}), completado: true };
    const calc = calcularPuntuacion(config, metricas);
    const resultado = {
      config,
      completado: true,
      segundos,
      puntos: extra.puntos ?? calc.total,
      desglose: extra.desglose ?? calc.desglose,
      metricas,
      fallos: this._fallos,
    };
    resultado.estrellas = estrellasPara(config, resultado.puntos);
    this.progreso.puntuar(config.id, resultado.puntos);
    this.progreso.registrarEstrellas(config.id, resultado.estrellas);
    this.progreso.completarNivel(config.id);
    // desbloquea la herramienta cuya `desbloqueadaEn` apunta a este nivel
    for (const h of HERRAMIENTAS){
      if (h.desbloqueadaEn === config.id) this.progreso.desbloquearHabilidad(h.id);
    }
    estado.cambiarFase(Fases.RESULTADO);
    try { document.exitPointerLock(); } catch {}
    bus.emitir(EVENTOS.LEVEL_COMPLETED, resultado);
  }

  /**
   * Emite LEVEL_FAILED (levelFailed) y pasa a RESULTADO.
   * @param {string} [motivo]
   */
  fallarNivel(motivo = 'desconocido'){
    if (!this.defActual) return;
    this._fallos++;
    estado.cambiarFase(Fases.RESULTADO);
    try { document.exitPointerLock(); } catch {}
    bus.emitir(EVENTOS.LEVEL_FAILED, { config: this.defActual, motivo, fallos: this._fallos });
  }

  /** Descarga el nivel actual liberando recursos GPU. */
  descargar(){
    if (!this.mundo) return;
    liberarRecursos(this.escena);
    this.escena.clear();
    this.mundo = null;
    this.defActual = null;
    this.objetivosPendientes = new Set();
    this._metricas = {};
  }
}

/**
 * Registro de constructores de escena.
 * Un nivel cuya escena no esté registrada reutiliza el Sector Alfa (`alfa`).
 */
LevelManager.CONSTRUCTORES = {
  alfa: crearMundo,
  nivel1: crearSectorAlfa,
  taller: crearTaller,
  ciudad: crearCiudad,
  academia: crearAcademia,
  nucleo: crearNucleo,
  plaza: crearPlaza,
};