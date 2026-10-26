// ═══════════════════════════════════════════════════════════
// mundo/moduloCiudadania.js — Nivel 3: la plaza y sus ciudadanos.
// Cada objeto instanciado se convierte en un personaje que camina
// con sus atributos flotando sobre la cabeza.
//
// Cada sub-reto tiene su reflejo en el mundo:
//  SR1 ¿Qué es cada cosa?      → 3 peanas: CLASE (molde fantasma), OBJETO (ciudadano) y ATRIBUTO (dato)
//  SR2 El molde del ciudadano  → el molde muestra «class Ciudadano»
//  SR3 El nacimiento           → el molde muestra el constructor; el ciudadano sin él nace con null
//  SR4 El glitch de Eclipse    → cubo de glitch flotando; cada ciudadano lleva un ESCUDO
//                                 que se pone rojo cuando el glitch rebota contra private
//  SR5 Que la ciudad respire   → al llenar un medidor su edificio se ilumina; con los 4, la fuente brilla
// Un tablero muestra el sub-reto activo.
// Incluye una terminal física en el MIRADOR (colina): sube y pulsa E.
//
// NUEVO (relieve y contenido):
//  · Terreno con colinas alrededor (plano en el centro, sube hacia afuera).
//  · Mirador: loma con meseta donde está la terminal. Expone mundo.alturaEn(x, z)
//    para que el jugador suba (main.js debe pasarlo a jugador.setColisionadores).
//  · Muro invisible a ±35: la plaza es el área jugable; las colinas son escenario.
//  · Edificios de distinta altura y torre de datos al fondo.
//  · Props: bancas y arbustos (InstancedMesh).
//  · PARCELAS: 6 solares vacíos con «?». Cada registrarCiudadano() levanta una casa
//    del color de su profesión en la parcela libre más cercana a su edificio.
//
// PALETA: atardecer AZUL. Cielo azul-morado con franja rosada/naranja solo en el
// horizonte, suelo y plaza fríos, y el naranja reservado para farolas, anillos de
// la plaza y contraluz. Así hay contraste y profundidad.
//
// PRESUPUESTO: la escena debe quedar bajo 3000 tris (panel F2).
// En reposo (sin ciudadanos) queda ≈ 2700. Cada ciudadano suma ≈ 100 y su casa ≈ 18.
// Si con los 4 ciudadanos pasa de 3000, pon USAR_PROPS = false (−170 tris).
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bus, EVENTOS } from '../sistema/eventos.js';
import { ErrorMotor } from '../motor/errores.js';
import { RegistroAPI } from '../motor/apiMundo.js'; 
import { MotorEjecucion } from '../motor/motorEjecucion.js';
import { SUBRETOS_NIVEL3 } from '../../datos/subretos-nivel3.js';
import { progreso } from '../sistema/progreso.js';

const COLORES_PROFESION = {
  agricultora: '#7cc35f', agricultor: '#7cc35f',
  ingeniero: '#8fb7d9', ingeniera: '#8fb7d9',
  medica: '#ff8d7a', medico: '#ff8d7a',
  comerciante: '#ffd27a',
};
const MEDIDOR_DE = {
  agricultora: 'comida', agricultor: 'comida',
  ingeniero: 'sistemas', ingeniera: 'sistemas',
  medica: 'salud', medico: 'salud',
  comerciante: 'comercio',
};
const UMBRAL = 4;
const _dir = new THREE.Vector3(); // reutilizado por frame: evita asignaciones

/* ══════════ relieve: mirador, límites y parcelas ══════════ */

const USAR_PROPS = true;      // bancas y arbustos (−170 tris si lo pones en false)
const LIMITE = 35;            // el jugador se mueve dentro de ±LIMITE
/* Mirador: meseta circular (rTop) que baja en rampa lineal hasta rBase. */
const MIR = { x: 0, z: 24, rTop: 3.5, rBase: 12, alto: 3 };

/* Altura del terreno que pisa el jugador. Solo el mirador es transitable:
   las colinas lejanas quedan fuera del muro invisible. */
function alturaEn(x, z){
  const d = Math.hypot(x - MIR.x, z - MIR.z);
  if (d >= MIR.rBase) return 0;
  if (d <= MIR.rTop) return MIR.alto;
  return MIR.alto * (MIR.rBase - d) / (MIR.rBase - MIR.rTop);
}

/* Solares donde aparecen las casas (fuera de la plaza, bien separados). */
const POS_PARCELAS = [[-24, -5], [24, -5], [-24, 5], [24, 5], [-6, -24], [6, -24]];

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

/* Plaza de 36×36 con losetas y anillos dibujados (0 tris extra).
   Piedra azul-gris; los anillos ámbar son el acento cálido. */
function texPlaza(){
  const S = 512, u = S / 36;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#3a4560'; g.fillRect(0, 0, S, S);
  const n = 12, p = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
    g.fillStyle = `rgba(170,200,255,${Math.random() * .08})`;
    g.fillRect(i * p, j * p, p, p);
  }
  g.strokeStyle = 'rgba(10,14,30,.55)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++){
    g.beginPath(); g.moveTo(i * p, 0); g.lineTo(i * p, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * p); g.lineTo(S, i * p); g.stroke();
  }
  g.strokeStyle = 'rgba(255,180,84,.6)'; g.lineWidth = 4;
  for (const [r, a] of [[3.3, .9], [6.2, .5], [12, .3]]){
    g.globalAlpha = a; g.beginPath(); g.arc(S / 2, S / 2, r * u, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Ventanas encendidas (se atenúan hasta que el medidor se llena). */
function texVentanas(){
  const c = document.createElement('canvas'); c.width = 192; c.height = 96;
  const g = c.getContext('2d');
  for (let i = 0; i < 3; i++){
    g.fillStyle = '#ffd27a'; g.fillRect(14 + i * 62, 14, 42, 68);
    g.fillStyle = 'rgba(40,20,5,.55)';
    g.fillRect(14 + i * 62 + 20, 14, 2, 68); g.fillRect(14 + i * 62, 46, 42, 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Parcela vacía: borde discontinuo ámbar y un «?» (se pinta una sola vez). */
function texParcela(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,180,84,.08)'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffb454'; g.lineWidth = 5; g.setLineDash([14, 10]);
  g.strokeRect(6, 6, 116, 116);
  g.setLineDash([]);
  g.fillStyle = '#ffd27a'; g.font = 'bold 72px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ══════════ utilidades de sprites de texto ══════════ */

/* Cartel flotante: el ancho se adapta al texto. */
function crearCartel(texto, color = '#ffe6b0'){
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

/* Cartel que cambia de texto (canvas fijo de 512 px). */
function crearCartelVivo(){
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(6.4, .8, 1);
  return { canvas, tex, sprite, _ultimo: '' };
}
function pintarCartelVivo(cv, texto, color = '#ffb454'){
  const key = texto + color;
  if (cv._ultimo === key) return;
  cv._ultimo = key;
  const g = cv.canvas.getContext('2d');
  g.clearRect(0, 0, 512, 64);
  g.fillStyle = 'rgba(12,18,30,.88)'; g.fillRect(0, 0, 512, 64);
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
  sprite.scale.set(6.4, 2.4, 1);
  return { canvas, tex, sprite };
}
function pintarTablero(tb, sub, indice, total){
  const g = tb.canvas.getContext('2d');
  g.clearRect(0, 0, 512, 192);
  g.fillStyle = 'rgba(12,18,30,.88)'; g.fillRect(6, 6, 500, 180);
  g.strokeStyle = '#ffb454'; g.lineWidth = 3; g.strokeRect(6, 6, 500, 180);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!sub){
    g.fillStyle = '#ffb454'; g.font = 'bold 30px monospace';
    g.fillText('PLAZA DE', 256, 70);
    g.fillText('CIUDADANÍA', 256, 110);
    g.fillStyle = '#ffe6b0'; g.font = '20px monospace';
    g.fillText('Sube al mirador (E)', 256, 154);
  } else {
    g.fillStyle = '#ffe6b0'; g.font = 'bold 20px monospace';
    g.fillText(`SUB-RETO ${indice + 1} / ${total}`, 256, 34);
    g.fillStyle = '#fff4dc'; g.font = 'bold 30px monospace';
    g.fillText(sub.nombre, 256, 88, 470);
    g.fillStyle = '#9fd6a8'; g.font = 'bold 24px monospace';
    g.fillText(sub.concepto, 256, 136, 470);
  }
  tb.tex.needsUpdate = true;
}

function crearEtiqueta(){
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6, 1.3, 1);
  sprite.position.y = 2.4;
  return { canvas, tex, sprite, _ultimo: '' };
}
function pintarEtiqueta(et, { nombre, profesion, energia }){
  const key = `${nombre}|${profesion}|${energia}`;
  if (et._ultimo === key) return; // sin cambios: no se toca la textura
  et._ultimo = key;
  const g = et.canvas.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(12,18,30,.78)'; g.fillRect(8, 8, 240, 112);
  g.strokeStyle = 'rgba(255,210,122,.7)'; g.strokeRect(8, 8, 240, 112);
  g.fillStyle = '#ffe6b0'; g.font = 'bold 26px monospace'; g.textAlign = 'center';
  g.fillText(String(nombre ?? 'null'), 128, 42);
  g.fillStyle = '#9fd6a8'; g.font = '20px monospace';
  g.fillText(String(profesion ?? 'null'), 128, 72);
  g.fillStyle = energia === null || energia === undefined ? '#8fa3ba' : '#7fe0ff';
  g.fillText(`⚡ ${energia ?? 'null'}`, 128, 102);
  et.tex.needsUpdate = true;
}

/* Texto del molde según el sub-reto activo. */
const TEXTO_MOLDE = [
  'CLASE · el molde',
  'class Ciudadano { ... }',
  'constructor(nombre, edad, profesion)',
  'private num energia',
  'el MISMO molde × 4',
];

/* ═══════════════════════════════════════════════════════════════════════
   FONDO DE LA PLAZA (todo decorativo; no toca colisiones ni lógica)
   Atardecer azul: cielo con sol poniente pálido · ciudad y colinas lejanas
   (una textura en un anillo abierto cada una) · nubes moradas · bruma rosada
   · faroles flotantes. Con el glitch (SR4) todo se tiñe de rojo.
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

/* Degradado de atardecer azul para el domo (el horizonte cae a mitad de la textura). */
function texturaCieloAtardecer(){
  const [c, g] = lienzoF(16, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  [[0, '#050818'], [.25, '#0f1a3a'], [.40, '#26336a'], [.46, '#6a4a8a'],
   [.49, '#d9788a'], [.5, '#ffb08a'], [.52, '#1a2038'], [1, '#080c18']]
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

/* Ciudad lejana: siluetas azul oscuro con ventanas cálidas, todo en una sola textura. */
function texturaSkyline(){
  const W = 2048, H = 256;
  const [c, g] = lienzoF(W, H);
  let x = 30;
  while (x < W - 60){
    const w = 22 + Math.random() * 40, h = 50 + Math.random() * 130, y = H - h;
    g.fillStyle = '#0c1224';
    g.fillRect(x, y, w, h);
    const r = Math.random();
    if (r < .35){                       // tejado a dos aguas
      g.beginPath();
      g.moveTo(x - 2, y); g.lineTo(x + w / 2, y - 14 - Math.random() * 10); g.lineTo(x + w + 2, y);
      g.closePath(); g.fill();
    } else if (r < .5){                 // antena
      g.fillRect(x + w / 2 - 1, y - 20, 2, 20);
    }
    for (let wy = y + 8; wy < H - 6; wy += 11){
      for (let wx = x + 5; wx < x + w - 6; wx += 9){
        if (Math.random() < .28){
          g.fillStyle = Math.random() < .8 ? '#ffc866' : '#ffe9b0';
          g.fillRect(wx, wy, 4, 6);
        }
      }
    }
    x += w + (Math.random() < .3 ? 8 + Math.random() * 14 : 2);
  }
  return texF(c);
}

/* Colinas azuladas con pinos al fondo. */
function texturaColinas(){
  const W = 2048, H = 128;
  const [c, g] = lienzoF(W, H);
  const alt = x => H - 40 - 22 * Math.sin(x * .006) - 14 * Math.sin(x * .017 + 1) - 8 * Math.sin(x * .043 + 2);
  g.fillStyle = '#14203a';
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, alt(x));
  g.lineTo(W, H); g.closePath(); g.fill();
  g.fillStyle = '#0e1a30';
  for (let i = 0; i < 260; i++){
    const x = Math.random() * W, base = alt(x) + 6;
    const h = 14 + Math.random() * 20, w = 6 + Math.random() * 6;
    g.beginPath();
    g.moveTo(x - w / 2, base); g.lineTo(x, base - h); g.lineTo(x + w / 2, base);
    g.closePath(); g.fill();
  }
  return texF(c);
}

/* Suelo azul-verdoso con alguna hoja cálida (0 tris: solo textura). */
function texturaSuelo(){
  const S = 1024;
  const [c, g] = lienzoF(S, S);
  g.fillStyle = '#1f2e3a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++){
    g.fillStyle = `rgba(${(30 + Math.random() * 30) | 0},${(70 + Math.random() * 40) | 0},${(80 + Math.random() * 40) | 0},${.08 + Math.random() * .1})`;
    g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 20 + Math.random() * 60, 0, Math.PI * 2); g.fill();
  }
  const COL = ['#5f9a7a', '#4a7f8a', '#7fb08a', '#d98a3a']; // solo una hoja cálida
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

/* ══════════ terreno con colinas ══════════
   Plano de 220×220 con 12×12 celdas (288 tris, estilo low-poly con flatShading).
   Los vértices caen en múltiplos de 18.33, así que todo lo que está a menos de
   ±36.7 queda exactamente a y = 0 (plaza y zona jugable). Hacia afuera sube en
   anillo de colinas y vuelve a 0 en el borde para no dejar «acantilados». */
function crearTerreno(tex){
  const geo = new THREE.PlaneGeometry(220, 220, 12, 12);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const ss = THREE.MathUtils.smoothstep;
  for (let i = 0; i < p.count; i++){
    const x = p.getX(i), z = p.getZ(i);
    const cheb = Math.max(Math.abs(x), Math.abs(z));
    const sube = ss(cheb, 36.7, 75);              // 0 en el centro, 1 lejos
    const baja = 1 - ss(cheb, 92, 110);           // vuelve a 0 en el borde
    const ruido = Math.sin(x * .09) * Math.cos(z * .11) * .5 + .5;
    p.setY(i, sube * baja * (3 + ruido * 6));
  }
  geo.computeVertexNormals();
  if (tex){
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);                          // si no, la textura se estira
  }
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: tex ? '#ffffff' : '#1f2e3a', map: tex, roughness: .95, flatShading: true }));
  m.receiveShadow = true;
  return m;
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

  // sol poniente pálido: medio escondido tras las colinas (se dibuja antes que ellas)
  const sol = crearGlow('#ffc8a0', 90);
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
    { color: '#ff7aa8', blending: ADITIVO, opacity: .35 });
  // colinas pintadas: ahora solo son el telón más lejano (las cercanas son malla real)
  const colinas = anillo(98, 16, 8, texturaColinas(), -15);
  // la ciudad asoma POR ENCIMA de las colinas reales: base baja para que el relieve la tape
  const ciudad = anillo(70, 24, 14, texturaSkyline(), -14);

  // nubes moradas (sprites alargados que giran muy despacio)
  const nubes = [];
  for (let i = 0; i < 6; i++){
    const s = crearGlow('#8a6fb0', 1);
    s.material.blending = THREE.NormalBlending;
    s.material.opacity = .28;
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
    map: TEX_GLOW, color: '#ffb35a', size: 1.6, transparent: true, opacity: .9,
    blending: ADITIVO, depthWrite: false, fog: false }));

  // terreno lejano
  const terreno = new THREE.Mesh(new THREE.CircleGeometry(170, 16),
    new THREE.MeshBasicMaterial({ color: '#0a1020' }));
  terreno.rotation.x = -Math.PI / 2;
  terreno.position.y = -.05;

  grupo.add(cielo, sol, bruma, colinas, ciudad, faroles, terreno, ...nubes.map(n => n.s));

  let alerta = 0; // 0..1: sube durante el glitch
  return {
    update(t, dt, enAlerta = false){
      alerta += ((enAlerta ? 1 : 0) - alerta) * Math.min(1, dt * 2.5);
      cielo.material.color.setRGB(1, 1 - .3 * alerta, 1 - .4 * alerta);
      bruma.material.color.set('#ff7aa8').lerp(ROJO_FONDO, alerta * .8);
      sol.material.color.set('#ffc8a0').lerp(ROJO_FONDO, alerta * .8);
      sol.scale.setScalar(90 * (1 + Math.sin(t * .5) * .03));

      for (const n of nubes){
        n.ang += n.vel * dt;
        n.s.position.set(Math.cos(n.ang) * n.r, n.y, Math.sin(n.ang) * n.r);
        n.s.material.color.set('#8a6fb0').lerp(ROJO_FONDO, alerta * .6);
      }

      for (let i = 0; i < NF; i++){
        posF[i * 3 + 1] += velF[i] * dt;
        posF[i * 3] += Math.sin(t * .6 + fasF[i]) * dt * .4;
        if (posF[i * 3 + 1] > 30) reubicar(i, true);
      }
      geoF.attributes.position.needsUpdate = true;
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

export function crearCiudad(escena){
  const colisionadores = [];
  const dinamicos = new THREE.Group();
  escena.add(dinamicos);

  /* ── geometrías compartidas (baratas y reutilizadas) ──
     Marcadas userData.compartida: liberarCiudadanos() no las libera. */
  const compartida = g => { g.userData.compartida = true; return g; };
  const GEO_ONDA = compartida(new THREE.RingGeometry(.94, 1, 24));          // 48 tris
  const GEO_ESFERA = compartida(new THREE.SphereGeometry(1, 6, 4));         // bocanadas (se escala)
  const GEO_PAQUETE = compartida(new THREE.SphereGeometry(.24, 5, 3));
  const GEO_CUERPO = compartida(new THREE.CylinderGeometry(.28, .34, 1.1, 6));
  const GEO_CABEZA = compartida(new THREE.SphereGeometry(.24, 6, 4));
  const GEO_HALO = compartida(new THREE.RingGeometry(.5, .64, 12));
  const GEO_ESCUDO = compartida(new THREE.SphereGeometry(1.05, 6, 4));
  const GEO_ALA = compartida(new THREE.CylinderGeometry(.5, .5, .04, 10));
  const GEO_COPA = compartida(new THREE.CylinderGeometry(.25, .27, .16, 8));
  const GEO_CASCO = compartida(new THREE.SphereGeometry(.27, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2));
  const GEO_CRUZ_H = compartida(new THREE.BoxGeometry(.26, .08, .04));
  const GEO_CRUZ_V = compartida(new THREE.BoxGeometry(.08, .26, .04));
  const GEO_BOLSA = compartida(new THREE.BoxGeometry(.3, .35, .15));
  // casas de las parcelas (12 + 4 + 2 = 18 tris por casa)
  const GEO_CASA = compartida(new THREE.BoxGeometry(2.6, 2, 2.6));
  const GEO_TEJADO = compartida(new THREE.ConeGeometry(2.1, 1.2, 4, 1, true));
  const GEO_PUERTA = compartida(new THREE.PlaneGeometry(.7, 1.2));
  const MAT_PUERTA = new THREE.MeshBasicMaterial({ color: '#1a1208' });
  const MAT_TEJADO_CASA = new THREE.MeshStandardMaterial({ color: '#2a2438', roughness: .8 });

  /* Accesorio distintivo de cada profesión. */
  function accesorioCiudadano(profesion, grupo){
    const p = String(profesion ?? '').toLowerCase();
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .6 });
    if (p.includes('agric')){
      const m = mat('#e8c56a');
      const ala = new THREE.Mesh(GEO_ALA, m);
      ala.position.y = 1.78;
      const copa = new THREE.Mesh(GEO_COPA, m);
      copa.position.y = 1.86;
      grupo.add(ala, copa);
    } else if (p.includes('ingen')){
      const casco = new THREE.Mesh(GEO_CASCO, mat('#ffd23f'));
      casco.position.y = 1.66;
      grupo.add(casco);
    } else if (p.includes('medic')){
      const m = mat('#ffffff');
      const h = new THREE.Mesh(GEO_CRUZ_H, m);
      const v = new THREE.Mesh(GEO_CRUZ_V, m);
      h.position.set(0, 1.0, .34); v.position.set(0, 1.0, .34);
      grupo.add(h, v);
    } else if (p.includes('comerc')){
      const bolsa = new THREE.Mesh(GEO_BOLSA, mat('#8a5a2b'));
      bolsa.position.set(.42, .7, 0);
      grupo.add(bolsa);
    }
  }

  /* ── iluminación propia del nivel 3 ──
     LevelManager limpia la escena al cargar: sin luces todo se ve oscuro.
     aplicarPaleta() recolorea estas luces y la niebla. */
  {
    // cielo: degradado de canvas (0 tris)
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#05081c'); gr.addColorStop(.55, '#2a2a5a'); gr.addColorStop(1, '#c06a7a');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const texCielo = new THREE.CanvasTexture(c); texCielo.colorSpace = THREE.SRGBColorSpace;
    escena.background = texCielo;

    // estrellas (Points: 0 tris), por encima de la ciudad y las colinas lejanas
    const NE = 220, posE = new Float32Array(NE * 3);
    for (let i = 0; i < NE; i++){
      const a = Math.random() * Math.PI * 2, b = .4 + Math.random() * 1.1, r = 95;
      posE[i * 3] = Math.cos(a) * Math.cos(b) * r;
      posE[i * 3 + 1] = Math.sin(b) * r;
      posE[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    }
    const geoE = new THREE.BufferGeometry();
    geoE.setAttribute('position', new THREE.BufferAttribute(posE, 3));
    escena.add(new THREE.Points(geoE, new THREE.PointsMaterial({
      color: '#ffe9c4', size: .9, transparent: true, opacity: .85, depthWrite: false, fog: false })));

    // luna fría (sprite: 2 tris), más lejos que la ciudad para que no la tape
    const luna = crearGlow('#cfe0ff', 24);
    luna.material.fog = false;
    luna.position.set(-70, 60, -100);
    escena.add(luna);
  }
  escena.fog = new THREE.Fog('#2a3358', 35, 110);
  // ambiente azul + luz de luna + contraluz cálido del horizonte
  const luzHemi = new THREE.HemisphereLight('#7f9cff', '#1c2438', 1.3);
  const luzSol = new THREE.DirectionalLight('#a9c4ff', 1.8);
  luzSol.position.set(-14, 26, 12);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(1024, 1024);
  Object.assign(luzSol.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 80 });
  const luzContra = new THREE.DirectionalLight('#ff9a5a', 1.2);
  luzContra.position.set(20, 8, -25);
  escena.add(luzHemi, luzSol, luzContra);

  // dos farolas con luz real (da profundidad al suelo)
  for (const x of [-12, 12]){
    const l = new THREE.PointLight('#ffb066', 14, 16, 2);
    l.position.set(x, 3.4, 0);
    escena.add(l);
  }

  // fondo: si algo fallara, el nivel sigue funcionando como antes (sin fondo nuevo)
  let fondo = null;
  if (USAR_FONDO){
    try { fondo = crearFondoPlaza(escena); }
    catch (e){ console.warn('[ciudadania] no se pudo crear el fondo:', e); }
  }

  /* ── efectos temporales (ondas, paquetes de datos, textos flotantes) ──
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

  function bocanada(x, y, z, color, { retraso = 0, dur = 1.2, sube = 2, crece = 1.6, tam = .25 } = {}){
    const m = new THREE.Mesh(GEO_ESFERA,
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
        m.material.opacity = .6 * (1 - k);
        return k < 1;
      },
      dispose(){ escena.remove(m); m.material.dispose(); },
    });
  }

  /* Paquete de recursos que viaja de un edificio a la fuente. */
  function paquete(x, z, color, y = 3.5){
    const m = new THREE.Mesh(GEO_PAQUETE, new THREE.MeshBasicMaterial({ color }));
    const a = new THREE.Vector3(x, y, z), b = new THREE.Vector3(0, .9, 0);
    escena.add(m);
    let t = 0;
    efectos.push({
      update(dt){
        t += dt;
        const k = Math.min(1, t / .9);
        m.position.lerpVectors(a, b, k);
        m.position.y += Math.sin(k * Math.PI) * 2.5;
        m.scale.setScalar(1 + Math.sin(k * Math.PI) * .5);
        if (k >= 1){
          st.flashFuente = 1;
          onda(0, 0, color, { vel: 3, dur: .8 });
          return false;
        }
        return true;
      },
      dispose(){ escena.remove(m); m.material.dispose(); },
    });
  }

  function textoFlotante(texto, color, x, y, z){
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 5; g.strokeStyle = 'rgba(12,18,30,.9)'; g.strokeText(texto, 64, 34);
    g.fillStyle = color; g.fillText(texto, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(1.4, .7, 1);
    s.position.set(x, y, z);
    escena.add(s);
    let t = 0;
    efectos.push({
      update(dt){
        t += dt;
        s.position.y = y + t * 1.2;
        s.material.opacity = Math.max(0, 1 - t / 1.2);
        return t < 1.2;
      },
      dispose(){ escena.remove(s); tex.dispose(); s.material.dispose(); },
    });
  }

  /* ── terreno con colinas (la plaza queda plana en el centro) ── */
  const suelo = crearTerreno(fondo ? texturaSuelo() : null);
  escena.add(suelo);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(36, 36),
    new THREE.MeshStandardMaterial({ map: texPlaza(), roughness: .9 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = .01; plaza.receiveShadow = true;
  escena.add(plaza);

  /* ── muro invisible: la plaza es el área jugable, las colinas son escenario ── */
  colisionadores.push(
    { minX: -80, maxX: -LIMITE, minZ: -80, maxZ: 80 },
    { minX: LIMITE, maxX: 80, minZ: -80, maxZ: 80 },
    { minX: -80, maxX: 80, minZ: -80, maxZ: -LIMITE },
    { minX: -80, maxX: 80, minZ: LIMITE, maxZ: 80 },
  );

  /* ── mirador: meseta con rampa (36+16 tris). alturaEn() describe esta misma forma ── */
  {
    const matLoma = new THREE.MeshStandardMaterial({ color: '#2f4a52', roughness: .95, flatShading: true });
    const loma = new THREE.Mesh(
      new THREE.CylinderGeometry(MIR.rTop, MIR.rBase, MIR.alto, 16, 1, true), matLoma);
    loma.position.set(MIR.x, MIR.alto / 2, MIR.z);
    loma.receiveShadow = true;
    const cima = new THREE.Mesh(new THREE.CircleGeometry(MIR.rTop, 16),
      new THREE.MeshStandardMaterial({ color: '#4a5878', roughness: .85 }));
    cima.rotation.x = -Math.PI / 2;
    cima.position.set(MIR.x, MIR.alto + .01, MIR.z);
    cima.receiveShadow = true;
    escena.add(loma, cima);
  }

  /* ── farolas (poste abierto + brillo) ── */
  const orbesFarola = [];
  {
    const matPoste = new THREE.MeshStandardMaterial({ color: '#1c2030', roughness: .8 });
    const geoPoste = new THREE.CylinderGeometry(.07, .1, 3.2, 5, 1, true);   // 10 tris
    for (const [x, z] of [[-12, 0], [12, 0], [-9, 8], [9, 8], [-11, -9], [11, -9]]){
      const poste = new THREE.Mesh(geoPoste, matPoste);
      poste.position.set(x, 1.6, z);
      const orbe = crearGlow('#ffd9a0', 1.6);
      orbe.position.set(x, 3.4, z);
      escena.add(poste, orbe);
      orbesFarola.push({ orbe, fase: x + z });
      colisionadores.push({ minX: x - .3, maxX: x + .3, minZ: z - .3, maxZ: z + .3 });
    }
  }

  /* ── luciérnagas ── */
  const NL = 180;
  const posL = new Float32Array(NL * 3);
  const velL = new Float32Array(NL);
  for (let i = 0; i < NL; i++){
    posL[i * 3] = (Math.random() - .5) * 70;
    posL[i * 3 + 1] = Math.random() * 8;
    posL[i * 3 + 2] = (Math.random() - .5) * 70;
    velL[i] = .15 + Math.random() * .35;
  }
  const geoL = new THREE.BufferGeometry();
  geoL.setAttribute('position', new THREE.BufferAttribute(posL, 3));
  const luciernagas = new THREE.Points(geoL,
    new THREE.PointsMaterial({ color: '#9fffd0', size: .16, transparent: true, opacity: .8, depthWrite: false }));
  escena.add(luciernagas);

  /* ── hojas de otoño cayendo (Points: 0 tris) ── */
  const NH = 90;
  const posH = new Float32Array(NH * 3), velH = new Float32Array(NH), faseH = new Float32Array(NH);
  for (let i = 0; i < NH; i++){
    posH[i * 3] = (Math.random() - .5) * 60;
    posH[i * 3 + 1] = Math.random() * 12;
    posH[i * 3 + 2] = (Math.random() - .5) * 60;
    velH[i] = .4 + Math.random() * .5;
    faseH[i] = Math.random() * 6.28;
  }
  const geoH = new THREE.BufferGeometry();
  geoH.setAttribute('position', new THREE.BufferAttribute(posH, 3));
  escena.add(new THREE.Points(geoH,
    new THREE.PointsMaterial({ color: '#d98a3a', size: .18, transparent: true, opacity: .9, depthWrite: false })));

  /* ── 4 edificios (uno por profesión), de distinta altura, bien separados de la fuente ── */
  const edificios = [];
  const defs = [
    { profesion: 'agricultora', medidor: 'comida',   cartel: 'GRANJA · comida',    color: 0x7cc35f, pos: [-14, -14], alto: 3 },
    { profesion: 'ingeniero',   medidor: 'sistemas', cartel: 'TALLER · sistemas',  color: 0x8fb7d9, pos: [14, -14],  alto: 6.5 },
    { profesion: 'medica',      medidor: 'salud',    cartel: 'HOSPITAL · salud',   color: 0xff8d7a, pos: [-14, 14],  alto: 5 },
    { profesion: 'comerciante', medidor: 'comercio', cartel: 'MERCADO · comercio', color: 0xffd27a, pos: [14, 14],   alto: 3.5 },
  ];
  const matCamino = new THREE.MeshStandardMaterial({ color: '#5a6078', roughness: .95 });
  const matTecho = new THREE.MeshStandardMaterial({ color: '#2a2438', roughness: .8 });
  const GEO_TECHO = compartida(new THREE.ConeGeometry(3.2, 1.6, 4, 1, true));   // 4 tris
  const GEO_VENT = compartida(new THREE.PlaneGeometry(3, 1.5));                  // 2 tris
  const texVent = texVentanas();
  for (const d of defs){
    const [px, pz] = d.pos;
    const H = d.alto;
    const sx = -Math.sign(px), sz = -Math.sign(pz);   // lado que mira a la plaza
    const m = new THREE.Mesh(new THREE.BoxGeometry(4, H, 4),
      new THREE.MeshStandardMaterial({ color: d.color, roughness: .8, emissive: d.color, emissiveIntensity: 0 }));
    m.position.set(px, H / 2, pz);
    m.castShadow = m.receiveShadow = true;
    const techo = new THREE.Mesh(GEO_TECHO, matTecho);
    techo.position.set(px, H + .8, pz);
    techo.rotation.y = Math.PI / 4;
    const cartel = crearCartel(d.cartel, '#' + d.color.toString(16).padStart(6, '0'));
    cartel.position.set(px, H + 2.4, pz);
    // baliza: se enciende cuando el medidor se llena
    const beacon = crearGlow('#4a3a2a', 1.2);
    beacon.position.set(px, H + 3.6, pz);
    // ventanas en las dos caras que miran a la plaza (comparten material)
    const matVent = new THREE.MeshBasicMaterial({ map: texVent, transparent: true, color: 0x595959, depthWrite: false });
    const vz = new THREE.Mesh(GEO_VENT, matVent);
    vz.position.set(px, 1.7, pz + sz * 2.02);
    vz.rotation.y = sz > 0 ? 0 : Math.PI;
    const vx = new THREE.Mesh(GEO_VENT, matVent);
    vx.position.set(px + sx * 2.02, 1.7, pz);
    vx.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    escena.add(vz, vx);
    // los edificios altos tienen un segundo piso de ventanas
    if (H >= 5){
      const vz2 = vz.clone(), vx2 = vx.clone();
      vz2.position.y = vx2.position.y = 4.2;
      escena.add(vz2, vx2);
    }
    // barra de medidor (del lado de la plaza)
    const marco = new THREE.Mesh(new THREE.BoxGeometry(.6, 3.1, .6),
      new THREE.MeshStandardMaterial({ color: '#1a1208', roughness: .8 }));
    marco.position.set(px + sx * 3, 1.55, pz);
    const geoRelleno = new THREE.BoxGeometry(.45, 1, .45);
    geoRelleno.translate(0, .5, 0);                 // crece desde abajo
    const barra = new THREE.Mesh(geoRelleno, new THREE.MeshBasicMaterial({ color: d.color }));
    barra.position.set(px + sx * 3, .05, pz);
    barra.scale.y = .02;
    // camino al centro
    const largo = Math.hypot(px, pz) - 4;
    const camino = new THREE.Mesh(new THREE.BoxGeometry(1.8, .03, largo), matCamino);
    camino.position.set(px / 2, .03, pz / 2);
    camino.rotation.y = Math.atan2(px, pz);
    camino.receiveShadow = true;
    escena.add(m, techo, cartel, beacon, marco, barra, camino);
    colisionadores.push({ minX: px - 2, maxX: px + 2, minZ: pz - 2, maxZ: pz + 2 });
    edificios.push({ ...d, malla: m, barra, beacon, matVent, nivel: 0, prevLleno: false });
  }

  /* ── torre de datos: un hito vertical al fondo (36 + 2 tris) ──
     Está detrás del muro invisible: es solo escenario. */
  let faroTorre = null;
  {
    const matT = new THREE.MeshStandardMaterial({
      color: '#2a3358', roughness: .6, emissive: '#1b2a66', emissiveIntensity: .6 });
    const torre = new THREE.Group();
    [[6, 10, 5], [4.5, 8, 14], [3, 8, 22]].forEach(([w, h, y]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), matT);
      b.position.y = y; b.castShadow = true;
      torre.add(b);
    });
    faroTorre = crearGlow('#7fe0ff', 8);
    faroTorre.position.y = 28;
    torre.add(faroTorre);
    torre.position.set(0, 0, -38);
    escena.add(torre);
  }

  /* ── árboles del borde: 2 InstancedMesh (≈12 tris por árbol, sin sombra) ──
     Verdes fríos, más pequeños y más lejos para no tapar la vista.
     No se plantan sobre el mirador. */
  const ARBOLES = 14;
  {
    const geoCopa = compartida(new THREE.ConeGeometry(1.3, 3.2, 6, 1, true));
    const geoTronco = compartida(new THREE.CylinderGeometry(.14, .2, 1.4, 3, 1, true));
    const copas = new THREE.InstancedMesh(geoCopa,
      new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true, side: THREE.DoubleSide }), ARBOLES);
    const troncos = new THREE.InstancedMesh(geoTronco,
      new THREE.MeshStandardMaterial({ color: '#2a2230', roughness: .9, side: THREE.DoubleSide }), ARBOLES);
    const tonos = ['#2f6f5a', '#3f8a6a', '#5a8f4a'].map(c => new THREE.Color(c));
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let k = 1; k < 200 && n < ARBOLES; k++){
      const a = k * 2.399963, r = 31 + (k * 7 % 5);       // ángulo áureo: reparto parejo y estable
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!defs.every(d => Math.hypot(x - d.pos[0], z - d.pos[1]) > 7)) continue;
      if (Math.hypot(x - MIR.x, z - MIR.z) < MIR.rBase + 3) continue;   // libre el mirador
      const s = .7 + ((k * 13) % 5) / 12;
      dummy.scale.setScalar(s);
      dummy.position.set(x, .7 * s, z); dummy.updateMatrix(); troncos.setMatrixAt(n, dummy.matrix);
      dummy.position.set(x, 2.8 * s, z); dummy.updateMatrix(); copas.setMatrixAt(n, dummy.matrix);
      copas.setColorAt(n, tonos[k % 3]);
      n++;
    }
    copas.count = troncos.count = n;
    escena.add(copas, troncos);
  }

  /* ── props: bancas (12 tris c/u) y arbustos (8 tris c/u) ── */
  if (USAR_PROPS){
    // bancas alrededor de la fuente, mirando hacia ella
    const BANCAS = [[-8.5, 0], [8.5, 0], [-4, 8.8], [4, 8.8], [-11, -4.5], [11, -4.5]];
    const geoBanca = compartida(new THREE.BoxGeometry(1.7, .5, .55));
    const bancas = new THREE.InstancedMesh(geoBanca,
      new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: .8 }), BANCAS.length);
    const dummy = new THREE.Object3D();
    BANCAS.forEach(([x, z], i) => {
      dummy.position.set(x, .25, z);
      dummy.rotation.set(0, Math.atan2(-x, -z), 0);      // largo de la banca tangente al anillo
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bancas.setMatrixAt(i, dummy.matrix);
      colisionadores.push({ minX: x - .8, maxX: x + .8, minZ: z - .8, maxZ: z + .8 });
    });
    bancas.castShadow = bancas.receiveShadow = true;
    escena.add(bancas);

    // arbustos repartidos fuera de la plaza (posiciones estables, sin azar)
    const MAX_ARB = 12;
    const geoArbusto = compartida(new THREE.OctahedronGeometry(.75, 0));
    const arbustos = new THREE.InstancedMesh(geoArbusto,
      new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true }), MAX_ARB);
    const verdes = ['#2f6f5a', '#3f8a6a', '#5a8f4a'].map(c => new THREE.Color(c));
    let n = 0;
    for (let k = 1; k < 300 && n < MAX_ARB; k++){
      const a = k * 2.399963, r = 19 + (k * 11 % 14);      // anillo entre la plaza y los árboles
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) > LIMITE - 2 || Math.abs(z) > LIMITE - 2) continue;
      if (!defs.every(d => Math.hypot(x - d.pos[0], z - d.pos[1]) > 5.5)) continue;
      if (!POS_PARCELAS.every(([px, pz]) => Math.hypot(x - px, z - pz) > 4.5)) continue;
      if (Math.hypot(x - MIR.x, z - MIR.z) < MIR.rBase + 1.5) continue;
      const s = .8 + ((k * 7) % 5) / 8;
      dummy.rotation.set(0, k, 0);
      dummy.scale.set(s, s * .8, s);
      dummy.position.set(x, .45 * s, z);
      dummy.updateMatrix();
      arbustos.setMatrixAt(n, dummy.matrix);
      arbustos.setColorAt(n, verdes[k % 3]);
      n++;
    }
    arbustos.count = n;
    escena.add(arbustos);
  }

  /* ── parcelas: solares vacíos que se llenan de casas ── */
  const TEX_PARCELA = texParcela();
  const GEO_PARCELA = compartida(new THREE.PlaneGeometry(5, 5));
  const MAT_PARCELA = new THREE.MeshBasicMaterial({
    map: TEX_PARCELA, transparent: true, opacity: .7, depthWrite: false });
  const parcelas = POS_PARCELAS.map(([x, z]) => {
    const marca = new THREE.Mesh(GEO_PARCELA, MAT_PARCELA);
    marca.rotation.x = -Math.PI / 2;
    marca.position.set(x, .04, z);
    escena.add(marca);
    return { x, z, marca, ocupada: false, col: null };
  });

  // fuente central (brilla cuando los 4 medidores están llenos)
  const fuente = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, .5, 12),
    new THREE.MeshStandardMaterial({ color: '#5a6580' }));
  fuente.position.y = .25;
  const agua = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, .1, 12),
    new THREE.MeshStandardMaterial({ color: '#7fd8e8', emissive: '#2b7f8f', emissiveIntensity: .6 }));
  agua.position.y = .5;
  const luzFuente = new THREE.PointLight('#7fd8e8', 3, 14, 2);
  luzFuente.position.set(0, 2, 0);
  escena.add(fuente, agua, luzFuente);

  // chorros de la fuente
  const NJ = 48;
  const posJ = new Float32Array(NJ * 3);
  const jAng = new Float32Array(NJ), jVr = new Float32Array(NJ), jVy = new Float32Array(NJ), jEdad = new Float32Array(NJ);
  function reiniciarGota(i, suma = 0){
    jAng[i] = Math.random() * Math.PI * 2;
    jVr[i] = .3 + Math.random() * .9;
    jVy[i] = 2.6 + Math.random() * 1.4 + suma * 1.2;
    jEdad[i] = 0;
  }
  for (let i = 0; i < NJ; i++){ reiniciarGota(i); jEdad[i] = Math.random() * 1.2; }
  const geoJ = new THREE.BufferGeometry();
  geoJ.setAttribute('position', new THREE.BufferAttribute(posJ, 3));
  const chorros = new THREE.Points(geoJ,
    new THREE.PointsMaterial({ color: '#bff3ff', size: .13, transparent: true, opacity: .85, depthWrite: false }));
  escena.add(chorros);

  /* ── terminal del Molde de Ciudadanos (en la cima del mirador) ──
     main.js lee mundo.terminal.cerca: con él muestra el aviso
     «PRESIONA E PARA USAR LA TERMINAL» y E abre el editor de clases. */
  const terminal = { cerca: false };
  const grupoTerminal = new THREE.Group();
  const pantallaMat = new THREE.MeshBasicMaterial({ color: '#ffb454' });
  const luzTerminal = new THREE.PointLight('#ffb454', 4, 8);
  const anilloTerminal = new THREE.Mesh(new THREE.RingGeometry(.75, .85, 16),
    new THREE.MeshBasicMaterial({ color: '#ffb454', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  const aroProximidad = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.5, 24),
    new THREE.MeshBasicMaterial({ color: '#ffb454', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false }));
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, .9),
      new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: .7 }));
    base.position.y = .5;
    const poste = new THREE.Mesh(new THREE.BoxGeometry(.12, .5, .12),
      new THREE.MeshStandardMaterial({ color: '#6b4a2a' }));
    poste.position.y = 1.15;
    const pantalla = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, .08), pantallaMat);
    pantalla.position.set(0, 1.45, 0);
    pantalla.rotation.x = -.25;
    luzTerminal.position.set(0, 1.6, 1);
    anilloTerminal.position.set(0, 2.1, 0);
    anilloTerminal.rotation.x = Math.PI / 2;
    aroProximidad.rotation.x = -Math.PI / 2;
    aroProximidad.position.y = .05;
    const cartel = crearCartel('MOLDE DE CIUDADANOS', '#ffb454');
    cartel.position.set(0, 2.9, 0);
    grupoTerminal.add(base, poste, pantalla, luzTerminal, anilloTerminal, aroProximidad, cartel);
    base.castShadow = true; poste.castShadow = true; pantalla.castShadow = true;
    grupoTerminal.position.set(MIR.x, MIR.alto, MIR.z);
    escena.add(grupoTerminal);
    colisionadores.push({ minX: MIR.x - .7, maxX: MIR.x + .7, minZ: MIR.z - .45, maxZ: MIR.z + .45 });
  }

  /* ══════════ SR1-SR3: peanas CLASE / OBJETO / ATRIBUTO ══════════ */
  const PX = 6.5, PZ = -8;     // separación lateral y fila de las peanas
  const matsPeana = [];
  const anillosPeana = [];
  const geoPeana = new THREE.CylinderGeometry(1.1, 1.2, .3, 12);
  const geoAnilloPeana = new THREE.RingGeometry(1.35, 1.5, 20);
  function crearPeana(x, color, texto){
    const mat = new THREE.MeshStandardMaterial({ color: '#3a2a1c', emissive: color, emissiveIntensity: .25, roughness: .6 });
    matsPeana.push(mat);
    const disco = new THREE.Mesh(geoPeana, mat);
    disco.position.set(x, .15, PZ); disco.receiveShadow = true;
    const anillo = new THREE.Mesh(geoAnilloPeana,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.set(x, .03, PZ);
    escena.add(disco, anillo);
    anillosPeana.push(anillo);
    if (texto){
      const c = crearCartel(texto, '#' + new THREE.Color(color).getHexString());
      c.position.set(x, 3.3, PZ);
      escena.add(c);
    }
    return mat;
  }
  crearPeana(-PX, '#ffb454', null);          // CLASE: lleva el cartel vivo del molde
  crearPeana(0, '#7cc35f', 'OBJETO · instancia');
  crearPeana(PX, '#7fe0ff', 'ATRIBUTO · dato');

  // CLASE: molde fantasma (alambre) + escáner holográfico
  const molde = new THREE.Group();
  {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffb454', wireframe: true, transparent: true, opacity: .75 });
    const cu = new THREE.Mesh(GEO_CUERPO, mat);
    cu.position.y = .8;
    const ca = new THREE.Mesh(GEO_CABEZA, mat);
    ca.position.y = 1.6;
    molde.add(cu, ca);
    molde.scale.setScalar(1.3);
    molde.position.set(-PX, .3, PZ);
    escena.add(molde);
  }
  const escaner = new THREE.Mesh(new THREE.RingGeometry(.77, .83, 16),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  escaner.rotation.x = -Math.PI / 2;
  escaner.position.set(-PX, .4, PZ);
  escena.add(escaner);
  const cartelMolde = crearCartelVivo();
  cartelMolde.sprite.position.set(-PX, 3.3, PZ);
  escena.add(cartelMolde.sprite);
  pintarCartelVivo(cartelMolde, TEXTO_MOLDE[0]);

  // OBJETO: ciudadano sólido de muestra
  const muestra = new THREE.Group();
  {
    const cu = new THREE.Mesh(GEO_CUERPO, new THREE.MeshStandardMaterial({ color: '#7cc35f', roughness: .6 }));
    cu.position.y = .8; cu.castShadow = true;
    const ca = new THREE.Mesh(GEO_CABEZA, new THREE.MeshStandardMaterial({ color: '#e8d2b8', roughness: .6 }));
    ca.position.y = 1.6;
    muestra.add(cu, ca);
    muestra.scale.setScalar(1.3);
    muestra.position.set(0, .3, PZ);
    escena.add(muestra);
  }

  // ATRIBUTO: dato flotante con satélites
  const dato = new THREE.Mesh(new THREE.BoxGeometry(.7, .7, .7),
    new THREE.MeshStandardMaterial({ color: '#7fe0ff', emissive: '#2b7f8f', emissiveIntensity: .9 }));
  dato.position.set(PX, 1.4, PZ);
  escena.add(dato);
  const satelites = [];
  {
    const geoSat = new THREE.BoxGeometry(.16, .16, .16);
    const matSat = new THREE.MeshBasicMaterial({ color: '#bff3ff' });
    for (let i = 0; i < 3; i++){
      const s = new THREE.Mesh(geoSat, matSat);
      escena.add(s);
      satelites.push(s);
    }
  }

  /* ══════════ SR4: glitch de Eclipse ══════════ */
  const glitch = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 0),
    new THREE.MeshBasicMaterial({ color: '#ff5d5d', wireframe: true }));
  glitch.position.set(0, 4.2, 0);
  const cartelGlitch = crearCartel('GLITCH · Eclipse', '#ff5d5d');
  cartelGlitch.position.set(0, 5.2, 0);
  glitch.visible = false; cartelGlitch.visible = false;
  escena.add(glitch, cartelGlitch);
  const fragmentosGlitch = [];
  {
    const geoFrag = new THREE.BoxGeometry(.18, .18, .18);
    const matFrag = new THREE.MeshBasicMaterial({ color: '#ff5d5d' });
    for (let i = 0; i < 4; i++){
      const f = new THREE.Mesh(geoFrag, matFrag);
      f.visible = false;
      escena.add(f);
      fragmentosGlitch.push(f);
    }
  }

  /* ── tablero del sub-reto activo (detrás de las peanas) ── */
  const tablero = crearTablero();
  tablero.sprite.position.set(0, 5.6, -14);
  escena.add(tablero.sprite);
  pintarTablero(tablero, null, -1, SUBRETOS_NIVEL3.length);

  /* ── registro de Gustaff (el jugador lo recoge a pie) ── */
  const registro = new THREE.Mesh(new THREE.OctahedronGeometry(.42),
    new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9c3f', emissiveIntensity: 1.2, flatShading: true }));
  registro.visible = false;
  escena.add(registro);
  const hazRegistro = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 10, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }));
  hazRegistro.visible = false;
  escena.add(hazRegistro);

  /* ── estado ── */
  const st = {
    indice: -1,
    ciudadanos: [],            // objetos del intérprete
    visuales: [],              // {grupo, et, destino, obj, fase, escudo, parcela, casa}
    medidores: { comida: 0, sistemas: 0, salud: 0, comercio: 0 },
    glitchRebotado: false,
    flash: 0,                  // destello rojo del escudo al rebotar el glitch
    flashFuente: 0,            // destello de la fuente al llegar un paquete
    completa: false,           // los 4 medidores llenos (celebración de la fuente)
    ultimoMostrado: undefined,
    intentos: {},              // subretoId → nº intentos
    puntos: 0, bonusIntentos: 0,
    inicioNivel: Date.now(), gestor: null,
  };

  /* ── casas: una por ciudadano, en la parcela libre más cercana a su edificio ── */
  function ocuparParcela(vis, color, cx, cz){
    let mejor = null, dMejor = Infinity;
    for (const p of parcelas){
      if (p.ocupada) continue;
      const d = Math.hypot(p.x - cx, p.z - cz);
      if (d < dMejor){ dMejor = d; mejor = p; }
    }
    if (!mejor) return;                         // no quedan parcelas: el ciudadano vive sin casa
    mejor.ocupada = true;
    mejor.marca.visible = false;
    mejor.col = { minX: mejor.x - 1.4, maxX: mejor.x + 1.4, minZ: mejor.z - 1.4, maxZ: mejor.z + 1.4 };
    colisionadores.push(mejor.col);

    const casa = new THREE.Group();
    vis.matCasa = new THREE.MeshStandardMaterial({
      color, roughness: .8, emissive: color, emissiveIntensity: .12 });
    const cuerpo = new THREE.Mesh(GEO_CASA, vis.matCasa);
    cuerpo.position.y = 1; cuerpo.castShadow = cuerpo.receiveShadow = true;
    const tejado = new THREE.Mesh(GEO_TEJADO, MAT_TEJADO_CASA);
    tejado.position.y = 2.6; tejado.rotation.y = Math.PI / 4;
    // puerta mirando a la plaza
    const lon = Math.hypot(mejor.x, mejor.z) || 1;
    const dx = -mejor.x / lon, dz = -mejor.z / lon;
    const puerta = new THREE.Mesh(GEO_PUERTA, MAT_PUERTA);
    puerta.position.set(dx * 1.32, .6, dz * 1.32);
    puerta.rotation.y = Math.atan2(dx, dz);
    casa.add(cuerpo, tejado, puerta);
    casa.position.set(mejor.x, 0, mejor.z);
    casa.scale.y = .01;                         // se levanta con una animación
    dinamicos.add(casa);

    onda(mejor.x, mejor.z, color, { vel: 5, dur: .9 });
    for (let i = 0; i < 3; i++)
      bocanada(mejor.x + (i - 1) * .8, 2, mejor.z, color, { retraso: .2 + i * .1 });

    vis.parcela = mejor; vis.casa = casa; vis.casaT = 0;
  }

  function liberarCasa(v){
    const p = v.parcela;
    if (!p) return;
    if (v.casa) dinamicos.remove(v.casa);
    v.matCasa?.dispose();                       // las geometrías y el tejado/puerta son compartidos
    const i = colisionadores.indexOf(p.col);
    if (i >= 0) colisionadores.splice(i, 1);
    p.col = null; p.ocupada = false; p.marca.visible = true;
    v.parcela = null; v.casa = null;
  }

  function liberarCiudadanos(){
    for (const v of st.visuales){
      liberarCasa(v);
      v.et.tex.dispose();
      v.et.sprite.material.dispose();
      v.grupo.traverse(c => {
        if (c.isSprite) return; // la geometría del sprite es compartida
        if (c.geometry?.dispose && !c.geometry.userData?.compartida) c.geometry.dispose();
        if (c.material?.dispose) c.material.dispose();
      });
      dinamicos.remove(v.grupo);
    }
    st.visuales = []; st.ciudadanos = [];
  }

  function limpiarCiudadanos(){
    st.medidores = { comida: 0, sistemas: 0, salud: 0, comercio: 0 };
    st.glitchRebotado = false;
    st.flash = 0;
    st.ultimoMostrado = undefined;
  }

  function cargarSubreto(i){
    const sub = SUBRETOS_NIVEL3[i];
    st.indice = i;
    liberarCiudadanos();
    limpiarCiudadanos();
    // registro de Gustaff en el sub-reto marcado
    const g = sub.registroG;
    registro.visible = !!g && !progreso.tieneRegistro('nivel-3');
    hazRegistro.visible = registro.visible;
    if (g){
      registro.position.set(g.x, 1, g.z);
      hazRegistro.position.set(g.x, 5, g.z);
    }
    // reflejo visual del sub-reto
    pintarTablero(tablero, sub, i, SUBRETOS_NIVEL3.length);
    pintarCartelVivo(cartelMolde, TEXTO_MOLDE[i] ?? TEXTO_MOLDE[0]);
    glitch.visible = cartelGlitch.visible = i === 3;
    for (const f of fragmentosGlitch) f.visible = i === 3;
    emitirMedidores();
    return sub;
  }

  function emitirMedidores(){
    bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'medidores', args: [], resultado: { ...st.medidores } });
  }

  /* ── personajes ── */
  function aparecerCiudadano(obj){
    const nombre = obj.campos.get('nombre');
    const profesion = obj.campos.get('profesion');
    const color = COLORES_PROFESION[String(profesion).toLowerCase()] ?? '#c9b8a8';
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Mesh(GEO_CUERPO, new THREE.MeshStandardMaterial({ color, roughness: .6 }));
    cuerpo.position.y = .8; cuerpo.castShadow = true;
    const cabeza = new THREE.Mesh(GEO_CABEZA, new THREE.MeshStandardMaterial({ color: '#e8d2b8', roughness: .6 }));
    cabeza.position.y = 1.6;
    grupo.add(cuerpo, cabeza);
    accesorioCiudadano(profesion, grupo);
    const halo = new THREE.Mesh(GEO_HALO,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = .05;
    grupo.add(halo);
    // SR4: escudo del encapsulamiento
    let escudo = null;
    if (st.indice === 3){
      escudo = new THREE.Mesh(GEO_ESCUDO,
        new THREE.MeshBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: .22, depthWrite: false }));
      escudo.position.y = 1;
      grupo.add(escudo);
    }
    const et = crearEtiqueta();
    grupo.add(et.sprite);
    grupo.position.set((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16);
    pintarEtiqueta(et, { nombre, profesion, energia: obj.campos.get('energia') });
    dinamicos.add(grupo);
    onda(grupo.position.x, grupo.position.z, color, { vel: 3, dur: .7 });
    const vis = { grupo, et, obj, escudo, destino: new THREE.Vector3(), fase: Math.random() * 6, reloj: 0,
                  parcela: null, casa: null, casaT: 1, matCasa: null };
    // su casa se levanta en la parcela libre más cercana a su edificio de trabajo
    const prof = String(profesion ?? '').toLowerCase();
    const edificio = edificios.find(e => prof.includes(e.profesion.slice(0, 5))) ?? null;
    ocuparParcela(vis, color, edificio ? edificio.pos[0] : 0, edificio ? edificio.pos[1] : 0);
    elegirDestino(vis);
    st.visuales.push(vis);
  }

  function elegirDestino(vis){
    // a veces va a su casa (frente a la puerta, lado de la plaza)
    if (vis.parcela && Math.random() < .35){
      const p = vis.parcela, lon = Math.hypot(p.x, p.z) || 1;
      vis.destino.set(p.x * (1 - 2.6 / lon), 0, p.z * (1 - 2.6 / lon));
      return;
    }
    const prof = String(vis.obj.campos.get('profesion') ?? '').toLowerCase();
    const edificio = edificios.find(e => prof.includes(e.profesion.slice(0, 5))) ?? null;
    // va al frente de su edificio (lado de la plaza), no detrás
    if (edificio) vis.destino.set(edificio.pos[0] * .62 + (Math.random() - 0.5) * 2, 0, edificio.pos[1] * .62 + (Math.random() - 0.5) * 2);
    else vis.destino.set((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14);
  }

  /* ── API del mundo ── */
  function crearAPI(){
    const api = new RegistroAPI();
    api.registrar('aportar', (profesion, cantidad) => {
      const medidor = MEDIDOR_DE[String(profesion).toLowerCase()];
      if (!medidor) throw new ErrorMotor('RUNTIME', `La profesión «${profesion}» no aporta a ningún medidor.`, 0);
      if (typeof cantidad !== 'number') throw new ErrorMotor('TYPE_ERROR', 'aportar necesita una cantidad numérica.', 0);
      st.medidores[medidor] += cantidad;
      // el recurso viaja del edificio a la fuente y aparece un «+N» flotante
      const ed = edificios.find(e => e.medidor === medidor);
      if (ed){
        const hex = '#' + ed.color.toString(16).padStart(6, '0');
        paquete(ed.pos[0], ed.pos[1], ed.color, ed.alto + .8);
        textoFlotante('+' + cantidad, hex, ed.pos[0], ed.alto + 1.2, ed.pos[1]);
      }
      emitirMedidores();
      return st.medidores[medidor];
    }, 'Aporta al medidor de la profesión');
    api.registrar('anunciar', texto => {
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'anunciar', args: [texto], resultado: texto });
      return texto;
    }, 'Burbuja de diálogo');
    api.registrar('registrarCiudadano', obj => {
      if (!obj || typeof obj !== 'object' || obj.__clase?.nombre !== 'Ciudadano')
        throw new ErrorMotor('TYPE_ERROR', 'registrarCiudadano solo acepta instancias de Ciudadano.', 0);
      st.ciudadanos.push(obj);
      aparecerCiudadano(obj);
      return st.ciudadanos.length;
    }, 'Da de alta un ciudadano en la ciudad');
    api.registrar('estadoCiudad', () => ({ ...st.medidores }), 'Medidores de la ciudad');
    api.registrar('mostrar', v => {
      st.ultimoMostrado = v;
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'mostrar', args: [v], resultado: v });
      return v;
    }, 'Muestra un valor');
    return api;
  }

  /* ── verificación ── */
  function claseEn(ast, nombre){
    return ast.cuerpo.find(d => d.tipo === 'DeclClase' && d.nombre === nombre) ?? null;
  }

  function verificar(sub, { ast, codigo } = {}){
    const v = sub.verificar;
    switch (v.tipo){
      case 'clasificacion': return true; // lo resuelve la UI
      case 'claseDefinida': {
        const c = claseEn(ast, v.clase);
        if (!c) return false;
        const campos = c.campos.map(x => x.nombre);
        const metodos = c.metodos.map(m => m.nombre);
        return v.atributos.every(a => campos.includes(a)) && v.metodos.every(m => metodos.includes(m));
      }
      case 'conConstructor': {
        const c = claseEn(ast, v.clase);
        if (!c?.constructorDef) return false;
        return st.ciudadanos.some(o => o.campos.get('nombre') !== null && o.campos.get('nombre') !== undefined);
      }
      case 'encapsulado': {
        const c = claseEn(ast, v.clase);
        if (!c) return false;
        const privado = c.campos.some(x => x.nombre === 'energia' && x.privado);
        return privado && st.glitchRebotado && st.ultimoMostrado === v.mostrado;
      }
      case 'ciudadFuncionando': {
        const profes = new Set(st.ciudadanos.map(o => String(o.campos.get('profesion') ?? '').toLowerCase()));
        const necesarias = ['agricultor', 'ingeniero', 'medic', 'comerciante'];
        const estan = necesarias.every(n => [...profes].some(p => p.includes(n.slice(0, 5))));
        const m = st.medidores;
        return estan && m.comida >= UMBRAL && m.sistemas >= UMBRAL && m.salud >= UMBRAL && m.comercio >= UMBRAL;
      }
      default: return false;
    }
  }

  /* ── ejecución ── */
  async function ejecutar(ast, { animado = true } = {}){
    const sub = SUBRETOS_NIVEL3[st.indice];

    // cada ejecución parte de una ciudad limpia: sin ciudadanos duplicados
    // ni medidores acumulados de ejecuciones anteriores.
    // (liberarCiudadanos también derriba las casas y vacía las parcelas.)
    // glitchRebotado se conserva a propósito (subreto 4: primero rebota, luego se corrige).
    liberarCiudadanos();
    st.medidores = { comida: 0, sistemas: 0, salud: 0, comercio: 0 };
    st.ultimoMostrado = undefined;
    emitirMedidores();

    st.intentos[sub.id] = (st.intentos[sub.id] ?? 0) + 1;
    telemetriaIntento(sub.id, st.intentos[sub.id]);
    const motor = new MotorEjecucion(bus);
    const limites = { maxPasos: sub.maxPasos || 900, maxProfundidad: 16, tiempoMaxMs: 6000 };
    let res;
    try {
      res = await motor.ejecutar(ast, crearAPI(), limites, { animado, delayMundo: 220, delayPaso: 30 });
    } catch (e){
      res = { ok: false, error: e };
    }
    // ¿el glitch de Eclipse rebotó contra un private?
    if (!res.ok && res.error?.categoria === 'TYPE_ERROR' && /privado/.test(res.error.message)){
      st.glitchRebotado = true;
      st.flash = 1; // el escudo destella en rojo
      onda(0, 0, '#ff5d5d', { vel: 10, dur: 1.2 });
      for (const v of st.visuales) onda(v.grupo.position.x, v.grupo.position.z, '#ff5d5d', { vel: 4, dur: .8 });
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'glitchRebotado', args: [], resultado: true });
    }
    if (!res.ok) return { ok: false, error: res.error };
    if (!verificar(sub, { ast })){
      return { ok: true, superado: false, mensaje: 'El programa funcionó, pero el objetivo aún no está cumplido.' };
    }
    // ¡superado!
    st.puntos += 12;
    if (st.intentos[sub.id] === 1) st.bonusIntentos += 3;
    if (st.indice < SUBRETOS_NIVEL3.length - 1) st.gestor?.completarObjetivo(`obj-3-${st.indice + 1}`);
    return { ok: true, superado: true };
  }

  function telemetriaIntento(subretoId, intento){
    import('../sistema/telemetria.js').then(({ telemetria }) =>
      telemetria.registrar('intento_subreto', { nivel: 'nivel-3', subreto: subretoId, intento }));
  }

  function completarClasificacion(aciertos, total){
    if (aciertos < total) return { ok: false };
    const sub = SUBRETOS_NIVEL3[st.indice];
    st.intentos[sub.id] = (st.intentos[sub.id] ?? 0) + 1;
    telemetriaIntento(sub.id, st.intentos[sub.id]);
    st.puntos += 12;
    if (st.intentos[sub.id] === 1) st.bonusIntentos += 3;
    if (st.indice < SUBRETOS_NIVEL3.length - 1) st.gestor?.completarObjetivo(`obj-3-${st.indice + 1}`);
    return { ok: true, superado: true };
  }

  function completarNivel(){
    st.gestor?.completarObjetivo('obj-3-5', {
      metricas: {
        subretosPuntos: st.puntos,
        primerIntento: Math.floor(st.bonusIntentos / 3),
        segundos: Math.round((Date.now() - st.inicioNivel) / 1000),
      },
    });
  }

  const mundo = {
    colisionadores,
    zonasDano: [],
    terminal,
    alturaEn,                    // main.js: jugador.setColisionadores(..., mundo.alturaEn)
    liberar: liberarCiudadanos,
    reto: {
      subretos: SUBRETOS_NIVEL3,
      indice: () => st.indice,
      actual: () => SUBRETOS_NIVEL3[st.indice],
      cargarSubreto,
      ejecutar,
      completarClasificacion,
      completarNivel,
      setGestor: g => { st.gestor = g; },
      medidores: () => ({ ...st.medidores }),
      glitchRebotado: () => st.glitchRebotado,
    },
    update(t, dt, posJugador){
      // fondo: cielo, nubes y faroles (se tiñe de rojo con el glitch del SR4)
      if (fondo){
        try { fondo.update(t, dt, glitch.visible); }
        catch (e){ console.warn('[ciudadania] fondo desactivado por error:', e); fondo = null; }
      }

      // terminal: proximidad y parpadeo
      if (posJugador){
        terminal.cerca = Math.hypot(posJugador.x - grupoTerminal.position.x,
                                    posJugador.z - grupoTerminal.position.z) < 2.5;
      }
      luzTerminal.intensity = 3 + Math.sin(t * 4) * 1.2;
      anilloTerminal.position.y = 2.1 + Math.sin(t * 2) * .08;
      aroProximidad.material.opacity = terminal.cerca ? .6 + Math.sin(t * 8) * .25 : .2 + Math.sin(t * 2) * .05;

      // torre de datos y parcelas vacías
      if (faroTorre) faroTorre.scale.setScalar(8 * (1 + Math.sin(t * 1.8) * .12));
      MAT_PARCELA.opacity = .55 + Math.sin(t * 2) * .15;

      // efectos temporales
      for (let i = efectos.length - 1; i >= 0; i--){
        if (!efectos[i].update(dt)){
          efectos[i].dispose();
          efectos.splice(i, 1);
        }
      }

      // luciérnagas
      const arrL = geoL.attributes.position.array;
      for (let i = 0; i < NL; i++){
        arrL[i * 3] += Math.sin(t * .8 + i) * dt * .4;
        arrL[i * 3 + 1] += velL[i] * dt;
        arrL[i * 3 + 2] += Math.cos(t * .7 + i) * dt * .4;
        if (arrL[i * 3 + 1] > 8) arrL[i * 3 + 1] = 0;
      }
      geoL.attributes.position.needsUpdate = true;

      // hojas de otoño
      const arrH = geoH.attributes.position.array;
      for (let i = 0; i < NH; i++){
        arrH[i * 3 + 1] -= velH[i] * dt;
        arrH[i * 3] += Math.sin(t * 1.2 + faseH[i]) * dt * .8;
        arrH[i * 3 + 2] += Math.cos(t * .9 + faseH[i]) * dt * .5;
        if (arrH[i * 3 + 1] < 0) arrH[i * 3 + 1] = 12;
      }
      geoH.attributes.position.needsUpdate = true;

      // farolas
      for (const f of orbesFarola) f.orbe.scale.setScalar(1.6 * (1 + Math.sin(t * 3 + f.fase) * .08));

      // SR1: las peanas pulsan fuerte mientras toca clasificar
      const pulso = st.indice === 0 ? .9 + Math.sin(t * 3) * .4 : .25;
      for (const m of matsPeana) m.emissiveIntensity = pulso;
      for (const a of anillosPeana) a.material.opacity = st.indice === 0 ? .5 + Math.sin(t * 3) * .3 : .35;
      molde.rotation.y += dt * .6;
      muestra.rotation.y -= dt * .4;
      dato.rotation.y += dt; dato.position.y = 1.4 + Math.sin(t * 2) * .15;
      // escáner holográfico sobre el molde
      const fe = (t * .5) % 1;
      escaner.position.y = .4 + fe * 2.2;
      escaner.material.opacity = .8 * (1 - fe);
      // satélites del atributo
      satelites.forEach((s, i) => {
        const a = t * 1.6 + (i / 3) * Math.PI * 2;
        s.position.set(PX + Math.cos(a) * 1.1, dato.position.y + Math.sin(a * 2) * .2, PZ + Math.sin(a) * 1.1);
        s.rotation.y += dt * 3;
      });

      // SR4: glitch jitter, fragmentos y destello del escudo
      if (glitch.visible){
        glitch.rotation.x += dt * 3; glitch.rotation.y += dt * 4;
        glitch.position.x = (Math.random() - .5) * .08;
        glitch.scale.setScalar(1 + st.flash * .8 + Math.sin(t * 9) * .1);
        cartelGlitch.position.y = 5.2 + Math.sin(t * 2) * .1;
        fragmentosGlitch.forEach((f, i) => {
          const a = t * 2.2 + (i / 4) * Math.PI * 2;
          f.position.set(Math.cos(a) * 1.3, 4.2 + Math.sin(a * 1.5) * .4, Math.sin(a) * 1.3);
          f.rotation.x += dt * 4; f.rotation.y += dt * 5;
          f.visible = Math.random() > .05; // parpadeo de glitch
        });
      }
      if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * .8);

      // tablero flotando
      tablero.sprite.position.y = 5.6 + Math.sin(t * 1.5) * .08;

      // barras de medidor: suben hasta llenarse; el edificio se ilumina y celebra
      let suma = 0;
      let todosLlenos = true;
      for (const e of edificios){
        const meta = Math.min(1, st.medidores[e.medidor] / UMBRAL);
        e.nivel += (meta - e.nivel) * Math.min(1, dt * 5);
        e.barra.scale.y = Math.max(.02, e.nivel * 3);
        e.malla.material.emissiveIntensity = e.nivel * .7;
        e.matVent.color.setScalar(.35 + e.nivel * .65);   // las ventanas se encienden al llenarse
        suma += e.nivel;

        const lleno = st.medidores[e.medidor] >= UMBRAL;
        if (lleno && !e.prevLleno){
          onda(e.pos[0], e.pos[1], e.color, { vel: 7, dur: 1.1 });
          onda(e.pos[0], e.pos[1], e.color, { vel: 7, dur: 1.1, retraso: .3 });
          for (let i = 0; i < 3; i++)
            bocanada(e.pos[0] + (i - 1) * .9, e.alto + .4, e.pos[1], e.color, { retraso: i * .12 });
        }
        e.prevLleno = lleno;
        e.beacon.material.color.set(lleno ? e.color : '#4a3a2a');
        e.beacon.scale.setScalar(lleno ? 2.2 * (1 + Math.sin(t * 5) * .15) : 1.2);
        if (!lleno) todosLlenos = false;
      }

      // la fuente brilla cuando la ciudad respira; celebra con los 4 medidores llenos
      st.flashFuente = Math.max(0, st.flashFuente - dt * 2.5);
      agua.material.emissiveIntensity = .6 + (suma / 4) * 1.4 + st.flashFuente * 1.2;
      luzFuente.intensity = 2.5 + suma * 3 + st.flashFuente * 6;
      if (todosLlenos && !st.completa){
        for (let i = 0; i < 4; i++) onda(0, 0, '#ffd27a', { vel: 12, dur: 1.8, retraso: i * .35 });
      }
      st.completa = todosLlenos;
      // chorros: suben más alto cuanto más llena está la ciudad
      const arrJ = geoJ.attributes.position.array;
      for (let i = 0; i < NJ; i++){
        jEdad[i] += dt;
        const e = jEdad[i];
        const y = .55 + jVy[i] * e - 4.2 * e * e;
        if (y < .5){ reiniciarGota(i, suma); continue; }
        arrJ[i * 3] = Math.cos(jAng[i]) * jVr[i] * e;
        arrJ[i * 3 + 1] = y;
        arrJ[i * 3 + 2] = Math.sin(jAng[i]) * jVr[i] * e;
      }
      geoJ.attributes.position.needsUpdate = true;

      // ciudadanos paseando / yendo a su edificio o a su casa
      for (const v of st.visuales){
        _dir.subVectors(v.destino, v.grupo.position);
        _dir.y = 0;
        if (_dir.length() < .4){
          v.reloj += dt;
          if (v.reloj > 3){ v.reloj = 0; elegirDestino(v); }
        } else {
          _dir.normalize();
          v.grupo.position.addScaledVector(_dir, dt * 1.4);
          v.grupo.rotation.y = Math.atan2(_dir.x, _dir.z);
        }
        v.grupo.position.y = Math.abs(Math.sin(t * 6 + v.fase)) * .06;
        // la casa se levanta con un easing suave
        if (v.casa && v.casaT < 1){
          v.casaT = Math.min(1, v.casaT + dt * 1.5);
          v.casa.scale.y = Math.max(.01, 1 - Math.pow(1 - v.casaT, 3));
        }
        if (v.escudo){
          v.escudo.material.color.set(st.flash > 0 ? '#ff5d5d' : '#7fe0ff');
          v.escudo.material.opacity = .22 + st.flash * .4;
        }
        // refrescar etiqueta (no-op si no cambiaron los atributos)
        pintarEtiqueta(v.et, {
          nombre: v.obj.campos.get('nombre'),
          profesion: v.obj.campos.get('profesion'),
          energia: v.obj.campos.get('energia'),
        });
      }

      // registro de Gustaff: lo recoge el jugador a pie
      if (registro.visible && posJugador){
        registro.rotation.y += dt;
        registro.position.y = 1 + Math.sin(t * 2.5) * .15;
        hazRegistro.material.opacity = .12 + Math.sin(t * 2) * .04;
        const d = Math.hypot(posJugador.x - registro.position.x, posJugador.z - registro.position.z);
        if (d < 1.6){
          registro.visible = false;
          hazRegistro.visible = false;
          progreso.marcarRegistro('nivel-3');
          import('../sistema/dialogos.js').then(({ dialogos }) => dialogos.abrirPorId('gustaff-3'));
        }
      }
    },
  };
  return mundo;
}