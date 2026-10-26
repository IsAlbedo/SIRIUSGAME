// ═══════════════════════════════════════════════════════════
// mundo/academiaEspecializacion.js — Nivel 4: academia azul/blanco,
// árbol de herencia 3D, incendio y especialistas respondiendo.
//
// Cada sub-reto tiene su reflejo en el mundo:
//  SR1 ¿Es-un o tiene-un?  → dos arcos: ES-UN (herencia) y TIENE-UN (composición)
//  SR2 extends + super()   → árbol 3D: al registrar un especialista se
//                            iluminan su plataforma y su rama hasta Ciudadano
//  SR3 override            → aparece la plataforma del Bombero bajo TrabajadorIndustrial
//  SR4 incendio            → el edificio arde, hay heridos en el suelo; apagarFuego()
//                            y curar() los resuelven de verdad en 3D
//  SR5 polimorfismo        → cartel «Ciudadano ciudadano = new Bombero()»
// Un tablero muestra el sub-reto activo.
// Incluye una terminal física: acércate y pulsa E para abrir el editor.
//
// NUEVO · MIRADOR DE HERENCIA (la terminal ahora está arriba):
//  · ESCALERA FLOTANTE de 8 peldaños que sube hasta la plataforma.
//  · ASCENSOR: pisa la placa y sube/baja solo (también se llama desde la plataforma).
//  · PLATAFORMA elevada con barandillas holográficas y la terminal.
//  · ATALAYA: 3 piedras flotantes y una isla con el registro de Gustaff (salto opcional).
//  · mundo.alturaEn(x, z, yPies): superficie que el jugador puede pisar. Admite
//    plataformas con hueco debajo (main.js lo pasa a jugador.setColisionadores).
//
// FONDO: crepúsculo azul de academia (cielo con astro pálido, ciudad de cúpulas y
// colinas lejanas, campus en plano medio, nubes, bruma azul, faroles cian, aves y globos, ≈ 310 tris).
// Se tiñe de rojo mientras el edificio arde (SR4/SR5).
// Se activa con USAR_FONDO y, si fallara, el nivel sigue como antes.
//
// PRESUPUESTO: la escena debe quedar bajo 3000 tris (panel F2).
// Lo que más pesaba eran los TOROS (un torus 8×24 = 384 tris cada uno):
// ahora los aros son RingGeometry planos. Además: sprites con brillo,
// texturas de canvas (pasillo, ventanas, banderas), geometrías compartidas,
// Points (0 tris) para estrellas, motas, glifos y brillos bajo las plataformas,
// y LineSegments (0 tris) para barandillas y guías del ascensor.
// El mirador completo suma ≈ 300 tris; se compensa con aros de columna más ligeros.
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { bus, EVENTOS } from '../sistema/eventos.js';
import { ErrorMotor } from '../motor/errores.js';
import { RegistroAPI } from '../motor/apiMundo.js';
import { MotorEjecucion } from '../motor/motorEjecucion.js';
import { SUBRETOS_NIVEL4 } from '../../datos/subretos-nivel4.js';
import { progreso } from '../sistema/progreso.js';

const _dir = new THREE.Vector3(); // reutilizado por frame: evita asignaciones 

/* ══════════ MIRADOR DE HERENCIA: medidas (todo en un sitio para ajustarlo fácil) ══════════ */
const AO = CONFIG.jugador?.alturaOjos ?? 1.7;   // altura de ojos del jugador
const PASO_ALTO = .7;                  // cuánto puede subir el jugador de golpe (peldaño / salto asistido)
const RISE = .45, N_PASOS = 8, PROF_PASO = .9;
const DECK_H = RISE * N_PASOS;         // 3.6: altura de la plataforma de la terminal
const ESC = { x0: 2.2, zc: 10.5, ancho: 2.6 };                                   // escalera: sube hacia +x
const DECK = { minX: ESC.x0 + N_PASOS * PROF_PASO, maxX: 17, minZ: 8, maxZ: 13 };  // plataforma (minX = 9.4)
const LIFT = { minX: 12.5, maxX: 14.9, minZ: 5.6, maxZ: 8 };                     // ascensor: pegado al borde z = 8
const LIFT_VEL = 1.6;                  // unidades por segundo
const ZP = 10.5;                       // z de las piedras flotantes y de la isla
const PIEDRAS = [[18.1, 4.1], [20, 4.6], [21.9, 5.1]];                           // [x, altura]
const ISLA = { x: 24.7, z: ZP, r: 1.7, y: 5.6 };                                 // atalaya con el registro
const PAD = { x: 13.7, z: 9.3 };                                                 // placa de llamada del ascensor

/* ══════════ geometrías compartidas (no se liberan) ══════════ */
const compartida = g => { g.userData.compartida = true; return g; };
const GEO_ONDA = compartida(new THREE.RingGeometry(.94, 1, 24));            // 48 tris
const GEO_BOCANADA = compartida(new THREE.SphereGeometry(1, 6, 4));         // se escala
const GEO_PULSO = compartida(new THREE.SphereGeometry(.2, 6, 4));
const GEO_CUERPO = compartida(new THREE.CylinderGeometry(.3, .36, 1.2, 6));
const GEO_CABEZA = compartida(new THREE.SphereGeometry(.26, 6, 4));
const GEO_HALO = compartida(new THREE.RingGeometry(.5, .65, 12));
const GEO_CASCO = compartida(new THREE.SphereGeometry(.31, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2));
const GEO_CRUZ_H = compartida(new THREE.BoxGeometry(.28, .08, .04));
const GEO_CRUZ_V = compartida(new THREE.BoxGeometry(.08, .28, .04));
const GEO_ANTENA = compartida(new THREE.CylinderGeometry(.02, .02, .5, 4, 1, true));
const GEO_PUNTA = compartida(new THREE.OctahedronGeometry(.07));
const GEO_BOLSA = compartida(new THREE.BoxGeometry(.3, .35, .15));

/* ══════════ texturas y sprites baratos ══════════ */

/* Brillo suave reutilizable (un sprite = 2 tris). */
function texGlow(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(.35, 'rgba(255,255,255,.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const TEX_GLOW = texGlow();
function crearGlow(color, tam){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX_GLOW, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(tam);
  return s;
}

/* Pasillo de 40×40: losetas, cuadrícula y anillos concéntricos (0 tris extra). */
function texPasillo(){
  const S = 512, u = S / 40;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#3b5280'; g.fillRect(0, 0, S, S);
  const n = 20, p = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
    g.fillStyle = `rgba(160,200,255,${Math.random() * .07})`;
    g.fillRect(i * p, j * p, p, p);
  }
  g.strokeStyle = 'rgba(111,176,255,.28)'; g.lineWidth = 1.5;
  for (let i = 0; i <= n; i++){
    g.beginPath(); g.moveTo(i * p, 0); g.lineTo(i * p, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * p); g.lineTo(S, i * p); g.stroke();
  }
  g.strokeStyle = 'rgba(159,198,255,.8)'; g.lineWidth = 3;
  for (const [r, a] of [[6, .9], [12, .5], [18, .3]]){
    g.globalAlpha = a; g.beginPath(); g.arc(S / 2, S / 2, r * u, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Placa de la plataforma elevada: azul oscuro con rejilla cian (0 tris extra). */
function texCubierta(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1d3563'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(111,176,255,.55)'; g.lineWidth = 2;
  g.strokeRect(2, 2, 124, 124);
  g.strokeStyle = 'rgba(111,176,255,.25)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 3);
  return t;
}

/* Ventana del edificio (se tiñe de naranja con el material.color cuando arde). */
function texVentana(){
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(4, 4, 88, 56);
  g.fillStyle = 'rgba(20,40,80,.55)';
  g.fillRect(46, 4, 4, 56); g.fillRect(4, 30, 88, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Bandera de academia. */
function texBandera(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 160;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 160);
  gr.addColorStop(0, '#2c6fb8'); gr.addColorStop(1, '#1b3f78');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 160);
  g.strokeStyle = '#e8f1fa'; g.lineWidth = 4; g.strokeRect(4, 4, 56, 152);
  g.fillStyle = '#e8f1fa';
  g.beginPath(); g.moveTo(32, 50); g.lineTo(50, 80); g.lineTo(32, 110); g.lineTo(14, 80); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Glifo de código flotante (sprite = 2 tris). */
function crearGlifo(txt){
  const c = document.createElement('canvas'); c.width = 192; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#bfe3ff'; g.fillText(txt, 96, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, opacity: .6, depthWrite: false }));
  s.scale.set(2.4, .8, 1);
  return s;
}

/* ══════════ utilidades de sprites de texto ══════════ */

function crearEtiqueta(){
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.6, 1.3, 1);
  sprite.position.y = 2.4;
  return { canvas, tex, sprite };
}
function pintarEtiqueta(et, { nombre, clase, energia }){
  const g = et.canvas.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(10,16,30,.8)'; g.fillRect(8, 8, 240, 112);
  g.strokeStyle = 'rgba(111,176,255,.7)'; g.strokeRect(8, 8, 240, 112);
  g.fillStyle = '#eaf4ff'; g.font = 'bold 24px monospace'; g.textAlign = 'center';
  g.fillText(String(nombre ?? 'null'), 128, 42);
  g.fillStyle = '#6fb0ff'; g.font = '19px monospace';
  g.fillText(String(clase ?? 'null'), 128, 72);
  g.fillStyle = '#7fe0ff';
  g.fillText(`⚡ ${energia ?? '—'}`, 128, 102);
  et.tex.needsUpdate = true;
}

/* Cartel flotante: el ancho se adapta al texto. */
function crearCartel(texto, color = '#eaf4ff'){
  const ancho = Math.max(256, texto.length * 15 + 40);
  const c = document.createElement('canvas');
  c.width = ancho; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,18,30,.85)'; g.fillRect(0, 0, ancho, 64);
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(2, 2, ancho - 4, 60);
  g.fillStyle = color; g.font = 'bold 24px monospace';
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
  sprite.scale.set(6.4, 2.4, 1);
  return { canvas, tex, sprite };
}
function pintarTablero(tb, sub, indice, total){
  const g = tb.canvas.getContext('2d');
  g.clearRect(0, 0, 512, 192);
  g.fillStyle = 'rgba(10,16,30,.88)'; g.fillRect(6, 6, 500, 180);
  g.strokeStyle = '#6fb0ff'; g.lineWidth = 3; g.strokeRect(6, 6, 500, 180);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!sub){
    g.fillStyle = '#6fb0ff'; g.font = 'bold 30px monospace';
    g.fillText('ACADEMIA DE', 256, 70);
    g.fillText('ESPECIALIZACIÓN', 256, 110);
    g.fillStyle = '#9fc6ff'; g.font = '20px monospace';
    g.fillText('Sube al mirador (E)', 256, 154);
  } else {
    g.fillStyle = '#9fc6ff'; g.font = 'bold 20px monospace';
    g.fillText(`SUB-RETO ${indice + 1} / ${total}`, 256, 34);
    g.fillStyle = '#eaf4ff'; g.font = 'bold 30px monospace';
    g.fillText(sub.nombre, 256, 88, 470);
    g.fillStyle = '#ffd27a'; g.font = 'bold 24px monospace';
    g.fillText(sub.concepto, 256, 136, 470);
  }
  tb.tex.needsUpdate = true;
}

/* ═══════════════════════════════════════════════════════════════════════
   FONDO DE LA ACADEMIA (el mismo del nivel 3; todo decorativo, no toca
   colisiones ni lógica)
   Atardecer: cielo con sol poniente · ciudad y colinas lejanas (una textura
   en un anillo abierto cada una) · nubes · bruma naranja · faroles flotantes
   · suelo con hojas. ≈ 180 tris. Con el incendio (SR4/SR5) todo se tiñe de rojo.
   ═══════════════════════════════════════════════════════════════════════ */
const USAR_FONDO = true;
const ROJO_FONDO = new THREE.Color('#ff4d4d');

function lienzoF(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function texF(c){
  const t = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Degradado de crepúsculo azul para el domo (el horizonte cae a mitad de la textura). */
function texturaCieloAtardecer(){
  const [c, g] = lienzoF(16, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  [[0, '#050a1c'], [.25, '#0f1d3d'], [.40, '#1f3a6b'], [.46, '#3f6ea8'],
   [.49, '#7fb4ee'], [.5, '#bfe3ff'], [.52, '#16284a'], [1, '#0a1224']]
    .forEach(([p, col]) => gr.addColorStop(p, col));
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  return texF(c);
}

/* Degradado vertical blanco→transparente (bruma del horizonte). */
function texturaGradienteF(stops){
  const [c, g] = lienzoF(4, 128);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  stops.forEach(([p, a]) => gr.addColorStop(p, `rgba(255,255,255,${a})`));
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

/* Ciudad lejana: siluetas con ventanas encendidas, todo en una sola textura. */
function texturaSkyline(){
  const W = 2048, H = 256;
  const [c, g] = lienzoF(W, H);
  let x = 30;
  while (x < W - 60){
    const w = 22 + Math.random() * 40, h = 50 + Math.random() * 130, y = H - h;
    g.fillStyle = '#0e1a33';
    g.fillRect(x, y, w, h);
    const r = Math.random();
    if (r < .35){                       // cúpula
      g.beginPath();
      g.arc(x + w / 2, y, w / 2, Math.PI, 0);
      g.closePath(); g.fill();
    } else if (r < .5){                 // antena
      g.fillRect(x + w / 2 - 1, y - 20, 2, 20);
    }
    for (let wy = y + 8; wy < H - 6; wy += 11){
      for (let wx = x + 5; wx < x + w - 6; wx += 9){
        if (Math.random() < .28){
          g.fillStyle = Math.random() < .8 ? '#7fe0ff' : '#e8f6ff';
          g.fillRect(wx, wy, 4, 6);
        }
      }
    }
    x += w + (Math.random() < .3 ? 8 + Math.random() * 14 : 2);
  }
  return texF(c);
}

/* Colinas con pinos al fondo. */
function texturaColinas(){
  const W = 2048, H = 128;
  const [c, g] = lienzoF(W, H);
  const alt = x => H - 40 - 22 * Math.sin(x * .006) - 14 * Math.sin(x * .017 + 1) - 8 * Math.sin(x * .043 + 2);
  g.fillStyle = '#14223f';
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, alt(x));
  g.lineTo(W, H); g.closePath(); g.fill();
  g.fillStyle = '#0e1a33';
  for (let i = 0; i < 260; i++){
    const x = Math.random() * W, base = alt(x) + 6;
    const h = 14 + Math.random() * 20, w = 6 + Math.random() * 6;
    g.beginPath();
    g.moveTo(x - w / 2, base); g.lineTo(x, base - h); g.lineTo(x + w / 2, base);
    g.closePath(); g.fill();
  }
  return texF(c);
}

/* Suelo exterior azul con destellos (0 tris: solo textura). */
function texturaSuelo(){
  const S = 1024;
  const [c, g] = lienzoF(S, S);
  g.fillStyle = '#2a3a5c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++){
    g.fillStyle = `rgba(${(50 + Math.random() * 40) | 0},${(80 + Math.random() * 50) | 0},${(140 + Math.random() * 60) | 0},${.08 + Math.random() * .1})`;
    g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 20 + Math.random() * 60, 0, Math.PI * 2); g.fill();
  }
  const COL = ['#6fb0ff', '#bfe3ff', '#3f6ea8', '#e8f1fa'];
  for (let i = 0; i < 700; i++){
    g.fillStyle = COL[(Math.random() * COL.length) | 0];
    g.globalAlpha = .5 + Math.random() * .4;
    g.save();
    g.translate(Math.random() * S, Math.random() * S);
    g.rotate(Math.random() * 6.28);
    g.fillRect(-2.5, -1.2, 5, 2.4);
    g.restore();
  }
  g.globalAlpha = 1;
  return texF(c);
}

/* Campus de la academia (plano medio): edificios bajos con cúpulas, torres, columnatas,
   árboles y farolas, todo en una sola textura. Va entre la plaza y la ciudad lejana. */
function texturaCampus(){
  const W = 2048, H = 128;
  const [c, g] = lienzoF(W, H);
  let x = 10;
  while (x < W - 60){
    const w = 60 + Math.random() * 70, h = 36 + Math.random() * 46, y = H - h;
    const r = Math.random();
    g.fillStyle = '#1c3258'; g.fillRect(x, y, w, h);
    g.fillStyle = '#9fc6ff'; g.fillRect(x, y, w, 3);                       // cornisa luminosa
    if (r < .3){                                                            // cúpula con aguja
      g.fillStyle = '#26427a';
      g.beginPath(); g.arc(x + w / 2, y, w * .35, Math.PI, 0); g.fill();
      g.fillStyle = '#bfe3ff'; g.fillRect(x + w / 2 - 1, y - w * .35 - 12, 2, 12);
    } else if (r < .5){                                                     // torre con antena
      const tw = w * .35;
      g.fillStyle = '#233f70'; g.fillRect(x + w / 2 - tw / 2, y - 34, tw, 34);
      g.fillStyle = '#7fe0ff'; g.fillRect(x + w / 2 - 1, y - 52, 2, 18);
    }
    if (r >= .3 && r < .7 && r >= .5){                                      // columnata blanca
      g.fillStyle = 'rgba(232,241,250,.75)';
      for (let cx = x + 6; cx < x + w - 6; cx += 12) g.fillRect(cx, y + 6, 4, h - 6);
    } else {                                                                // ventanas cian
      g.fillStyle = '#7fe0ff';
      for (let wy = y + 10; wy < H - 8; wy += 12)
        for (let wx = x + 6; wx < x + w - 8; wx += 11)
          if (Math.random() < .3) g.fillRect(wx, wy, 5, 6);
    }
    const hueco = 6 + Math.random() * 20;
    if (hueco > 14){                                                        // árbol en el hueco
      const tx = x + w + hueco / 2, rad = 9 + Math.random() * 5;
      g.fillStyle = '#12254a'; g.fillRect(tx - 1.5, H - 20, 3, 20);
      g.fillStyle = '#2a5a9a'; g.beginPath(); g.arc(tx, H - 24, rad, 0, Math.PI * 2); g.fill();
    } else if (Math.random() < .5){                                         // farola con brillo
      const fx = x + w + hueco / 2;
      g.fillStyle = '#9fc6ff'; g.fillRect(fx - 1, H - 40, 2, 40);
      g.fillStyle = 'rgba(191,227,255,.9)'; g.beginPath(); g.arc(fx, H - 42, 4, 0, Math.PI * 2); g.fill();
    }
    x += w + hueco;
  }
  return texF(c);
}

function crearFondoPlaza(escena){
  const grupo = new THREE.Group();
  escena.add(grupo);
  const ADITIVO = THREE.AdditiveBlending;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // domo del cielo (8×4 segmentos: el ecuador cae justo en el horizonte)
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(200, 8, 4),
    new THREE.MeshBasicMaterial({ map: texturaCieloAtardecer(), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  cielo.renderOrder = -20;

  // sol poniente: medio escondido tras las colinas (se dibuja antes que ellas)
  const sol = crearGlow('#bfe3ff', 90);
  sol.material.fog = false;
  sol.material.opacity = .85;
  sol.position.set(85, 16, -150);
  sol.renderOrder = -18;

  // anillos abiertos con una textura cada uno (de más lejos a más cerca)
  const anillo = (radio, alto, y, tex, orden, extra = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, alto, 16, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false, ...extra }));
    m.position.y = y;
    m.renderOrder = orden;
    return m;
  };
  const bruma = anillo(96, 40, 20, texturaGradienteF([[0, 0], [1, .9]]), -16,
    { color: '#6fb0ff', blending: ADITIVO, opacity: .55 });
  const colinas = anillo(90, 16, 7, texturaColinas(), -15);
  const ciudad = anillo(70, 24, 11, texturaSkyline(), -14);
  const campus = anillo(55, 14, 7, texturaCampus(), -13.5);      // plano medio: llena los costados

  // aro luminoso en el suelo que marca el borde de la plaza (80 tris)
  const bordeSuelo = new THREE.Mesh(new THREE.RingGeometry(40, 40.7, 40),
    new THREE.MeshBasicMaterial({ color: '#6fb0ff', transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false, blending: ADITIVO }));
  bordeSuelo.rotation.x = -Math.PI / 2;
  bordeSuelo.position.y = .03;

  // nubes (sprites alargados que giran muy despacio)
  const nubes = [];
  for (let i = 0; i < 6; i++){
    const s = crearGlow('#6a8fd0', 1);
    s.material.blending = THREE.NormalBlending;
    s.material.opacity = .32;
    s.material.fog = false;
    s.scale.set(rnd(55, 80), rnd(12, 18), 1);
    s.renderOrder = -17;
    nubes.push({ s, ang: (i / 6) * Math.PI * 2 + rnd(-.3, .3), r: rnd(110, 140), y: rnd(38, 60), vel: rnd(.004, .01) });
  }

  // faroles flotantes (Points: 0 tris)
  const NF = 40;
  const posF = new Float32Array(NF * 3), velF = new Float32Array(NF), fasF = new Float32Array(NF);
  const reubicar = (i, desdeAbajo) => {
    const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 32;
    posF[i * 3] = Math.cos(a) * r;
    posF[i * 3 + 1] = desdeAbajo ? 0 : Math.random() * 28;
    posF[i * 3 + 2] = Math.sin(a) * r;
  };
  for (let i = 0; i < NF; i++){ reubicar(i, false); velF[i] = rnd(.5, 1.1); fasF[i] = rnd(0, 6.28); }
  const geoF = new THREE.BufferGeometry();
  geoF.setAttribute('position', new THREE.BufferAttribute(posF, 3));
  const faroles = new THREE.Points(geoF, new THREE.PointsMaterial({
    map: TEX_GLOW, color: '#7fe0ff', size: 1.6, transparent: true, opacity: .9,
    blending: ADITIVO, depthWrite: false, fog: false }));

  // terreno lejano
  const terreno = new THREE.Mesh(new THREE.CircleGeometry(170, 16),
    new THREE.MeshBasicMaterial({ color: '#0a1428' }));
  terreno.rotation.x = -Math.PI / 2;
  terreno.position.y = -.05;

  // aves: siluetas en «V» que giran por el cielo y aletean (sprites: 2 tris cada una)
  const [cAve, gAve] = lienzoF(64, 32);
  gAve.strokeStyle = '#0e1a33'; gAve.lineWidth = 4; gAve.lineCap = 'round'; gAve.lineJoin = 'round';
  gAve.beginPath(); gAve.moveTo(4, 8); gAve.quadraticCurveTo(20, 8, 32, 24); gAve.quadraticCurveTo(44, 8, 60, 8); gAve.stroke();
  const matAve = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cAve), transparent: true, depthWrite: false, fog: false });
  const aves = [];
  for (let i = 0; i < 8; i++){
    const s = new THREE.Sprite(matAve);
    s.scale.set(2.4, 1.2, 1);
    s.renderOrder = -13;
    aves.push({ s, off: rnd(-.12, .12), r: rnd(54, 62), y: 20 + i * .4 + rnd(-2, 4), fase: rnd(0, 6.28) });
  }
  let bandadaAng = rnd(0, 6.28);

  // globos aerostáticos lejanos que derivan despacio (sprites: 2 tris cada uno)
  const globoAerostatico = (c1, c2) => {
    const [c, g] = lienzoF(64, 96);
    g.fillStyle = c1; g.beginPath(); g.ellipse(32, 34, 26, 32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c2; g.beginPath(); g.ellipse(32, 34, 10, 32, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#0e1a33'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(20, 62); g.lineTo(26, 80); g.moveTo(44, 62); g.lineTo(38, 80); g.stroke();
    g.fillStyle = '#1a2438'; g.fillRect(24, 80, 16, 10);
    return new THREE.CanvasTexture(c);
  };
  const globos = [];
  [['#6fb0ff', '#e8f1fa', 105, 42, .006], ['#e8f1fa', '#3f6ea8', 108, 52, -.004]].forEach(([c1, c2, r, y, vel], i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: globoAerostatico(c1, c2), transparent: true, depthWrite: false, fog: false }));
    s.scale.set(7, 10.5, 1);
    s.renderOrder = -13;
    globos.push({ s, ang: i * 2.6 + rnd(0, 1), r, y, vel, fase: rnd(0, 6.28) });
  });

  // estrella fugaz ocasional (sprite: 2 tris)
  const [cFug, gFug] = lienzoF(128, 16);
  const grFug = gFug.createLinearGradient(0, 0, 128, 0);
  grFug.addColorStop(0, 'rgba(255,255,255,0)'); grFug.addColorStop(1, 'rgba(255,240,210,1)');
  gFug.fillStyle = grFug; gFug.fillRect(0, 5, 128, 6);
  const fugaz = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cFug), transparent: true, depthWrite: false, blending: ADITIVO, fog: false, opacity: 0 }));
  fugaz.scale.set(14, 1.4, 1);
  fugaz.renderOrder = -13;
  let fugazT = -rnd(3, 6), fugazVel = new THREE.Vector3();

  grupo.add(cielo, sol, bruma, colinas, ciudad, campus, bordeSuelo, faroles, terreno, ...nubes.map(n => n.s),
    ...aves.map(a => a.s), ...globos.map(g => g.s), fugaz);

  let alerta = 0; // 0..1: sube mientras arde el edificio
  return {
    update(t, dt, enAlerta = false){
      alerta += ((enAlerta ? 1 : 0) - alerta) * Math.min(1, dt * 2.5);
      cielo.material.color.setRGB(1, 1 - .3 * alerta, 1 - .4 * alerta);
      bruma.material.color.set('#6fb0ff').lerp(ROJO_FONDO, alerta * .8);
      sol.material.color.set('#bfe3ff').lerp(ROJO_FONDO, alerta * .8);
      sol.scale.setScalar(90 * (1 + Math.sin(t * .5) * .03));

      for (const n of nubes){
        n.ang += n.vel * dt;
        n.s.position.set(Math.cos(n.ang) * n.r, n.y, Math.sin(n.ang) * n.r);
        n.s.material.color.set('#6a8fd0').lerp(ROJO_FONDO, alerta * .6);
      }

      for (let i = 0; i < NF; i++){
        posF[i * 3 + 1] += velF[i] * dt;
        posF[i * 3] += Math.sin(t * .6 + fasF[i]) * dt * .4;
        if (posF[i * 3 + 1] > 30) reubicar(i, true);
      }
      geoF.attributes.position.needsUpdate = true;

      // bandada: gira por el cielo y aletea
      bandadaAng += dt * .05;
      for (const a of aves){
        const ang = bandadaAng + a.off;
        a.s.position.set(Math.cos(ang) * a.r, a.y + Math.sin(t * .8 + a.fase) * .8, Math.sin(ang) * a.r);
        a.s.scale.set(2.4, 1.3 * (.3 + .7 * Math.abs(Math.sin(t * 5 + a.fase))), 1);
      }

      // globos aerostáticos: derivan y se mecen
      for (const g of globos){
        g.ang += g.vel * dt;
        g.s.position.set(Math.cos(g.ang) * g.r, g.y + Math.sin(t * .4 + g.fase) * 1.2, Math.sin(g.ang) * g.r);
      }

      // estrella fugaz: cada pocos segundos cruza el cielo
      const antes = fugazT;
      fugazT += dt;
      if (antes < 0 && fugazT >= 0){
        const a = rnd(0, 6.28);
        fugaz.position.set(Math.cos(a) * 80, rnd(45, 70), Math.sin(a) * 80);
        fugazVel.set(-Math.sin(a), -.15, Math.cos(a)).multiplyScalar(60);
      }
      if (fugazT >= 0){
        if (fugazT < .9){
          fugaz.position.addScaledVector(fugazVel, dt);
          fugaz.material.opacity = Math.sin((fugazT / .9) * Math.PI);
        } else {
          fugaz.material.opacity = 0;
          fugazT = -rnd(4, 9);
        }
      }
    },
    dispose(){
      escena.remove(grupo);
      grupo.traverse(o => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m && m.map !== TEX_GLOW) m.map?.dispose(); m?.dispose(); });
      });
    },
  };
}

/* ══════════ constantes de la jerarquía ══════════ */

const PADRE_DE = {
  TrabajadorIndustrial: 'Ciudadano',
  TécnicoSistemas: 'Ciudadano',
  ComercianteMercado: 'Ciudadano',
  MédicoComunitario: 'Ciudadano',
  Bombero: 'TrabajadorIndustrial',
};
const COLORES = {
  Bombero: '#ff6b5e', MédicoComunitario: '#ff8d7a', TrabajadorIndustrial: '#9aa7b8',
  TécnicoSistemas: '#8fb7d9', ComercianteMercado: '#ffd27a',
};
/* Posiciones de los heridos del SR4 (frente al edificio): [x, z, giro]. */
const HERIDOS = [[-4.5, -15.6, .4], [4.6, -15.2, -.5], [1, -14.2, 1.2]];

/* Accesorio distintivo de cada clase. */
function accesorio(clase, grupo){
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .5 });
  switch (clase){
    case 'Bombero':
    case 'TrabajadorIndustrial': {
      const casco = new THREE.Mesh(GEO_CASCO, mat(clase === 'Bombero' ? '#ff3b30' : '#ffd23f'));
      casco.position.y = 1.8;
      grupo.add(casco);
      break;
    }
    case 'MédicoComunitario': {
      const m = mat('#ffffff');
      const h = new THREE.Mesh(GEO_CRUZ_H, m);
      const v = new THREE.Mesh(GEO_CRUZ_V, m);
      h.position.set(0, 1.1, .37); v.position.set(0, 1.1, .37);
      grupo.add(h, v);
      break;
    }
    case 'TécnicoSistemas': {
      const ant = new THREE.Mesh(GEO_ANTENA, mat('#8fa3ba'));
      ant.position.set(.15, 2.1, 0);
      const punta = new THREE.Mesh(GEO_PUNTA, new THREE.MeshBasicMaterial({ color: '#7fe0ff' }));
      punta.position.set(.15, 2.38, 0);
      grupo.add(ant, punta);
      break;
    }
    case 'ComercianteMercado': {
      const bolsa = new THREE.Mesh(GEO_BOLSA, mat('#8a5a2b'));
      bolsa.position.set(.42, .8, 0);
      grupo.add(bolsa);
      break;
    }
    default: break;
  }
}

export function crearAcademia(escena){
  const colisionadores = [];
  const dinamicos = new THREE.Group();
  escena.add(dinamicos);

  /* ── iluminación y cielo propios del nivel 4 ──
     aplicarPaleta() recolorea estas luces y la niebla. */
  {
    // cielo: degradado de canvas (0 tris)
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#050a1c'); gr.addColorStop(.55, '#16284a'); gr.addColorStop(1, '#3a5a8f');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const texCielo = new THREE.CanvasTexture(c); texCielo.colorSpace = THREE.SRGBColorSpace;
    escena.background = texCielo;

    // estrellas (Points: 0 tris), por encima de la ciudad y las colinas lejanas
    const NE = 240, posE = new Float32Array(NE * 3);
    for (let i = 0; i < NE; i++){
      const a = Math.random() * Math.PI * 2, b = .4 + Math.random() * 1.1, r = 95;
      posE[i * 3] = Math.cos(a) * Math.cos(b) * r;
      posE[i * 3 + 1] = Math.sin(b) * r;
      posE[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    }
    const geoE = new THREE.BufferGeometry();
    geoE.setAttribute('position', new THREE.BufferAttribute(posE, 3));
    escena.add(new THREE.Points(geoE, new THREE.PointsMaterial({
      color: '#dcebff', size: .9, transparent: true, opacity: .9, depthWrite: false, fog: false })));

    // planeta lejano (sprite: 2 tris), más lejos que la ciudad para que no la tape
    const planeta = crearGlow('#9fc2ee', 16);
    planeta.material.fog = false;
    planeta.position.set(45, 45, -95);
    escena.add(planeta);
  }
  escena.fog = new THREE.Fog('#2c4a75', 40, 110);
  const luzHemi = new THREE.HemisphereLight('#9fc2ee', '#243552', 2.4);
  const luzSol = new THREE.DirectionalLight('#ffffff', 3);
  luzSol.position.set(14, 26, 12);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(1024, 1024);
  Object.assign(luzSol.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 90 });
  escena.add(luzHemi, luzSol);

  // fondo: si algo fallara, el nivel sigue funcionando como antes (sin fondo nuevo)
  let fondo = null;
  if (USAR_FONDO){
    try { fondo = crearFondoPlaza(escena); }
    catch (e){ console.warn('[academia] no se pudo crear el fondo:', e); }
  }

  /* ── efectos temporales (ondas, bocanadas, pulsos del árbol) ──
     Cada efecto: { update(dt) → true mientras viva, dispose() }. */
  const efectos = [];

  function onda(x, z, color, { retraso = 0, vel = 8, dur = 1 } = {}){
    const m = new THREE.Mesh(GEO_ONDA,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, .06, z);
    escena.add(m);
    let t = -retraso;
    efectos.push({
      update(dt){
        t += dt;
        if (t < 0) return true;
        const k = t / dur;
        m.scale.setScalar(1 + t * vel);
        m.material.opacity = Math.max(0, .9 * (1 - k));
        return k < 1;
      },
      dispose(){ escena.remove(m); m.material.dispose(); },
    });
  }

  function bocanada(x, y, z, color, { retraso = 0, dur = 1.4, sube = 2.5, crece = 2.2, tam = .35 } = {}){
    const m = new THREE.Mesh(GEO_BOCANADA,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z);
    m.scale.setScalar(tam);
    escena.add(m);
    let t = -retraso;
    efectos.push({
      update(dt){
        t += dt;
        if (t < 0) return true;
        const k = t / dur;
        m.position.y = y + sube * k;
        m.scale.setScalar(tam * (1 + crece * k));
        m.material.opacity = .55 * (1 - k);
        return k < 1;
      },
      dispose(){ escena.remove(m); m.material.dispose(); },
    });
  }

  /* Pulso de energía que viaja por una rama del árbol (hijo → padre). */
  function pulso(hijo, padre, retraso = 0){
    const a = nodos[hijo], b = nodos[padre];
    if (!a || !b) return;
    const m = new THREE.Mesh(GEO_PULSO,
      new THREE.MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: 0 }));
    escena.add(m);
    let t = -retraso;
    const dur = .6;
    efectos.push({
      update(dt){
        t += dt;
        if (t < 0) return true;
        const k = Math.min(1, t / dur);
        m.position.set(a.x + (b.x - a.x) * k, .55 + Math.sin(k * Math.PI) * .5, a.z + (b.z - a.z) * k);
        m.material.opacity = 1;
        if (k >= 1){
          onda(b.x, b.z, '#6fb0ff', { vel: 3, dur: .7 });
          return false;
        }
        return true;
      },
      dispose(){ escena.remove(m); m.material.dispose(); },
    });
  }

  /* ── suelo, pasillo grande y alfombra ── */
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({
      color: fondo ? '#ffffff' : '#2a3a5c',
      map: fondo ? texturaSuelo() : null,         // losas azules
      roughness: .95 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true;
  escena.add(suelo);
  const pasillo = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: texPasillo(), roughness: .9 }));
  pasillo.rotation.x = -Math.PI / 2; pasillo.position.y = .01; pasillo.receiveShadow = true;
  escena.add(pasillo);
  const alfombra = new THREE.Mesh(new THREE.PlaneGeometry(4, 34),
    new THREE.MeshStandardMaterial({ color: '#e8f1fa', roughness: .8 }));
  alfombra.rotation.x = -Math.PI / 2; alfombra.position.set(0, .02, -2); alfombra.receiveShadow = true;
  escena.add(alfombra);
  // franjas luminosas a los lados de la alfombra
  const matFranja = new THREE.MeshBasicMaterial({ color: '#6fb0ff' });
  for (const x of [-2.15, 2.15]){
    const franja = new THREE.Mesh(new THREE.BoxGeometry(.1, .03, 34), matFranja);
    franja.position.set(x, .03, -2);
    escena.add(franja);
  }

  /* ── columnas blancas con aro plano, brillo, bandera y haz de luz ── */
  const matCol = new THREE.MeshStandardMaterial({ color: '#e8f1fa', roughness: .5 });
  const matAro = new THREE.MeshBasicMaterial({ color: '#6fb0ff', side: THREE.DoubleSide });
  const matHaz = new THREE.MeshBasicMaterial({ color: '#9fc6ff', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false });
  const geoCol = new THREE.CylinderGeometry(.7, .8, 6, 8);          // 32 tris
  const geoAroCol = new THREE.RingGeometry(.8, .95, 12);            // 24 tris (antes 40)
  const geoHaz = new THREE.CylinderGeometry(.25, .25, 12, 8, 1, true); // 16 tris
  const geoBandera = new THREE.PlaneGeometry(1.1, 2.8);             // 2 tris
  const matBandera = new THREE.MeshBasicMaterial({ map: texBandera(), side: THREE.DoubleSide });
  const arosColumnas = [];
  const banderas = [];
  for (const [x, z] of [[-17, -17], [17, -17], [-17, 17], [17, 17], [-19.5, 0], [19.5, 0]]){
    const c = new THREE.Mesh(geoCol, matCol);
    c.position.set(x, 3, z);
    const aro = new THREE.Mesh(geoAroCol, matAro);
    aro.rotation.x = -Math.PI / 2; aro.position.set(x, 5.6, z);
    const haz = new THREE.Mesh(geoHaz, matHaz);
    haz.position.set(x, 12, z);
    const glow = crearGlow('#6fb0ff', 2.6);
    glow.position.set(x, 6.4, z);
    // bandera colgando hacia el centro
    const len = Math.hypot(x, z);
    const dx = -x / len, dz = -z / len;
    const b = new THREE.Mesh(geoBandera, matBandera);
    b.position.set(x + dx * .95, 3.4, z + dz * .95);
    b.rotation.y = Math.atan2(dx, dz);
    escena.add(c, aro, haz, glow, b);
    arosColumnas.push({ aro, fase: x + z });
    banderas.push({ b, fase: x * .7 + z });
    colisionadores.push({ minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 });
  }

  /* ── motas de conocimiento flotando ── */
  const NM = 200;
  const posM = new Float32Array(NM * 3);
  const velM = new Float32Array(NM);
  for (let i = 0; i < NM; i++){
    posM[i * 3] = (Math.random() - .5) * 70;
    posM[i * 3 + 1] = Math.random() * 12;
    posM[i * 3 + 2] = (Math.random() - .5) * 70;
    velM[i] = .25 + Math.random() * .5;
  }
  const geoM = new THREE.BufferGeometry();
  geoM.setAttribute('position', new THREE.BufferAttribute(posM, 3));
  const motas = new THREE.Points(geoM,
    new THREE.PointsMaterial({ color: '#cfe6ff', size: .13, transparent: true, opacity: .7, depthWrite: false }));
  escena.add(motas);

  /* ── glifos de código que flotan (sprites: 2 tris cada uno) ── */
  const glifos = [];
  for (const txt of ['class', 'extends', 'super()', 'override', '{ }', 'is-a', 'new', 'this', 'return', '<T>']){
    const s = crearGlifo(txt);
    s.position.set((Math.random() - .5) * 50, 1 + Math.random() * 9, (Math.random() - .5) * 50);
    escena.add(s);
    glifos.push({ s, vy: .15 + Math.random() * .25, fase: Math.random() * 6 });
  }

  /* ── globo holográfico en el centro de la plaza (80 tris) ── */
  const globo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1),
    new THREE.MeshBasicMaterial({ color: '#6fb0ff', wireframe: true, transparent: true, opacity: .7 }));
  globo.position.set(0, 3.2, 4);
  const globoGlow = crearGlow('#6fb0ff', 4.2);
  globoGlow.position.copy(globo.position);
  escena.add(globo, globoGlow);

  /* ── drones de la academia (octaedro + brillo): vuelan algo más alto que la plataforma ── */
  const GEO_DRON = compartida(new THREE.OctahedronGeometry(.22));
  const matDron = new THREE.MeshBasicMaterial({ color: '#e8f1fa' });
  const drones = [];
  for (let i = 0; i < 4; i++){
    const g = new THREE.Group();
    g.add(new THREE.Mesh(GEO_DRON, matDron));
    const gl = crearGlow('#9fc6ff', 1.2);
    g.add(gl);
    escena.add(g);
    drones.push({ g, R: 9 + i * 1.6, vel: (.3 + i * .07) * (i % 2 ? -1 : 1), y: 7 + i * .4, fase: i * 1.6 });
  }

  /* ── cosas volando: aviones de papel y dirigibles (≈ 150 tris) ── */
  const GEO_AVION = compartida(new THREE.ConeGeometry(.22, 1, 3));           // 4 tris
  GEO_AVION.rotateX(Math.PI / 2);                                             // la punta mira a +Z
  const GEO_DIRIGIBLE = compartida(new THREE.SphereGeometry(1, 8, 5));        // 64 tris, se estira
  const matAvion = new THREE.MeshBasicMaterial({ color: '#e8f1fa' });
  const aviones = [];
  for (let i = 0; i < 6; i++){
    const m = new THREE.Mesh(GEO_AVION, matAvion);
    m.scale.set(2.2, .35, 1.6);
    escena.add(m);
    aviones.push({ m, R: 13 + i * 3, vel: (.22 + i * .03) * (i % 2 ? -1 : 1), y: 6 + (i % 3) * 2.5, fase: i * 1.1 });
  }
  const dirigibles = [];
  [['extends', '#6fb0ff', 30, 15, .05], ['new Bombero()', '#ffd27a', 36, 19, -.04]].forEach(([txt, col, R, y, vel], i) => {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(GEO_DIRIGIBLE, new THREE.MeshStandardMaterial({ color: '#dbe9fa', roughness: .6 }));
    cuerpo.scale.set(3.4, 1.2, 1.2);
    const luz = crearGlow(col, 2.2); luz.position.set(0, -1.1, 0);
    const cartel = crearCartel(txt, col); cartel.position.y = -2.6;
    g.add(cuerpo, luz, cartel);
    escena.add(g);
    dirigibles.push({ g, R, y, vel, fase: i * 2.4 });
  });

  /* ── bancas (box = 12 tris) ── */
  {
    const geoBanca = new THREE.BoxGeometry(2.2, .45, .7);
    const matBanca = new THREE.MeshStandardMaterial({ color: '#e8f1fa', roughness: .6 });
    for (const [x, z] of [[-7, 8], [7, 8], [-9, -11], [9, -11]]){
      const b = new THREE.Mesh(geoBanca, matBanca);
      b.position.set(x, .225, z);
      escena.add(b);
      colisionadores.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - .4, maxZ: z + .4 });
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MIRADOR DE HERENCIA: escalera flotante, plataforma, ascensor y atalaya
     ───────────────────────────────────────────────────────────────────────
     Las superficies que se pisan viven en `sup`. alturaEn(x, z, yPies) devuelve
     la más alta que el jugador alcanza desde sus pies (hasta PASO_ALTO por encima),
     así que el ascensor, las piedras y la plataforma pueden tener hueco debajo.
     Las barandillas son colisionadores 2D (invisibles) + líneas holográficas.
     ═══════════════════════════════════════════════════════════════════════ */
  const sup = [];
  const rect = (minX, maxX, minZ, maxZ, y) => { const s = { minX, maxX, minZ, maxZ, y }; sup.push(s); return s; };
  const disco = (cx, cz, r, y) => { const s = { cx, cz, r, y }; sup.push(s); return s; };

  function alturaEn(x, z, yPies = 1e9){
    const tope = yPies + PASO_ALTO;
    let h = 0;
    for (const s of sup){
      if (s.y > tope || s.y <= h) continue;
      if (s.r !== undefined){
        const dx = x - s.cx, dz = z - s.cz;
        if (dx * dx + dz * dz > s.r * s.r) continue;
      } else if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
      h = s.y;
    }
    return h;
  }

  // superficies pisables
  for (let k = 1; k <= N_PASOS; k++)
    rect(ESC.x0 + (k - 1) * PROF_PASO, ESC.x0 + k * PROF_PASO, ESC.zc - ESC.ancho / 2, ESC.zc + ESC.ancho / 2, k * RISE);
  rect(DECK.minX, DECK.maxX, DECK.minZ, DECK.maxZ, DECK_H);
  const supLift = rect(LIFT.minX, LIFT.maxX, LIFT.minZ, LIFT.maxZ, 0);
  for (const [px, py] of PIEDRAS) disco(px, ZP, .8, py);
  disco(ISLA.x, ISLA.z, ISLA.r, ISLA.y);

  // muros invisibles (barandillas): costados de la escalera, borde de la plataforma y guías del ascensor
  const gr = .1;
  const muro = (minX, maxX, minZ, maxZ) => { const m = { minX, maxX, minZ, maxZ }; colisionadores.push(m); return m; };
  const zEscA = ESC.zc - ESC.ancho / 2, zEscB = ESC.zc + ESC.ancho / 2;
  muro(ESC.x0, DECK.minX, zEscA - 2 * gr, zEscA);                       // escalera: costado
  muro(ESC.x0, DECK.minX, zEscB, zEscB + 2 * gr);                       // escalera: costado
  muro(DECK.minX - gr, DECK.minX + gr, DECK.minZ, zEscA);               // plataforma: oeste (mitad)
  muro(DECK.minX - gr, DECK.minX + gr, zEscB, DECK.maxZ);               // plataforma: oeste (mitad)
  muro(DECK.minX, LIFT.minX, DECK.minZ - gr, DECK.minZ + gr);          // plataforma: borde del ascensor, lado izq.
  muro(LIFT.maxX, DECK.maxX, DECK.minZ - gr, DECK.minZ + gr);          // plataforma: borde del ascensor, lado der.
  muro(DECK.minX, DECK.maxX, DECK.maxZ - gr, DECK.maxZ + gr);          // plataforma: sur
  muro(DECK.maxX - gr, DECK.maxX + gr, DECK.minZ, ZP - .9);             // plataforma: este (deja paso a la atalaya)
  muro(DECK.maxX - gr, DECK.maxX + gr, ZP + .9, DECK.maxZ);
  muro(LIFT.minX - 2 * gr, LIFT.minX, LIFT.minZ, LIFT.maxZ);            // pozo del ascensor: lados
  muro(LIFT.maxX, LIFT.maxX + 2 * gr, LIFT.minZ, LIFT.maxZ);
  // compuertas del ascensor (se activan según dónde esté la cabina)
  const muroNorteLift = { minX: LIFT.minX, maxX: LIFT.maxX, minZ: DECK.minZ - gr, maxZ: DECK.minZ + gr };
  const muroSurLift = { minX: LIFT.minX, maxX: LIFT.maxX, minZ: LIFT.minZ - 2 * gr, maxZ: LIFT.minZ - .02 };
  function setMuro(m, activo){
    const i = colisionadores.indexOf(m);
    if (activo && i < 0) colisionadores.push(m);
    else if (!activo && i >= 0) colisionadores.splice(i, 1);
  }

  // ── visual: escalera flotante (InstancedMesh, 12 tris por peldaño) ──
  const dm = new THREE.Object3D();
  {
    const pasos = new THREE.InstancedMesh(
      new THREE.BoxGeometry(PROF_PASO - .04, .2, ESC.ancho),
      new THREE.MeshStandardMaterial({ color: '#dbe9fa', emissive: '#3f8ae0', emissiveIntensity: .35, roughness: .5 }),
      N_PASOS);
    for (let k = 1; k <= N_PASOS; k++){
      dm.position.set(ESC.x0 + (k - .5) * PROF_PASO, k * RISE - .1, ESC.zc);
      dm.updateMatrix();
      pasos.setMatrixAt(k - 1, dm.matrix);
    }
    pasos.castShadow = pasos.receiveShadow = true;
    escena.add(pasos);
  }

  // ── visual: plataforma elevada con núcleo antigravedad ──
  const cxDeck = (DECK.minX + DECK.maxX) / 2, czDeck = (DECK.minZ + DECK.maxZ) / 2;
  {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(DECK.maxX - DECK.minX, .4, DECK.maxZ - DECK.minZ),
      new THREE.MeshStandardMaterial({ map: texCubierta(), roughness: .55, emissive: '#0d2f66', emissiveIntensity: .45 }));
    deck.position.set(cxDeck, DECK_H - .2, czDeck);
    deck.castShadow = deck.receiveShadow = true;
    const nucleo = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.8, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: '#6fb0ff', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }));
    nucleo.rotation.x = Math.PI;                       // punta hacia abajo
    nucleo.position.set(cxDeck, DECK_H - .4 - .9, czDeck);
    escena.add(deck, nucleo);
  }

  // ── visual: piedras flotantes y atalaya (el salto opcional hasta el registro) ──
  {
    const geoPiedra = new THREE.CylinderGeometry(.85, .6, .3, 6);
    const matPiedra = new THREE.MeshStandardMaterial({ color: '#dbe9fa', emissive: '#3f8ae0', emissiveIntensity: .4, roughness: .5 });
    for (const [px, py] of PIEDRAS){
      const p = new THREE.Mesh(geoPiedra, matPiedra);
      p.position.set(px, py - .15, ZP);
      p.castShadow = true;
      escena.add(p);
    }
    const isla = new THREE.Mesh(new THREE.CylinderGeometry(ISLA.r + .1, 1.2, .5, 10), matPiedra);
    isla.position.set(ISLA.x, ISLA.y - .25, ISLA.z);
    isla.castShadow = true;
    escena.add(isla);
  }

  // ── visual: ascensor (cabina que sube y baja) ──
  const LIFT_CX = (LIFT.minX + LIFT.maxX) / 2, LIFT_CZ = (LIFT.minZ + LIFT.maxZ) / 2;
  const liftGrupo = new THREE.Group();
  const liftAnillo = new THREE.Mesh(new THREE.RingGeometry(.7, .95, 12),
    new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
  {
    const placa = new THREE.Mesh(new THREE.BoxGeometry(2.3, .3, 2.3),
      new THREE.MeshStandardMaterial({ color: '#e8f1fa', emissive: '#3f8ae0', emissiveIntensity: .5, roughness: .4 }));
    placa.position.y = -.15;
    liftAnillo.rotation.x = -Math.PI / 2; liftAnillo.position.y = .02;
    const brillo = crearGlow('#7fe0ff', 3); brillo.position.y = .5;
    liftGrupo.add(placa, liftAnillo, brillo);
    liftGrupo.position.set(LIFT_CX, 0, LIFT_CZ);
    escena.add(liftGrupo);
    // marca fija en el suelo del pozo
    const base = new THREE.Mesh(new THREE.RingGeometry(.95, 1.15, 12),
      new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: .6, side: THREE.DoubleSide, depthWrite: false }));
    base.rotation.x = -Math.PI / 2; base.position.set(LIFT_CX, .04, LIFT_CZ);
    escena.add(base);
  }
  // placa de llamada sobre la plataforma
  const padLlamada = new THREE.Mesh(new THREE.RingGeometry(.45, .8, 12),
    new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
  padLlamada.rotation.x = -Math.PI / 2;
  padLlamada.position.set(PAD.x, DECK_H + .03, PAD.z);
  escena.add(padLlamada);
  // compuertas holográficas: avisan de dónde hay pared invisible (2 tris cada una)
  const matGate = new THREE.MeshBasicMaterial({ color: '#ff5d5d', transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false });
  const geoGate = new THREE.PlaneGeometry(LIFT.maxX - LIFT.minX, 1.3);
  const gateN = new THREE.Mesh(geoGate, matGate);
  gateN.position.set(LIFT_CX, DECK_H + .65, DECK.minZ);
  const gateS = new THREE.Mesh(geoGate, matGate);
  gateS.position.set(LIFT_CX, .65, LIFT.minZ - .06);
  escena.add(gateN, gateS);

  // ── visual: barandillas, pasamanos y guías del ascensor (LineSegments: 0 tris) ──
  {
    const rv = [];
    const riel = (x1, z1, x2, z2, y0) => {
      for (const dy of [.5, 1.05]) rv.push(x1, y0 + dy, z1, x2, y0 + dy, z2);
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, z2 - z1) / 1.8));
      for (let i = 0; i <= n; i++){
        const f = i / n, px = x1 + (x2 - x1) * f, pz = z1 + (z2 - z1) * f;
        rv.push(px, y0, pz, px, y0 + 1.05, pz);
      }
    };
    // plataforma
    riel(DECK.minX, DECK.minZ, LIFT.minX, DECK.minZ, DECK_H);
    riel(LIFT.maxX, DECK.minZ, DECK.maxX, DECK.minZ, DECK_H);
    riel(DECK.minX, DECK.maxZ, DECK.maxX, DECK.maxZ, DECK_H);
    riel(DECK.minX, DECK.minZ, DECK.minX, zEscA, DECK_H);
    riel(DECK.minX, zEscB, DECK.minX, DECK.maxZ, DECK_H);
    riel(DECK.maxX, DECK.minZ, DECK.maxX, ZP - .9, DECK_H);
    riel(DECK.maxX, ZP + .9, DECK.maxX, DECK.maxZ, DECK_H);
    // escalera: pasamanos con la misma pendiente que los peldaños
    for (const zs of [zEscA, zEscB]){
      rv.push(ESC.x0, 1, zs, DECK.minX, DECK_H + 1, zs);
      for (let k = 1; k <= N_PASOS; k++){
        const xk = ESC.x0 + (k - .5) * PROF_PASO;
        rv.push(xk, k * RISE, zs, xk, 1 + (xk - ESC.x0) * (DECK_H / (DECK.minX - ESC.x0)), zs);
      }
    }
    // guías del ascensor: cuatro columnas de luz y un marco arriba
    const yTop = DECK_H + 1.4;
    for (const x of [LIFT.minX, LIFT.maxX]) for (const z of [LIFT.minZ, LIFT.maxZ]) rv.push(x, 0, z, x, yTop, z);
    rv.push(LIFT.minX, yTop, LIFT.minZ, LIFT.maxX, yTop, LIFT.minZ,
            LIFT.maxX, yTop, LIFT.minZ, LIFT.maxX, yTop, LIFT.maxZ,
            LIFT.maxX, yTop, LIFT.maxZ, LIFT.minX, yTop, LIFT.maxZ,
            LIFT.minX, yTop, LIFT.maxZ, LIFT.minX, yTop, LIFT.minZ);
    const geoL = new THREE.BufferGeometry();
    geoL.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv), 3));
    const lineas = new THREE.LineSegments(geoL,
      new THREE.LineBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: .7 }));
    lineas.frustumCulled = false;
    escena.add(lineas);
  }

  // ── visual: brillo antigravedad bajo cada superficie flotante (Points: 0 tris) ──
  {
    const pts = [];
    for (let k = 1; k <= N_PASOS; k++) pts.push(ESC.x0 + (k - .5) * PROF_PASO, k * RISE - .5, ESC.zc);
    for (const dx of [-2.4, 0, 2.4]) pts.push(cxDeck + dx, DECK_H - .8, czDeck);
    for (const [px, py] of PIEDRAS) pts.push(px, py - .6, ZP);
    pts.push(ISLA.x, ISLA.y - 1, ISLA.z);
    const geoP = new THREE.BufferGeometry();
    geoP.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    escena.add(new THREE.Points(geoP, new THREE.PointsMaterial({
      map: TEX_GLOW, color: '#6fb0ff', size: 2.6, transparent: true, opacity: .85,
      blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  // ── carteles del mirador ──
  {
    const cEsc = crearCartel('ESCALERA FLOTANTE ↑', '#6fb0ff');
    cEsc.position.set(ESC.x0 - .8, 3, ESC.zc);
    const cLift = crearCartel('ASCENSOR · pisa la placa', '#7fe0ff');
    cLift.position.set(LIFT_CX, DECK_H + 3, LIFT_CZ);
    const cAtalaya = crearCartel('ATALAYA · salta las piedras', '#ffd27a');
    cAtalaya.position.set(ISLA.x, ISLA.y + 3.4, ISLA.z);
    escena.add(cEsc, cLift, cAtalaya);
  }

  // ── lógica del ascensor: sube y baja solo al pisar la placa (o la placa de llamada) ──
  const lift = { y: 0, estado: 'abajo', espera: 0, reposo: 0, salir: false };
  function sincronizarAscensor(){
    const norte = lift.y < DECK_H - .15, sur = lift.y > .8;
    setMuro(muroNorteLift, norte);
    setMuro(muroSurLift, sur);
    gateN.visible = norte;
    gateS.visible = sur;
    supLift.y = lift.y;
    liftGrupo.position.y = lift.y;
    gateS.position.y = lift.y + .65;
  }
  function actualizarAscensor(dt, enLift, enLlamada){
    if (!enLift) lift.salir = false;            // tras llegar, hay que bajarse antes de reactivarlo
    switch (lift.estado){
      case 'abajo':
        if ((enLift && !lift.salir) || enLlamada) lift.espera += dt; else lift.espera = 0;
        if (lift.espera > .7){ lift.estado = 'sube'; lift.espera = 0; }
        break;
      case 'sube':
        lift.y = Math.min(DECK_H, lift.y + LIFT_VEL * dt);
        if (lift.y >= DECK_H){ lift.estado = 'arriba'; lift.salir = enLift; lift.espera = 0; lift.reposo = 0; }
        break;
      case 'arriba':
        if (enLift && !lift.salir) lift.espera += dt; else lift.espera = 0;
        if (enLift) lift.reposo = 0; else lift.reposo += dt;
        if (lift.espera > .7 || lift.reposo > 12){ lift.estado = 'baja'; lift.espera = 0; }  // vuelve solo si nadie lo usa
        break;
      case 'baja':
        lift.y = Math.max(0, lift.y - LIFT_VEL * dt);
        if (lift.y <= 0){ lift.estado = 'abajo'; lift.salir = enLift; lift.espera = 0; }
        break;
      default: break;
    }
    sincronizarAscensor();
  }
  sincronizarAscensor();

  /* ── edificio de prácticas (el que arde), al fondo ── */
  const EZ = -22;   // z del centro del edificio; su fachada queda en EZ + 3
  const edificio = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 6),
    new THREE.MeshStandardMaterial({ color: '#3f6ea8', roughness: .8 }));
  edificio.position.set(0, 2.25, EZ); edificio.castShadow = edificio.receiveShadow = true;
  escena.add(edificio);
  colisionadores.push({ minX: -4, maxX: 4, minZ: EZ - 3, maxZ: EZ + 3 });

  const matBlanco = new THREE.MeshStandardMaterial({ color: '#e8f1fa', roughness: .5 });
  const techoEd = new THREE.Mesh(new THREE.BoxGeometry(8.8, .4, 6.8), matBlanco);
  techoEd.position.set(0, 4.7, EZ);
  const puerta = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, .1),
    new THREE.MeshStandardMaterial({ color: '#1a2438' }));
  puerta.position.set(0, 1.2, EZ + 3.02);
  const matVentana = new THREE.MeshBasicMaterial({ map: texVentana(), transparent: true, color: '#bfe3ff' }); // naranja si arde
  const geoVent = new THREE.PlaneGeometry(1.8, 1.2);
  for (const x of [-2.6, 2.6]){
    const v = new THREE.Mesh(geoVent, matVentana);
    v.position.set(x, 2.7, EZ + 3.03);
    escena.add(v);
  }
  const cartelEdificio = crearCartel('EDIFICIO DE PRÁCTICAS', '#6fb0ff');
  cartelEdificio.position.set(0, 6.1, EZ + 3);
  escena.add(techoEd, puerta, cartelEdificio);

  /* ── terminal de la Academia (mismo diseño que la de Ciudadanía), ahora en la plataforma ──
     main.js lee mundo.terminal.cerca: con él muestra el aviso
     «PRESIONA E PARA USAR LA TERMINAL» y E abre el editor de herencia.
     Solo se activa en el piso de la plataforma (no desde el suelo de abajo). */
  const terminal = { cerca: false };
  const grupoTerminal = new THREE.Group();
  const pantallaMat = new THREE.MeshBasicMaterial({ color: '#6fb0ff' });
  const luzTerminal = new THREE.PointLight('#6fb0ff', 4, 8);
  const anilloTerminal = new THREE.Mesh(new THREE.RingGeometry(.75, .85, 16),
    new THREE.MeshBasicMaterial({ color: '#6fb0ff', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  const aroProximidad = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.5, 24),
    new THREE.MeshBasicMaterial({ color: '#6fb0ff', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false }));
  const TERM = { x: 13.6, z: 11.6 };
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, .9),
      new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: .7 }));
    base.position.y = .5;
    const poste = new THREE.Mesh(new THREE.BoxGeometry(.12, .5, .12),
      new THREE.MeshStandardMaterial({ color: '#8fa3ba' }));
    poste.position.y = 1.15;
    const pantalla = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, .08), pantallaMat);
    pantalla.position.set(0, 1.45, 0);
    pantalla.rotation.x = -.25;
    luzTerminal.position.set(0, 1.6, 1);
    anilloTerminal.position.set(0, 2.2, 0);
    anilloTerminal.rotation.x = -Math.PI / 2;
    aroProximidad.rotation.x = -Math.PI / 2;
    aroProximidad.position.y = .05;
    const cartel = crearCartel('ÁRBOL DE HERENCIA', '#6fb0ff');
    cartel.position.set(0, 2.9, 0);
    grupoTerminal.add(base, poste, pantalla, luzTerminal, anilloTerminal, aroProximidad, cartel);
    base.castShadow = true;
    grupoTerminal.position.set(TERM.x, DECK_H, TERM.z);
    escena.add(grupoTerminal);
    colisionadores.push({ minX: TERM.x - .7, maxX: TERM.x + .7, minZ: TERM.z - .45, maxZ: TERM.z + .45 });
  }

  /* ══════════ SR1: arcos ES-UN / TIENE-UN ══════════ */
  const velosArcos = [];
  const geoPosteArco = new THREE.BoxGeometry(.3, 3, .3);
  const geoDintel = new THREE.BoxGeometry(2.9, .3, .3);
  const geoVelo = new THREE.PlaneGeometry(2.1, 2.8);
  function crearArco(x, z, color, texto){
    const mat = new THREE.MeshStandardMaterial({ color: '#2a3140', emissive: color, emissiveIntensity: .3, roughness: .5 });
    const g = new THREE.Group();
    for (const dx of [-1.2, 1.2]){
      const p = new THREE.Mesh(geoPosteArco, mat);
      p.position.set(dx, 1.5, 0);
      g.add(p);
    }
    const dintel = new THREE.Mesh(geoDintel, mat);
    dintel.position.y = 3;
    const velo = new THREE.Mesh(geoVelo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }));
    velo.position.y = 1.5;
    const cartel = crearCartel(texto, '#' + new THREE.Color(color).getHexString());
    cartel.position.y = 3.9;
    g.add(dintel, velo, cartel);
    g.position.set(x, 0, z);
    escena.add(g);
    velosArcos.push(velo.material);
    return mat;
  }
  const matArcoEs = crearArco(8, -5, '#6fb0ff', 'ES-UN · herencia');
  const matArcoTiene = crearArco(13.5, -5, '#ffb454', 'TIENE-UN · composición');

  /* ══════════ SR2-SR3: árbol de herencia 3D (a la izquierda, bien separado) ══════════ */
  const nodos = {};       // nombre → { mat, grupo, lit, pilar, aro }
  const ramas = {};       // hijo → { mat }
  const geoDisco = compartida(new THREE.CylinderGeometry(.95, 1.05, .25, 12));
  const geoDiscoG = compartida(new THREE.CylinderGeometry(1.3, 1.4, .25, 12));
  const geoPilar = compartida(new THREE.CylinderGeometry(.5, .5, 3, 10, 1, true));
  const geoPilarG = compartida(new THREE.CylinderGeometry(.7, .7, 3, 10, 1, true));
  const geoAroNodo = compartida(new THREE.RingGeometry(.72, .8, 20));
  const geoAroNodoG = compartida(new THREE.RingGeometry(1.02, 1.1, 20));

  function crearNodo(nombre, x, z, color, alto = 1.4, grande = false){
    const grupo = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#2a3a5c', emissive: color, emissiveIntensity: .15, roughness: .5 });
    const disco = new THREE.Mesh(grande ? geoDiscoG : geoDisco, mat);
    disco.position.y = .13; disco.receiveShadow = true;
    const cartel = crearCartel(nombre, '#' + new THREE.Color(color).getHexString());
    cartel.scale.multiplyScalar(grande ? .8 : .65);
    cartel.position.y = alto;
    // pilar de luz y aro ascendente: solo cuando el nodo está encendido
    const pilar = new THREE.Mesh(grande ? geoPilarG : geoPilar,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
    pilar.position.y = 1.5;
    pilar.visible = false;
    const aro = new THREE.Mesh(grande ? geoAroNodoG : geoAroNodo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    aro.rotation.x = -Math.PI / 2;
    aro.position.y = .4;
    aro.visible = false;
    grupo.add(disco, cartel, pilar, aro);
    grupo.position.set(x, 0, z);
    escena.add(grupo);
    nodos[nombre] = { mat, grupo, lit: false, x, z, pilar, aro };
    return nodos[nombre];
  }
  function crearRama(hijo, padre){
    const a = nodos[padre], b = nodos[hijo];
    const dx = b.x - a.x, dz = b.z - a.z;
    const largo = Math.hypot(dx, dz);
    const mat = new THREE.MeshBasicMaterial({ color: '#2c4a75' });
    const viga = new THREE.Mesh(new THREE.BoxGeometry(.14, .06, largo), mat);
    viga.position.set((a.x + b.x) / 2, .3, (a.z + b.z) / 2);
    viga.rotation.y = Math.atan2(dx, dz);
    b.grupo.userData.rama = viga;
    escena.add(viga);
    ramas[hijo] = { mat, viga };
  }

  crearNodo('Ciudadano', -11.4, 3, '#eaf4ff', 1.9, true);
  crearNodo('TrabajadorIndustrial', -18, -5, '#9aa7b8', 1.4);
  crearNodo('TécnicoSistemas', -13.6, -5, '#8fb7d9', 2.1);
  crearNodo('ComercianteMercado', -9.2, -5, '#ffd27a', 1.4);
  crearNodo('MédicoComunitario', -4.8, -5, '#ff8d7a', 2.1);
  crearNodo('Bombero', -18, -11, '#ff6b5e', 1.4);
  for (const hijo of ['TrabajadorIndustrial', 'TécnicoSistemas', 'ComercianteMercado', 'MédicoComunitario', 'Bombero'])
    crearRama(hijo, PADRE_DE[hijo]);
  nodos.Ciudadano.mat.emissiveIntensity = .5;

  function iluminarNodo(nombre, encendido){
    const n = nodos[nombre];
    if (!n) return;
    n.lit = encendido;
    n.mat.emissiveIntensity = encendido ? 1 : (nombre === 'Ciudadano' ? .5 : .15);
    n.pilar.visible = encendido;
    n.aro.visible = encendido;
    const r = ramas[nombre];
    if (r) r.mat.color.set(encendido ? '#6fb0ff' : '#2c4a75');
  }
  /* Enciende la clase y toda su cadena hasta Ciudadano. */
  function iluminarCadena(nombreClase){
    let n = nombreClase;
    let paso = 0;
    while (n && nodos[n]){
      if (!nodos[n].lit) onda(nodos[n].x, nodos[n].z, '#6fb0ff', { vel: 4, dur: .8, retraso: paso * .5 });
      iluminarNodo(n, true);
      if (PADRE_DE[n]) pulso(n, PADRE_DE[n], paso * .5);
      n = PADRE_DE[n];
      paso++;
    }
  }
  function mostrarBombero(visible){
    nodos.Bombero.grupo.visible = visible;
    ramas.Bombero.viga.visible = visible;
  }

  /* ══════════ SR4: fuego y heridos ══════════ */
  const fuegoGrupo = new THREE.Group();
  const matLlama = new THREE.MeshBasicMaterial({ color: '#ff9c3f', transparent: true, opacity: .9, side: THREE.DoubleSide });
  const llamas = [
    { malla: new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.6, 8, 1, true), matLlama), pos: [0, 6.6, EZ], fase: 0 },
    { malla: new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 8, 1, true), matLlama), pos: [-2.6, 5.9, EZ + .8], fase: 1.7 },
    { malla: new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 8, 1, true), matLlama), pos: [2.6, 5.8, EZ + .6], fase: 3.1 },
  ];
  for (const l of llamas){ l.malla.position.set(...l.pos); fuegoGrupo.add(l.malla); }
  const luzFuego = new THREE.PointLight('#ff7a2a', 30, 24, 2);
  luzFuego.position.set(0, 7, EZ + 1);
  fuegoGrupo.add(luzFuego);
  fuegoGrupo.visible = false;
  escena.add(fuegoGrupo);

  // brasas que suben mientras arde
  const NB = 48;
  const posB = new Float32Array(NB * 3);
  const velB = new Float32Array(NB);
  function reiniciarBrasa(i){
    posB[i * 3] = (Math.random() - .5) * 6;
    posB[i * 3 + 1] = 5 + Math.random() * 1.5;
    posB[i * 3 + 2] = EZ + (Math.random() - .5) * 4;
    velB[i] = 1 + Math.random() * 1.5;
  }
  for (let i = 0; i < NB; i++){ reiniciarBrasa(i); posB[i * 3 + 1] += Math.random() * 5; }
  const geoB = new THREE.BufferGeometry();
  geoB.setAttribute('position', new THREE.BufferAttribute(posB, 3));
  const brasas = new THREE.Points(geoB,
    new THREE.PointsMaterial({ color: '#ffb454', size: .18, transparent: true, opacity: .9, depthWrite: false }));
  brasas.visible = false;
  escena.add(brasas);

  const heridosGrupo = new THREE.Group();
  const matHerido = new THREE.MeshStandardMaterial({ color: '#ff8d7a', roughness: .6 });
  const geoHCuerpo = new THREE.BoxGeometry(1.1, .22, .4);
  const geoHCabeza = new THREE.SphereGeometry(.2, 6, 4);
  const matHCabeza = new THREE.MeshStandardMaterial({ color: '#e8d2b8', roughness: .6 });
  for (const [x, z, giro] of HERIDOS){
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoHCuerpo, matHerido);
    cuerpo.position.y = .2;
    const cabeza = new THREE.Mesh(geoHCabeza, matHCabeza);
    cabeza.position.set(.65, .24, 0);
    const cruz = crearCartel('+', '#ff5d5d');
    cruz.scale.set(.5, .5, 1); cruz.position.y = 1.1;
    g.add(cuerpo, cabeza, cruz);
    g.position.set(x, 0, z); g.rotation.y = giro;
    heridosGrupo.add(g);
  }
  heridosGrupo.visible = false;
  escena.add(heridosGrupo);

  /* ══════════ SR5: cartel de polimorfismo ══════════ */
  const cartelPoli = crearCartel('Ciudadano ciudadano = new Bombero()', '#ffd27a');
  cartelPoli.position.set(0, 5.2, -11);
  cartelPoli.visible = false;
  escena.add(cartelPoli);

  /* ══════════ tablero del sub-reto activo ══════════ */
  const TABLERO_Y = 5.2;
  const tablero = crearTablero();
  tablero.sprite.position.set(11, TABLERO_Y, -12);
  escena.add(tablero.sprite);
  pintarTablero(tablero, null, -1, SUBRETOS_NIVEL4.length);

  /* ── registro de Gustaff: ahora espera en la atalaya (isla flotante) ── */
  const REG_Y = ISLA.y + 1;
  const registro = new THREE.Mesh(new THREE.OctahedronGeometry(.42),
    new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: 1.2, flatShading: true }));
  registro.position.set(ISLA.x, REG_Y, ISLA.z);
  registro.visible = !progreso.tieneRegistro('nivel-4');
  escena.add(registro);
  const hazRegistro = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 10, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }));
  hazRegistro.position.set(ISLA.x, REG_Y + 4, ISLA.z);
  hazRegistro.visible = registro.visible;
  escena.add(hazRegistro);

  /* ── estado ── */
  const st = {
    indice: -1, ciudadanos: [], visuales: [], acciones: [],
    fuegoApagado: true, heridosCurados: true,
    ultimoMostrado: undefined, intentos: {},
    puntos: 0, bonusIntentos: 0, herenciaOk: false,
    inicioNivel: Date.now(), gestor: null,
  };

  mostrarBombero(false);

  /* Deja la escena del sub-reto como al empezar: sin especialistas,
     sin acciones anotadas, árbol apagado y con el incendio (si toca) encendido. */
  function reiniciarEscena(sub){
    for (const v of st.visuales){
      v.et.tex.dispose(); v.et.sprite.material.dispose();
      v.grupo.traverse(o => {
        if (o.isSprite) return; // la geometría del sprite es compartida
        if (o.geometry?.dispose && !o.geometry.userData?.compartida) o.geometry.dispose();
        if (o.material?.dispose) o.material.dispose();
      });
      dinamicos.remove(v.grupo);
    }
    st.visuales = []; st.ciudadanos = []; st.acciones = [];
    st.ultimoMostrado = undefined;

    const conFuego = sub.verificar.tipo === 'emergencia' || sub.verificar.tipo === 'polimorfismo';
    fuegoGrupo.visible = conFuego;
    for (const l of llamas) l.malla.scale.set(1, 1, 1);
    st.fuegoApagado = !conFuego;
    st.heridosCurados = !conFuego;
    edificio.material.color.set(conFuego ? '#2a2a30' : '#3f6ea8');
    matVentana.color.set(conFuego ? '#ff9c3f' : '#bfe3ff');

    // heridos solo en la emergencia (SR4)
    heridosGrupo.visible = sub.verificar.tipo === 'emergencia';
    matHerido.color.set('#ff8d7a');

    // árbol apagado al reiniciar
    for (const nombre of Object.keys(nodos)) iluminarNodo(nombre, false);
  }

  function cargarSubreto(i){
    const sub = SUBRETOS_NIVEL4[i];
    st.indice = i;
    reiniciarEscena(sub);
    // el Bombero aparece en el árbol desde el SR3 (override)
    mostrarBombero(i >= 2);
    // cartel de polimorfismo solo en el SR5
    cartelPoli.visible = sub.verificar.tipo === 'polimorfismo';
    pintarTablero(tablero, sub, i, SUBRETOS_NIVEL4.length);
    return sub;
  }

  /* ── personajes ── */
  function aparecer(obj){
    const claseNombre = obj.__clase?.nombre ?? '?';
    const color = COLORES[claseNombre] ?? '#c9d8ea';
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Mesh(GEO_CUERPO, new THREE.MeshStandardMaterial({ color, roughness: .6 }));
    cuerpo.position.y = .85; cuerpo.castShadow = true;
    const cabeza = new THREE.Mesh(GEO_CABEZA, new THREE.MeshStandardMaterial({ color: '#e8d2b8', roughness: .6 }));
    cabeza.position.y = 1.75;
    grupo.add(cuerpo, cabeza);
    accesorio(claseNombre, grupo);
    const halo = new THREE.Mesh(GEO_HALO,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = .05;
    grupo.add(halo);
    const et = crearEtiqueta();
    pintarEtiqueta(et, { nombre: obj.campos.get('nombre'), clase: claseNombre, energia: obj.campos.get('energia') });
    grupo.add(et.sprite);
    grupo.position.set((Math.random() - 0.5) * 12, 0, -2 + (Math.random() - 0.5) * 8);
    dinamicos.add(grupo);
    onda(grupo.position.x, grupo.position.z, color, { vel: 3, dur: .7 });
    st.visuales.push({ grupo, et, obj, destino: new THREE.Vector3(), reloj: 0, fase: Math.random() * 6 });
    // el árbol 3D reconoce al especialista y enciende su rama hasta Ciudadano
    iluminarCadena(claseNombre);
  }

  /* ── API del mundo ── */
  function crearAPI(){
    const api = new RegistroAPI();
    api.registrar('registrarCiudadano', obj => {
      if (!obj || typeof obj !== 'object' || !obj.__clase)
        throw new ErrorMotor('TYPE_ERROR', 'registrarCiudadano solo acepta instancias de una clase.', 0);
      st.ciudadanos.push(obj);
      aparecer(obj);
      return st.ciudadanos.length;
    }, 'Da de alta al especialista');
    api.registrar('apagarFuego', () => {
      st.fuegoApagado = true;
      edificio.material.color.set('#4a5a6a');
      matVentana.color.set('#bfe3ff');
      // vapor y ondas de extinción
      onda(0, EZ + 3, '#9fd8ff', { vel: 6, dur: 1.2 });
      onda(0, EZ, '#ffffff', { vel: 9, dur: 1.4, retraso: .2 });
      for (let i = 0; i < 5; i++)
        bocanada((i - 2) * 1.3, 5.2, EZ, '#d8e8f5', { retraso: i * .12 });
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'fuegoApagado', args: [], resultado: true });
      return true;
    }, 'Extingue el incendio');
    api.registrar('curar', () => {
      st.heridosCurados = true;
      matHerido.color.set('#58f0a0');
      // destellos verdes sobre cada herido
      HERIDOS.forEach(([x, z], i) => {
        onda(x, z, '#58f0a0', { vel: 5, dur: .9, retraso: i * .15 });
        bocanada(x, .6, z, '#58f0a0', { retraso: i * .15, sube: 1.8, crece: 1.2, tam: .22 });
      });
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'heridosCurados', args: [], resultado: true });
      return true;
    }, 'Atiende a los heridos');
    api.registrar('registrarAccion', texto => {
      st.acciones.push(String(texto));
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'accion', args: [texto], resultado: texto });
      return texto;
    }, 'Anota qué método se ejecutó');
    api.registrar('anunciar', t => {
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'anunciar', args: [t], resultado: t });
      return t;
    }, 'Burbuja de diálogo');
    api.registrar('estadoAcademia', () => ({
      fuego: st.fuegoApagado ? 'apagado' : '¡ARDIENDO!',
      heridos: st.heridosCurados ? 'atendidos' : 'sin atender',
      registrados: st.ciudadanos.map(c => c.__clase.nombre),
      acciones: [...st.acciones],
    }), 'Estado de la academia');
    api.registrar('mostrar', v => {
      st.ultimoMostrado = v;
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'mostrar', args: [v], resultado: v });
      return v;
    }, 'Muestra un valor');
    return api;
  }

  /* ── verificación ── */
  function clasesDe(ast){ return ast.cuerpo.filter(d => d.tipo === 'DeclClase'); }

  function tieneSuper(bloque){
    if (!bloque) return false;
    const rec = s => {
      if (!s) return false;
      switch (s.tipo){
        case 'Super': return s.metodo === null;
        case 'Bloque': return s.sentencias.some(rec);
        case 'Si': return rec(s.ent) || rec(s.sino);
        default: return false;
      }
    };
    return rec(bloque);
  }

  function verificar(sub, { ast } = {}){
    const v = sub.verificar;
    switch (v.tipo){
      case 'relaciones': return true; // lo valida la UI
      case 'extendsSuper': {
        for (const nombre of v.clases){
          const c = clasesDe(ast).find(d => d.nombre === nombre);
          if (!c || c.extiende !== v.padre) return false;
          if (!c.constructorDef || !tieneSuper(c.constructorDef.cuerpo)) return false;
        }
        return true;
      }
      case 'override': {
        const b = clasesDe(ast).find(d => d.nombre === 'Bombero');
        if (!b || b.extiende !== 'TrabajadorIndustrial') return false;
        const trabajar = b.metodos.find(m => m.nombre === 'trabajar');
        if (!trabajar?.override) return false;
        if (!b.metodos.some(m => m.nombre === 'extinguirFuego')) return false;
        const m = clasesDe(ast).find(d => d.nombre === 'MédicoComunitario');
        if (!m?.metodos.some(x => x.nombre === 'atenderHeridos')) return false;
        return true;
      }
      case 'emergencia': {
        const hayBombero = st.ciudadanos.some(o => o.__clase.nombre === 'Bombero');
        const hayMedico = st.ciudadanos.some(o => o.__clase.nombre === 'MédicoComunitario');
        return hayBombero && hayMedico && st.fuegoApagado && st.heridosCurados;
      }
      case 'polimorfismo': {
        // Debe existir una declaración de variable con tipo declarado «Ciudadano»
        // cuyo valor sea un `new Bombero(...)`. No dependo del nombre exacto de los
        // campos del AST: busco el tipo declarado entre los valores del nodo y
        // «Bombero» en cualquier parte del nodo.
        const refPadre = ast.cuerpo.some(d =>
          d.tipo === 'DeclVar' &&
          Object.values(d).includes('Ciudadano') &&
          JSON.stringify(d).includes('Bombero'));
        const dispatch = st.acciones.some(a => a.includes('Bombero'));
        return refPadre && dispatch && st.fuegoApagado;
      }
      default: return false;
    }
  }

  /* ── ejecución ── */
  async function ejecutar(ast, { animado = true } = {}){
    const sub = SUBRETOS_NIVEL4[st.indice];

    // cada ejecución parte de una escena limpia (sin duplicados ni acciones acumuladas)
    reiniciarEscena(sub);

    st.intentos[sub.id] = (st.intentos[sub.id] ?? 0) + 1;
    import('../sistema/telemetria.js').then(({ telemetria }) =>
      telemetria.registrar('intento_subreto', { nivel: 'nivel-4', subreto: sub.id, intento: st.intentos[sub.id] }));
    const motor = new MotorEjecucion(bus);
    const limites = { maxPasos: sub.maxPasos || 600, maxProfundidad: 16, tiempoMaxMs: 6000 };
    let res;
    try {
      res = await motor.ejecutar(ast, crearAPI(), limites, { animado, delayMundo: 220, delayPaso: 30 });
    } catch (e){
      res = { ok: false, error: e };
    }
    if (!res.ok) return { ok: false, error: res.error };
    if (!verificar(sub, { ast })){
      return { ok: true, superado: false, mensaje: 'El programa funcionó, pero la jerarquía o la emergencia aún no están resueltas.' };
    }
    st.puntos += 12;
    if (st.intentos[sub.id] === 1) st.bonusIntentos += 2;
    if (sub.id === 'n4-sr3') st.herenciaOk = true; // bonus +15 por herencia correcta
    // los sub-retos 1 a 4 cierran sus objetivos; el 5 lo cierra completarNivel()
    if (st.indice < SUBRETOS_NIVEL4.length - 1) st.gestor?.completarObjetivo(`obj-4-${st.indice + 1}`);
    return { ok: true, superado: true };
  }

  function completarRelaciones(aciertos, total){
    if (aciertos < total) return { ok: false };
    const sub = SUBRETOS_NIVEL4[st.indice];
    st.intentos[sub.id] = (st.intentos[sub.id] ?? 0) + 1;
    st.puntos += 12;
    if (st.intentos[sub.id] === 1) st.bonusIntentos += 2;
    if (st.indice < SUBRETOS_NIVEL4.length - 1) st.gestor?.completarObjetivo(`obj-4-${st.indice + 1}`);
    return { ok: true, superado: true };
  }

  function completarNivel(){
    st.gestor?.completarObjetivo('obj-4-5', {
      metricas: {
        subretosPuntos: st.puntos,
        herenciaOk: st.herenciaOk,
        primerIntento: Math.floor(st.bonusIntentos / 2),
        segundos: Math.round((Date.now() - st.inicioNivel) / 1000),
      },
    });
  }

  const mundo = {
    colisionadores,
    zonasDano: [],
    terminal,
    alturaEn,                    // main.js: jugador.setColisionadores(..., mundo.alturaEn)
    reto: {
      subretos: SUBRETOS_NIVEL4,
      indice: () => st.indice,
      actual: () => SUBRETOS_NIVEL4[st.indice],
      cargarSubreto,
      ejecutar,
      completarRelaciones,
      completarNivel,
      setGestor: g => { st.gestor = g; },
    },
    update(t, dt, posJugador){
      // fondo: cielo, nubes y faroles (se tiñe de rojo mientras arde el edificio)
      if (fondo){
        try { fondo.update(t, dt, fuegoGrupo.visible && !st.fuegoApagado); }
        catch (e){ console.warn('[academia] fondo desactivado por error:', e); fondo = null; }
      }

      // terminal: solo se activa en el piso de la plataforma (no desde el suelo de abajo)
      if (posJugador){
        const enPlataforma = Math.abs(posJugador.y - AO - DECK_H) < 1.3;
        terminal.cerca = enPlataforma && Math.hypot(posJugador.x - grupoTerminal.position.x,
                                                    posJugador.z - grupoTerminal.position.z) < 2.5;
      }
      luzTerminal.intensity = 3 + Math.sin(t * 4) * 1.2;
      anilloTerminal.position.y = 2.2 + Math.sin(t * 2) * .08;
      aroProximidad.material.opacity = terminal.cerca ? .6 + Math.sin(t * 8) * .25 : .2 + Math.sin(t * 2) * .05;

      // ascensor: ¿hay alguien sobre la cabina o sobre la placa de llamada?
      let enLift = false, enLlamada = false;
      if (posJugador){
        enLift = posJugador.x >= LIFT.minX && posJugador.x <= LIFT.maxX &&
                 posJugador.z >= LIFT.minZ && posJugador.z <= LIFT.maxZ &&
                 Math.abs(posJugador.y - AO - lift.y) < .5;
        enLlamada = Math.hypot(posJugador.x - PAD.x, posJugador.z - PAD.z) < .9 &&
                    Math.abs(posJugador.y - AO - DECK_H) < .5;
      }
      actualizarAscensor(dt, enLift, enLlamada);
      const moviendo = lift.estado === 'sube' || lift.estado === 'baja';
      liftAnillo.material.color.set(moviendo ? '#ffd27a' : lift.espera > 0 ? '#ffffff' : '#7fe0ff');
      liftAnillo.scale.setScalar(1 + Math.sin(t * 4) * .05 + lift.espera * .25);
      padLlamada.material.color.set(lift.estado === 'arriba' ? '#58f0a0'
        : moviendo ? '#ffd27a' : enLlamada ? '#ffffff' : '#7fe0ff');
      padLlamada.scale.setScalar(1 + Math.sin(t * 3) * .06);
      matGate.opacity = .18 + Math.sin(t * 5) * .06;

      // efectos temporales
      for (let i = efectos.length - 1; i >= 0; i--){
        if (!efectos[i].update(dt)){
          efectos[i].dispose();
          efectos.splice(i, 1);
        }
      }

      // motas de conocimiento
      const arrM = geoM.attributes.position.array;
      for (let i = 0; i < NM; i++){
        arrM[i * 3 + 1] += velM[i] * dt;
        if (arrM[i * 3 + 1] > 12) arrM[i * 3 + 1] = 0;
      }
      geoM.attributes.position.needsUpdate = true;

      // glifos de código: suben despacio y se mecen
      for (const g of glifos){
        g.s.position.y += g.vy * dt;
        g.s.position.x += Math.sin(t * .6 + g.fase) * dt * .25;
        if (g.s.position.y > 11) g.s.position.y = 1;
        g.s.material.opacity = .35 + (Math.sin(t * 1.4 + g.fase) + 1) * .2;
      }

      // globo holográfico
      globo.rotation.y += dt * .5; globo.rotation.x += dt * .2;
      globo.position.y = 3.2 + Math.sin(t * 1.4) * .2;
      globoGlow.position.y = globo.position.y;
      globoGlow.material.opacity = .7 + Math.sin(t * 2) * .2;

      // drones patrullando la plaza
      for (const d of drones){
        const a = t * d.vel + d.fase;
        d.g.position.set(Math.cos(a) * d.R, d.y + Math.sin(t * 2 + d.fase) * .2, Math.sin(a) * d.R);
        d.g.rotation.y += dt * 2;
      }

      // aviones de papel: giran en bucles sobre la plaza y miran hacia donde van
      for (const a of aviones){
        const ang = t * a.vel + a.fase, ang2 = (t + .1) * a.vel + a.fase;
        a.m.position.set(Math.cos(ang) * a.R, a.y + Math.sin(t * 1.3 + a.fase) * 1.5, -6 + Math.sin(ang) * a.R);
        a.m.lookAt(Math.cos(ang2) * a.R, a.y + Math.sin((t + .1) * 1.3 + a.fase) * 1.5, -6 + Math.sin(ang2) * a.R);
        a.m.rotateZ(Math.sin(t * 2 + a.fase) * .4);
      }

      // dirigibles: patrullan despacio, de lado hacia su trayectoria
      for (const d of dirigibles){
        const ang = t * d.vel + d.fase, sg = Math.sign(d.vel);
        d.g.position.set(Math.cos(ang) * d.R, d.y + Math.sin(t * .6 + d.fase) * .8, -6 + Math.sin(ang) * d.R);
        d.g.rotation.y = Math.atan2(-Math.cos(ang) * sg, -Math.sin(ang) * sg);
      }

      // columnas: aros que respiran, haces de luz y banderas ondeando
      for (const c of arosColumnas) c.aro.position.y = 5.6 + Math.sin(t * 1.6 + c.fase) * .25;
      for (const b of banderas) b.b.rotation.z = Math.sin(t * 1.5 + b.fase) * .05;
      matHaz.opacity = .1 + Math.sin(t * 1.2) * .03;

      // SR1: los arcos pulsan fuerte mientras toca clasificar es-un / tiene-un
      const pulsoArco = st.indice === 0 ? .9 + Math.sin(t * 3) * .4 : .3;
      matArcoEs.emissiveIntensity = pulsoArco;
      matArcoTiene.emissiveIntensity = pulsoArco;
      for (const m of velosArcos) m.opacity = st.indice === 0 ? .18 + Math.sin(t * 3) * .08 : .14;

      // árbol: los nodos encendidos respiran suave y sueltan aros ascendentes
      for (const n of Object.values(nodos)){
        if (!n.lit) continue;
        n.mat.emissiveIntensity = .9 + Math.sin(t * 3 + n.x) * .25;
        const f = (t * .8 + n.x * .1) % 1;
        n.aro.position.y = .4 + f * 2.4;
        n.aro.material.opacity = .8 * (1 - f);
      }

      // fuego: parpadea mientras arde; al apagarlo se extingue de verdad
      const arde = fuegoGrupo.visible && !st.fuegoApagado;
      for (const l of llamas){
        l.malla.visible = arde;
        if (arde){
          l.malla.scale.set(
            1 + Math.sin(t * 11 + l.fase) * .18,
            1 + Math.sin(t * 13 + l.fase) * .22,
            1 + Math.cos(t * 9 + l.fase) * .18);
        }
      }
      luzFuego.intensity = arde ? 26 + Math.sin(t * 15) * 8 : 0;

      // brasas
      brasas.visible = arde;
      if (arde){
        const arrB = geoB.attributes.position.array;
        for (let i = 0; i < NB; i++){
          arrB[i * 3 + 1] += velB[i] * dt;
          arrB[i * 3] += Math.sin(t * 2 + i) * dt * .4;
          if (arrB[i * 3 + 1] > 12) reiniciarBrasa(i);
        }
        geoB.attributes.position.needsUpdate = true;
      }

      // heridos: parpadeo suave mientras esperan ayuda
      if (heridosGrupo.visible && !st.heridosCurados){
        matHerido.emissive.set('#ff3030');
        matHerido.emissiveIntensity = .3 + Math.abs(Math.sin(t * 3)) * .5;
      } else {
        matHerido.emissiveIntensity = 0;
      }

      // cartel de polimorfismo y tablero flotando
      if (cartelPoli.visible) cartelPoli.position.y = 5.2 + Math.sin(t * 2) * .1;
      tablero.sprite.position.y = TABLERO_Y + Math.sin(t * 1.5) * .08;

      // especialistas paseando por la plaza 
      for (const v of st.visuales){
        v.reloj += dt;
        if (v.reloj > 2.5){
          v.reloj = 0;
          v.destino.set((Math.random() - 0.5) * 24, 0, -8 + (Math.random() - 0.5) * 16);
        }
        _dir.subVectors(v.destino, v.grupo.position);
        _dir.y = 0;
        if (_dir.length() > .5){
          _dir.normalize();
          v.grupo.position.addScaledVector(_dir, dt * 1.3);
          v.grupo.rotation.y = Math.atan2(_dir.x, _dir.z);
          v.grupo.position.y = Math.abs(Math.sin(t * 8 + v.fase)) * .08;
        } else {
          v.grupo.position.y = 0;
        }
      }

      // registro de Gustaff (en la atalaya: hay que estar arriba, no basta pasar por debajo)
      if (registro.visible && posJugador){
        registro.rotation.y += dt;
        registro.position.y = REG_Y + Math.sin(t * 2.5) * .15;
        hazRegistro.material.opacity = .12 + Math.sin(t * 2) * .04;
        const d = Math.hypot(posJugador.x - registro.position.x, posJugador.z - registro.position.z);
        if (d < 1.6 && Math.abs(posJugador.y - registro.position.y) < 1.6){
          registro.visible = false;
          hazRegistro.visible = false;
          progreso.marcarRegistro('nivel-4');
          import('../sistema/dialogos.js').then(({ dialogos }) => dialogos.abrirPorId('gustaff-4'));
        }
      }
    },
  };
  return mundo;
}