// ═══════════════════════════════════════════════════════════
// mundo/efectosRobot.js — vida del robot del Sector Alfa:
//  · AVANZA: rebota con cada paso, se inclina hacia delante y la antena se bambolea
//  · ÉXITO:  dos saltitos de alegría
//  · ERROR:  se infla y tiembla en rojo → EXPLOTA en piezas → se RECONSTRUYE solo
// Presupuesto: +10 tetraedros (40 tris) y un anillo de 16 segmentos (32 tris).
// No toca la lógica: la posición/rumbo del robot los sigue llevando sectorAlfa.js.
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';

const T_GLITCH = .45;   // s: se infla y tiembla antes de explotar
const T_AUSENTE = 1.1;  // s: robot ausente, vuelan las piezas
const T_RECON = .65;    // s: se reconstruye
const T_CELEB = .9;     // s: saltitos de alegría
const N_PIEZAS = 10;
const ESC_MIN = .0001;  // escala 0 exacta daría matrices no invertibles

const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/**
 * @param {THREE.Scene} escena
 * @param {THREE.Group} robot            el grupo del robot (geoRobot)
 * @param {{bola?:THREE.Object3D}} partes  bola de la antena (opcional)
 * @param {{chispas?:(pos:THREE.Vector3, color:string)=>void, frente?:number, colores?:string[]}} extras
 *    chispas: explosión de partículas que ya tenga el nivel (fx.explotar)
 *    frente:  hacia dónde mira el robot en su eje z local: -1 (nivel 1, por defecto) o 1 (nivel 2)
 *    colores: 4 colores de las piezas al explotar (por defecto, los del robot azul del nivel 1)
 */
export function crearEfectosRobot(escena, robot, { bola = null } = {}, { chispas = null, frente = -1, colores = null } = {}){
  // yaw primero y luego inclinación LOCAL (con el orden por defecto se inclinaría sobre el eje del mundo)
  robot.rotation.order = 'YXZ';

  const grupo = new THREE.Group();
  escena.add(grupo);

  // piezas: tetraedros con los colores del robot + naranja de fuego
  const geoPieza = new THREE.TetrahedronGeometry(.16);
  const matsPieza = (colores ?? ['#dfe7ff', '#2a3270', '#8fb7ff', '#ff9c3f']).map(c => new THREE.MeshBasicMaterial({ color: c }));
  const piezas = [];
  for (let i = 0; i < N_PIEZAS; i++){
    const m = new THREE.Mesh(geoPieza, matsPieza[i % matsPieza.length]);
    m.visible = false;
    grupo.add(m);
    piezas.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() });
  }

  // anillo cian que se cierra sobre el robot al reconstruirse
  const anillo = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 16),
    new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  anillo.rotation.x = -Math.PI / 2;
  anillo.visible = false;
  grupo.add(anillo);

  // destello rojo (la luz existe desde el principio con intensidad 0: no recompila shaders al explotar)
  const luz = new THREE.PointLight('#ff3b3b', 0, 9, 2);
  grupo.add(luz);

  const bolaZ = bola ? bola.position.z : 0;
  let fase = 'normal';  // normal | glitch | ausente | recon
  let tFase = 0, celeb = -1, k = 0;

  function boom(){
    fase = 'ausente'; tFase = 0;
    const p = robot.position;
    luz.position.set(p.x, 1, p.z);
    luz.intensity = 14;
    piezas.forEach(o => {
      o.m.visible = true;
      o.m.scale.setScalar(1);
      o.m.position.set(p.x, .6 + Math.random() * .5, p.z);
      const a = Math.random() * Math.PI * 2, f = 1.5 + Math.random() * 2.5;
      o.v.set(Math.cos(a) * f, 3 + Math.random() * 3, Math.sin(a) * f);
      o.w.set((Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 14);
    });
    chispas?.(new THREE.Vector3(p.x, .9, p.z), '#ff5d5d');
  }

  function ocultarPiezas(){ piezas.forEach(o => { o.m.visible = false; }); }

  return {
    /** El robot se rompe y se reconstruye solo (ignora llamadas mientras ya está roto). */
    explotar(){
      if (fase === 'glitch' || fase === 'ausente') return;
      fase = 'glitch'; tFase = 0;
      anillo.visible = false;
    },
    /** Saltitos de alegría (no si está roto). */
    celebrar(){ if (fase === 'normal') celeb = 0; },
    /** Vuelve todo a normal de inmediato (nuevo intento / nuevo sub-reto). */
    reiniciar(){
      fase = 'normal'; tFase = 0; celeb = -1;
      ocultarPiezas();
      anillo.visible = false;
      luz.intensity = 0;
      robot.scale.setScalar(1);
      robot.position.y = 0;
      robot.rotation.x = 0;
    },
    get roto(){ return fase !== 'normal'; },

    /** Llamar cada frame DESPUÉS de mover/girar el robot hacia su casilla. */
    update(t, dt, enMarcha){
      k += ((enMarcha ? 1 : 0) - k) * Math.min(1, dt * 8);
      let y = 0, esc = 1, inclina = 0;

      if (fase === 'normal' || fase === 'recon'){
        if (fase === 'normal'){
          // avanza: rebote, inclinación hacia delante y antena bamboleando
          y = Math.abs(Math.sin(t * 14)) * .07 * k;
          inclina = .1 * frente * k; // frente -1: nariz abajo = x negativo; frente +1: x positivo
          if (bola) bola.position.z = bolaZ + Math.sin(t * 14) * .04 * k;
          if (celeb >= 0){
            celeb += dt;
            const p = celeb / T_CELEB;
            if (p >= 1) celeb = -1; else y += Math.abs(Math.sin(p * Math.PI * 2)) * .5;
          }
        }
      }

      if (fase === 'glitch'){
        tFase += dt;
        const p = Math.min(1, tFase / T_GLITCH);
        esc = 1 + Math.sin(tFase * 40) * .06 + p * .25;
        robot.position.x += (Math.random() - .5) * .12 * p;
        robot.position.z += (Math.random() - .5) * .12 * p;
        luz.position.set(robot.position.x, 1, robot.position.z);
        luz.intensity = 2 + p * 8;
        if (p >= 1){ boom(); esc = ESC_MIN; }
      } else if (fase === 'ausente'){
        tFase += dt;
        esc = ESC_MIN;
        luz.intensity = 14 * Math.exp(-tFase * 5);
        const fin = Math.min(1, Math.max(0, (T_AUSENTE - tFase) / .35)); // se encogen al final
        for (const o of piezas){
          o.v.y -= 9 * dt;
          o.m.position.addScaledVector(o.v, dt);
          if (o.m.position.y < .08){ o.m.position.y = .08; o.v.y *= -.45; o.v.x *= .7; o.v.z *= .7; }
          o.m.rotation.x += o.w.x * dt; o.m.rotation.y += o.w.y * dt; o.m.rotation.z += o.w.z * dt;
          o.m.scale.setScalar(Math.max(ESC_MIN, fin));
        }
        if (tFase >= T_AUSENTE){
          fase = 'recon'; tFase = 0;
          ocultarPiezas();
          luz.intensity = 0;
          anillo.visible = true;
        }
      } else if (fase === 'recon'){
        tFase += dt;
        const p = Math.min(1, tFase / T_RECON);
        esc = Math.max(ESC_MIN, easeOutBack(p));
        anillo.position.set(robot.position.x, .05, robot.position.z);
        anillo.scale.setScalar(2.2 * (1 - p) + .3);
        anillo.material.opacity = .85 * p;
        if (p >= 1){ fase = 'normal'; tFase = 0; anillo.visible = false; }
      }

      robot.scale.setScalar(esc);
      robot.position.y = y;
      robot.rotation.x = inclina;
    },

    dispose(){
      escena.remove(grupo);
      geoPieza.dispose();
      matsPieza.forEach(m => m.dispose());
      anillo.geometry.dispose(); anillo.material.dispose();
    },
  };
}