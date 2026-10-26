// ═══════════════════════════════════════════════════════════
// mundo/sectorAlfa.js — Nivel 1: laberinto de servidores en
// casillas, robot de rescate, puerta, fragmentos, jefe.
// Se registra en LevelManager.CONSTRUCTORES como 'nivel1'.
//
// El sector ahora es un centro de datos con vida y cada sub-reto se refleja
// en una ESTACIÓN HOLOGRÁFICA junto al spawn:
//  SR1 Secuencia      → 5 luces que se encienden una tras otra
//  SR2 Variables      → 4 cubos con los tipos de dato (entero, decimal, bool, texto)
//                       + el panel con su texto sobre la puerta
//  SR3 if/else        → bifurcación: si hay muro → derecha, si no → izquierda
//  SR4 switch         → 3 lámparas; al llamar leerCodigo() se enciende la del código
//  SR5 for            → 8 luces: cada moverAdelante() enciende una
//  SR6 while          → 12 luces: se encienden hasta que el robot llega al muro
//  JEFE               → Error de Sintaxis (glitch); se apaga al depurar bien
// Además: racks con LEDs parpadeantes, bandejas de cables, columnas de datos,
// plataforma bajo el laberinto y tablero del sub-reto.
//
// PRESUPUESTO: bajo 3000 tris (panel F2). Antes ~2300 en el peor sub-reto;
// el upgrade suma ~150 (estimado) y casi todo lo nuevo es textura, sprites
// y Points (0 tris).
//
// Capa de brillo (decorativa, no toca colisiones ni lógica):
//  estrellas, chispas flotantes, neón en los muros, halo en las bandejas de cables,
//  haz escáner sobre el laberinto, orbes luminosos, baliza sobre la terminal
//  y luces de color (cian junto a la estación, ámbar junto al tablero).
//
// UPGRADE:
//  suelo de placa de circuitos, horizonte con silueta de ciudad y planeta,
//  pulsos de datos viajando por las bandejas, 3 drones de mantenimiento,
//  charcos de luz bajo la estación y la terminal, anillo de llegada,
//  robot con halo, haz de faros y estela de chispas, fragmentos con brillo,
//  tapas de servidor y puerta con textura, y onda de éxito/error con
//  destello verde en todos los servidores.
//
// ZONA CAÍDA (nuevo, ~70 tris):
//  4 racks dañados con LED rojo, chispas y humo; cables sueltos con pulsos
//  hacia la terminal; flechas luminosas en el suelo (spawn → terminal → laberinto).
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bus, EVENTOS } from '../sistema/eventos.js';
import { RegistroAPI } from '../motor/apiMundo.js';
import { MotorEjecucion } from '../motor/motorEjecucion.js';
import { SUBRETOS_NIVEL1 } from '../../datos/subretos-nivel1.js';
import { progreso } from '../sistema/progreso.js';
import { liberarGrupo } from './liberar.js';
import { ErrorMotor } from '../motor/errores.js';
import { crearEfectosRobot } from './efectosRobot.js';

const CELDA = 2;
const DIRS = { N: 0, E: 1, S: 2, O: 3 };
const DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/* Caja sin la cara de abajo (-y), que nunca se ve: 10 triángulos en vez de 12.
   Conserva los grupos de material, así que también sirve con arreglos de materiales. */
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

/* ══════════ texturas baratas (canvas: 0 tris) ══════════ */

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
const TEX_GLOW = texturaGlow();

/* Suelo de placa de circuitos violeta (se repite). */
function texSuelo(){
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#141a30'; g.fillRect(0, 0, S, S);
  g.lineWidth = 3;
  for (let i = 0; i < 30; i++){
    let x = Math.floor(Math.random() * 16) * 32 + 16, y = Math.floor(Math.random() * 16) * 32 + 16;
    g.strokeStyle = `rgba(123,92,255,${.16 + Math.random() * .22})`;
    g.beginPath(); g.moveTo(x, y);
    const seg = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < seg; k++){
      const d = (Math.random() < .5 ? -1 : 1) * (1 + Math.floor(Math.random() * 4)) * 32;
      if (k % 2 === 0) x = Math.max(8, Math.min(S - 8, x + d)); else y = Math.max(8, Math.min(S - 8, y + d));
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = 'rgba(95,240,224,.7)'; g.fillRect(x - 4, y - 4, 8, 8);
  }
  // ── daños: manchas de quemadura, paneles faltantes, baldosas glitch y grietas ──
  const M = 48; // margen para que el patrón repetido no muestre costuras
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 8; i++){
    const x = rnd(M, S - M), y = rnd(M, S - M), r = rnd(28, 46);
    const gm = g.createRadialGradient(x, y, 0, x, y, r);
    gm.addColorStop(0, 'rgba(0,0,0,.6)'); gm.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gm; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 6; i++){
    const x = Math.floor(rnd(2, 13)) * 32, y = Math.floor(rnd(2, 13)) * 32;
    const w = 32 * (1 + Math.floor(Math.random() * 2)), h = 32;
    g.fillStyle = '#04060f'; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,93,93,.55)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  for (let i = 0; i < 5; i++){
    const x = Math.floor(rnd(2, 13)) * 32, y = Math.floor(rnd(2, 13)) * 32;
    g.fillStyle = 'rgba(255,47,180,.35)'; g.fillRect(x + 4, y + 2, 28, 5);
    g.fillStyle = 'rgba(95,240,224,.4)'; g.fillRect(x - 6, y + 12, 36, 4);
    g.fillStyle = 'rgba(255,47,180,.3)'; g.fillRect(x + 8, y + 22, 24, 3);
  }
  for (let i = 0; i < 9; i++){
    let x = rnd(M, S - M), y = rnd(M, S - M);
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++){ x += rnd(-30, 30); y += rnd(-30, 30); pts.push([x, y]); }
    for (const [col, off, ancho] of [['rgba(123,92,255,.35)', 2, 2], ['rgba(0,0,0,.85)', 0, 3]]){
      g.strokeStyle = col; g.lineWidth = ancho; g.beginPath();
      pts.forEach(([px, py], k) => k ? g.lineTo(px + off, py + off) : g.moveTo(px + off, py + off));
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

/* Relieve del suelo (bump): baldosas a distinta altura, algunas hundidas, y grietas. */
function texSueloRelieve(){
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 16)
    for (let x = 0; x < S; x += 16){
      const v = 88 + Math.floor(Math.random() * 84);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 1, y + 1, 14, 14);
    }
  for (let i = 0; i < 6; i++){
    g.fillStyle = '#1c1c1c';
    g.fillRect(Math.floor(1 + Math.random() * 13) * 16, Math.floor(1 + Math.random() * 13) * 16, 16 * (1 + Math.floor(Math.random() * 2)), 16);
  }
  g.strokeStyle = '#000'; g.lineWidth = 2;
  for (let i = 0; i < 9; i++){
    let x = 24 + Math.random() * (S - 48), y = 24 + Math.random() * (S - 48);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++){ x += (Math.random() - .5) * 30; y += (Math.random() - .5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

/* Horizonte: silueta de ciudad lejana con ventanas, en un anillo alto. */
function texHorizonte(){
  const W = 1024, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(123,92,255,0)'); gr.addColorStop(1, 'rgba(123,92,255,.4)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let x = 0;
  while (x < W){
    const w = 22 + Math.random() * 40, h = 40 + Math.random() * 120;
    g.fillStyle = '#080c26'; g.fillRect(x, H - h, w, h);
    g.fillStyle = 'rgba(95,240,224,.7)';
    for (let wy = H - h + 8; wy < H - 6; wy += 14)
      for (let wx = x + 5; wx < x + w - 6; wx += 10)
        if (Math.random() < .3) g.fillRect(wx, wy, 4, 6);
    x += w + 2;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}

/* Tapa de servidor: ranuras y LEDs. */
function texTapa(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c8cfff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#5a64c8';
  for (let y = 6; y < 60; y += 12) g.fillRect(6, y, 52, 6);
  g.fillStyle = '#ffffff';
  for (let y = 7; y < 60; y += 12)
    for (let x = 10; x < 56; x += 10) if (Math.random() < .55) g.fillRect(x, y, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Puerta de acceso (se crea por sub-reto; liberarGrupo la libera). */
function texPuerta(){
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2060'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#7b5cff'; g.lineWidth = 4; g.strokeRect(6, 6, 116, 244);
  g.fillStyle = 'rgba(123,92,255,.35)';
  for (let y = 20; y < 240; y += 24) g.fillRect(14, y, 100, 6);
  g.strokeStyle = '#5ff0e0'; g.lineWidth = 5;
  g.beginPath(); g.arc(64, 128, 22, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#5ff0e0'; g.fillRect(58, 120, 12, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Haz de los faros del robot: cono que se abre y se desvanece hacia delante. */
function texFaro(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,233,168,.65)'); gr.addColorStop(1, 'rgba(255,233,168,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(28, 128); g.lineTo(36, 128); g.lineTo(62, 0); g.lineTo(2, 0); g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}

/* Flecha (chevrón) apuntando hacia arriba del canvas, para las flechas del suelo. */
function texFlecha(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#5ff0e0'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(12, 46); g.lineTo(32, 16); g.lineTo(52, 46); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Cara de rack dañado: unidades con LEDs, huecos con cables expuestos, quemadura, grietas y franja de peligro. */
function texRackDanado(){
  const W = 128, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1526'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#4a3d66'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4);
  const ledCols = ['#ff3b3b', '#ff3b3b', '#ffb454', '#2a2140'];
  for (let y = 14; y < H - 34; y += 22){
    const roto = Math.random() < .22;
    g.fillStyle = roto ? '#050308' : '#2a2140';
    g.fillRect(10, y, 108, 18);
    g.strokeStyle = '#5a4d80'; g.lineWidth = 1; g.strokeRect(10.5, y + .5, 107, 17);
    if (roto){
      g.strokeStyle = Math.random() < .5 ? '#ff5d5d' : '#ffb454'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(20, y + 9); g.bezierCurveTo(50, y + 1, 70, y + 17, 104, y + 9); g.stroke();
    } else {
      g.fillStyle = '#161026';
      for (let x = 48; x < 108; x += 6) g.fillRect(x, y + 4, 3, 10);
      for (let k = 0; k < 3; k++){
        g.fillStyle = ledCols[Math.floor(Math.random() * ledCols.length)];
        g.fillRect(16 + k * 9, y + 6, 5, 5);
      }
    }
  }
  // quemadura en la parte alta
  const gr = g.createLinearGradient(0, 0, 0, 90);
  gr.addColorStop(0, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 90);
  // grietas
  g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 2;
  for (let i = 0; i < 3; i++){
    let x = 10 + Math.random() * 108, y = 30 + Math.random() * 120;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++){ x += (Math.random() - .5) * 26; y += 8 + Math.random() * 14; g.lineTo(x, y); }
    g.stroke();
  }
  // franja de peligro abajo
  g.save();
  g.beginPath(); g.rect(6, H - 26, W - 12, 20); g.clip();
  g.fillStyle = '#0a0710'; g.fillRect(6, H - 26, W - 12, 20);
  g.fillStyle = '#ffb454';
  for (let x = -20; x < W; x += 16){
    g.beginPath(); g.moveTo(x, H - 6); g.lineTo(x + 8, H - 6); g.lineTo(x + 18, H - 26); g.lineTo(x + 10, H - 26); g.fill();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── partículas de feedback (pool simple) ── */
class FX {
  constructor(escena){
    this.n = 120;
    this.pos = new Float32Array(this.n * 3).fill(-1000); // fuera de vista hasta la primera explosión
    this.vel = new Float32Array(this.n * 3);
    this.vida = new Float32Array(this.n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color: '#58f0a0', size: .18, transparent: true, opacity: .95, depthWrite: false });
    this.puntos = new THREE.Points(geo, this.mat);
    this.puntos.frustumCulled = false;
    escena.add(this.puntos);
  }
  explotar(p, colorHex){
    this.mat.color.set(colorHex);
    this.mat.opacity = .95; // antes solo bajaba y las explosiones se volvían invisibles
    for (let i = 0; i < this.n; i++){
      this.pos[i*3] = p.x; this.pos[i*3+1] = p.y; this.pos[i*3+2] = p.z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const v = 1.5 + Math.random() * 2.5;
      this.vel[i*3] = Math.cos(a) * Math.cos(b) * v;
      this.vel[i*3+1] = Math.sin(b) * v + 1;
      this.vel[i*3+2] = Math.sin(a) * Math.cos(b) * v;
      this.vida[i] = .8 + Math.random() * .4;
    }
    this.puntos.geometry.attributes.position.needsUpdate = true;
  }
  update(dt){
    let activo = false;
    for (let i = 0; i < this.n; i++){
      if (this.vida[i] <= 0) continue;
      activo = true;
      this.vida[i] -= dt;
      this.vel[i*3+1] -= 4 * dt;
      this.pos[i*3] += this.vel[i*3] * dt;
      this.pos[i*3+1] += this.vel[i*3+1] * dt;
      this.pos[i*3+2] += this.vel[i*3+2] * dt;
      if (this.vida[i] <= 0) this.pos[i*3+1] = -1000; // partícula muerta: se esconde
    }
    if (activo) this.puntos.geometry.attributes.position.needsUpdate = true;
  }
}

/* ── estela de chispas que deja el robot al moverse (Points: 0 tris) ── */
class Estela {
  constructor(escena){
    this.n = 48; this.i = 0;
    this.pos = new Float32Array(this.n * 3).fill(-1000);
    this.col = new Float32Array(this.n * 3);
    this.vida = new Float32Array(this.n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.puntos = new THREE.Points(geo, new THREE.PointsMaterial({
      size: .34, map: TEX_GLOW, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    this.puntos.frustumCulled = false;
    escena.add(this.puntos);
  }
  emitir(x, y, z){
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos[i*3] = x + (Math.random() - .5) * .25;
    this.pos[i*3+1] = y;
    this.pos[i*3+2] = z + (Math.random() - .5) * .25;
    this.vida[i] = 1;
  }
  update(dt){
    for (let i = 0; i < this.n; i++){
      if (this.vida[i] <= 0) continue;
      this.vida[i] -= dt * 1.6;
      const k = Math.max(0, this.vida[i]);
      this.col[i*3] = .37 * k; this.col[i*3+1] = .94 * k; this.col[i*3+2] = .88 * k;
      this.pos[i*3+1] += dt * .35;
      if (this.vida[i] <= 0) this.pos[i*3+1] = -1000;
    }
    this.puntos.geometry.attributes.position.needsUpdate = true;
    this.puntos.geometry.attributes.color.needsUpdate = true;
  }
}

/* Cartel flotante: el ancho se adapta al texto. */
function crearCartel(texto, color = '#58f0a0'){
  const ancho = Math.max(256, texto.length * 14 + 40);
  const c = document.createElement('canvas');
  c.width = ancho; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,15,46,.85)'; g.fillRect(0, 0, ancho, 64);
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(2, 2, ancho - 4, 60);
  g.fillStyle = color; g.font = 'bold 22px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, ancho / 2, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(ancho / 80, .8, 1);
  return s;
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
  g.fillStyle = 'rgba(10,15,46,.88)'; g.fillRect(6, 6, 500, 180);
  g.strokeStyle = '#7b5cff'; g.lineWidth = 3; g.strokeRect(6, 6, 500, 180);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!sub){
    g.fillStyle = '#7b5cff'; g.font = 'bold 30px monospace';
    g.fillText('SECTOR ALFA', 256, 70);
    g.fillStyle = '#9fa8ff'; g.font = '20px monospace';
    g.fillText('Usa la terminal (E)', 256, 130);
  } else {
    g.fillStyle = '#9fa8ff'; g.font = 'bold 20px monospace';
    g.fillText(sub.esJefe ? 'JEFE FINAL' : `SUB-RETO ${indice + 1} / ${total - 1}`, 256, 34);
    g.fillStyle = '#eef0ff'; g.font = 'bold 30px monospace';
    g.fillText(sub.nombre, 256, 88, 470);
    g.fillStyle = '#58f0a0'; g.font = 'bold 24px monospace';
    g.fillText(sub.concepto, 256, 136, 470);
  }
  tb.tex.needsUpdate = true;
}

/* ══════════ BRILLO: estrellas, chispas, neón, halos, escáner, baliza y luces de color ══════════
   Todo decorativo (no toca colisiones ni lógica). Se crea en crearSectorAlfa() y se anima en update(). */

function crearBrillo(escena){
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
    size: 1.1, map: tex, color: '#cfd6ff', transparent: true, opacity: .8,
    blending: ADITIVO, depthWrite: false, fog: false,
  });
  grupo.add(new THREE.Points(geoE, matE));

  /* ── horizonte (silueta de ciudad lejana: 32 tris) y planeta (2 tris) ── */
  const matHor = new THREE.MeshBasicMaterial({
    map: texHorizonte(), transparent: true, side: THREE.BackSide, depthWrite: false, fog: false });
  const horizonte = new THREE.Mesh(new THREE.CylinderGeometry(62, 62, 30, 16, 1, true), matHor);
  horizonte.position.y = 15;
  grupo.add(horizonte);
  const planeta = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: '#7b5cff', transparent: true, opacity: .55, blending: ADITIVO, depthWrite: false, fog: false }));
  planeta.scale.set(22, 22, 1);
  planeta.position.set(-42, 36, -55);
  grupo.add(planeta);

  /* ── cielo glitch: cúpula con franjas y bloques de cian/magenta que saltan a ráfagas (~100 tris) ── */
  const matGlitch = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: ADITIVO, fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vDir;
      float h(float n){ return fract(sin(n * 91.345) * 47453.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      // puntos en rejilla; n es entero para que no haya costura en el giro de 360°
      float puntos(vec2 uv, float umbral){
        vec2 id = floor(uv);
        vec2 f = fract(uv) - .5;
        return step(umbral, h2(id)) * smoothstep(.2, .0, length(f));
      }
      // 3 capas de estrellas con velocidades distintas (parallax) + banda de nebulosa
      vec3 capas(float az, float y, float t){
        float u = az / 6.2831853;
        float lejos  = puntos(vec2(u * 24.0 + t * .004, y * 10.0), .86);
        float medio  = puntos(vec2(u * 48.0 + t * .012, y * 20.0), .88);
        float cerca  = puntos(vec2(u * 96.0 + t * .030, y * 40.0), .92);
        vec3 c = vec3(.55, .45, 1.0) * lejos * .6 + vec3(.7, .85, 1.0) * medio * .9 + vec3(.4, 1.0, .95) * cerca * 1.2;
        float neb = .5 + .5 * sin(az * 4.0 + t * .1 + sin(y * 6.0 + t * .2) * 2.0);
        neb *= smoothstep(.08, .5, y) * (1.0 - smoothstep(.5, 1.0, y));
        return c + vec3(.3, .15, .9) * neb * .16;
      }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        float az = atan(d.z, d.x);
        float tt = floor(uTime * 8.0);
        float rafaga = step(.5, h(floor(uTime * 1.1) + 7.0));   // ~50% de los segundos hay interferencia

        // rasgado horizontal: algunas franjas se desplazan de lado
        float banda = floor(y * 34.0);
        float rasgo = step(.88, h(banda * 1.3 + tt)) * rafaga;
        az += (h(banda + tt * 3.0) - .5) * .5 * rasgo;

        // separación RGB (más fuerte durante la interferencia)
        float sep = .004 + rafaga * .012 + rasgo * .03;
        vec3 col = vec3(capas(az + sep, y, uTime).r, capas(az, y, uTime).g, capas(az - sep, y, uTime).b);

        // barra rodante de tele, líneas de barrido, estática y parpadeo
        float barra = exp(-pow((fract(y * 1.6 - uTime * .12) - .5) * 9.0, 2.0)) * .10;
        float scan = .88 + .12 * sin(y * 900.0);
        float estatica = (h2(vec2(az * 300.0, y * 300.0) + tt) - .5) * (.05 + rafaga * .14);
        float parpadeo = .93 + .07 * h(floor(uTime * 30.0));
        col = (col + vec3(.35, .3, .6) * barra + estatica) * scan * parpadeo;
        col += vec3(.9, .2, .8) * rasgo * .12;   // franja rasgada con tinte magenta

        float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0) * smoothstep(.0, .1, y);
        gl_FragColor = vec4(col, a);
      }`,
  });
  grupo.add(new THREE.Mesh(new THREE.SphereGeometry(72, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), matGlitch));

  /* ── chispas flotantes (violeta y cian) ── */
  const NC = 160;
  const posC = new Float32Array(NC * 3);
  const colC = new Float32Array(NC * 3);
  const velC = new Float32Array(NC);
  const fasC = new Float32Array(NC);
  const violeta = new THREE.Color('#7b5cff'), cian = new THREE.Color('#5ff0e0');
  for (let i = 0; i < NC; i++){
    posC[i * 3]     = (Math.random() - .5) * 32;
    posC[i * 3 + 1] = Math.random() * 7;
    posC[i * 3 + 2] = (Math.random() - .5) * 40;
    velC[i] = .3 + Math.random() * .5;
    fasC[i] = Math.random() * 6.28;
    const c = Math.random() < .6 ? violeta : cian;
    colC[i * 3] = c.r; colC[i * 3 + 1] = c.g; colC[i * 3 + 2] = c.b;
  }
  const geoC = new THREE.BufferGeometry();
  geoC.setAttribute('position', new THREE.BufferAttribute(posC, 3));
  geoC.setAttribute('color', new THREE.BufferAttribute(colC, 3));
  const matC = new THREE.PointsMaterial({
    size: .24, map: tex, vertexColors: true, transparent: true, opacity: .9,
    blending: ADITIVO, depthWrite: false,
  });
  grupo.add(new THREE.Points(geoC, matC));

  /* ── neón en lo alto de los muros del sector ── */
  const matNeon = new THREE.MeshBasicMaterial({ color: '#7b5cff', side: THREE.DoubleSide });
  const geoNeon = new THREE.PlaneGeometry(59, .1);
  for (const [x, z, giro] of [[0, -29.45, 0], [0, 29.45, 0], [-29.45, 0, Math.PI / 2], [29.45, 0, Math.PI / 2]]){
    const n = new THREE.Mesh(geoNeon, matNeon);
    n.position.set(x, 3.8, z);
    n.rotation.y = giro;
    grupo.add(n);
  }

  /* ── halo de las bandejas de cables ── */
  const matHalo = new THREE.MeshBasicMaterial({
    color: '#6f5cff', transparent: true, opacity: .14, blending: ADITIVO, depthWrite: false,
  });
  for (const x of [-17.5, 17.5]){
    const h = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 56), matHalo);
    h.rotation.x = -Math.PI / 2;
    h.position.set(x, .02, 0);
    grupo.add(h);
  }

  /* ── pulsos de datos que viajan por las bandejas (sprites: 2 tris) ── */
  const pulsos = [];
  for (const x of [-17.5, 17.5]){
    for (let k = 0; k < 2; k++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: '#5ff0e0', transparent: true, opacity: .95, blending: ADITIVO, depthWrite: false }));
      s.scale.set(1.2, 1.2, 1);
      s.position.set(x, .25, -28 + k * 28);
      grupo.add(s);
      pulsos.push({ s, v: (x < 0 ? 1 : -1) * (5 + k * 2.5) });
    }
  }

  /* ── haz escáner sobre el laberinto ── */
  const escaner = new THREE.Mesh(new THREE.PlaneGeometry(30, .25),
    new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: .18, blending: ADITIVO, depthWrite: false }));
  escaner.rotation.x = -Math.PI / 2;
  escaner.position.y = .04;
  grupo.add(escaner);

  /* ── orbes luminosos: junto a las luces violeta y en lo alto de las columnas de datos ── */
  for (const [x, y, z, color, escala, op] of [
    [-16, 4, 0, '#7b5cff', 3.4, .8], [16, 4, 0, '#7b5cff', 3.4, .8],
    [-16, 12.2, -26, '#5ff0e0', 4, .7], [16, 12.2, -26, '#5ff0e0', 4, .7],
    [-16, 12.2, 26, '#5ff0e0', 4, .7], [16, 12.2, 26, '#5ff0e0', 4, .7],
  ]){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color, transparent: true, opacity: op, blending: ADITIVO, depthWrite: false,
    }));
    s.scale.set(escala, escala, 1);
    s.position.set(x, y, z);
    grupo.add(s);
  }

  /* ── drones de mantenimiento patrullando (octaedro + brillo) ── */
  const geoDron = new THREE.OctahedronGeometry(.22);
  const matDron = new THREE.MeshBasicMaterial({ color: '#cfd6ff' });
  const drones = [];
  [[14, 20, 5.5, .32], [17, 24, 6.6, -.26], [11, 16, 7.6, .4]].forEach(([Rx, Rz, y, vel], i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geoDron, matDron));
    g.add(new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: '#7b5cff', transparent: true, opacity: .9, blending: ADITIVO, depthWrite: false })));
    g.children[1].scale.set(1.3, 1.3, 1);
    grupo.add(g);
    drones.push({ g, Rx, Rz, y, vel, fase: i * 2.1 });
  });

  /* ── charcos de luz en el suelo: bajo la estación holográfica y bajo la terminal (2 tris c/u) ── */
  const geoCharco = new THREE.PlaneGeometry(1, 1);
  const charcos = [];
  for (const [x, z, w, d, color] of [[-6, 12.5, 10, 4, '#5fe0ff'], [2.2, 9.8, 4.2, 4.2, '#58f0a0']]){
    const m = new THREE.Mesh(geoCharco, new THREE.MeshBasicMaterial({
      map: tex, color, transparent: true, opacity: .4, blending: ADITIVO, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, d, 1);
    m.position.set(x, .035, z);
    grupo.add(m);
    charcos.push(m);
  }

  /* ── anillo de llegada en el punto de aparición (40 tris) ── */
  const anilloLlegada = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 20),
    new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
  anilloLlegada.rotation.x = -Math.PI / 2;
  anilloLlegada.position.set(0, .045, 11);
  grupo.add(anilloLlegada);

  /* ── baliza verde sobre la terminal del Arquitecto ── */
  const matBaliza = new THREE.SpriteMaterial({
    map: tex, color: '#caffe6', transparent: true, opacity: 1, blending: ADITIVO, depthWrite: false,
  });
  const baliza = new THREE.Sprite(matBaliza);
  baliza.scale.set(.7, .7, 1);
  baliza.position.set(2.2, 4.1, 9.8);
  const halBaliza = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: '#58f0a0', transparent: true, opacity: .9, blending: ADITIVO, depthWrite: false,
  }));
  halBaliza.scale.set(2.4, 2.4, 1);
  halBaliza.position.copy(baliza.position);
  grupo.add(baliza, halBaliza);

  /* ── luces de color ── */
  const luzCian = new THREE.PointLight('#5fe0ff', 5, 12, 2);
  luzCian.position.set(-6, 3, 12.5);   // junto a la estación holográfica
  const luzAmbar = new THREE.PointLight('#ffb454', 5, 14, 2);
  luzAmbar.position.set(0, 5, -16);    // junto al tablero
  grupo.add(luzCian, luzAmbar);

  return {
    update(t, dt){
      // estrellas
      matE.opacity = .65 + Math.sin(t * .7) * .15;

      // cielo glitch
      matGlitch.uniforms.uTime.value = t;
      // la ciudad del horizonte se desliza lento (parallax) y salta durante la interferencia
      matHor.userData.x = (matHor.userData.x ?? 0) + dt * .004;
      const salto = (Math.sin(t * 37) > .85 && Math.sin(t * 1.7) > .3) ? (Math.random() - .5) * .02 : 0;
      matHor.map.offset.x = matHor.userData.x + salto;

      // horizonte y planeta respirando
      planeta.material.opacity = .45 + Math.sin(t * .5) * .1;

      // chispas
      for (let i = 0; i < NC; i++){
        posC[i * 3 + 1] += velC[i] * dt;
        posC[i * 3] += Math.sin(t * .8 + fasC[i]) * dt * .25;
        if (posC[i * 3 + 1] > 7){
          posC[i * 3 + 1] = 0;
          posC[i * 3]     = (Math.random() - .5) * 32;
          posC[i * 3 + 2] = (Math.random() - .5) * 40;
        }
      }
      geoC.attributes.position.needsUpdate = true;

      // neón y halo pulsando
      matNeon.color.setHSL(.7, .9, .55 + Math.sin(t * 1.5) * .12);
      matHalo.opacity = .1 + Math.sin(t * 2) * .06;

      // pulsos de datos recorriendo las bandejas
      for (const p of pulsos){
        p.s.position.z += p.v * dt;
        if (p.s.position.z > 28) p.s.position.z = -28;
        else if (p.s.position.z < -28) p.s.position.z = 28;
      }

      // drones en órbita elíptica
      for (const d of drones){
        const a = t * d.vel + d.fase;
        d.g.position.set(Math.cos(a) * d.Rx, d.y + Math.sin(t * 2 + d.fase) * .25, Math.sin(a) * d.Rz);
        d.g.rotation.y += dt * 2;
      }

      // charcos de luz y anillo de llegada respirando
      charcos.forEach((c, i) => { c.material.opacity = .32 + Math.sin(t * 1.8 + i * 1.7) * .1; });
      anilloLlegada.scale.setScalar(1 + Math.sin(t * 2.2) * .07);
      anilloLlegada.material.opacity = .35 + Math.sin(t * 2.2) * .2;

      // escáner: barre el laberinto de norte a sur
      escaner.position.z = -10 + ((t * 2.5) % 20);

      // baliza parpadeando
      const on = Math.sin(t * 5) > 0;
      matBaliza.color.set(on ? '#caffe6' : '#1f6a45');
      halBaliza.material.opacity = on ? .9 : .15;

      // luces de color respirando
      luzCian.intensity = 4 + Math.sin(t * 1.7) * 1.5;
      luzAmbar.intensity = 4 + Math.sin(t * 1.3 + 1) * 1.5;
    },
    dispose(){
      escena.remove(grupo);
      grupo.traverse(o => {
        if (!o.isSprite) o.geometry?.dispose();
        o.material?.dispose();
      });
      matHor.map?.dispose();
      tex.dispose();
    },
  };
}

/* ══════════ ZONA CAÍDA: racks dañados con humo, cables con pulsos y flechas guía ══════════
   Decorativo. Los racks sí tienen colisión para que no se atraviesen. */

/* Giro en Y para que un plano tumbado (rotation.order 'YXZ') apunte hacia (dx, dz). */
function yawHacia(dx, dz){ return Math.atan2(-dx, -dz); }

function crearZonaCaida(escena, colisionadores){
  const grupo = new THREE.Group();
  escena.add(grupo);
  const ADITIVO = THREE.AdditiveBlending;
  const TERM = { x: 2.2, z: 10.7 };   // donde llegan los cables (frente a la terminal)

  /* ── racks dañados: [x, z, inclinación, giro, caído] (ajusta a gusto) ── */
  const RACKS = [
    { x: -9,  z: 20, rz:  .22, ry:  .3, caido: false },
    { x:  8,  z: 22, rz: -.26, ry: -.2, caido: false },
    { x: -3,  z: 25, rz: Math.PI / 2, ry: 0, caido: true },
    { x: 12,  z: 17, rz:  .16, ry:  .5, caido: false },
  ];
  const geoRack = cajaSinBase(1.6, 3.2, 1.2);
  const texRack = texRackDanado();
  const matRackLado = new THREE.MeshStandardMaterial({
    color: '#2a1f33', roughness: .7, emissive: '#3a0f18', emissiveIntensity: .5 });
  const matRackFrente = new THREE.MeshStandardMaterial({
    color: '#ffffff', map: texRack, roughness: .7, emissive: '#ffffff', emissiveMap: texRack, emissiveIntensity: .7 });
  // orden de caras: +x, -x, +y, -y (sin usar), +z, -z
  const matRack = [matRackLado, matRackLado, matRackLado, matRackLado, matRackFrente, matRackFrente];
  for (const r of RACKS){
    const m = new THREE.Mesh(geoRack, matRack);
    m.rotation.order = 'YXZ';
    m.rotation.set(0, r.ry, r.rz);
    // inclinado: la esquina alta apoya en el suelo y la baja queda hundida (sin hueco debajo)
    const a = Math.abs(r.rz);
    const yRack = r.caido ? .8 : 1.6 * Math.cos(a) - .8 * Math.sin(a);
    m.position.set(r.x, yRack, r.z);
    m.castShadow = false;
    grupo.add(m);
    r.cima = r.caido ? 1.3 : yRack + 1.6 * Math.cos(a) + .8 * Math.sin(a);
    // colisión (caído: largo sobre X)
    const hx = r.caido ? 1.7 : 1, hz = r.caido ? .9 : 1;
    colisionadores.push({ minX: r.x - hx, maxX: r.x + hx, minZ: r.z - hz, maxZ: r.z + hz });
  }

  /* ── LED rojo parpadeante en cada rack ── */
  const leds = RACKS.map((r, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: '#ff3b3b', transparent: true, opacity: 1, blending: ADITIVO, depthWrite: false }));
    s.scale.set(.9, .9, 1);
    s.position.set(r.x, r.cima - .5, r.z + .7);
    grupo.add(s);
    return { s, fase: i * 1.7 };
  });

  /* ── chispas que saltan de los racks (Points: 0 tris) ── */
  const NS = 40;
  const posS = new Float32Array(NS * 3).fill(-1000);
  const velS = new Float32Array(NS * 3);
  const vidaS = new Float32Array(NS);
  for (let i = 0; i < NS; i++) vidaS[i] = Math.random() * 1.5;
  const geoS = new THREE.BufferGeometry();
  geoS.setAttribute('position', new THREE.BufferAttribute(posS, 3));
  const puntosS = new THREE.Points(geoS, new THREE.PointsMaterial({
    size: .17, map: TEX_GLOW, color: '#ff9c3f', transparent: true, opacity: .95,
    blending: ADITIVO, depthWrite: false }));
  puntosS.frustumCulled = false;
  grupo.add(puntosS);
  function nacerChispa(i){
    const r = RACKS[i % RACKS.length];
    posS[i*3] = r.x + (Math.random() - .5) * .8;
    posS[i*3+1] = r.cima;
    posS[i*3+2] = r.z + (Math.random() - .5) * .6;
    velS[i*3] = (Math.random() - .5) * 2.2;
    velS[i*3+1] = 1 + Math.random() * 2;
    velS[i*3+2] = (Math.random() - .5) * 2.2;
    vidaS[i] = .5 + Math.random() * .6;
  }

  /* ── humo: sprites que suben, crecen y se desvanecen ── */
  const humo = [];
  RACKS.forEach((r, ri) => {
    for (let k = 0; k < 3; k++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX_GLOW, color: '#8a8fb5', transparent: true, opacity: 0, depthWrite: false }));
      grupo.add(s);
      humo.push({ s, r, fase: ri * .37 + k / 3 });
    }
  });

  /* ── cables sueltos desde cada rack hasta la terminal, con pulso de luz ── */
  const matCable = new THREE.MeshBasicMaterial({ color: '#3a4ad0', side: THREE.DoubleSide });
  const cables = RACKS.map((r, i) => {
    const fx = TERM.x + (i - 1.5) * .3;
    const dx = fx - r.x, dz = TERM.z - r.z;
    const largo = Math.hypot(dx, dz);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(.1, largo), matCable);
    c.rotation.order = 'YXZ';
    c.rotation.set(-Math.PI / 2, yawHacia(dx, dz), 0);
    c.position.set((r.x + fx) / 2, .04, (r.z + TERM.z) / 2);
    grupo.add(c);
    const p = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: '#ffb454', transparent: true, opacity: .95, blending: ADITIVO, depthWrite: false }));
    p.scale.set(.9, .9, 1);
    grupo.add(p);
    return { p, x0: r.x, z0: r.z, x1: fx, z1: TERM.z, fase: i * .25 };
  });

  /* ── flechas en el suelo: [x, z, haciaX, haciaZ, escala] spawn → terminal → laberinto ── */
  const geoFlecha = new THREE.PlaneGeometry(1, 1);
  const texF = texFlecha();
  const FLECHAS = [
    [.7, 10.6, TERM.x, 9.8, .7], [1.25, 10.25, TERM.x, 9.8, .7],   // spawn → terminal
    [2.2, 8.4, 2.2, 0, .9], [2.2, 7.2, 2.2, 0, .9],                // terminal → laberinto
  ];
  const flechas = FLECHAS.map(([x, z, hx, hz, esc]) => {
    const m = new THREE.Mesh(geoFlecha, new THREE.MeshBasicMaterial({
      map: texF, transparent: true, opacity: .5, blending: ADITIVO, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2, yawHacia(hx - x, hz - z), 0);
    m.scale.set(esc, esc, 1);
    m.position.set(x, .05, z);
    grupo.add(m);
    return m;
  });

  /* ── losas de suelo levantadas: relieve real en las zonas libres (10 tris c/u, decorativas) ── */
  {
    const N = 30;
    const losas = new THREE.InstancedMesh(cajaSinBase(1, .22, 1),
      new THREE.MeshStandardMaterial({ color: '#232b5a', roughness: .85, emissive: '#10163a', emissiveIntensity: .5 }), N);
    // evitar: estación holográfica, spawn/terminal, racks dañados
    const evitar = [[-6, 12.5, 6], [1, 10, 5], ...RACKS.map(r => [r.x, r.z, 4])];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const p = new THREE.Vector3(), s = new THREE.Vector3();
    let n = 0, intentos = 0;
    while (n < N && intentos++ < 400){
      const x = (Math.random() - .5) * 32, z = (Math.random() - .5) * 52;
      if (Math.abs(x) < 12 && z > -13 && z < 10) continue;   // zona del laberinto
      if (evitar.some(([ex, ez, er]) => (x - ex) ** 2 + (z - ez) ** 2 < er * er)) continue;
      e.set((Math.random() - .5) * .45, Math.random() * 6.28, (Math.random() - .5) * .45);
      q.setFromEuler(e);
      s.set(.8 + Math.random() * 1.4, 1, .8 + Math.random() * 1.4);
      p.set(x, .04, z);
      m4.compose(p, q, s);
      losas.setMatrixAt(n++, m4);
    }
    losas.count = n;
    losas.castShadow = losas.receiveShadow = true;
    grupo.add(losas);
  }

  return {
    update(t, dt){
      // LEDs rojos con parpadeo irregular
      for (const l of leds){
        const on = Math.sin(t * 6 + l.fase) + Math.sin(t * 2.3 + l.fase * 2) > .2;
        l.s.material.opacity = on ? 1 : .12;
      }

      // chispas
      for (let i = 0; i < NS; i++){
        vidaS[i] -= dt;
        if (vidaS[i] <= 0){
          if (Math.random() < dt * 1.2) nacerChispa(i); else posS[i*3+1] = -1000;
          continue;
        }
        velS[i*3+1] -= 6 * dt;
        posS[i*3] += velS[i*3] * dt;
        posS[i*3+1] += velS[i*3+1] * dt;
        posS[i*3+2] += velS[i*3+2] * dt;
        if (posS[i*3+1] < 0) vidaS[i] = 0;
      }
      geoS.attributes.position.needsUpdate = true;

      // humo
      for (const h of humo){
        const k = (t * .22 + h.fase) % 1;
        h.s.position.set(h.r.x + Math.sin(t * .6 + h.fase * 6) * .3 + k * .6, h.r.cima + k * 3.2, h.r.z);
        h.s.scale.setScalar(.9 + k * 2.4);
        h.s.material.opacity = .26 * Math.sin(Math.PI * k);
      }

      // pulsos por los cables hacia la terminal
      for (const c of cables){
        const k = (t * .35 + c.fase) % 1;
        c.p.position.set(c.x0 + (c.x1 - c.x0) * k, .22, c.z0 + (c.z1 - c.z0) * k);
      }

      // flechas encendiéndose en secuencia
      flechas.forEach((f, k) => {
        f.material.opacity = .15 + .6 * Math.max(0, Math.sin(t * 3 - k * .9));
      });
    },
  };
}

export function crearSectorAlfa(escena, anisotropia = 4){
  const colisionadores = [];
  const dinamicos = new THREE.Group();
  escena.add(dinamicos);

  /* ── entorno fijo ── */
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ map: texSuelo(), bumpMap: texSueloRelieve(), bumpScale: 6, roughness: .95 })
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);
  const rejilla = new THREE.GridHelper(60, 30, 0x39406e, 0x232a4d);
  rejilla.position.y = .01;
  rejilla.material.transparent = true;
  rejilla.material.opacity = .55;
  escena.add(rejilla);
  // límite del sector
  const matMuro = new THREE.MeshStandardMaterial({ color: '#1a2140', roughness: .9 });
  const geoMuroLimite = cajaSinBase(1, 4, 1); // escalada por .scale
  for (const [x, z, w, d] of [[0, -30, 60, 1], [0, 30, 60, 1], [-30, 0, 1, 60], [30, 0, 1, 60]]){
    const m = new THREE.Mesh(geoMuroLimite, matMuro);
    m.scale.set(w, 1, d);
    m.position.set(x, 2, z); m.receiveShadow = true;
    escena.add(m);
    colisionadores.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
  }

  /* ── iluminación propia del nivel 1 ──
     LevelManager limpia la escena al cargar y este constructor no creaba luces,
     por eso todo se veía negro. aplicarPaleta() recolorea estas luces y la niebla. */
  escena.background = new THREE.Color('#0a0f2e');
  escena.fog = new THREE.Fog('#241d4d', 28, 85);
  const luzHemi = new THREE.HemisphereLight('#5a4a9e', '#1a1633', 1.5);
  const luzSol = new THREE.DirectionalLight('#ffffff', 3);
  luzSol.position.set(14, 26, 12);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(1024, 1024);
  Object.assign(luzSol.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 80 });
  escena.add(luzHemi, luzSol);
  for (const x of [-16, 16]){
    const l = new THREE.PointLight('#7b5cff', 16, 30, 2);
    l.position.set(x, 4, 0);
    escena.add(l);
  }
  const brillo = crearBrillo(escena);
  const zonaCaida = crearZonaCaida(escena, colisionadores);

  /* ══════════ centro de datos: racks con LEDs, cables y columnas ══════════ */
  {
    const xs = [-20, -23.5];
    const lista = [];
    for (const lado of [-1, 1])
      for (const ax of xs)
        for (let z = -24; z <= 24.1; z += 3.2) lista.push({ x: lado * Math.abs(ax), z, lado });

    const matRack = new THREE.MeshStandardMaterial({ color: '#1a2140', roughness: .7, emissive: '#10163a', emissiveIntensity: .5 });
    const racks = new THREE.InstancedMesh(cajaSinBase(1.6, 3.2, 1.2), matRack, lista.length);
    // LEDs: planos (2 tris) pegados a la cara que mira al laberinto
    const geoLed = new THREE.PlaneGeometry(.9, .12);
    const ledsA = new THREE.InstancedMesh(geoLed,
      new THREE.MeshBasicMaterial({ color: '#58f0a0', side: THREE.DoubleSide }), lista.length);
    const ledsB = new THREE.InstancedMesh(geoLed,
      new THREE.MeshBasicMaterial({ color: '#5ff0e0', side: THREE.DoubleSide }), lista.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion(), ejeY = new THREE.Vector3(0, 1, 0);
    const uno = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    lista.forEach((r, i) => {
      m.identity().setPosition(r.x, 1.6, r.z); racks.setMatrixAt(i, m);
      const cara = r.x + (r.lado < 0 ? .82 : -.82); // cara que mira al laberinto
      q.setFromAxisAngle(ejeY, r.lado < 0 ? Math.PI / 2 : -Math.PI / 2);
      m.compose(pos.set(cara, 2.5, r.z), q, uno); ledsA.setMatrixAt(i, m);
      m.compose(pos.set(cara, 1.4, r.z), q, uno); ledsB.setMatrixAt(i, m);
    });
    racks.receiveShadow = true; // no proyectan sombra: caen fuera de la zona de juego
    escena.add(racks, ledsA, ledsB);
    ledsA.userData.led = ledsB.userData.led = true;
    escena._ledsA = ledsA; escena._ledsB = ledsB;

    // un colisionador largo por columna de racks
    for (const lado of [-1, 1])
      for (const ax of xs){
        const x = lado * Math.abs(ax);
        colisionadores.push({ minX: x - .8, maxX: x + .8, minZ: -26, maxZ: 26 });
      }

    // bandejas de cables luminosas
    const matCable = new THREE.MeshBasicMaterial({ color: '#6f5cff' });
    for (const x of [-17.5, 17.5]){
      const c = new THREE.Mesh(new THREE.PlaneGeometry(.25, 56), matCable);
      c.rotation.x = -Math.PI / 2;
      c.position.set(x, .03, 0);
      escena.add(c);
    }
    // columnas de datos en las esquinas
    escena._columnas = [];
    for (const [x, z] of [[-16, -26], [16, -26], [-16, 26], [16, 26]]){
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 12, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: .25, depthWrite: false }));
      col.position.set(x, 6, z);
      escena.add(col);
      escena._columnas.push(col);
    }
  }

  const fx = new FX(escena);
  const estela = new Estela(escena);
  let acumEstela = 0;

  /* ── onda de éxito/error (una sola malla reutilizada; solo se dibuja mientras viaja) ── */
  const ondaFin = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 24),
    new THREE.MeshBasicMaterial({ color: '#58f0a0', transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  ondaFin.rotation.x = -Math.PI / 2;
  ondaFin.visible = false;
  escena.add(ondaFin);
  let tOnda = -1;
  let flashExito = 0;      // ← esta faltaba
  let flashError = 0;
  const colTapaError = new THREE.Color('#ff3b3b');
  function lanzarOnda(pos, color){
    ondaFin.position.set(pos.x, .08, pos.z);
    ondaFin.material.color.set(color);
    ondaFin.visible = true;
    tOnda = 0;
  }

  const geoRobot = new THREE.Group();
  let cabezaRobot, bolaRobot;
  {
    const matCasco = new THREE.MeshStandardMaterial({ color: '#dfe7ff', roughness: .35, metalness: .3, emissive: '#2b3f8f', emissiveIntensity: .25 });
    const matOscuro = new THREE.MeshStandardMaterial({ color: '#2a3270', roughness: .6, metalness: .2 });
    const matAcento = new THREE.MeshStandardMaterial({ color: '#8fb7ff', emissive: '#2b3f8f', emissiveIntensity: .7, roughness: .4 });
    const matOjo = new THREE.MeshBasicMaterial({ color: '#5ff0e0' });
    const matFaro = new THREE.MeshBasicMaterial({ color: '#ffe9a8' });

    // orugas
    for (const lado of [-1, 1]){
      const oruga = new THREE.Mesh(new THREE.BoxGeometry(.28, .3, 1.2), matOscuro);
      oruga.position.set(lado * .5, .15, 0);
      geoRobot.add(oruga);
    }
    // chasis y torso
    const chasis = new THREE.Mesh(new THREE.BoxGeometry(.72, .28, 1.0), matAcento);
    chasis.position.y = .32;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.8, .4, .85), matCasco);
    torso.position.y = .64;
    geoRobot.add(chasis, torso);

    // faros delanteros
    for (const lado of [-1, 1]){
      const faro = new THREE.Mesh(new THREE.PlaneGeometry(.16, .1), matFaro);
      faro.position.set(lado * .22, .34, -.51);
      geoRobot.add(faro);
    }

    // cabeza (sube y baja suavemente)
    cabezaRobot = new THREE.Group();
    const cabeza = new THREE.Mesh(new THREE.BoxGeometry(.7, .38, .6), matCasco);
    cabeza.position.set(0, 1.04, -.08);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(.56, .2, .06), matOscuro);
    visor.position.set(0, 1.06, -.4);
    cabezaRobot.add(cabeza, visor);
    for (const lado of [-1, 1]){
      const ojo = new THREE.Mesh(new THREE.PlaneGeometry(.14, .08), matOjo);
      ojo.material.side = THREE.DoubleSide;
      ojo.position.set(lado * .14, 1.06, -.435);
      cabezaRobot.add(ojo);
    }
    // antena con bola luminosa
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .3, 6), matOscuro);
    antena.position.set(-.26, 1.38, .12);
    bolaRobot = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 4),
      new THREE.MeshStandardMaterial({ color: '#58f0a0', emissive: '#2bd8b0', emissiveIntensity: 1.2 }));
    bolaRobot.position.set(-.26, 1.56, .12);
    // flecha dorada sobre la cabeza: apunta al FRENTE (-z), se ve bien desde la vista aérea
    const flecha = new THREE.Mesh(new THREE.ConeGeometry(.26, .55, 3),
      new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: 1.1 }));
    flecha.rotation.x = -Math.PI / 2;
    flecha.position.set(0, 1.3, -.1);
    cabezaRobot.add(antena, bolaRobot, flecha);

    geoRobot.add(cabezaRobot);
    geoRobot.traverse(o => { if (o.isMesh) o.castShadow = true; });

    // upgrade: halo bajo el robot y haz de luz de los faros (2 tris c/u, sin sombra)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: '#5ff0e0', transparent: true, opacity: .55,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(2.6, 2.6, 1);
    halo.position.y = .15;
    const haz = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3),
      new THREE.MeshBasicMaterial({ map: texFaro(), transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    haz.rotation.x = -Math.PI / 2;
    haz.position.set(0, .06, -2);
    geoRobot.add(halo, haz);
  }
  escena.add(geoRobot);
  const efectos = crearEfectosRobot(escena, geoRobot, { bola: bolaRobot }, { chispas: (p, c) => fx.explotar(p, c) });
  
  /* ── tablero del sub-reto ── */
  const tablero = crearTablero();
  tablero.sprite.position.set(0, 6.5, -18);
  escena.add(tablero.sprite);
  pintarTablero(tablero, null, -1, SUBRETOS_NIVEL1.length);

  /* ══════════ estación holográfica (cambia en cada sub-reto) ══════════ */
  const holo = new THREE.Group();
  holo.position.set(-6, 0, 12.5);
  escena.add(holo);
  const lamparas = [];
  const geoLamp = new THREE.SphereGeometry(.28, 8, 6);
  const matLampOff = new THREE.MeshStandardMaterial({ color: '#2a3270', emissive: '#1a2050', emissiveIntensity: .3 });
  const matLampOn = new THREE.MeshStandardMaterial({ color: '#7ef0d0', emissive: '#2bd8b0', emissiveIntensity: 1.4 });
  const geoCubo = new THREE.BoxGeometry(.8, .8, .8);
  let modoHolo = -1;
  let glitchHolo = null, cartelVencidoHolo = null;

  function limpiarHolo(){
    for (const c of [...holo.children]){
      c.traverse(o => {
        if (o.isSprite){ o.material.map?.dispose(); o.material.dispose(); }
        else if (o.isMesh && o.userData.propia){ o.geometry.dispose(); o.material.dispose(); }
        else if (o.isMesh && o.userData.matPropia){ o.material.dispose(); }
      });
      holo.remove(c);
    }
    lamparas.length = 0;
    glitchHolo = null; cartelVencidoHolo = null;
  }
  function lampara(x, y = .5){
    const l = new THREE.Mesh(geoLamp, matLampOff);
    l.position.set(x, y, 0);
    holo.add(l);
    lamparas.push(l);
    return l;
  }
  function cartelHolo(txt, color, y = 2.4, x = 0, escala = 1){
    const c = crearCartel(txt, color);
    c.position.set(x, y, 0);
    c.scale.multiplyScalar(escala);
    holo.add(c);
    return c;
  }

  function construirHolo(i, sub){
    limpiarHolo();
    modoHolo = i;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2),
      new THREE.MeshStandardMaterial({ color: '#1c2447', emissive: '#3a4ad0', emissiveIntensity: .4 }));
    base.rotation.x = -Math.PI / 2;
    base.position.y = .08; base.userData.propia = true;
    holo.add(base);
    switch (i){
      case 0: // secuencia
        for (let k = 0; k < 5; k++) lampara(-2 + k);
        cartelHolo('SECUENCIA · una orden tras otra', '#58f0a0');
        break;
      case 1: { // variables: tipos de dato
        const colores = { entero: '#7ef0d0', decimal: '#7ec8ff', bool: '#ffd27a', texto: '#ff9cf0' };
        (sub.fichas ?? []).forEach((f, k) => {
          const tipo = typeof f.v === 'string' ? 'texto' : typeof f.v === 'boolean' ? 'bool'
            : Number.isInteger(f.v) ? 'entero' : 'decimal';
          const col = colores[tipo];
          const cubo = new THREE.Mesh(geoCubo, new THREE.MeshStandardMaterial({
            color: col, emissive: col, emissiveIntensity: .45, roughness: .5 }));
          cubo.userData.matPropia = true;
          cubo.position.set(-2.7 + k * 1.8, .85, 0);
          cubo.userData.girar = true;
          holo.add(cubo);
          const v = typeof f.v === 'string' ? `"${f.v}"` : String(f.v);
          cartelHolo(`${v} · ${tipo}`, col, 1.8, -2.7 + k * 1.8, .7);
        });
        cartelHolo('VARIABLES · tipos de dato', '#9fa8ff', 2.8);
        break;
      }
      case 2: { // if / else
        const matA = new THREE.MeshStandardMaterial({ color: '#ff8d7a', emissive: '#a03a2a', emissiveIntensity: .7 });
        const matB = new THREE.MeshStandardMaterial({ color: '#7ef0d0', emissive: '#2bd8b0', emissiveIntensity: .7 });
        const der = new THREE.Mesh(new THREE.ConeGeometry(.35, .9, 8), matA);
        der.rotation.z = -Math.PI / 2; der.position.set(1.6, 1, 0); der.userData.propia = true;
        const izq = new THREE.Mesh(new THREE.ConeGeometry(.35, .9, 8), matB);
        izq.rotation.z = Math.PI / 2; izq.position.set(-1.6, 1, 0); izq.userData.propia = true;
        holo.add(der, izq);
        cartelHolo('si hay muro', '#ff8d7a', 1.8, 1.6, .65);
        cartelHolo('si no', '#7ef0d0', 1.8, -1.6, .65);
        cartelHolo('if / else · el robot elige', '#9fa8ff', 2.8);
        break;
      }
      case 3: // switch
        for (let k = 0; k < 3; k++){
          lampara(-1.5 + k * 1.5, .8);
          cartelHolo(String(k + 1), '#9fa8ff', 1.6, -1.5 + k * 1.5, .4);
        }
        cartelHolo('switch · según el código', '#58f0a0', 2.6);
        break;
      case 4: // for
        for (let k = 0; k < 8; k++) lampara(-3.5 + k);
        cartelHolo('for · 8 vueltas, 8 pasos', '#58f0a0');
        break;
      case 5: // while
        for (let k = 0; k < 12; k++) lampara(-3.85 + k * .7);
        cartelHolo('while · hasta que haya muro', '#58f0a0');
        break;
      default: { // jefe
        const mat = new THREE.MeshBasicMaterial({ color: '#ff5d5d', wireframe: true });
        glitchHolo = new THREE.Mesh(new THREE.IcosahedronGeometry(.8, 0), mat);
        glitchHolo.position.y = 1.8; glitchHolo.userData.propia = true;
        holo.add(glitchHolo);
        cartelHolo('ERROR DE SINTAXIS', '#ff5d5d', 3.2);
        cartelVencidoHolo = cartelHolo('DEPURADO ✔', '#58f0a0', 3.2);
        cartelVencidoHolo.visible = false;
      }
    }
  }

  /* ── estado del reto ── */
  const estadoReto = {
    indice: -1, muros: new Set(), cols: 0, filas: 0,
    robot: { x: 0, y: 0, dir: 1 },
    fragmentos: new Map(), puerta: null, panel: null, codigo: 1,
    registroG: null, dialogoPendiente: false,
    pasos: 0, codigoLeido: false, jefeVencido: false,
    puntos: 0, eficiencia: 0, inicioNivel: Date.now(),
    gestor: null,
  };
  let motor = null;

  const celdaClave = (x, y) => `${x},${y}`;
  const celdaAMundo = (x, y) => new THREE.Vector3(
    (x - estadoReto.cols / 2 + .5) * CELDA, 0, (y - estadoReto.filas / 2 + .5) * CELDA);

  const geoServidor = cajaSinBase(CELDA * .96, 1.2, CELDA * .96);
  const matLado = new THREE.MeshStandardMaterial({ color: '#4a58b8', roughness: .6 });

  const texTapaServidor = texTapa();
  const matTapa = new THREE.MeshStandardMaterial({
    color: '#8f9cff', map: texTapaServidor, emissive: '#3a4ad0', emissiveMap: texTapaServidor, emissiveIntensity: .6 });
  const colTapaBase = new THREE.Color('#3a4ad0'), colTapaExito = new THREE.Color('#2bd8b0');
  const matServidor = [matLado, matLado, matTapa, matLado, matLado, matLado];
  const geoFragmento = new THREE.OctahedronGeometry(.4);
  const matFragmento = new THREE.MeshStandardMaterial({ color: '#7ef0d0', emissive: '#2bd8b0', emissiveIntensity: 1.4, flatShading: true });
  const matGlowFrag = new THREE.SpriteMaterial({
    map: TEX_GLOW, color: '#7ef0d0', transparent: true, opacity: .8,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const geoRegistro = new THREE.OctahedronGeometry(.42);
  const matRegistro = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: 1.2, flatShading: true });

  /* Fragmento con brillo (octaedro + sprite hijo: 10 tris). */
  function crearFragmentoMalla(){
    const m = new THREE.Mesh(geoFragmento, matFragmento);
    const g = new THREE.Sprite(matGlowFrag);
    g.scale.setScalar(1.7);
    m.add(g);
    return m;
  }

  function cargarSubreto(i){
    const sub = SUBRETOS_NIVEL1[i];
    estadoReto.indice = i;
    estadoReto.muros.clear(); estadoReto.fragmentos.clear();
    estadoReto.puerta = null; estadoReto.panel = sub.panelTexto ?? null;
    estadoReto.registroG = null;
    estadoReto.dialogoPendiente = false;
    estadoReto.pasos = 0; estadoReto.codigoLeido = false; estadoReto.jefeVencido = false;
    estadoReto.codigo = 1 + Math.floor(Math.random() * 3);

    liberarGrupo(dinamicos); // ← libera lo anterior (geom + mat + tex)

    // colisiones dinámicas previas
    for (let k = colisionadores.length - 1; k >= 0; k--){
      if (colisionadores[k]._dinamica) colisionadores.splice(k, 1);
    }

    const filas = sub.mapa.length, cols = sub.mapa[0].length;
    estadoReto.filas = filas; estadoReto.cols = cols;
    // las líneas de la rejilla caen en los bordes de las casillas (según paridad del mapa)
    rejilla.position.x = (cols % 2) * (CELDA / 2);
    rejilla.position.z = (filas % 2) * (CELDA / 2);

    // plataforma luminosa bajo el laberinto
    {
      const pg = new THREE.PlaneGeometry(cols * CELDA + 1.2, filas * CELDA + 1.2);
      const plat = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: '#1f2a5a', transparent: true, opacity: .55, depthWrite: false }));
      plat.rotation.x = -Math.PI / 2; plat.position.y = .02;
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(pg), new THREE.LineBasicMaterial({ color: '#6f5cff' }));
      borde.rotation.x = -Math.PI / 2; borde.position.y = .03;
      dinamicos.add(plat, borde);
    }

    // 1 pasada: contar servidores y fragmentos para InstancedMesh
    const servidores = [], fragmentos = [];
    for (let y = 0; y < filas; y++){
      for (let x = 0; x < cols; x++){
        const c = sub.mapa[y][x];
        if (c === '#'){ servidores.push({ x, y }); estadoReto.muros.add(celdaClave(x, y)); }
        else if (c === 'F') fragmentos.push({ x, y });
        else if (c === 'R'){ estadoReto.robot.x = x; estadoReto.robot.y = y; estadoReto.robot.dir = DIRS[sub.direccionInicial ?? 'E']; }
        else if (c === 'P') estadoReto.puerta = { x, y, abierta: false };
        else if (c === 'G' && !progreso.tieneRegistro('nivel-1')) estadoReto.registroG = { x, y };
      }
    }

    // InstancedMesh de servidores (1 draw call)
    if (servidores.length){
      const inst = new THREE.InstancedMesh(geoServidor, matServidor, servidores.length);
      const m = new THREE.Matrix4();
      servidores.forEach((s, idx) => {
        m.identity().setPosition(
          (s.x - cols/2 + .5) * CELDA, .6, (s.y - filas/2 + .5) * CELDA);
        inst.setMatrixAt(idx, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = inst.receiveShadow = true;
      dinamicos.add(inst);
    }


    // colisiones por servidor
    for (const s of servidores){
      const p = celdaAMundo(s.x, s.y);
      colisionadores.push({
        minX: p.x - CELDA/2, maxX: p.x + CELDA/2,
        minZ: p.z - CELDA/2, maxZ: p.z + CELDA/2, _dinamica: true,
      });
    }

    // fragmentos (pocos: malla individual compartida, con brillo)
    for (const f of fragmentos){
      const malla = crearFragmentoMalla();
      malla.position.copy(celdaAMundo(f.x, f.y)).setY(1);
      dinamicos.add(malla);
      estadoReto.fragmentos.set(celdaClave(f.x, f.y), malla);
    }

    // puerta (1 mesh) + panel con su texto encima
    if (estadoReto.puerta){
      const { x, y } = estadoReto.puerta;
      estadoReto.puerta.malla = new THREE.Mesh(
        new THREE.BoxGeometry(CELDA * .9, 2.4, .4),
        new THREE.MeshStandardMaterial({ color: '#ffffff', map: texPuerta(), emissive: '#7b5cff', emissiveIntensity: .7 }));
      estadoReto.puerta.malla.position.copy(celdaAMundo(x, y)).setY(1.2);
      dinamicos.add(estadoReto.puerta.malla);
      const v = celdaAMundo(x, y);
      estadoReto.puerta.col = {
        minX: v.x - CELDA/2, maxX: v.x + CELDA/2, minZ: v.z - CELDA/2, maxZ: v.z + CELDA/2, _dinamica: true,
      };
      colisionadores.push(estadoReto.puerta.col);
      if (sub.panelTexto){
        const panel = crearCartel(`PANEL: ${sub.panelTexto}`, '#7b5cff');
        panel.position.copy(v).setY(3.2);
        dinamicos.add(panel);
      }
    }

    // registro de Gustaff
    if (estadoReto.registroG){
      const malla = new THREE.Mesh(geoRegistro, matRegistro);
      malla.position.copy(celdaAMundo(estadoReto.registroG.x, estadoReto.registroG.y)).setY(1);
      dinamicos.add(malla);
    }

    // fragmento dinámico del switch
    if (sub.id === 'sr4') colocarFragmentoCorredor();
    const objetivo = geoRobot.position;
    objetivo.copy(celdaAMundo(estadoReto.robot.x, estadoReto.robot.y));
    geoRobot.rotation.y = -estadoReto.robot.dir * Math.PI / 2;
    efectos.reiniciar();
    
    // reflejo visual del sub-reto
    pintarTablero(tablero, sub, i, SUBRETOS_NIVEL1.length);
    construirHolo(i, sub);

    bus.emitir(EVENTOS.MOTOR_INICIO, {}); // reutilizado como "reto listo"
    return sub;
  }

  function colocarFragmentoCorredor(){
    const { codigo } = estadoReto;
    const fin = codigo === 1 ? { x: 4, y: 1 } : codigo === 2 ? { x: 7, y: 4 } : { x: 4, y: 7 };
    const malla = crearFragmentoMalla();
    malla.position.copy(celdaAMundo(fin.x, fin.y)).setY(1);
    dinamicos.add(malla);
    estadoReto.fragmentos.set(celdaClave(fin.x, fin.y), malla);
  }

  /* ── API del mundo ── */
  function crearAPI(){
    const api = new RegistroAPI();
    const adelante = () => DELTA[estadoReto.robot.dir];
    api.registrar('moverAdelante', () => {
      const [dx, dy] = adelante();
      const nx = estadoReto.robot.x + dx, ny = estadoReto.robot.y + dy;
      const clave = celdaClave(nx, ny);
      if (estadoReto.muros.has(clave))
        throw new ErrorMotor('RUNTIME', 'El robot chocó contra un servidor bloqueado.', 0);
      if (estadoReto.puerta && !estadoReto.puerta.abierta && estadoReto.puerta.x === nx && estadoReto.puerta.y === ny)
        throw new ErrorMotor('RUNTIME', 'La puerta está cerrada: necesita el código correcto.', 0);
      estadoReto.robot.x = nx; estadoReto.robot.y = ny;
      estadoReto.pasos++; // enciende una luz del contador (SR5/SR6)
      if (estadoReto.registroG && nx === estadoReto.registroG.x && ny === estadoReto.registroG.y)
        estadoReto.dialogoPendiente = true;
      return true;
    }, 'Avanza una casilla');
    api.registrar('girar', direccion => {
      if (direccion === 'derecha') estadoReto.robot.dir = (estadoReto.robot.dir + 1) % 4;
      else if (direccion === 'izquierda') estadoReto.robot.dir = (estadoReto.robot.dir + 3) % 4;
      else throw new ErrorMotor('TYPE_ERROR', 'girar solo acepta "derecha" o "izquierda".', 0);
      return estadoReto.robot.dir;
    }, 'Gira 90°');
    api.registrar('leerSensor', () => {
      const [dx, dy] = adelante();
      const clave = celdaClave(estadoReto.robot.x + dx, estadoReto.robot.y + dy);
      if (estadoReto.muros.has(clave)) return 'muro';
      if (estadoReto.puerta && !estadoReto.puerta.abierta && estadoReto.puerta.x === estadoReto.robot.x + dx && estadoReto.puerta.y === estadoReto.robot.y + dy) return 'puerta';
      if (estadoReto.fragmentos.has(clave)) return 'fragmento';
      return 'libre';
    }, 'Qué hay delante: muro/libre/fragmento/puerta');
    api.registrar('leerPanel', () => estadoReto.panel ?? '', 'Lee el panel de datos');
    api.registrar('leerCodigo', () => {
      estadoReto.codigoLeido = true; // se enciende la lámpara del código (SR4)
      return estadoReto.codigo;
    }, 'Lee el código numérico del panel');
    api.registrar('abrirPuerta', codigo => {
      if (!estadoReto.puerta) throw new ErrorMotor('RUNTIME', 'Aquí no hay ninguna puerta.', 0);
      if (String(codigo) !== String(estadoReto.panel)){
        throw new ErrorMotor('RUNTIME', `El código «${codigo}» no abre la puerta. Mira bien el panel.`, 0);
      }
      estadoReto.puerta.abierta = true;
      dinamicos.remove(estadoReto.puerta.malla);
      const i = colisionadores.indexOf(estadoReto.puerta.col);
      if (i >= 0) colisionadores.splice(i, 1);
      fx.explotar(estadoReto.puerta.malla.position.clone(), '#7b5cff');
      lanzarOnda(estadoReto.puerta.malla.position, '#7b5cff');
      return true;
    }, 'Abre la puerta con el código correcto');
    api.registrar('recolectar', () => {
      const clave = celdaClave(estadoReto.robot.x, estadoReto.robot.y);
      const malla = estadoReto.fragmentos.get(clave);
      if (!malla) return false;
      estadoReto.fragmentos.delete(clave);
      dinamicos.remove(malla);
      fx.explotar(celdaAMundo(estadoReto.robot.x, estadoReto.robot.y).setY(1), '#58f0a0');
      return true;
    }, 'Recolecta el fragmento de la casilla actual');
    api.registrar('mostrar', v => {
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'mostrar', args: [v], resultado: v });
      return v;
    }, 'Muestra un valor en la consola');
    return api;
  }

  /* ── ejecución ── */
  async function ejecutarAST(ast, { bloquesUsados = 0, animado = true } = {}){
    efectos.reiniciar();
    const sub = SUBRETOS_NIVEL1[estadoReto.indice];
    estadoReto.pasos = 0;          // los contadores del holograma parten de cero en cada ejecución
    estadoReto.codigoLeido = false;
    motor = new MotorEjecucion(bus);
    const limites = { maxPasos: sub.maxPasos, maxProfundidad: 16, tiempoMaxMs: 5000 };
    const res = await motor.ejecutar(ast, crearAPI(), limites, { animado, delayMundo: 300, delayPaso: 40 });
    if (res.ok){
      if (estadoReto.fragmentos.size === 0){
        // ¡sub-reto superado!
        if (sub.esJefe) estadoReto.jefeVencido = true; // el glitch se apaga
        estadoReto.puntos += sub.esJefe ? 40 : 10;
        if (!sub.esJefe){
          estadoReto.gestor?.completarObjetivo(`obj-1-${estadoReto.indice + 1}`, {
            metricas: { subretosPuntos: estadoReto.puntos },
          });
        }
        if (bloquesUsados > 0 && bloquesUsados <= sub.minBloques) estadoReto.eficientes = (estadoReto.eficientes ?? 0) + 1;
        fx.explotar(geoRobot.position.clone().setY(1.2), '#58f0a0');
        efectos.celebrar();
        lanzarOnda(geoRobot.position, '#58f0a0');
        flashExito = 1;
        if (estadoReto.dialogoPendiente && !progreso.tieneRegistro('nivel-1')){
          progreso.marcarRegistro('nivel-1');
          import('../sistema/dialogos.js').then(({ dialogos }) => dialogos.abrirPorId('gustaff-1'));
        }
        return { ok: true, superado: true, esJefe: !!sub.esJefe };
      }
      return { ok: true, superado: false };
    }
    efectos.explotar();
    lanzarOnda(geoRobot.position, '#ff5d5d');
    flashError = 1;
    return { ok: false, error: res.error };
  }

  function completarNivel(){
    estadoReto.gestor?.completarObjetivo('obj-1-7', {
      metricas: {
        subretosPuntos: estadoReto.puntos,
        subretosEficientes: estadoReto.eficientes ?? 0,
        segundos: Math.round((Date.now() - estadoReto.inicioNivel) / 1000),
      },
    });
  }

  /* ── terminal del Arquitecto (se usa con E) ── */
  const TERMINAL_POS = [2.2, 0, 9.8]; // x, y, z — cerca del spawn [0,1.7,11], ajústalo a gusto
  const terminal = { pos: new THREE.Vector3(...TERMINAL_POS), cerca: false, radio: 3.5 };

  const grupoTerminal = new THREE.Group();
  const luzTerminal = new THREE.PointLight('#58f0a0', 4, 8);
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, .9),
      new THREE.MeshStandardMaterial({ color: '#1c2447', roughness: .7 }));
    base.position.y = .5;
    const poste = new THREE.Mesh(new THREE.BoxGeometry(.12, .5, .12),
      new THREE.MeshStandardMaterial({ color: '#39406e' }));
    poste.position.y = 1.15;
    const pantalla = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, .08),
      new THREE.MeshBasicMaterial({ color: '#58f0a0' }));
    pantalla.position.set(0, 1.45, 0);
    pantalla.rotation.x = -.25;
    luzTerminal.position.set(0, 1.6, 1);
    const cartel = crearCartel('ARQUITECTO', '#58f0a0');
    cartel.position.set(0, 3, 0);
    grupoTerminal.add(base, poste, pantalla, luzTerminal, cartel);
    grupoTerminal.traverse(o => { if (o.isMesh) o.castShadow = true; });
    grupoTerminal.position.copy(terminal.pos);
    escena.add(grupoTerminal);
    colisionadores.push({ minX: terminal.pos.x - .7, maxX: terminal.pos.x + .7,
                          minZ: terminal.pos.z - .45, maxZ: terminal.pos.z + .45 });
  }

  const mundo = {
    colisionadores,
    terminal,
    /** Encuadre de la vista aérea del editor: centro y medio lado del laberinto. */
    aerea: () => ({
      x: 0, z: 0,
      medio: Math.max(6, Math.max(estadoReto.cols, estadoReto.filas) * CELDA / 2 + 0.8),
      inclinacion: 60,
      giro: 0,
    }), 
        /** Posición y rumbo del robot para la cámara de seguimiento. */
    camaraRobot: () => ({
      x: geoRobot.position.x,
      z: geoRobot.position.z,
      yaw: geoRobot.rotation.y,
    }),
    
    mostrarRobot: v => { geoRobot.visible = v; },
    zonasDano: [],
    reto: {
      subretos: SUBRETOS_NIVEL1,
      indice: () => estadoReto.indice,
      actual: () => SUBRETOS_NIVEL1[estadoReto.indice],
      cargarSubreto,
      ejecutarAST,
      detener: () => motor?.detener(),
      completarNivel,
      setGestor: g => { estadoReto.gestor = g; },
      puntos: () => estadoReto.puntos,
    },
    update(t, dt, jugadorPos){
      brillo.update(t, dt);
      zonaCaida.update(t, dt);
      if (jugadorPos){
        const dx = jugadorPos.x - terminal.pos.x, dz = jugadorPos.z - terminal.pos.z;
        terminal.cerca = dx * dx + dz * dz <= terminal.radio * terminal.radio;
        luzTerminal.intensity = 3 + Math.sin(t * 4) * 1.2;
      }

      // racks: los LEDs parpadean en fases distintas; las columnas de datos respiran
      if (escena._ledsA){
        const a = .35 + (Math.sin(t * 2.1) + 1) * .325;
        const b = .35 + (Math.sin(t * 2.1 + 2.4) + 1) * .325;
        escena._ledsA.material.color.setRGB(.35 * a, 1 * a, .63 * a);
        escena._ledsB.material.color.setRGB(.37 * b, .94 * b, .88 * b);
      }
      if (escena._columnas){
        escena._columnas.forEach((c, k) => { c.material.opacity = .15 + (Math.sin(t * 1.5 + k) + 1) * .1; });
      }

      // servidores: las tapas laten y destellan en verde al superar un reto
      flashExito = Math.max(0, flashExito - dt * .7);
      flashError = Math.max(0, flashError - dt * 1.2);
      const kF = Math.max(flashExito, flashError);
      matTapa.emissive.lerpColors(colTapaBase, flashError > flashExito ? colTapaError : colTapaExito, Math.min(1, kF));
      matTapa.emissiveIntensity = .5 + Math.sin(t * 1.6) * .12 + kF * .9;

      // onda de éxito/error: crece y se desvanece; luego se oculta
      if (tOnda >= 0){
        tOnda += dt;
        const k = tOnda / 1.4;
        ondaFin.scale.setScalar(1 + tOnda * 14);
        ondaFin.material.opacity = Math.max(0, .9 * (1 - k));
        if (k >= 1){ tOnda = -1; ondaFin.visible = false; }
      }

      // tablero flotando
      tablero.sprite.position.y = 6.5 + Math.sin(t * 1.5) * .08;

      // estación holográfica según el sub-reto
      switch (modoHolo){
        case 0: { // secuencia: una luz tras otra
          const act = Math.floor(t * 2.5) % lamparas.length;
          lamparas.forEach((l, k) => { l.material = k === act ? matLampOn : matLampOff; });
          break;
        }
        case 1:
          holo.children.forEach(o => { if (o.userData.girar) o.rotation.y += dt; });
          break;
        case 3: // switch: la lámpara del código se enciende al leerlo
          lamparas.forEach((l, k) => {
            l.material = estadoReto.codigoLeido && k === estadoReto.codigo - 1 ? matLampOn : matLampOff;
          });
          break;
        case 4: case 5: // for / while: una luz por cada paso del robot
          lamparas.forEach((l, k) => { l.material = k < estadoReto.pasos ? matLampOn : matLampOff; });
          break;
        case 6: // jefe
          if (glitchHolo){
            if (estadoReto.jefeVencido){
              glitchHolo.material.color.set('#58f0a0');
              glitchHolo.scale.setScalar(Math.max(.3, glitchHolo.scale.x - dt * .6));
              glitchHolo.rotation.y += dt;
              if (cartelVencidoHolo) cartelVencidoHolo.visible = true;
              holo.children.forEach(o => { if (o.isSprite && o !== cartelVencidoHolo && o.position.y === 3.2) o.visible = false; });
            } else {
              glitchHolo.rotation.x += dt * 3; glitchHolo.rotation.y += dt * 4;
              glitchHolo.position.x = (Math.random() - .5) * .1;
            }
          }
          break;
      }

      // animación del robot hacia su casilla lógica
      const destino = celdaAMundo(estadoReto.robot.x, estadoReto.robot.y);
      const enMarcha = Math.hypot(geoRobot.position.x - destino.x, geoRobot.position.z - destino.z) > .12;

      geoRobot.position.lerp(destino, Math.min(1, dt * 9));
      efectos.update(t, dt, enMarcha);
      const yawObj = -estadoReto.robot.dir * Math.PI / 2;
      let d = yawObj - geoRobot.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      geoRobot.rotation.y += d * Math.min(1, dt * 9);
      // estela de chispas mientras avanza
      if (enMarcha){
        acumEstela += dt;
        while (acumEstela > .04){
          acumEstela -= .04;
          estela.emitir(geoRobot.position.x, .22, geoRobot.position.z);
        }
      }
      estela.update(dt);
      // fragmentos flotando
      for (const malla of estadoReto.fragmentos.values()){
        if (malla){ malla.rotation.y += dt * 1.5; malla.position.y = 1 + Math.sin(t * 2 + malla.position.x) * .15; }
      }
      cabezaRobot.position.y = Math.sin(t * 3) * .025;
      bolaRobot.material.emissiveIntensity = 1.2 + Math.sin(t * 6) * .6;
      fx.update(dt);
    },
  };
  return mundo;
}