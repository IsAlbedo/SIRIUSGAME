// ═══════════════════════════════════════════════════════════
// mundo/tallerConstruccion.js — Nivel 2: robot constructor.
// Plano fantasma → estructuras reales; verifica estado al ejecutar.
// Registro en LevelManager.CONSTRUCTORES como 'taller'.
//
// El taller ahora tiene vida y cada sub-reto se refleja en él:
//  Siempre   → obra delimitada con franja de seguridad, conos, casetas, cajas, barriles,
//              postes de luz, tablero del sub-reto y RECETARIO que cambia por reto
//  SR1       → recetario: construirPared()
//  SR2       → dos medidores (largo y alto) junto al recetario
//  SR3-SR4   → el DEPÓSITO se enciende en verde cuando aceptó tu pedido
//  SR4       → cúpula de cristal: el ÁMBITO de preparar()
//  SR5       → la GRÚA muestra su lista compartida con una caja por material
//  SR6       → rótulos de las 3 filas (vivienda, almacén, centro de comunicación)
//  JEFE      → glitch de Eclipse; se apaga al refactorizar bien
//
// Mejoras visuales:
//  · ROBOT CONSTRUCTOR: orugas con ruedas, cabina con visor y ojos, baliza naranja,
//    tolva trasera con bloques y brazo grúa que baja y SUELTA cada pieza al construir
//  · PLATAFORMA DE OBRA por sub-reto: casillas en tablero, borde luminoso y vallas con
//    postes, del tamaño del plano (como el laberinto del nivel 1); la vista aérea la encuadra
//  · los bloques tienen la tapa clara y los lados más oscuros
//  · anillo pulsante en la casilla actual + losa de concreto en la zona de obra
//  · las piezas aparecen cuando el brazo las suelta, "crecen" con rebote y sueltan un
//    destello (verde = ok, rojo = no)
//  · los fantasmas del plano respiran para distinguir lo que falta construir
//  · capa de brillo: estrellas, chispas, neón, halos, escáner, baliza y luces de color
//  · FONDO (crearFondo, más abajo en este mismo archivo): cielo con eclipse y aurora, ciudad lejana con grúas,
//    muros con paneles y carteles, y circuito impreso en el suelo
//  · PARALLAX LEVE: 3 capas de estrellas que giran a distinta velocidad y siguen un poco al jugador,
//    y la ciudad lejana se mece despacio
//  · SUELO DE HORMIGÓN: grano, juntas de losa, manchas, grietas y gravilla (textura + relieve bump)
//    y ~24 losas levantadas e inclinadas en las zonas libres (relieve real)
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bus, EVENTOS } from '../sistema/eventos.js';
import { ErrorMotor } from '../motor/errores.js';
import { RegistroAPI } from '../motor/apiMundo.js';
import { MotorEjecucion } from '../motor/motorEjecucion.js';
import { SUBRETOS_NIVEL2 } from '../../datos/subretos-nivel2.js';
import { progreso } from '../sistema/progreso.js';
import { liberarGrupo } from './liberar.js';
import { crearEfectosRobot } from './efectosRobot.js';

const CELDA = 2;
const DIRS = { N: 0, E: 1, S: 2, O: 3 };
const DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/* ══════════ utilidades de sprites ══════════ */

/* Letrero fijo: el ancho se adapta al texto. */
function crearCartel(texto, color = '#5ad08a'){
  const ancho = Math.max(256, texto.length * 14 + 40);
  const c = document.createElement('canvas');
  c.width = ancho; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(13,20,16,.85)'; g.fillRect(0, 0, ancho, 64);
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(2, 2, ancho - 4, 60);
  g.fillStyle = color; g.font = 'bold 22px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, ancho / 2, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(ancho / 80, .8, 1);
  return s;
}

/* Letrero que cambia de texto (canvas fijo de 512 px). */
function crearCartelVivo(){
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(6.4, .8, 1);
  return { canvas, tex, sprite, _ultimo: '' };
}
function pintarCartelVivo(cv, texto, color = '#5ad08a'){
  const key = texto + color;
  if (cv._ultimo === key) return;
  cv._ultimo = key;
  const g = cv.canvas.getContext('2d');
  g.clearRect(0, 0, 512, 64);
  g.fillStyle = 'rgba(13,20,16,.88)'; g.fillRect(0, 0, 512, 64);
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(2, 2, 508, 60);
  g.fillStyle = color; g.font = 'bold 22px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, 256, 34, 490);
  cv.tex.needsUpdate = true;
}

/* Tablero del sub-reto activo. */
function crearTablero(){
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 192;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(7, 2.6, 1);
  return { canvas, tex, sprite };
}
function pintarTablero(tb, sub, indice, total){
  const g = tb.canvas.getContext('2d');
  g.clearRect(0, 0, 512, 192);
  g.fillStyle = 'rgba(13,20,16,.88)'; g.fillRect(6, 6, 500, 180);
  g.strokeStyle = '#5ad08a'; g.lineWidth = 3; g.strokeRect(6, 6, 500, 180);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!sub){
    g.fillStyle = '#5ad08a'; g.font = 'bold 30px monospace';
    g.fillText('TALLER DE', 256, 70);
    g.fillText('CONSTRUCCIÓN', 256, 110);
    g.fillStyle = '#9fd6a8'; g.font = '20px monospace';
    g.fillText('Usa la terminal (E)', 256, 154);
  } else {
    g.fillStyle = '#9fd6a8'; g.font = 'bold 20px monospace';
    g.fillText(sub.esJefe ? 'JEFE FINAL' : `SUB-RETO ${indice + 1} / ${total - 1}`, 256, 34);
    g.fillStyle = '#eafff2'; g.font = 'bold 30px monospace';
    g.fillText(sub.nombre, 256, 88, 470);
    g.fillStyle = '#ffd27a'; g.font = 'bold 24px monospace';
    g.fillText(sub.concepto, 256, 136, 470);
  }
  tb.tex.needsUpdate = true;
}

/* Texto del recetario por sub-reto (índice 0..6; el 6 es el jefe). */
const TEXTO_RECETA = [
  'receta: construirPared()',
  'construirPared(largo, alto)',
  'return largo × alto × 2',
  'ámbito: la var muere al salir',
  'número = copia · lista = compartida',
  'función reutilizada = bonus',
  'fila() × 3 = refactorizar',
];
const COLOR_CAJA = { acero: '#8a9ba8', vidrio: '#7fd8e8', madera: '#a8743c' };

/* Rebote suave (easeOutBack) para la animación de construcción. */
const rebote = k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
const suave = k => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/* ══════════ BRILLO: estrellas, chispas, neón, halos, baliza y luces de color ══════════
   Todo decorativo (no toca colisiones ni lógica). Se crea en crearTaller() y se anima en update(). */
/* Textura radial suave para halos y partículas. */
function texturaGlow(){
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(.35, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function crearBrillo(escena){
  const tex = texturaGlow();
  const grupo = new THREE.Group();
  escena.add(grupo);
  const ADITIVO = THREE.AdditiveBlending;

  /* ── estrellas ── */
  const NE = 300;
  const posE = new Float32Array(NE * 3);
  for (let i = 0; i < NE; i++){
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * .85 + .1);
    const r = 75;
    posE[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    posE[i * 3 + 1] = r * Math.cos(ph);
    posE[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geoE = new THREE.BufferGeometry();
  geoE.setAttribute('position', new THREE.BufferAttribute(posE, 3));
  const matE = new THREE.PointsMaterial({
    size: 1.1, map: tex, color: '#bfe8cf', transparent: true, opacity: .8,
    blending: ADITIVO, depthWrite: false, fog: false,
  });
  const estrellas = new THREE.Points(geoE, matE);
  grupo.add(estrellas);

  /* ── chispas flotantes ── */
  const NC = 140;
  const posC = new Float32Array(NC * 3);
  const colC = new Float32Array(NC * 3);
  const velC = new Float32Array(NC);
  const fasC = new Float32Array(NC);
  const verde = new THREE.Color('#5ad08a'), ambar = new THREE.Color('#ffd27a');
  for (let i = 0; i < NC; i++){
    posC[i * 3]     = (Math.random() - .5) * 24;
    posC[i * 3 + 1] = Math.random() * 7;
    posC[i * 3 + 2] = (Math.random() - .5) * 16;
    velC[i] = .3 + Math.random() * .5;
    fasC[i] = Math.random() * 6.28;
    const c = Math.random() < .6 ? verde : ambar;
    colC[i * 3] = c.r; colC[i * 3 + 1] = c.g; colC[i * 3 + 2] = c.b;
  }
  const geoC = new THREE.BufferGeometry();
  geoC.setAttribute('position', new THREE.BufferAttribute(posC, 3));
  geoC.setAttribute('color', new THREE.BufferAttribute(colC, 3));
  const matC = new THREE.PointsMaterial({
    size: .22, map: tex, vertexColors: true, transparent: true, opacity: .9,
    blending: ADITIVO, depthWrite: false,
  });
  grupo.add(new THREE.Points(geoC, matC));

  /* ── neón en lo alto de los muros ── */
  const matNeon = new THREE.MeshBasicMaterial({ color: '#5ad08a' });
  for (const [x, z, w, d] of [[0, -19.45, 39, .08], [0, 19.45, 39, .08], [-19.45, 0, .08, 39], [19.45, 0, .08, 39]]){
    const n = new THREE.Mesh(new THREE.BoxGeometry(w, .08, d), matNeon);
    n.position.set(x, 3.3, z);
    grupo.add(n);
  }

  /* ── halo de la franja de seguridad ── */
  const matHalo = new THREE.MeshBasicMaterial({
    color: '#ffd27a', transparent: true, opacity: .18, blending: ADITIVO, depthWrite: false,
  });
  for (const [x, z, w, d] of [[0, -8.3, 24.6, .9], [0, 8.3, 24.6, .9], [-12.3, 0, .9, 16.6], [12.3, 0, .9, 16.6]]){
    const h = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matHalo);
    h.rotation.x = -Math.PI / 2;
    h.position.set(x, .02, z);
    grupo.add(h);
  }

  /* ── haz escáner sobre la losa ── */
  const escaner = new THREE.Mesh(new THREE.PlaneGeometry(24.4, .25),
    new THREE.MeshBasicMaterial({ color: '#5fe0ff', transparent: true, opacity: .18, blending: ADITIVO, depthWrite: false }));
  escaner.rotation.x = -Math.PI / 2;
  escaner.position.y = .04;
  grupo.add(escaner);

  /* ── halos en los focos de los postes ── */
  for (const [x, z] of [[-16, -16], [16, -16], [-16, 6], [16, 6]]){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: '#fff4c8', transparent: true, opacity: .85, blending: ADITIVO, depthWrite: false,
    }));
    s.scale.set(3.2, 3.2, 1);
    s.position.set(x, 5.1, z);
    grupo.add(s);
  }

  /* ── baliza naranja sobre la oficina ── */
  const matBaliza = new THREE.MeshBasicMaterial({ color: '#ff8a2a' });
  const baliza = new THREE.Mesh(new THREE.SphereGeometry(.22, 6, 4), matBaliza);
  baliza.position.set(-14.5, 3.0, 13);
  const halBaliza = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: '#ff8a2a', transparent: true, opacity: .9, blending: ADITIVO, depthWrite: false,
  }));
  halBaliza.scale.set(2.6, 2.6, 1);
  halBaliza.position.copy(baliza.position);
  const luzBaliza = new THREE.PointLight('#ff8a2a', 6, 10, 2);
  luzBaliza.position.copy(baliza.position);
  grupo.add(baliza, halBaliza, luzBaliza);

  /* ── luces de color ── */
  const luzCian = new THREE.PointLight('#5fe0ff', 5, 12, 2);
  luzCian.position.set(9, 3, -4);
  const luzAmbar = new THREE.PointLight('#ffb454', 5, 12, 2);
  luzAmbar.position.set(-8, 6, -10);
  grupo.add(luzCian, luzAmbar);

  return {
    update(t, dt){
      // estrellas: giro muy lento (parallax leve)
      estrellas.rotation.y += dt * .006;
      matE.opacity = .65 + Math.sin(t * .7) * .15;

      // chispas
      for (let i = 0; i < NC; i++){
        posC[i * 3 + 1] += velC[i] * dt;
        posC[i * 3] += Math.sin(t * .8 + fasC[i]) * dt * .25;
        if (posC[i * 3 + 1] > 7){
          posC[i * 3 + 1] = 0;
          posC[i * 3]     = (Math.random() - .5) * 24;
          posC[i * 3 + 2] = (Math.random() - .5) * 16;
        }
      }
      geoC.attributes.position.needsUpdate = true;

      // neón y halo pulsando
      matNeon.color.setHSL(.4, .7, .45 + Math.sin(t * 1.5) * .12);
      matHalo.opacity = .12 + Math.sin(t * 2) * .07;

      // escáner: barre la zona de obra de norte a sur
      escaner.position.z = -8 + ((t * 2.5) % 16);

      // baliza parpadeando
      const on = Math.sin(t * 5) > 0;
      matBaliza.color.set(on ? '#ffb060' : '#7a3a10');
      halBaliza.material.opacity = on ? .9 : .15;
      luzBaliza.intensity = on ? 6 : .5;

      // luces de color respirando
      luzCian.intensity = 4 + Math.sin(t * 1.7) * 1.5;
      luzAmbar.intensity = 4 + Math.sin(t * 1.3 + 1) * 1.5;
    },
    dispose(){
      escena.remove(grupo);
      grupo.traverse(o => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      tex.dispose();
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   FONDO DEL NIVEL 2 (todo decorativo; no toca colisiones ni lógica)
   Cielo con eclipse y aurora · ciudad lejana con grúas · muros con paneles
   y carteles · circuito impreso en el suelo. Se activa con USAR_FONDO.
   Hecho con POCOS TRIÁNGULOS (≈ 850): siluetas planas, grúas de líneas,
   geometrías de baja resolución y luces con puntos en vez de mallas.
   ═══════════════════════════════════════════════════════════════════════ */
const USAR_FONDO = true;

const ADITIVO = THREE.AdditiveBlending;
const rnd = (a, b) => a + Math.random() * (b - a);
const VERDE = new THREE.Color('#5ad08a');
const ROJO = new THREE.Color('#ff4d4d');

/* ══════════ utilidades ══════════ */

function lienzo(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function aTextura(c, { repetir = false, color = true } = {}){
  const t = new THREE.CanvasTexture(c);
  if (color && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* Caja sin la cara de abajo (-y), que nunca se ve: 10 triángulos en vez de 12. */
function cajaSinBase(w, h, d){
  const g = new THREE.BoxGeometry(w, h, d);
  const viejo = g.index.array, nuevo = [], grupos = [];
  for (const gr of g.groups){
    if (gr.materialIndex === 3) continue; // cara inferior
    grupos.push({ start: nuevo.length, count: gr.count, materialIndex: gr.materialIndex });
    for (let k = gr.start; k < gr.start + gr.count; k++) nuevo.push(viejo[k]);
  }
  g.setIndex(nuevo);
  g.clearGroups();
  for (const gr of grupos) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
}

/* Halo radial suave (para sprites y puntos aditivos). */
function texturaBrillo(){
  const [c, g] = lienzo(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(.35, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return aTextura(c, { color: false });
}

/* Degradado vertical blanco→transparente (aurora y bruma). */
function texturaDegradado(stops){
  const [c, g] = lienzo(4, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  stops.forEach(([p, a]) => grad.addColorStop(p, `rgba(255,255,255,${a})`));
  g.fillStyle = grad; g.fillRect(0, 0, 4, 128);
  return aTextura(c, { color: false });
}

/* Coloca algo pegado a la cara INTERIOR de un muro. lado: N, S, E u O.
   Los muros del taller están en ±20 con grosor 1 → cara interior en ±19.5. */
function enMuro(lado, pos, sacar){
  switch (lado){
    case 'N': return { x: pos, z: -19.5 + sacar, ry: 0 };
    case 'S': return { x: pos, z: 19.5 - sacar, ry: Math.PI };
    case 'O': return { x: -19.5 + sacar, z: pos, ry: Math.PI / 2 };
    default:  return { x: 19.5 - sacar, z: pos, ry: -Math.PI / 2 }; // E
  }
}

/* Añade las 12 aristas de una caja a una lista de segmentos. */
function pushCaja(pts, w, h, d, cx, cy, cz){
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]){
    pts.push(...v[a], ...v[b]);
  }
}

function geoLineas(pts){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/* ══════════ cielo ══════════ */

function crearCielo(){
  const [c, g] = lienzo(16, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  [[0, '#03070a'], [.25, '#07120f'], [.4, '#0d2a20'], [.47, '#1b5640'],
   [.5, '#2d8460'], [.53, '#10301f'], [1, '#060b08']]
    .forEach(([p, col]) => grad.addColorStop(p, col));
  g.fillStyle = grad; g.fillRect(0, 0, 16, 512);

  const domo = new THREE.Mesh(
    new THREE.SphereGeometry(220, 12, 6),            // 6 franjas: el ecuador cae justo en el horizonte
    new THREE.MeshBasicMaterial({ map: aTextura(c), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  domo.renderOrder = -20;
  return domo;
}

/* ══════════ capas de estrellas con parallax leve (Points: 0 tris) ══════════
   Cada capa gira a su propia velocidad y sigue un poco al jugador:
   la más lejana casi no se mueve y la más cercana se desplaza más. */
function crearCapaEstrellas(brillo, { n, radio, color, opacidad, vel, k }){
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++){
    const th = rnd(0, Math.PI * 2), ph = Math.acos(rnd(.08, .95));
    pos[i * 3]     = radio * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = radio * Math.cos(ph);
    pos[i * 3 + 2] = radio * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.1 * radio / 75, map: brillo, color, transparent: true, opacity: opacidad,
    blending: ADITIVO, depthWrite: false, fog: false,
  }));
  p.frustumCulled = false;
  return { p, vel, k };
}

/* ══════════ eclipse ══════════ */

function crearEclipse(brillo){
  const grupo = new THREE.Group();
  grupo.position.set(-85, 78, -150);

  const matSprite = (color, opacity) => new THREE.SpriteMaterial({
    map: brillo, color, transparent: true, opacity, blending: ADITIVO, depthWrite: false, fog: false,
  });
  const corona = new THREE.Sprite(matSprite('#5ad08a', .85));
  const halo = new THREE.Sprite(matSprite('#bfffe0', .55));
  const anillo = new THREE.Mesh(new THREE.RingGeometry(15.2, 16.4, 24),
    new THREE.MeshBasicMaterial({ color: '#caffe6', transparent: true, opacity: .9, blending: ADITIVO, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  const disco = new THREE.Mesh(new THREE.CircleGeometry(15, 24),
    new THREE.MeshBasicMaterial({ color: '#020405', fog: false }));
  // el disco queda más cerca del jugador que la corona, así la tapa en el centro
  anillo.position.z = .5;
  disco.position.z = 1;
  grupo.add(corona, halo, anillo, disco);
  grupo.lookAt(0, 0, 0);
  return { grupo, corona, halo, anillo };
}

/* ══════════ aurora ══════════ */

function crearAurora({ color, radio, y0, alto, a0, a1, fase }, textura){
  const N = 24;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const uv = new Float32Array((N + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= N; i++){
    uv.set([i / N, 0, i / N, 1], i * 4);
    if (i < N){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    map: textura, color, transparent: true, opacity: .55, blending: ADITIVO,
    side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false,
  });
  const malla = new THREE.Mesh(geo, mat);
  malla.frustumCulled = false;

  const actualizar = t => {
    for (let i = 0; i <= N; i++){
      const a = a0 + (a1 - a0) * (i / N);
      const r = radio + Math.sin(t * .3 + i * .3 + fase) * 4;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r;
      const onda = Math.sin(t * .45 + i * .42 + fase) * 6;
      const alta = Math.sin(t * .7 + i * .7 + fase * 2) * 7;
      pos.set([x, y0 + onda, z, x, y0 + alto + onda + alta, z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  };
  actualizar(0);
  return { malla, mat, actualizar, base: new THREE.Color(color) };
}

/* ══════════ ciudad lejana ══════════ */

function texturaVentanas(){
  const [c, g] = lienzo(256, 256);
  g.fillStyle = '#0c1511'; g.fillRect(0, 0, 256, 256);
  const COLORES = ['#ffd27a', '#ffe9a8', '#bfe8cf', '#7fe0ff'];
  for (let j = 0; j < 8; j++){
    for (let i = 0; i < 8; i++){
      g.fillStyle = Math.random() < .38 ? COLORES[(Math.random() * COLORES.length) | 0] : '#14231b';
      g.fillRect(i * 32 + 8, j * 32 + 7, 16, 18);
    }
  }
  return aTextura(c, { repetir: true });
}

function crearCiudad(brillo){
  const grupo = new THREE.Group();
  const luces = [];
  const tex = texturaVentanas();

  // 4 bandas de color por distancia: lo lejano se pierde en la bruma
  const claro = new THREE.Color('#ffffff'), lejos = new THREE.Color('#4f6a5a');
  const bandas = [0, 1, 2, 3].map(b => new THREE.MeshBasicMaterial({
    map: tex, color: claro.clone().lerp(lejos, b / 3), fog: false,
  }));
  const lineaHolo = new THREE.LineBasicMaterial({ color: '#5ad08a', transparent: true, opacity: .55, fog: false });
  const lineaPisos = new THREE.LineBasicMaterial({ color: '#5ad08a', transparent: true, opacity: .22, fog: false });
  const lineaMastil = new THREE.LineBasicMaterial({ color: '#2f7a54', fog: false });

  function pisos(w, h, d){
    const pts = [], hw = w / 2, hd = d / 2;
    for (let y = -h / 2 + 3; y < h / 2; y += 3){
      pts.push(-hw, y, -hd, hw, y, -hd,  hw, y, -hd, hw, y, hd,  hw, y, hd, -hw, y, hd,  -hw, y, hd, -hw, y, -hd);
    }
    return new THREE.LineSegments(geoLineas(pts), lineaPisos);
  }

  const N = 44;
  for (let i = 0; i < N; i++){
    const ang = (i / N) * Math.PI * 2 + rnd(-.05, .05);
    const r = rnd(46, 72);               // ≤ 72: siempre delante de las estrellas (radio 75)
    const w = rnd(5, 11), d = rnd(4, 9), h = rnd(10, 38);
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    let m;

    if (Math.random() < .3){
      // torre holográfica "en construcción": solo líneas (0 triángulos)
      const pts = [];
      pushCaja(pts, w, h, d, 0, 0, 0);
      m = new THREE.Group();
      m.add(new THREE.LineSegments(geoLineas(pts), lineaHolo), pisos(w, h, d));
      m.position.set(x, h / 2, z);
      m.rotation.y = rnd(0, Math.PI);
    } else {
      // edificio plano mirando al centro (2 triángulos)
      const geo = new THREE.PlaneGeometry(w, h);
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / 24, uv.getY(k) * h / 24);
      m = new THREE.Mesh(geo, bandas[Math.min(3, Math.floor(((r - 46) / 26) * 4))]);
      m.position.set(x, h / 2, z);
      m.lookAt(0, h / 2, 0);
      m.rotation.y += rnd(-.3, .3);
      if (h > 26){
        const mastil = new THREE.Line(geoLineas([0, h / 2, 0, 0, h / 2 + 5, 0]), lineaMastil);
        const luz = new THREE.Sprite(new THREE.SpriteMaterial({
          map: brillo, color: '#ff4d4d', transparent: true, opacity: 1, blending: ADITIVO, depthWrite: false, fog: false,
        }));
        luz.scale.set(3.2, 3.2, 1);
        luz.position.y = h / 2 + 5.2;
        m.add(mastil, luz);
        luces.push({ s: luz, fase: rnd(0, 6.28) });
      }
    }
    grupo.add(m);
  }
  return { grupo, luces };
}

/* Grúas torre dibujadas con líneas (celosía): 0 triángulos. */
function crearGruas(brillo){
  const grupo = new THREE.Group();
  const luces = [], plumas = [];
  const matLinea = new THREE.LineBasicMaterial({ color: '#3d9a6b', transparent: true, opacity: .85, fog: false });

  const CANT = 5;
  for (let i = 0; i < CANT; i++){
    const ang = (i / CANT) * Math.PI * 2 + rnd(-.2, .2);
    const r = rnd(54, 68);
    const H = rnd(42, 56);
    const g = new THREE.Group();
    g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);

    // mástil: 4 aristas + aros + diagonales cada 3 m
    const a = .7, esq = [[-a, -a], [a, -a], [a, a], [-a, a]];
    const mast = [];
    for (const [ex, ez] of esq) mast.push(ex, 0, ez, ex, H, ez);
    for (let y = 0; y <= H; y += 3){
      for (let k = 0; k < 4; k++){
        const [x0, z0] = esq[k], [x1, z1] = esq[(k + 1) % 4];
        mast.push(x0, y, z0, x1, y, z1);
        if (y + 3 <= H) mast.push(x0, y, z0, x1, y + 3, z1);
      }
    }
    pushCaja(mast, 2.4, 2.2, 2.4, 0, H + 1.1, 0);     // cabina

    // pluma (gira): cordones, travesaños y diagonales + contrapeso + tirantes + cable y gancho
    const pl = [];
    for (const [yy, zz] of [[.5, -.5], [.5, .5], [-.5, -.5], [-.5, .5]]) pl.push(-6, yy, zz, 28, yy, zz);
    for (let x = -6; x <= 28; x += 2.5){
      for (const zz of [-.5, .5]){
        pl.push(x, -.5, zz, x, .5, zz);
        if (x + 2.5 <= 28) pl.push(x, -.5, zz, x + 2.5, .5, zz);
      }
    }
    pushCaja(pl, 6, 2.4, 2.2, -8, -.4, 0);            // contrapeso
    pushCaja(pl, 1.4, 5, 1.4, 0, 2.5, 0);             // torreta
    pl.push(0, 5, 0, 28, .5, 0, 0, 5, 0, -11, 0, 0);  // tirantes
    pl.push(18, 0, 0, 18, -12, 0);                    // cable
    pushCaja(pl, 1.2, 1, 1.2, 18, -12.5, 0);          // gancho

    const pluma = new THREE.Group();
    pluma.position.y = H + 2.4;
    const luz = new THREE.Sprite(new THREE.SpriteMaterial({
      map: brillo, color: '#ff4d4d', transparent: true, opacity: 1, blending: ADITIVO, depthWrite: false, fog: false,
    }));
    luz.scale.set(5, 5, 1);
    luz.position.set(28, .8, 0);
    pluma.add(new THREE.LineSegments(geoLineas(pl), matLinea), luz);
    pluma.rotation.y = rnd(0, Math.PI * 2);

    g.add(new THREE.LineSegments(geoLineas(mast), matLinea), pluma);
    grupo.add(g);
    plumas.push({ pluma, base: pluma.rotation.y, fase: rnd(0, 6.28) });
    luces.push({ s: luz, fase: rnd(0, 6.28) });
  }
  return { grupo, luces, plumas };
}

/* ══════════ muros ══════════ */

function texturaMuro(){
  const [c, g] = lienzo(512, 256);          // un panel de 8 m × 3.5 m
  const f = g.createLinearGradient(0, 0, 0, 256);
  f.addColorStop(0, '#1a241e'); f.addColorStop(.5, '#2a362f'); f.addColorStop(1, '#222d27');
  g.fillStyle = f; g.fillRect(0, 0, 512, 256);

  // juntas del panel
  g.strokeStyle = '#111915'; g.lineWidth = 4;
  g.strokeRect(2, 2, 508, 252);
  g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();

  // remaches
  g.fillStyle = '#3f5448';
  for (const x of [14, 498]){
    for (const y of [14, 114, 142, 200]){
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
  }
  // rejillas de ventilación
  for (const x of [120, 340]){
    g.fillStyle = '#0f1612'; g.fillRect(x, 40, 52, 56);
    g.fillStyle = '#2b3a31';
    for (let k = 0; k < 6; k++) g.fillRect(x + 4, 46 + k * 9, 44, 3);
  }
  // franja de peligro en la base
  g.save();
  g.beginPath(); g.rect(0, 222, 512, 34); g.clip();
  g.fillStyle = '#0f1612'; g.fillRect(0, 222, 512, 34);
  g.fillStyle = '#d9a93a';
  for (let x = -40; x < 540; x += 44){
    g.beginPath();
    g.moveTo(x, 256); g.lineTo(x + 22, 256); g.lineTo(x + 56, 222); g.lineTo(x + 34, 222);
    g.closePath(); g.fill();
  }
  g.restore();
  return aTextura(c, { repetir: true });
}

function cartelPared(texto, color){
  const [c, g] = lienzo(512, 160);
  g.fillStyle = '#0c1410'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(6, 6, 500, 148);
  g.fillStyle = color;
  g.globalAlpha = .3;
  for (let x = 16; x < 496; x += 24){ g.fillRect(x, 16, 12, 5); g.fillRect(x, 139, 12, 5); }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const palabras = texto.split(' ');
  if (texto.length <= 16){
    g.font = 'bold 46px monospace';
    g.fillText(texto, 256, 82, 470);
  } else {
    const mitad = Math.ceil(palabras.length / 2);
    g.font = 'bold 38px monospace';
    g.fillText(palabras.slice(0, mitad).join(' '), 256, 58, 470);
    g.fillText(palabras.slice(mitad).join(' '), 256, 106, 470);
  }
  return aTextura(c);
}

function crearMuros(brillo){
  const grupo = new THREE.Group();

  // paneles que cubren la cara interior de los 4 muros
  const texMuro = texturaMuro();
  texMuro.repeat.set(39 / 8, 1);
  const matPanel = new THREE.MeshStandardMaterial({ map: texMuro, roughness: .85, metalness: .15 });
  const geoPanel = new THREE.PlaneGeometry(39, 3.5);
  for (const lado of ['N', 'S', 'E', 'O']){
    const p = enMuro(lado, 0, .01);
    const m = new THREE.Mesh(geoPanel, matPanel);
    m.position.set(p.x, 1.75, p.z);
    m.rotation.y = p.ry;
    m.receiveShadow = true;
    grupo.add(m);
  }

  // carteles con consejos (entre los pilares)
  const CARTELES = {
    N: [[-9, 'CIUDAD NEURAL · EN OBRA', '#5ad08a'], [9, 'UNA FUNCIÓN = UNA RECETA', '#ffd27a']],
    S: [[-9, 'NO REPITAS CÓDIGO', '#5fe0ff'], [9, 'CASCO OBLIGATORIO', '#ffd27a']],
    E: [[-9, 'PRUEBA ANTES DE ENTREGAR', '#5ad08a'], [9, 'NOMBRES CLAROS, OBRAS CLARAS', '#5fe0ff']],
    O: [[-9, 'PLANO PRIMERO, OBRA DESPUÉS', '#ffd27a'], [9, 'RECICLA FUNCIONES', '#5ad08a']],
  };
  const geoCartel = new THREE.PlaneGeometry(5, 1.56);
  for (const [lado, lista] of Object.entries(CARTELES)){
    for (const [pos, texto, color] of lista){
      const p = enMuro(lado, pos, .03);
      const m = new THREE.Mesh(geoCartel, new THREE.MeshBasicMaterial({ map: cartelPared(texto, color) }));
      m.position.set(p.x, 2.0, p.z);
      m.rotation.y = p.ry;
      grupo.add(m);
    }
  }

  // pilares (3 por muro) con una lámpara de puntos encima
  const POS = [-12, 0, 12];
  const pilares = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, 4.1, .5),
    new THREE.MeshStandardMaterial({ color: '#1c2620', roughness: .8, metalness: .2 }), POS.length * 4);
  const m4 = new THREE.Matrix4();
  const lamparas = [];
  let n = 0;
  for (const lado of ['N', 'S', 'E', 'O']){
    for (const pos of POS){
      const p = enMuro(lado, pos, .25);
      m4.makeTranslation(p.x, 2.05, p.z); pilares.setMatrixAt(n++, m4);
      lamparas.push(p.x, 4.3, p.z);
    }
  }
  const puntos = new THREE.Points(geoLineas(lamparas), new THREE.PointsMaterial({
    size: 1.6, map: brillo, color: '#5ad08a', transparent: true, opacity: .95,
    blending: ADITIVO, depthWrite: false, fog: false,
  }));
  grupo.add(pilares, puntos);

  // tira LED a media altura (planos, no cajas)
  const matLed = new THREE.MeshBasicMaterial({ color: '#5ad08a', side: THREE.DoubleSide });
  const geoLed = new THREE.PlaneGeometry(39, .08);
  for (const lado of ['N', 'S', 'E', 'O']){
    const p = enMuro(lado, 0, .04);
    const led = new THREE.Mesh(geoLed, matLed);
    led.position.set(p.x, 1.05, p.z);
    led.rotation.y = p.ry;
    grupo.add(led);
  }
  return { grupo, matLed };
}

/* ══════════ suelo: circuito impreso ══════════ */

function texturaCircuito(){
  const [c, g] = lienzo(1024, 1024);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const CEL = 32, MAX = 1024 / CEL;
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const lim = v => Math.max(0, Math.min(MAX, v));
  for (let n = 0; n < 70; n++){
    let x = (Math.random() * MAX) | 0, y = (Math.random() * MAX) | 0, d = (Math.random() * 4) | 0;
    const col = Math.random() < .2 ? 'rgba(255,210,122,.34)' : 'rgba(90,208,138,.30)';
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = Math.random() < .3 ? 4 : 2;
    g.beginPath(); g.moveTo(x * CEL, y * CEL);
    const tramos = 2 + ((Math.random() * 4) | 0);
    for (let k = 0; k < tramos; k++){
      const len = 2 + ((Math.random() * 7) | 0);
      x = lim(x + dirs[d][0] * len); y = lim(y + dirs[d][1] * len);
      g.lineTo(x * CEL, y * CEL);
      d = (d + (Math.random() < .5 ? 1 : 3)) % 4;
    }
    g.stroke();
    g.beginPath(); g.arc(x * CEL, y * CEL, 6, 0, Math.PI * 2); g.fill(); // nodo
  }
  return aTextura(c);
}

/* ══════════ suelo: hormigón con irregularidades ══════════
   Devuelve [mapa de color, mapa de relieve]. Ambos se dibujan con las mismas grietas
   y juntas para que coincidan. Los elementos quedan lejos del borde para que al repetirse no haya costuras. */
function texturaHormigon(){
  const S = 512, M = 44;
  const [c, g] = lienzo(S, S);
  const [cb, gb] = lienzo(S, S);
  g.fillStyle = '#232c26'; g.fillRect(0, 0, S, S);
  gb.fillStyle = '#808080'; gb.fillRect(0, 0, S, S);

  // grano del concreto
  for (let i = 0; i < 3500; i++){
    const x = rnd(0, S), y = rnd(0, S), v = Math.random();
    g.fillStyle = v < .5 ? 'rgba(0,0,0,.10)' : 'rgba(190,230,205,.05)';
    g.fillRect(x, y, 2, 2);
    const k = (128 + (v - .5) * 70) | 0;
    gb.fillStyle = `rgb(${k},${k},${k})`; gb.fillRect(x, y, 2, 2);
  }

  // losas de 128 px: cada una a distinta altura; algunas más oscuras
  for (let y = 0; y < S; y += 128){
    for (let x = 0; x < S; x += 128){
      const k = (108 + Math.random() * 48) | 0;
      gb.fillStyle = `rgb(${k},${k},${k})`; gb.fillRect(x + 3, y + 3, 122, 122);
      if (Math.random() < .35){ g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, y, 128, 128); }
    }
  }
  // juntas hundidas entre losas
  g.strokeStyle = '#111713'; g.lineWidth = 4;
  gb.strokeStyle = '#202020'; gb.lineWidth = 6;
  for (let p = 0; p <= S; p += 128){
    for (const ctx of [g, gb]){
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
    }
  }

  // manchas de aceite y humedad (solo color)
  for (let i = 0; i < 7; i++){
    const x = rnd(M, S - M), y = rnd(M, S - M), r = rnd(26, 44);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // grietas (mismo trazo en color y relieve)
  for (let i = 0; i < 9; i++){
    let x = rnd(M, S - M), y = rnd(M, S - M);
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++){ x += rnd(-32, 32); y += rnd(-32, 32); pts.push([x, y]); }
    for (const [ctx, col, ancho, off] of [
      [g, 'rgba(120,170,140,.18)', 2, 1], [g, 'rgba(0,0,0,.85)', 3, 0], [gb, '#101010', 4, 0],
    ]){
      ctx.strokeStyle = col; ctx.lineWidth = ancho; ctx.beginPath();
      pts.forEach(([px, py], k) => k ? ctx.lineTo(px + off, py + off) : ctx.moveTo(px + off, py + off));
      ctx.stroke();
    }
  }

  // gravilla y escombro suelto
  for (let i = 0; i < 45; i++){
    const x = rnd(M, S - M), y = rnd(M, S - M), r = rnd(1.5, 4);
    g.fillStyle = 'rgba(150,180,160,.28)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    gb.fillStyle = '#cfcfcf';
    gb.beginPath(); gb.arc(x, y, r, 0, Math.PI * 2); gb.fill();
  }
  return [aTextura(c, { repetir: true }), aTextura(cb, { repetir: true, color: false })];
}

/* ══════════ ensamblado ══════════ */

function crearFondo(escena){
  const grupo = new THREE.Group();
  escena.add(grupo);
  const brillo = texturaBrillo();

  // cielo y astros
  const domo = crearCielo();
  const eclipse = crearEclipse(brillo);
  grupo.add(domo, eclipse.grupo);

  // capas de estrellas con parallax leve: lejos (casi quieta) → cerca (se mueve más)
  const capas = [
    crearCapaEstrellas(brillo, { n: 140, radio: 150, color: '#bfe8cf', opacidad: .55, vel: .004, k: .95 }),
    crearCapaEstrellas(brillo, { n: 100, radio: 110, color: '#e8fff0', opacidad: .65, vel: .009, k: .88 }),
    crearCapaEstrellas(brillo, { n: 60,  radio: 80,  color: '#ffd27a', opacidad: .5,  vel: .016, k: .78 }),
  ];
  capas.forEach(c => grupo.add(c.p));

  // aurora
  const texAurora = texturaDegradado([[0, 0], [.45, .28], [.85, .85], [1, .1]]);
  const auroras = [
    crearAurora({ color: '#5ad08a', radio: 125, y0: 38, alto: 38, a0: -1.3, a1: 1.3, fase: 0 }, texAurora),
    crearAurora({ color: '#5fe0ff', radio: 138, y0: 48, alto: 30, a0: -1.0, a1: 1.5, fase: 2.4 }, texAurora),
  ];
  auroras.forEach(a => grupo.add(a.malla));

  // bruma en el horizonte
  const bruma = new THREE.Mesh(
    new THREE.CylinderGeometry(92, 92, 46, 16, 1, true),
    new THREE.MeshBasicMaterial({
      map: texturaDegradado([[0, 0], [1, .9]]), color: '#2fae7a', transparent: true, opacity: .45,
      blending: ADITIVO, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    }));
  bruma.position.y = 23;
  grupo.add(bruma);

  // ciudad lejana y grúas
  const ciudad = crearCiudad(brillo);
  const gruas = crearGruas(brillo);
  grupo.add(ciudad.grupo, gruas.grupo);
  const luces = [...ciudad.luces, ...gruas.luces];

  // muros
  const muros = crearMuros(brillo);
  grupo.add(muros.grupo);

  // suelo: terreno lejano + circuito impreso sobre el patio
  const terreno = new THREE.Mesh(new THREE.CircleGeometry(170, 16),
    new THREE.MeshBasicMaterial({ color: '#0b120e' }));
  terreno.rotation.x = -Math.PI / 2;
  terreno.position.y = -.06;
  const circuito = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ map: texturaCircuito(), transparent: true, depthWrite: false }));
  circuito.rotation.x = -Math.PI / 2;
  circuito.position.y = .003;
  grupo.add(terreno, circuito);

  /* losas de suelo levantadas e inclinadas: relieve real en las zonas libres (10 tris c/u, decorativas).
     Se evita la zona de obra, las casetas, cajas, barriles, depósito, recetario, terminal, grúa y postes. */
  {
    const N = 24;
    const losas = new THREE.InstancedMesh(cajaSinBase(1, .22, 1),
      new THREE.MeshStandardMaterial({ color: '#2c3a31', roughness: .9, emissive: '#0f1a13', emissiveIntensity: .4 }), N);
    const evitar = [
      [-14.5, 13, 4.5], [15.5, -11.8, 3.5], [15.6, 14.2, 3.5], [-7, 11.5, 6], [9, 11.5, 4.5],
      [2.2, 10.8, 3.5], [0, 12, 3.5], [-14, -10, 3.5], [-8, -10, 5], [-16, -16, 2.5], [16, -16, 2.5],
      [-16, 6, 2.5], [16, 6, 2.5], [9, -4, 4],
    ];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const p = new THREE.Vector3(), s = new THREE.Vector3();
    let n = 0, intentos = 0;
    while (n < N && intentos++ < 600){
      const x = rnd(-18, 18), z = rnd(-18, 18);
      if (Math.abs(x) < 13 && Math.abs(z) < 9) continue;   // zona de obra
      if (evitar.some(([ex, ez, er]) => (x - ex) ** 2 + (z - ez) ** 2 < er * er)) continue;
      e.set(rnd(-.22, .22), rnd(0, Math.PI * 2), rnd(-.22, .22));
      q.setFromEuler(e);
      s.set(rnd(.8, 2.1), 1, rnd(.8, 2.1));
      p.set(x, .04, z);
      m4.compose(p, q, s);
      losas.setMatrixAt(n++, m4);
    }
    losas.count = n;
    losas.castShadow = losas.receiveShadow = true;
    grupo.add(losas);
  }

  let alerta = 0; // 0..1: sube durante el jefe (el eclipse se vuelve rojo)
  const colCorona = new THREE.Color();

  return {
    /** @param {boolean} enAlerta true mientras el glitch de Eclipse está activo
     *  @param {{x:number, z:number}|null} jp posición del jugador (para el parallax) */
    update(t, dt, enAlerta = false, jp = null){
      alerta += ((enAlerta ? 1 : 0) - alerta) * Math.min(1, dt * 2.5);

      // parallax leve: cada capa de estrellas gira a su ritmo y sigue un poco al jugador
      for (const c of capas){
        c.p.rotation.y += dt * c.vel;
        if (jp) c.p.position.set(jp.x * c.k, 0, jp.z * c.k);
      }
      // la ciudad lejana se mece despacio
      ciudad.grupo.rotation.y = Math.sin(t * .05) * .015;

      // eclipse: corona verde → roja, con latido
      colCorona.copy(VERDE).lerp(ROJO, alerta);
      const pulso = 1 + Math.sin(t * (enAlerta ? 5 : 1.2)) * .06;
      eclipse.corona.material.color.copy(colCorona);
      eclipse.corona.scale.setScalar(95 * pulso);
      eclipse.halo.scale.setScalar(55 * pulso);
      eclipse.anillo.material.color.set('#caffe6').lerp(ROJO, alerta * .7);

      // cielo con tinte rojizo durante el jefe
      domo.material.color.setRGB(1, 1 - .25 * alerta, 1 - .35 * alerta);

      // auroras
      for (const a of auroras){
        a.actualizar(t);
        a.mat.color.copy(a.base).lerp(ROJO, alerta * .85);
      }

      // grúas: la pluma gira despacio
      for (const p of gruas.plumas) p.pluma.rotation.y = p.base + Math.sin(t * .08 + p.fase) * .5;

      // luces de aviso parpadeando
      for (const l of luces) l.s.material.opacity = Math.sin(t * 2.2 + l.fase) > .75 ? 1 : .18;

      // tira LED de los muros
      muros.matLed.color.setHSL(.4, .7, .42 + Math.sin(t * 1.5 + 1) * .1);
    },
    dispose(){
      escena.remove(grupo);
      grupo.traverse(o => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { m?.map?.dispose(); m?.dispose(); });
      });
      brillo.dispose();
    },
  };
}

export function crearTaller(escena){
  const colisionadores = [];
  const dinamicos = new THREE.Group();
  escena.add(dinamicos);

  /* ── iluminación propia del nivel 2 ──
     LevelManager limpia la escena al cargar: sin luces todo se ve negro. */
  escena.background = new THREE.Color('#0d1410');
  escena.fog = new THREE.Fog('#16221b', 28, 85);
  const luzHemi = new THREE.HemisphereLight('#8fd6a8', '#1a241d', 1.7);
  const luzSol = new THREE.DirectionalLight('#e8fff0', 2.4);
  luzSol.position.set(14, 26, 12);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(1024, 1024);
  Object.assign(luzSol.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 80 });
  escena.add(luzHemi, luzSol);
  const brillo = crearBrillo(escena);
  // fondo: si algo fallara, el nivel sigue funcionando como antes (sin fondo nuevo)
  let fondo = null;
  if (USAR_FONDO){
    try { fondo = crearFondo(escena); }
    catch (e){ console.warn('[taller] no se pudo crear el fondo:', e); }
  }

  /* ── entorno industrial (verde/gris) ── */
  // suelo de hormigón con relieve (grano, juntas, grietas, gravilla)
  const [mapSuelo, bumpSuelo] = texturaHormigon();
  mapSuelo.repeat.set(6, 6); bumpSuelo.repeat.set(6, 6);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: mapSuelo, bumpMap: bumpSuelo, bumpScale: 4, roughness: .95 }));
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);
  const rejilla = new THREE.GridHelper(40, 20, 0x4e7a5a, 0x2c3a30);
  rejilla.position.y = .01;
  escena.add(rejilla);

  // grúa: torre + brazo + cable con gancho
  const matGrua = new THREE.MeshStandardMaterial({ color: '#8a9ba8', roughness: .6, metalness: .3 });
  const torre = new THREE.Mesh(new THREE.BoxGeometry(.8, 10, .8), matGrua);
  torre.position.set(-14, 5, -10); torre.castShadow = true;
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(14, .6, .6), matGrua);
  brazo.position.set(-8, 9.6, -10); brazo.castShadow = true;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 5.6, 6),
    new THREE.MeshBasicMaterial({ color: '#c9d8ea' }));
  cable.position.set(-8, 6.5, -10);
  const gancho = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .4),
    new THREE.MeshStandardMaterial({ color: '#ffd27a' }));
  gancho.position.set(-8, 3.55, -10);
  escena.add(torre, brazo, cable, gancho);

  // perímetro
  const matMuro = new THREE.MeshStandardMaterial({ color: '#2c3630', roughness: .9 });
  for (const [x, z, w, d] of [[0, -20, 40, 1], [0, 20, 40, 1], [-20, 0, 1, 40], [20, 0, 1, 40]]){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.5, d), matMuro);
    m.position.set(x, 1.75, z);
    escena.add(m);
    colisionadores.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
  }

  /* ══════════ obra delimitada: losa, franja de seguridad y conos ══════════ */
  // losa de concreto que marca la zona de obra (misma textura de hormigón, más oscura)
  const mapLosa = mapSuelo.clone(); mapLosa.needsUpdate = true; mapLosa.repeat.set(2.4, 1.6);
  const bumpLosa = bumpSuelo.clone(); bumpLosa.needsUpdate = true; bumpLosa.repeat.set(2.4, 1.6);
  const losa = new THREE.Mesh(new THREE.PlaneGeometry(24.4, 16.4),
    new THREE.MeshStandardMaterial({ color: '#9aa39d', map: mapLosa, bumpMap: bumpLosa, bumpScale: 3, roughness: 1 }));
  losa.rotation.x = -Math.PI / 2; losa.position.y = .006; losa.receiveShadow = true;
  escena.add(losa);

  const matFranja = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
  for (const [x, z, w, d] of [[0, -8.3, 24.6, .16], [0, 8.3, 24.6, .16], [-12.3, 0, .16, 16.6], [12.3, 0, .16, 16.6]]){
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, .03, d), matFranja);
    f.position.set(x, .03, z);
    escena.add(f);
  }
  const matCono = new THREE.MeshStandardMaterial({ color: '#ff8a2a', roughness: .6, emissive: '#7a2a00', emissiveIntensity: .3 });
  for (const [x, z] of [[-12.6, -8.6], [12.6, -8.6], [-12.6, 8.6], [12.6, 8.6], [0, -8.6], [0, 8.6], [-12.6, 0], [12.6, 0]]){
    const c = new THREE.Mesh(new THREE.ConeGeometry(.3, .75, 6), matCono);
    c.position.set(x, .38, z);
    escena.add(c);
  }

  /* ══════════ utilería de obra: casetas, cajas, barriles ══════════ */
  // caseta de oficina
  {
    const caseta = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 3),
      new THREE.MeshStandardMaterial({ color: '#4a6a58', roughness: .7 }));
    caseta.position.set(-14.5, 1.3, 13); caseta.castShadow = caseta.receiveShadow = true;
    const techo = new THREE.Mesh(new THREE.BoxGeometry(5.4, .25, 3.4),
      new THREE.MeshStandardMaterial({ color: '#1f2a24' }));
    techo.position.set(-14.5, 2.7, 13);
    const ventana = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, .08),
      new THREE.MeshBasicMaterial({ color: '#bfe8cf' }));
    ventana.position.set(-14.5, 1.6, 11.46);
    const cartel = crearCartel('OFICINA DE OBRA', '#9fd6a8');
    cartel.position.set(-14.5, 4.2, 13);
    escena.add(caseta, techo, ventana, cartel);
    colisionadores.push({ minX: -17, maxX: -12, minZ: 11.5, maxZ: 14.5 });
  }
  // pilas de cajas y barriles
  const matCajaDeco = new THREE.MeshStandardMaterial({ color: '#8a6a3c', roughness: .8 });
  const matBarril = new THREE.MeshStandardMaterial({ color: '#3c6a8a', roughness: .5, metalness: .3 });
  for (const [x, z] of [[15, -12], [16.1, -12.2], [15.5, -11.0]]){
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), matCajaDeco);
    c.position.set(x, .6, z); c.rotation.y = x * .3; c.castShadow = true;
    escena.add(c);
  }
  {
    const alta = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), matCajaDeco);
    alta.position.set(15.5, 1.75, -11.8); alta.castShadow = true;
    escena.add(alta);
    colisionadores.push({ minX: 14.2, maxX: 16.8, minZ: -12.9, maxZ: -10.3 });
  }
  for (const [x, z] of [[15, 14], [16.2, 13.4], [15.6, 15.2]]){
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 1.1, 8), matBarril);
    b.position.set(x, .55, z); b.castShadow = true;
    escena.add(b);
  }
  colisionadores.push({ minX: 14.4, maxX: 16.8, minZ: 12.8, maxZ: 15.8 });

  // postes de luz
  for (const [x, z, conLuz] of [[-16, -16, true], [16, -16, false], [-16, 6, false], [16, 6, true]]){
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, 5, 5), matGrua);
    poste.position.set(x, 2.5, z);
    const foco = new THREE.Mesh(new THREE.SphereGeometry(.3, 6, 4),
      new THREE.MeshBasicMaterial({ color: '#fff4c8' }));
    foco.position.set(x, 5.1, z);
    escena.add(poste, foco);
    if (conLuz){
      const l = new THREE.PointLight('#fff0c0', 14, 20, 2);
      l.position.set(x, 5, z);
      escena.add(l);
    }
  }

  /* ══════════ tablero del sub-reto ══════════ */
  const tablero = crearTablero();
  tablero.sprite.position.set(0, 6, -17);
  escena.add(tablero.sprite);
  pintarTablero(tablero, null, -1, SUBRETOS_NIVEL2.length);

  /* ══════════ recetario (cambia en cada sub-reto) ══════════ */
  const recetario = new THREE.Group();
  const libro = new THREE.Mesh(new THREE.BoxGeometry(1.2, .15, .9),
    new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#7a5a12', emissiveIntensity: .6 }));
  libro.position.y = 1.6;
  {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: '#252d28', roughness: .7 }));
    pedestal.position.y = .6; pedestal.castShadow = true;
    recetario.add(pedestal, libro);
    recetario.position.set(-4, 0, 11.5);
    escena.add(recetario);
  }
  const cartelReceta = crearCartelVivo();
  cartelReceta.sprite.position.set(-4, 3.2, 11.5);
  escena.add(cartelReceta.sprite);
  pintarCartelVivo(cartelReceta, 'RECETARIO · usa la terminal', '#ffd27a');

  /* ══════════ SR2: medidores largo / alto ══════════ */
  const medidores = new THREE.Group();
  {
    const matM = new THREE.MeshStandardMaterial({ color: '#5ad08a', emissive: '#1f6a3a', emissiveIntensity: .8 });
    const ml = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 1.5, 8), matM);
    ml.position.set(-9.5, .75, 11.5);
    const ma = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 1.0, 8), matM);
    ma.position.set(-7.5, .5, 11.5);
    const cl = crearCartel('largo = 3', '#5ad08a'); cl.position.set(-9.5, 2.3, 11.5); cl.scale.multiplyScalar(.7);
    const ca = crearCartel('alto = 2', '#5ad08a'); ca.position.set(-7.5, 2.3, 11.5); ca.scale.multiplyScalar(.7);
    medidores.add(ml, ma, cl, ca);
    medidores.visible = false;
    escena.add(medidores);
  }

  /* ══════════ SR3-SR4: depósito de materiales ══════════ */
  const matDepotPantalla = new THREE.MeshBasicMaterial({ color: '#ffb454' });
  {
    const caja = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2),
      new THREE.MeshStandardMaterial({ color: '#3c4a42', roughness: .7 }));
    caja.position.set(9, 1, 11.5); caja.castShadow = caja.receiveShadow = true;
    const pant = new THREE.Mesh(new THREE.BoxGeometry(1.8, .7, .06), matDepotPantalla);
    pant.position.set(9, 1.3, 10.46);
    escena.add(caja, pant);
    colisionadores.push({ minX: 7.5, maxX: 10.5, minZ: 10.5, maxZ: 12.5 });
  }
  const cartelDepot = crearCartelVivo();
  cartelDepot.sprite.scale.set(5, .62, 1);
  cartelDepot.sprite.position.set(9, 3.1, 11.5);
  escena.add(cartelDepot.sprite);
  pintarCartelVivo(cartelDepot, 'DEPÓSITO · sin pedidos', '#8a9ba8');

  /* ══════════ SR4: cúpula del ámbito ══════════ */
  const ambito = new THREE.Group();
  {
    const domo = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
    const aro = new THREE.Mesh(new THREE.TorusGeometry(2.8, .05, 3, 16),
      new THREE.MeshBasicMaterial({ color: '#7fe0ff' }));
    aro.rotation.x = Math.PI / 2; aro.position.y = .05;
    const ladrillos = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .6),
      new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: .6 }));
    ladrillos.position.y = 1.1;
    ladrillos.name = 'ladrillos';
    const cartel = crearCartel('ÁMBITO · preparar()', '#7fe0ff');
    cartel.position.y = 3.6;
    const cartel2 = crearCartel('ladrillos vive AQUÍ', '#ffd27a');
    cartel2.position.y = 2.2; cartel2.scale.multiplyScalar(.7);
    ambito.add(domo, aro, ladrillos, cartel, cartel2);
    ambito.position.set(9, 0, -4);
    ambito.visible = false;
    escena.add(ambito);
  }

  /* ══════════ SR5: lista compartida de la grúa ══════════ */
  const grua = new THREE.Group();
  const cajasGrua = new THREE.Group();
  const cartelGrua = crearCartelVivo();
  {
    const palet = new THREE.Mesh(new THREE.BoxGeometry(6, .15, 1.6),
      new THREE.MeshStandardMaterial({ color: '#6a5030', roughness: .9 }));
    palet.position.set(-8, .08, -10);
    cartelGrua.sprite.position.set(-8, 4.6, -10);
    grua.add(palet, cajasGrua, cartelGrua.sprite);
    grua.visible = false;
    escena.add(grua);
  }
  const matsCaja = {};
  const geoCaja = new THREE.BoxGeometry(.9, .9, .9);
  function matCajaDe(nombre){
    return matsCaja[nombre] ??= new THREE.MeshStandardMaterial({ color: COLOR_CAJA[nombre] ?? '#c9d8ea', roughness: .6 });
  }
  function repintarGrua(){
    cajasGrua.clear(); // geometría y materiales compartidos: no se liberan
    st.materiales.forEach((m, i) => {
      const c = new THREE.Mesh(geoCaja, matCajaDe(m));
      c.position.set(-10 + i * 1.1, .6, -10);
      c.castShadow = true;
      cajasGrua.add(c);
    });
    pintarCartelVivo(cartelGrua, `GRÚA: ${st.materiales.join(', ')}`, '#ffd27a');
  }

  /* ══════════ SR6: rótulos de las 3 filas ══════════ */
  const rotulosFilas = new THREE.Group();
  {
    // filas del plano: y=1,3,5 → z = (y - filas/2 + .5) * CELDA = -5, -1, 3
    for (const [z, txt] of [[-5, 'FILA 1 · VIVIENDA'], [-1, 'FILA 2 · ALMACÉN'], [3, 'FILA 3 · COMUNICACIÓN']]){
      const c = crearCartel(txt, '#5fe0ff');
      c.scale.multiplyScalar(.75);
      c.position.set(-15.2, 1.8, z);
      rotulosFilas.add(c);
    }
    rotulosFilas.visible = false;
    escena.add(rotulosFilas);
  }

  /* ══════════ JEFE: glitch de Eclipse ══════════ */
  const matGlitch = new THREE.MeshBasicMaterial({ color: '#ff5d5d', wireframe: true });
  const glitch = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 0), matGlitch);
  glitch.position.set(0, 4.5, 0);
  const cartelGlitch = crearCartel('GLITCH · mismo tramo ×3', '#ff5d5d');
  cartelGlitch.position.set(0, 6, 0);
  const cartelVencido = crearCartel('REFACTORIZADO ✔', '#58f0a0');
  cartelVencido.position.set(0, 6, 0);
  glitch.visible = cartelGlitch.visible = cartelVencido.visible = false;
  escena.add(glitch, cartelGlitch, cartelVencido);

  /* ══════════ robot constructor ══════════
     Frente = +z local. Orugas con ruedas, cabina con visor y ojos, baliza naranja,
     tolva trasera con bloques y un brazo grúa que baja por detrás y suelta cada pieza. */
  const robot = new THREE.Group();
  const matChasis = new THREE.MeshStandardMaterial({ color: '#9fd6a8', emissive: '#1f4d2e', emissiveIntensity: .5, roughness: .4 });
  const matOscuro = new THREE.MeshStandardMaterial({ color: '#27322b', roughness: .7, metalness: .2 });
  const matAmarillo = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: .55, roughness: .5 });
  const matOjoRobot = new THREE.MeshBasicMaterial({ color: '#5ad08a' });
  const matFaroRobot = new THREE.MeshBasicMaterial({ color: '#ffe9a8' });
  const matBalizaRobot = new THREE.MeshBasicMaterial({ color: '#ffb060' });
  const matCarga = new THREE.MeshStandardMaterial({ color: '#b6e8c8', emissive: '#3a8a5a', emissiveIntensity: .5, roughness: .5 });
  {
    // orugas con ruedas
    for (const lado of [-1, 1]){
      const oruga = new THREE.Mesh(new THREE.BoxGeometry(.3, .34, 1.4), matOscuro);
      oruga.position.set(lado * .58, .17, 0);
      robot.add(oruga);
      for (const z of [-.5, 0, .5]){
        const rueda = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .36, 6), matChasis);
        rueda.rotation.z = Math.PI / 2;
        rueda.position.set(lado * .58, .17, z);
        robot.add(rueda);
      }
    }
    // chasis y cabina
    const chasis = new THREE.Mesh(new THREE.BoxGeometry(.9, .3, 1.3), matChasis);
    chasis.position.y = .46;
    const cabina = new THREE.Mesh(new THREE.BoxGeometry(.78, .5, .58), matChasis);
    cabina.position.set(0, .86, .32);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(.62, .2, .06), matOscuro);
    visor.position.set(0, .9, .62);
    robot.add(chasis, cabina, visor);
    for (const lado of [-1, 1]){
      const ojo = new THREE.Mesh(new THREE.BoxGeometry(.14, .1, .02), matOjoRobot);
      ojo.position.set(lado * .14, .9, .655);
      const faro = new THREE.Mesh(new THREE.BoxGeometry(.16, .08, .04), matFaroRobot);
      faro.position.set(lado * .28, .46, .67);
      robot.add(ojo, faro);
    }
    // baliza naranja sobre la cabina
    const mastilBaliza = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .14, 6), matOscuro);
    mastilBaliza.position.set(0, 1.18, .32);
    const bolaBaliza = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 4), matBalizaRobot);
    bolaBaliza.position.set(0, 1.3, .32);
    robot.add(mastilBaliza, bolaBaliza);

    // tolva trasera con bloques de repuesto
    const baseTolva = new THREE.Mesh(new THREE.BoxGeometry(.82, .1, .6), matOscuro);
    baseTolva.position.set(0, .64, -.4);
    const paredAtras = new THREE.Mesh(new THREE.BoxGeometry(.82, .3, .06), matOscuro);
    paredAtras.position.set(0, .8, -.68);
    robot.add(baseTolva, paredAtras);
    for (const lado of [-1, 1]){
      const lateral = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .6), matOscuro);
      lateral.position.set(lado * .38, .8, -.4);
      robot.add(lateral);
    }
    for (const [x, z] of [[-.19, -.28], [.19, -.28], [0, -.52]]){
      const repuesto = new THREE.Mesh(new THREE.BoxGeometry(.26, .26, .26), matCarga);
      repuesto.position.set(x, .82, z);
      robot.add(repuesto);
    }
  }

  /* brazo grúa: pivota sobre el mástil; en reposo sostiene un bloque en alto, al construir
     baja hasta el suelo por detrás, lo suelta y vuelve a subir */
  const REPOSO = .55, ABAJO = -.9;       // ángulos del brazo (rad): + sube la punta, − la baja
  const T_BRAZO = .5, P_SUELTA = .45;    // duración del movimiento (s) y momento en que suelta (0..1)
  const DEMORA_PIEZA = T_BRAZO * P_SUELTA / .35;     // la pieza aparece justo cuando se suelta
  const DEMORA_DESTELLO = T_BRAZO * P_SUELTA / .6;
  const brazoPivot = new THREE.Group();
  brazoPivot.position.set(0, 1.05, -.2);
  const cargaMano = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), matCarga);
  {
    const mastil = new THREE.Mesh(new THREE.BoxGeometry(.16, .3, .16), matOscuro);
    mastil.position.set(0, .9, -.2);
    robot.add(mastil);
    const barra = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .95), matAmarillo);
    barra.position.set(0, 0, -.475);
    brazoPivot.add(barra);
    for (const lado of [-1, 1]){
      const pinza = new THREE.Mesh(new THREE.BoxGeometry(.04, .24, .2), matOscuro);
      pinza.position.set(lado * .19, -.12, -.95);
      brazoPivot.add(pinza);
    }
    cargaMano.position.set(0, -.18, -.95);
    brazoPivot.add(cargaMano);
    brazoPivot.rotation.x = REPOSO;
    robot.add(brazoPivot);
  }
  robot.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingSphere();
    o.castShadow = o.geometry.boundingSphere.radius > .3; // solo piezas grandes
  });
  escena.add(robot);
  const brazoAnim = { t: -1 };           // t < 0: sin animación

  const efectosRobot = crearEfectosRobot(escena, robot, {}, {
    frente: 1,                                       // el robot del taller mira hacia +z
    colores: ['#9fd6a8', '#27322b', '#ffd27a', '#ff8a2a'], // piezas verdes, oscuras, amarillas y naranjas
    chispas: p => { destello(p, false); efectos[efectos.length - 1].t = 0; }, // anillo rojo al instante
  });

  function posBrazo(p){
    if (p < P_SUELTA) return REPOSO + (ABAJO - REPOSO) * suave(p / P_SUELTA);
    return ABAJO + (REPOSO - ABAJO) * suave((p - P_SUELTA) / (1 - P_SUELTA));
  }

  // anillo pulsante bajo la casilla actual del robot
  const marcador = new THREE.Mesh(new THREE.RingGeometry(.75, .9, 16),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  marcador.rotation.x = -Math.PI / 2;
  marcador.position.y = .07;
  escena.add(marcador);

  /* ── estado ── */
  const st = {
    indice: -1, cols: 12, filas: 8,
    pos: { x: 0, y: 0 }, dir: DIRS.E,
    area: null,                  // plataforma de obra del sub-reto: { x0, x1, y0, y1 } en casillas
    construido: new Map(),       // "x,y" → {tipo, alto}
    fantasmas: new Map(),        // "x,y" → { g, t, p } casilla del plano (para el feedback)
    materiales: [], recursosOk: false, requerido: 0,
    ultimoMostrado: undefined, dialogoPendiente: false, registroG: null,
    jefeVencido: false,
    puntos: 0, eficiencia: 0, reutilizacion: 0, penalizacion: 0,
    funcionesReutilizadas: 0, duplicados: 0, eficientes: 0,
    _bloquesInst: null, _bloquesCount: 0, _bloquesCap: 64,
    inicioNivel: Date.now(), gestor: null,
  };
  let motor = null;

  /* ── animaciones de construcción ── */
  const anims = [];     // piezas creciendo (bloques instanciados o meshes sueltos)
  const efectos = [];   // destellos en el piso
  const _m = new THREE.Matrix4();

  function destello(p, ok){
    const geo = new THREE.RingGeometry(.3, .5, 24);
    const mat = new THREE.MeshBasicMaterial({ color: ok ? '#58f0a0' : '#ff5d5d', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false });
    const r = new THREE.Mesh(geo, mat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(p.x, .1, p.z);
    r.visible = false;                 // aparece cuando el brazo suelta la pieza
    dinamicos.add(r);
    efectos.push({ r, t: -DEMORA_DESTELLO });
  }

  const clave = (x, y) => `${x},${y}`;
  const aMundo = (x, y) => new THREE.Vector3((x - st.cols/2 + .5) * CELDA, 0, (y - st.filas/2 + .5) * CELDA);

  // bloques: lados más oscuros y tapa clara (como los servidores del nivel 1)
  const matBloqueLado = new THREE.MeshStandardMaterial({ color: '#5f8f78', roughness: .6 });
  const matBloqueTapa = new THREE.MeshStandardMaterial({ color: '#b6e8c8', emissive: '#3a8a5a', emissiveIntensity: .55 });
  const matBloque = [matBloqueLado, matBloqueLado, matBloqueTapa, matBloqueLado, matBloqueLado, matBloqueLado];
  const COLOR_PLANO = { bloque: '#5ad08a', puerta: '#ffb454', ventana: '#5fe0ff' };
  const matPuerta = new THREE.MeshStandardMaterial({ color: '#c98a3c', emissive: '#7a4a12', emissiveIntensity: .5 });
  const matVentana = new THREE.MeshStandardMaterial({ color: '#7fd8e8', transparent: true, opacity: .55, emissive: '#2b7f8f', emissiveIntensity: .4 });

  /* Muestra u oculta el contenido ligado al sub-reto activo. */
  function aplicarSubreto(sub, i){
    pintarTablero(tablero, sub, i, SUBRETOS_NIVEL2.length);
    pintarCartelVivo(cartelReceta, TEXTO_RECETA[i] ?? TEXTO_RECETA[0], '#ffd27a');
    medidores.visible = i === 1;
    ambito.visible = i === 3;
    grua.visible = i === 4;
    rotulosFilas.visible = i === 5;
    glitch.visible = !!sub.esJefe;
    cartelGlitch.visible = !!sub.esJefe;
    cartelVencido.visible = false;
    matGlitch.color.set('#ff5d5d');
    glitch.scale.setScalar(1);
    st.jefeVencido = false;
    repintarGrua();
  }

  function cargarSubreto(i){
    const sub = SUBRETOS_NIVEL2[i];
    st.indice = i;
    st.construido.clear();
    st.fantasmas.clear();
    anims.length = 0;
    efectos.length = 0;
    brazoAnim.t = -1;
    st.materiales = ['acero'];
    st.recursosOk = false;
    st.ultimoMostrado = undefined;
    st.dialogoPendiente = false;
    st.pos = { x: sub.robot.x, y: sub.robot.y };
    st.dir = DIRS[sub.robot.dir];
    st.registroG = sub.registroG ?? null;
    // requerido: bloques(alto×2) + puertas(3) + ventanas(2)
    st.requerido = (sub.plano ?? []).reduce((acc, p) =>
      acc + (p.tipo === 'bloque' ? p.alto * 2 : p.tipo === 'puerta' ? 3 : 2), 0);
    liberarGrupo(dinamicos); // ← libera geometría+material+textura del sub-reto previo

    /* plataforma de obra: casillas, borde luminoso y vallas (como el laberinto del nivel 1).
       Cubre el plano del sub-reto con un margen de 1 casilla. */
    {
      const celdas = [...(sub.plano ?? []), sub.robot];
      const xs = celdas.map(c => c.x), ys = celdas.map(c => c.y);
      let x0 = Math.max(0, Math.min(...xs) - 1), x1 = Math.min(st.cols - 1, Math.max(...xs) + 1);
      let y0 = Math.max(0, Math.min(...ys) - 1), y1 = Math.min(st.filas - 1, Math.max(...ys) + 1);
      // tamaño mínimo para que el robot tenga por dónde caminar
      while (x1 - x0 + 1 < 6 && (x1 < st.cols - 1 || x0 > 0)){ if (x1 < st.cols - 1) x1++; else x0--; }
      while (y1 - y0 + 1 < 3 && (y1 < st.filas - 1 || y0 > 0)){ if (y1 < st.filas - 1) y1++; else y0--; }
      st.area = { x0, x1, y0, y1 };

      const nx = x1 - x0 + 1, ny = y1 - y0 + 1;
      const c = aMundo((x0 + x1) / 2, (y0 + y1) / 2);
      const w = nx * CELDA + .4, d = ny * CELDA + .4;

      // losa oscura + borde luminoso
      const pg = new THREE.PlaneGeometry(w, d);
      const plat = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: '#10261b' }));
      plat.rotation.x = -Math.PI / 2; plat.position.set(c.x, .02, c.z);
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(pg), new THREE.LineBasicMaterial({ color: '#5ad08a' }));
      borde.rotation.x = -Math.PI / 2; borde.position.set(c.x, .06, c.z);
      dinamicos.add(plat, borde);

      // casillas en tablero de ajedrez (un solo draw call)
      const baldosas = new THREE.InstancedMesh(new THREE.PlaneGeometry(CELDA * .94, CELDA * .94),
        new THREE.MeshBasicMaterial({ color: '#ffffff' }), nx * ny);
      const col = new THREE.Color(), mt = new THREE.Matrix4();
      let n = 0;
      for (let y = y0; y <= y1; y++){
        for (let x = x0; x <= x1; x++){
          const p = aMundo(x, y);
          mt.makeRotationX(-Math.PI / 2).setPosition(p.x, .03, p.z);
          baldosas.setMatrixAt(n, mt);
          baldosas.setColorAt(n++, col.set((x + y) % 2 ? '#1e3a2a' : '#173024'));
        }
      }
      baldosas.instanceMatrix.needsUpdate = true;
      baldosas.instanceColor.needsUpdate = true;
      dinamicos.add(baldosas);

      // vallas bajas luminosas y postes en las esquinas
      const matValla = new THREE.MeshStandardMaterial({ color: '#2f6b48', emissive: '#5ad08a', emissiveIntensity: .7 });
      for (const [px, pz, bw, bd] of [
        [c.x, c.z - d / 2, w + .15, .15], [c.x, c.z + d / 2, w + .15, .15],
        [c.x - w / 2, c.z, .15, d], [c.x + w / 2, c.z, .15, d],
      ]){
        const v = new THREE.Mesh(new THREE.BoxGeometry(bw, .3, bd), matValla);
        v.position.set(px, .15, pz);
        dinamicos.add(v);
      }
      const matPoste = new THREE.MeshStandardMaterial({ color: '#3a4a42' });
      const matLuz = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
      for (const [px, pz] of [[c.x - w / 2, c.z - d / 2], [c.x + w / 2, c.z - d / 2], [c.x - w / 2, c.z + d / 2], [c.x + w / 2, c.z + d / 2]]){
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .9, 5), matPoste);
        poste.position.set(px, .45, pz);
        const luz = new THREE.Mesh(new THREE.SphereGeometry(.16, 5, 3), matLuz);
        luz.position.set(px, 1, pz);
        dinamicos.add(poste, luz);
      }
    }

    // reservar InstancedMesh reutilizable para bloques colocados (no se recrea)
    if (!st._bloquesInst){
      const cap = st._bloquesCap;
      st._bloquesInst = new THREE.InstancedMesh(
        new THREE.BoxGeometry(CELDA * .88, 1, CELDA * .88), matBloque, cap);
      st._bloquesInst.count = 0;
      st._bloquesInst.castShadow = st._bloquesInst.receiveShadow = true;
      st._bloquesInst.frustumCulled = false;
    }
    st._bloquesInst.count = 0;
    dinamicos.add(st._bloquesInst);
    st._bloquesCount = 0;

    // plano: pieza translúcida + borde + baldosa en el piso (verde bloque, naranja puerta, cian ventana)
    for (const p of sub.plano ?? []){
      const h = p.tipo === 'bloque' ? (p.alto ?? 1) * .8 : 1.6;
      const col = COLOR_PLANO[p.tipo];
      const geo = new THREE.BoxGeometry(CELDA * .9, h, CELDA * .9);
      const g = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .35, depthWrite: false }));
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col })));
      g.position.copy(aMundo(p.x, p.y)).setY(h / 2);
      dinamicos.add(g);
      const baldosa = new THREE.Mesh(new THREE.PlaneGeometry(CELDA * .9, CELDA * .9),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .45 }));
      baldosa.rotation.x = -Math.PI / 2;
      baldosa.position.copy(aMundo(p.x, p.y)).setY(.045);
      dinamicos.add(baldosa);
      st.fantasmas.set(clave(p.x, p.y), { g, t: baldosa, p });
    }
    if (st.registroG && !progreso.tieneRegistro('nivel-2')){
      const g = new THREE.Mesh(new THREE.OctahedronGeometry(.4),
        new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: 1.2, flatShading: true }));
      g.position.copy(aMundo(st.registroG.x, st.registroG.y)).setY(1);
      dinamicos.add(g);
    }
    robot.position.copy(aMundo(st.pos.x, st.pos.y));
    robot.rotation.y = -st.dir * Math.PI / 2 + Math.PI;
    efectosRobot.reiniciar();
    aplicarSubreto(sub, i);
    return sub;
  }

  /* ¿la pieza construida coincide con la del plano en esa casilla? */
  function coincide(f, tipo, alto){
    return !!f && f.p.tipo === tipo && (tipo !== 'bloque' || f.p.alto === alto);
  }

  /* ── estructuras ── */
  function ponerEstructura(tipo, alto = 1){
    const k = clave(st.pos.x, st.pos.y);
    if (st.construido.has(k))
      throw new ErrorMotor('RUNTIME', 'Ahí ya hay una estructura: el robot no puede construir encima.', 0);
    st.construido.set(k, { tipo, alto });
    const p = aMundo(st.pos.x, st.pos.y);

    // el brazo grúa baja con la pieza que toca (bloque, puerta o ventana) y la suelta
    matCarga.color.set(tipo === 'puerta' ? '#c98a3c' : tipo === 'ventana' ? '#7fd8e8' : '#b6e8c8');
    brazoAnim.t = 0;

    if (tipo === 'bloque'){
      if (st._bloquesCount >= st._bloquesInst.instanceMatrix.count){
        // crecer
        const nuevo = new THREE.InstancedMesh(st._bloquesInst.geometry, matBloque, st._bloquesCount * 2);
        nuevo.count = st._bloquesCount;
        for (let j = 0; j < st._bloquesCount; j++){
          const m = new THREE.Matrix4();
          st._bloquesInst.getMatrixAt(j, m);
          nuevo.setMatrixAt(j, m);
        }
        nuevo.castShadow = nuevo.receiveShadow = true;
        nuevo.frustumCulled = false;
        dinamicos.remove(st._bloquesInst);
        dinamicos.add(nuevo);
        st._bloquesInst.dispose();
        st._bloquesInst = nuevo;
      }
      const h = alto * .8;
      // arranca casi plano; la animación (update) lo hace crecer hasta h cuando el brazo lo suelta
      const m = new THREE.Matrix4();
      m.makeScale(1, .001, 1).setPosition(p.x, .0005, p.z);
      st._bloquesInst.setMatrixAt(st._bloquesCount++, m);
      st._bloquesInst.instanceMatrix.needsUpdate = true;
      st._bloquesInst.count = st._bloquesCount;
      anims.push({ idx: st._bloquesCount - 1, x: p.x, z: p.z, h, t: -DEMORA_PIEZA });
    } else {
      const mat = tipo === 'puerta' ? matPuerta : matVentana;
      const h = tipo === 'puerta' ? 1.8 : 1;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(CELDA * (tipo === 'puerta' ? .5 : .6), h, tipo === 'puerta' ? .3 : .15),
        mat);
      mesh.position.copy(p).setY(tipo === 'puerta' ? .9 : 1.1);
      mesh.scale.setScalar(.01);
      dinamicos.add(mesh);
      anims.push({ mesh, t: -DEMORA_PIEZA });
    }

    // feedback: la baldosa se pone verde si la pieza es correcta, roja si no
    const f = st.fantasmas.get(k);
    if (f){
      const ok = coincide(f, tipo, alto);
      f.t.material.color.set(ok ? '#58f0a0' : '#ff5d5d');
      f.t.material.opacity = .8;
      f.g.visible = !ok;            // si está bien se ve la pieza real; si no, el fantasma sigue
    }
    let bien = 0;
    for (const [kk, c] of st.construido){
      if (coincide(st.fantasmas.get(kk), c.tipo, c.alto)) bien++;
    }
    if (st.fantasmas.size > 0){
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'obra', args: [], resultado: `${bien}/${st.fantasmas.size}` });
    }
    destello(p, !!f && coincide(f, tipo, alto));
  }

  /* ── API del mundo ── */
  function crearAPI(){
    const api = new RegistroAPI();
    api.registrar('moverAdelante', () => {
      const [dx, dy] = DELTA[st.dir];
      st.pos.x += dx; st.pos.y += dy;
      if (st.registroG && st.pos.x === st.registroG.x && st.pos.y === st.registroG.y)
        st.dialogoPendiente = true;
      return true;
    }, 'Avanza una casilla');
    api.registrar('girar', d => {
      if (d === 'derecha') st.dir = (st.dir + 1) % 4;
      else if (d === 'izquierda') st.dir = (st.dir + 3) % 4;
      else throw new ErrorMotor('TYPE_ERROR', 'girar solo acepta "derecha" o "izquierda".', 0);
      return st.dir;
    }, 'Gira 90°');
    api.registrar('colocarBloque', (alto = 1) => {
      if (typeof alto !== 'number' || alto < 1)
        throw new ErrorMotor('TYPE_ERROR', 'colocarBloque necesita un alto numérico ≥ 1.', 0);
      ponerEstructura('bloque', Math.min(3, Math.round(alto)));
      return true;
    }, 'Construye en la casilla actual');
    api.registrar('ponerPuerta', () => { ponerEstructura('puerta'); return true; }, 'Coloca una puerta');
    api.registrar('ponerVentana', () => { ponerEstructura('ventana'); return true; }, 'Instala una ventana');
    api.registrar('pedirRecursos', cantidad => {
      if (cantidad === null || cantidad === undefined || typeof cantidad !== 'number' || Number.isNaN(cantidad))
        throw new ErrorMotor('RUNTIME', 'La función no devuelve el valor esperado: el depósito recibió «nada».', 0);
      if (cantidad !== st.requerido)
        throw new ErrorMotor('RUNTIME', `El depósito rechaza ${cantidad} unidades: el plano necesita ${st.requerido}.`, 0);
      st.recursosOk = true;
      return true;
    }, 'Pide materiales al depósito');
    api.registrar('agregarMaterial', m => {
      if (typeof m !== 'string') throw new ErrorMotor('TYPE_ERROR', 'agregarMaterial espera un texto.', 0);
      st.materiales.push(m);
      repintarGrua(); // una caja nueva en el palet de la grúa
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'materiales', args: [], resultado: [...st.materiales] });
      return st.materiales.length;
    }, 'Añade a la lista COMPARTIDA de la grúa');
    api.registrar('materiales', () => [...st.materiales], 'Lista compartida de materiales');
    api.registrar('mostrar', v => {
      st.ultimoMostrado = v;
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'mostrar', args: [v], resultado: v });
      return v;
    }, 'Muestra un valor');
    return api;
  }

  /* ── verificación del sub-reto ── */
  function verificar(sub, calidad){
    const v = sub.verificar;
    if (v.tipo === 'plano' || v.tipo === 'planoYRecursos' || v.tipo === 'planoYReutilizacion'){
      const plano = new Map((sub.plano ?? []).map(p => [clave(p.x, p.y), p]));
      if (plano.size !== st.construido.size) return false;
      for (const [k, p] of plano){
        const c = st.construido.get(k);
        if (!c || c.tipo !== p.tipo) return false;
        if (p.tipo === 'bloque' && c.alto !== p.alto) return false;
      }
      if (v.tipo === 'planoYRecursos' && !st.recursosOk) return false;
      if (v.tipo === 'planoYReutilizacion' && !(calidad?.maxLlamadas >= 3)) return false;
      return true;
    }
    if (v.tipo === 'materialesYMostrar'){
      const okMat = JSON.stringify(st.materiales) === JSON.stringify(v.materiales);
      return okMat && st.ultimoMostrado === v.mostrado;
    }
    return false;
  }

  /* ── ejecución ── */
   /* ── ejecución ── */
  async function ejecutarAST(ast, { bloquesUsados = 0, calidad = null, animado = true } = {}){
    const sub = SUBRETOS_NIVEL2[st.indice];
    motor = new MotorEjecucion(bus);
    const limites = { maxPasos: sub.maxPasos, maxProfundidad: 16, tiempoMaxMs: 6000 };
    const res = await motor.ejecutar(ast, crearAPI(), limites, { animado, delayMundo: 280, delayPaso: 40 });
    if (!res.ok){ efectosRobot.explotar(); return { ok: false, error: res.error }; }
    if (!verificar(sub, calidad)){
      return { ok: true, superado: false, mensaje: 'El programa terminó, pero la obra no coincide con el plano.' };
    }
    // ¡superado!
    if (sub.esJefe) st.jefeVencido = true; // el glitch se apaga
    st.puntos += sub.esJefe ? 20 : 10;
    if (!sub.esJefe){
      st.gestor?.completarObjetivo(`obj-2-${st.indice + 1}`, {
        metricas: { subretosPuntos: st.puntos },
      });
    }
    if (bloquesUsados > 0 && bloquesUsados <= sub.minBloques) st.eficientes = (st.eficientes ?? 0) + 1;
    if (calidad){
      st.funcionesReutilizadas += calidad.funcionesReutilizadas;
      st.duplicados += calidad.duplicados;
      telemetriaCalidad(sub.id, calidad);
    }
    // ← NUEVO: el robot celebra con saltitos y un destello verde en el suelo
    efectosRobot.celebrar();
    destello(robot.position, true);
    efectos[efectos.length - 1].t = 0; // destello al instante (sin esperar al brazo)
    if (st.dialogoPendiente && !progreso.tieneRegistro('nivel-2')){
      progreso.marcarRegistro('nivel-2');
      import('../sistema/dialogos.js').then(({ dialogos }) => dialogos.abrirPorId('gustaff-2'));
    }
    return { ok: true, superado: true, esJefe: !!sub.esJefe };
  }

  function telemetriaCalidad(subretoId, c){
    bus.emitir(EVENTOS.TELEMETRIA, {});
    try {
      import('../sistema/telemetria.js').then(({ telemetria }) =>
        telemetria.registrar('calidad_codigo', { nivel: 'nivel-2', subreto: subretoId, ...c }));
    } catch {}
  }

  function completarNivel(){
    st.gestor?.completarObjetivo('obj-2-7', {
      metricas: {
        subretosPuntos: st.puntos,
        subretosEficientes: st.eficientes ?? 0,
        funcionesReutilizadas: st.funcionesReutilizadas,
        duplicados: st.duplicados,
        segundos: Math.round((Date.now() - st.inicioNivel) / 1000),
      },
    });
  }

  /* ── terminal del Arquitecto (se usa con E) ── */
  const TERMINAL_POS = [2.2, 0, 10.8]; // x, y, z — misma posición relativa al spawn [0,1.7,12] que en el nivel 1
  const terminal = { pos: new THREE.Vector3(...TERMINAL_POS), cerca: false, radio: 3.5 };
  const grupoTerminal = new THREE.Group();
  const luzTerminal = new THREE.PointLight('#5ad08a', 4, 8);
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, .9),
      new THREE.MeshStandardMaterial({ color: '#252d28', roughness: .7 }));
    base.position.y = .5;
    const poste = new THREE.Mesh(new THREE.BoxGeometry(.12, .5, .12),
      new THREE.MeshStandardMaterial({ color: '#8a9ba8', metalness: .3 }));
    poste.position.y = 1.15;
    const pantalla = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, .08),
      new THREE.MeshBasicMaterial({ color: '#5ad08a' }));
    pantalla.position.set(0, 1.45, 0);
    pantalla.rotation.x = -.25;
    luzTerminal.position.set(0, 1.6, 1);
    const cartel = crearCartel('PLANOS DE OBRA', '#5ad08a');
    cartel.position.set(0, 3, 0);
    grupoTerminal.add(base, poste, pantalla, luzTerminal, cartel);
    grupoTerminal.traverse(o => { if (o.isMesh) o.castShadow = true; });
    grupoTerminal.position.copy(terminal.pos);
    escena.add(grupoTerminal);
    colisionadores.push({ minX: terminal.pos.x - .7, maxX: terminal.pos.x + .7,
                          minZ: terminal.pos.z - .45, maxZ: terminal.pos.z + .45 });
  }

  /* Texto/colores del depósito según el estado del sub-reto. */
  function actualizarDepot(){
    const sub = SUBRETOS_NIVEL2[st.indice];
    const usaRecursos = sub?.verificar?.tipo === 'planoYRecursos';
    if (!usaRecursos){
      pintarCartelVivo(cartelDepot, 'DEPÓSITO · sin pedidos', '#8a9ba8');
      matDepotPantalla.color.set('#5a6a62');
    } else if (st.recursosOk){
      pintarCartelVivo(cartelDepot, 'DEPÓSITO · pedido ACEPTADO ✔', '#58f0a0');
      matDepotPantalla.color.set('#58f0a0');
    } else {
      pintarCartelVivo(cartelDepot, 'DEPÓSITO · esperando pedido', '#ffb454');
      matDepotPantalla.color.set('#ffb454');
    }
  }

  const mundo = {
    colisionadores,
    terminal,
    /** Encuadre de la vista aérea del editor: se ajusta a la plataforma de obra del sub-reto. */
    aerea: () => {
      const a = st.area;
      if (!a) return { x: 0, z: 0, medio: 8, inclinacion: 50, giro: 0 };
      const c = aMundo((a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
      const ancho = (a.x1 - a.x0 + 1) * CELDA, fondo = (a.y1 - a.y0 + 1) * CELDA;
      return { x: c.x, z: c.z, medio: Math.max(5, Math.max(ancho, fondo) / 2 + 1), inclinacion: 50, giro: 0 };
    },
        /** Posición y rumbo del robot para la cámara en primera persona. */
    camaraRobot: () => ({
      x: robot.position.x,
      z: robot.position.z,
      // el robot del taller mira hacia +z local (el del nivel 1 hacia -z),
      // por eso se resta PI para que main.js calcule bien hacia dónde mira
      yaw: robot.rotation.y - Math.PI,
    }),
    mostrarRobot: v => { robot.visible = v; },
    zonasDano: [],
    reto: {
      subretos: SUBRETOS_NIVEL2,
      indice: () => st.indice,
      actual: () => SUBRETOS_NIVEL2[st.indice],
      cargarSubreto,
      ejecutarAST,
      detener: () => motor?.detener(),
      completarNivel,
      setGestor: g => { st.gestor = g; },
    },
    update(t, dt, jugadorPos){
      brillo.update(t, dt);
      if (fondo){
        try { fondo.update(t, dt, glitch.visible && !st.jefeVencido, jugadorPos); } // el eclipse se pone rojo con el jefe
        catch (e){ console.warn('[taller] fondo desactivado por error:', e); fondo = null; }
      }
      if (jugadorPos){
        const dx = jugadorPos.x - terminal.pos.x, dz = jugadorPos.z - terminal.pos.z;
        terminal.cerca = dx * dx + dz * dz <= terminal.radio * terminal.radio;
      }
      luzTerminal.intensity = 3 + Math.sin(t * 4) * 1.2;

      // recetario: el libro flota y gira
      libro.rotation.y += dt * .8;
      libro.position.y = 1.6 + Math.sin(t * 2) * .08;

      // depósito: reacciona al pedido
      actualizarDepot();

      // grúa: el gancho se balancea suave
      gancho.position.x = -8 + Math.sin(t * 1.2) * .15;

      // SR4: el ladrillo flota dentro de la cúpula
      if (ambito.visible){
        const l = ambito.getObjectByName('ladrillos');
        if (l){ l.rotation.y += dt; l.position.y = 1.1 + Math.sin(t * 2) * .12; }
      }

      // jefe: glitch vibrando; al vencerlo se vuelve verde y se encoge
      if (glitch.visible){
        if (st.jefeVencido){
          matGlitch.color.set('#58f0a0');
          glitch.scale.setScalar(Math.max(.3, glitch.scale.x - dt * .6));
          cartelGlitch.visible = false;
          cartelVencido.visible = true;
          glitch.rotation.y += dt;
        } else {
          glitch.rotation.x += dt * 3; glitch.rotation.y += dt * 4;
          glitch.position.x = (Math.random() - .5) * .1;
        }
      }

      // fantasmas del plano: "respiran" mientras falte construirlos
      for (const f of st.fantasmas.values()){
        if (f.g.visible) f.g.material.opacity = .3 + Math.sin(t * 3 + f.p.x) * .08;
      }

      // piezas: esperan a que el brazo las suelte y luego crecen con rebote
      for (let i = anims.length - 1; i >= 0; i--){
        const a = anims[i];
        a.t += dt / .35;
        if (a.t < 0) continue;
        const k = Math.min(1, a.t);
        const e = Math.max(.001, rebote(k));
        if (a.mesh) a.mesh.scale.setScalar(e);
        else if (st._bloquesInst){
          _m.makeScale(1, a.h * e, 1).setPosition(a.x, a.h * e / 2, a.z);
          st._bloquesInst.setMatrixAt(a.idx, _m);
          st._bloquesInst.instanceMatrix.needsUpdate = true;
        }
        if (k >= 1) anims.splice(i, 1);
      }

      // destellos en el piso (verde = pieza correcta, rojo = incorrecta)
      for (let i = efectos.length - 1; i >= 0; i--){
        const e = efectos[i];
        e.t += dt / .6;
        if (e.t < 0) continue;
        e.r.visible = true;
        e.r.scale.setScalar(1 + e.t * 3);
        e.r.material.opacity = Math.max(0, .9 * (1 - e.t));
        if (e.t >= 1){
          dinamicos.remove(e.r);
          e.r.geometry.dispose(); e.r.material.dispose();
          efectos.splice(i, 1);
        }
      }

      const destino = aMundo(st.pos.x, st.pos.y);
      const enMarcha = Math.hypot(robot.position.x - destino.x, robot.position.z - destino.z) > .12;
      robot.position.lerp(destino, Math.min(1, dt * 9));
      const yaw = -st.dir * Math.PI / 2 + Math.PI;
      let d = yaw - robot.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      robot.rotation.y += d * Math.min(1, dt * 9);
      efectosRobot.update(t, dt, enMarcha);

      // brazo grúa: baja, suelta la pieza (desaparece de la pinza) y vuelve a subir con otra
      if (brazoAnim.t >= 0){
        brazoAnim.t += dt / T_BRAZO;
        const p = Math.min(1, brazoAnim.t);
        brazoPivot.rotation.x = posBrazo(p);
        cargaMano.visible = p < P_SUELTA || p > .85;
        if (p >= 1) brazoAnim.t = -1;
      } else {
        brazoPivot.rotation.x = REPOSO + Math.sin(t * 2) * .04;
        cargaMano.visible = true;
      }
      matBalizaRobot.color.set(Math.sin(t * 6) > 0 ? '#ffb060' : '#7a3a10');

      // anillo pulsante en la casilla actual
      marcador.position.set(destino.x, .07, destino.z);
      marcador.scale.setScalar(1 + Math.sin(t * 4) * .06);
    },
  };
  return mundo;
}