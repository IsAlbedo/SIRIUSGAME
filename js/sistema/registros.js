// ═══════════════════════════════════════════════════════════
// sistema/registros.js — Registros de Gustaff: coleccionable 3D
// por nivel (se añade a la escena sin tocar world.js). Al recogerlo
// abre su mini-diálogo y queda guardado en PlayerProgress.
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bus, EVENTOS } from './eventos.js';
import { estado } from './estado.js';
import { progreso } from './progreso.js';
import { dialogos } from './dialogos.js';

/** Posición del registro por nivel (XZ, dentro de la arena). */
const POSICIONES = Object.freeze({
  'nivel-1': [14, -10],
  'nivel-2': [-16, -18],
  'nivel-3': [20, 14],
  'nivel-4': [-12, 20],
  'nivel-5': [8, -24],
});
const RADIO = 2.4;

export const registros = {
  grupo: null,
  malla: null,
  nivelId: null,
  numero: '1',
  recogido: true,
  cerca: false,

  /** Construye el coleccionable una sola vez. */
  iniciar(){
    this.grupo = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: 1.2,
      roughness: .3, flatShading: true,
    });
    this.malla = new THREE.Mesh(new THREE.OctahedronGeometry(.45), mat);
    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(.8, .03, 8, 32),
      new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .5 })
    );
    anillo.rotation.x = Math.PI / 2;
    this.grupo.add(this.malla, anillo);
    this.grupo.visible = false;
  },

  /** Prepara el registro del nivel recién cargado. @param {string} nivelId */
  prepararParaNivel(nivelId){
    if (!(nivelId in POSICIONES)){
      // p. ej. la Plaza de Cristales: no hay registro que recoger
      this.nivelId = nivelId;
      this.recogido = true;
      this.cerca = false;
      this.grupo.visible = false;
      return;
    }
    this.nivelId = nivelId;
    this.numero = nivelId.split('-')[1] ?? '1';
    this.recogido = progreso.tieneRegistro(nivelId);
    const [x, z] = POSICIONES[nivelId] ?? [10, -10];
    this.grupo.position.set(x, 1.3, z);
    this.grupo.visible = true;
    this.cerca = false;
    // ya recogido: se muestra como fantasma tenue, sin interacción
    this.malla.material.emissiveIntensity = this.recogido ? .25 : 1.2;
    this.grupo.children[1].material.opacity = this.recogido ? .15 : .5;
  },

  /** @param {number} t @param {number} dt @param {THREE.Vector3} posJugador */
  update(t, dt, posJugador){
    if (!this.grupo?.visible) return;
    this.malla.rotation.y += dt * 1.2;
    this.grupo.children[1].rotation.z += dt * .8;
    this.malla.position.y = Math.sin(t * 2) * .15;
    if (this.recogido){ this.cerca = false; return; }
    const d = Math.hypot(
      posJugador.x - this.grupo.position.x,
      posJugador.z - this.grupo.position.z
    );
    this.cerca = d < RADIO && estado.explorando();
  },

  puedeRecoger(){ return this.cerca && !this.recogido && estado.explorando(); },

  recoger(){
    if (!this.puedeRecoger()) return;
    this.recogido = true;
    this.cerca = false;
    this.malla.material.emissiveIntensity = .25;
    this.grupo.children[1].material.opacity = .15;
    progreso.marcarRegistro(this.nivelId); // emite REGISTRO_RECOGIDO
    dialogos.abrirPorId(`gustaff-${this.numero}`);
  },
};