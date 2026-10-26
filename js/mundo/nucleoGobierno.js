// ═══════════════════════════════════════════════════════════
// mundo/nucleoGobierno.js — Nivel 5: núcleo cibernético,
// catástrofe simulada, Eclipse y la restauración final.
// Incluye una terminal física: acércate y pulsa E para abrir el editor.
// El nivel termina al hablar con el holograma de Gustaff tras vencer a Eclipse.
//
// PRESUPUESTO: la escena debe quedar bajo 3000 tris (panel F2).
// Trucos usados: sprites con brillo en vez de esferas, texturas de canvas
// (suelo de circuitos, horizonte, ventanas, LEDs), aros planos, geometrías
// compartidas y Points (0 tris) para estrellas y partículas de datos.
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bus, EVENTOS } from '../sistema/eventos.js';
import { ErrorMotor } from '../motor/errores.js';
import { RegistroAPI } from '../motor/apiMundo.js';
import { MotorEjecucion } from '../motor/motorEjecucion.js';
import { SUBRETOS_NIVEL5, COMPONENTES } from '../../datos/subretos-nivel5.js';
import { progreso } from '../sistema/progreso.js';

/* Objetivo de niveles.js que cierra cada sub-reto (el jefe cierra obj-5-2 en completarNivel). */
const OBJETIVO_DE_SUBRETO = ['obj-5-1', 'obj-5-1b', 'obj-5-4', 'obj-5-3'];

/* Clase → evento que resuelve (para que el avatar camine a su estación). */
const EVENTO_DE_CLASE = {
  MedicoUrbano: 'heridos',
  BomberoMetropolitano: 'incendio',
  ComercianteNocturno: 'desabasto',
  GlitchDeEclipse: 'glitch',
};

/* Color de cada clase de avatar. */
const COLOR_CLASE = {
  MedicoUrbano: '#ff5d7a',
  BomberoMetropolitano: '#ff8a3c',
  ComercianteNocturno: '#ffd27a',
  ComunicadorNodo: '#7ab8ff',
  GlitchDeEclipse: '#ff3b3b',
};

/* Estaciones de emergencia visibles en el mundo: pos = [x, z]. Bien separadas de la torre. */
const ESTACIONES = {
  incendio:  { cartel: 'INCENDIO',  color: '#ff8a3c', pos: [-14, -6] },
  heridos:   { cartel: 'HERIDOS',   color: '#ff5d7a', pos: [14, -6] },
  desabasto: { cartel: 'DESABASTO', color: '#ffd27a', pos: [-14, 8] },
  glitch:    { cartel: 'GLITCH',    color: '#c25dff', pos: [14, 8] },
};

const TORRE = { x: 0, z: -18 };
const TORRE_ALTO = 12;
const EY = 14.4;          // altura de Eclipse sobre la torre
const VERDE = '#58f0a0';

function serAST(n){
  if (!n) return '';
  if (Array.isArray(n)) return n.map(serAST).join(',');
  if (typeof n !== 'object') return String(n);
  return n.tipo + '{' + Object.keys(n)
    .filter(k => !['id', 'linea', 'bloqueId'].includes(k))
    .map(k => k + ':' + serAST(n[k])).join(',') + '}';
}
function funcionCoordinar(ast){
  return ast.cuerpo.find(d => d.tipo === 'DeclFuncion' && d.nombre === 'coordinar') ?? null;
}
function nombreLlamada(c){ return c?.tipo === 'Acceso' ? c.prop : (c?.tipo === 'Ident' ? c.nombre : null); }
function tieneIndice(c){ return c?.tipo === 'Acceso' ? tieneIndice(c.obj) : c?.tipo === 'Indice'; }
function esPolimorfico(fn){
  const buscar = s => {
    if (!s) return false;
    switch (s.tipo){
      case 'Bloque': return s.sentencias.some(buscar);
      case 'Para': return buscar(s.cuerpo);
      case 'Si': return buscar(s.ent) || buscar(s.sino);
      case 'Llamar': return nombreLlamada(s.callee) === 'responderEmergencia' && tieneIndice(s.callee);
      default: return false;
    }
  };
  return buscar(fn.cuerpo);
}
function implementaContrato(obj){
  let c = obj.__clase;
  while (c){ if (c.metodos.has('responderEmergencia')) return true; c = c._padreRef ?? null; }
  return false;
}

/* Libera geometrías/materiales/texturas de los hijos de un grupo Y los saca del grupo.
   Las geometrías marcadas userData.compartida se reutilizan: no se liberan. */
function vaciarGrupo(grupo){
  for (const hijo of [...grupo.children]){
    hijo.traverse(o => {
      if (!o.isSprite && o.geometry?.dispose && !o.geometry.userData?.compartida) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats){
        if (m.map?.dispose) m.map.dispose();
        m.dispose?.();
      }
    });
    grupo.remove(hijo);
  }
}

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

/* Suelo de placa de circuitos (se repite; 0 tris extra). */
function texCircuito(){
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#07161c'; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(43,143,153,.12)'; g.lineWidth = 1;
  for (let i = 0; i <= S; i += 64){
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  g.lineWidth = 3;
  for (let i = 0; i < 34; i++){
    let x = Math.floor(Math.random() * 16) * 32 + 16, y = Math.floor(Math.random() * 16) * 32 + 16;
    g.strokeStyle = `rgba(57,198,208,${.22 + Math.random() * .25})`;
    g.beginPath(); g.moveTo(x, y);
    const seg = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < seg; k++){
      const d = (Math.random() < .5 ? -1 : 1) * (1 + Math.floor(Math.random() * 4)) * 32;
      if (k % 2 === 0) x = Math.max(8, Math.min(S - 8, x + d)); else y = Math.max(8, Math.min(S - 8, y + d));
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = 'rgba(95,240,224,.75)'; g.fillRect(x - 4, y - 4, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  return t;
}

/* Horizonte: silueta de ciudad con ventanas, en un anillo lejano. */
function texHorizonte(){
  const W = 1024, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(57,198,208,0)'); gr.addColorStop(1, 'rgba(57,198,208,.45)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let x = 0;
  while (x < W){
    const w = 22 + Math.random() * 40, h = 40 + Math.random() * 120;
    g.fillStyle = '#04141c'; g.fillRect(x, H - h, w, h);
    g.fillStyle = 'rgba(95,240,224,.7)';
    for (let wy = H - h + 8; wy < H - 6; wy += 14)
      for (let wx = x + 5; wx < x + w - 6; wx += 10)
        if (Math.random() < .35) g.fillRect(wx, wy, 4, 6);
    x += w + 2;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}

/* Ventanas encendidas de las torres caídas (mapa de emisión). */
function texVentanasTorre(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12)
    for (let x = 6; x < 58; x += 12)
      if (Math.random() < .45){ g.fillStyle = '#ffffff'; g.fillRect(x, y, 6, 7); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Racks de servidor con LEDs. */
function texRack(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0a1c22'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12){
    g.fillStyle = '#123a42'; g.fillRect(4, y, 56, 8);
    for (let x = 8; x < 56; x += 8){
      g.fillStyle = Math.random() < .5 ? '#5ff0e0' : (Math.random() < .5 ? '#ffffff' : '#0a1c22');
      g.fillRect(x, y + 2, 4, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Glifo de código flotante (sprite = 2 tris). */
function crearGlifo(txt){
  const ancho = Math.max(192, txt.length * 17 + 30);
  const c = document.createElement('canvas'); c.width = ancho; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 26px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#bfeef2'; g.fillText(txt, ancho / 2, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, opacity: .6, depthWrite: false }));
  s.scale.set(ancho / 80, .8, 1);
  return s;
}

/* ══════════ sprites de texto ══════════ */

function crearEtiqueta(){
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(2.4, .9, 1);
  sprite.position.y = 2.1;
  return { canvas, tex, sprite };
}
function pintarEtiqueta(et, nombre, clase){
  const g = et.canvas.getContext('2d');
  g.clearRect(0, 0, 256, 96);
  g.fillStyle = 'rgba(6,16,20,.8)'; g.fillRect(6, 6, 244, 84);
  g.strokeStyle = 'rgba(95,240,224,.7)'; g.strokeRect(6, 6, 244, 84);
  g.fillStyle = '#bfeef2'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
  g.fillText(String(nombre), 128, 40);
  g.fillStyle = '#5ff0e0'; g.font = '16px monospace';
  g.fillText(String(clase), 128, 70);
  et.tex.needsUpdate = true;
}

/* Letrero fijo (terminal y estaciones). */
function crearCartel(texto, color = '#bfeef2'){
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(6,16,20,.85)'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(2, 2, 252, 60);
  g.fillStyle = color; g.font = 'bold 24px monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(3.2, .8, 1);
  return s;
}

export function crearNucleo(escena){
  const colisionadores = [];
  const dinamicos = new THREE.Group();
  escena.add(dinamicos);

  /* ── geometrías compartidas (baratas y reutilizadas) ── */
  const compartida = g => { g.userData.compartida = true; return g; };
  const GEO_ONDA = compartida(new THREE.RingGeometry(.94, 1, 24));
  const GEO_HALO = compartida(new THREE.RingGeometry(.45, .6, 12));
  const GEO_PAQUETE = compartida(new THREE.SphereGeometry(.28, 5, 3));
  const GEO_AVATAR = compartida(new THREE.CapsuleGeometry(.3, .7, 2, 6));

  /* ── iluminación propia del nivel 5 ──
     aplicarPaleta() recolorea estas luces y la niebla. */
  escena.background = new THREE.Color('#04141c');
  escena.fog = new THREE.Fog('#0d3a42', 40, 110);
  const luzHemi = new THREE.HemisphereLight('#3f8f99', '#07161c', 1.5);
  const luzSol = new THREE.DirectionalLight('#c8fff6', 2.2);
  luzSol.position.set(14, 26, 12);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(1024, 1024);
  Object.assign(luzSol.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 95 });
  escena.add(luzHemi, luzSol);

  /* Colores de partida y de destino para la transición a «ciudad restaurada». */
  const colIni = {
    fondo: new THREE.Color(escena.background), niebla: new THREE.Color(escena.fog.color),
    hemiCielo: new THREE.Color(luzHemi.color), hemiSuelo: new THREE.Color(luzHemi.groundColor),
    sol: new THREE.Color(luzSol.color), suelo: new THREE.Color('#ffffff'),
  };
  const colFin = {
    fondo: new THREE.Color('#1a1408'), niebla: new THREE.Color('#3a2e14'),
    hemiCielo: new THREE.Color('#c9a15a'), hemiSuelo: new THREE.Color('#1a1408'),
    sol: new THREE.Color('#fff1c8'), suelo: new THREE.Color('#ffd9a0'),
  };

  /* ── cielo: estrellas, planeta y horizonte (0 a 32 tris) ── */
  const matEstrellas = new THREE.PointsMaterial({
    color: '#cfffff', size: .9, transparent: true, opacity: .9, depthWrite: false, fog: false });
  {
    const NE = 240, posE = new Float32Array(NE * 3);
    for (let i = 0; i < NE; i++){
      const a = Math.random() * Math.PI * 2, b = .2 + Math.random() * 1.15, r = 56;
      posE[i * 3] = Math.cos(a) * Math.cos(b) * r;
      posE[i * 3 + 1] = Math.sin(b) * r;
      posE[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
    }
    const geoE = new THREE.BufferGeometry();
    geoE.setAttribute('position', new THREE.BufferAttribute(posE, 3));
    escena.add(new THREE.Points(geoE, matEstrellas));
  }
  const planeta = crearGlow('#39c6d0', 18);
  planeta.material.fog = false;
  planeta.position.set(-34, 30, -48);
  escena.add(planeta);
  const matHorizonte = new THREE.MeshBasicMaterial({
    map: texHorizonte(), transparent: true, side: THREE.BackSide, depthWrite: false, fog: false });
  const horizonte = new THREE.Mesh(new THREE.CylinderGeometry(62, 62, 30, 16, 1, true), matHorizonte);
  horizonte.position.y = 15;
  escena.add(horizonte);

  /* ── efectos temporales (ondas, paquetes de datos) ──
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

  function paquete(x, z, color){
    const m = new THREE.Mesh(GEO_PAQUETE, new THREE.MeshBasicMaterial({ color }));
    const a = new THREE.Vector3(x, 2.9, z), b = new THREE.Vector3(TORRE.x, TORRE_ALTO, TORRE.z);
    escena.add(m);
    let t = 0;
    efectos.push({
      update(dt){
        t += dt;
        const k = Math.min(1, t);
        m.position.lerpVectors(a, b, k);
        m.position.y += Math.sin(k * Math.PI) * 3;
        m.scale.setScalar(1 + Math.sin(k * Math.PI) * .6);
        if (k >= 1){
          st.flashTorre = 1;
          onda(TORRE.x, TORRE.z, color, { vel: 6, dur: 1.2 });
          return false;
        }
        return true;
      },
      dispose(){ escena.remove(m); m.material.dispose(); },
    });
  }

  /* ── núcleo frío/cibernético: suelo de circuitos y rejilla ── */
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ map: texCircuito(), roughness: .9 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true;
  escena.add(suelo);
  const rejilla = new THREE.GridHelper(100, 50, 0x2b8f99, 0x123a42);
  rejilla.position.y = .01;
  rejilla.material.transparent = true;
  rejilla.material.opacity = .45;
  escena.add(rejilla);

  // torre del núcleo
  const nucleoTorre = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, TORRE_ALTO, 10),
    new THREE.MeshStandardMaterial({ color: '#0f2e36', emissive: '#39c6d0', emissiveIntensity: .5, roughness: .4 }));
  nucleoTorre.position.set(TORRE.x, TORRE_ALTO / 2, TORRE.z);
  escena.add(nucleoTorre);
  colisionadores.push({ minX: TORRE.x - 3.8, maxX: TORRE.x + 3.8, minZ: TORRE.z - 3.8, maxZ: TORRE.z + 3.8 });

  // haz de luz de la torre hacia el cielo y plataforma de anillos en su base
  const matHaz = new THREE.MeshBasicMaterial({
    color: '#39c6d0', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false });
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(.5, .8, 40, 8, 1, true), matHaz);
  haz.position.set(TORRE.x, 20, TORRE.z);
  escena.add(haz);
  const plataforma = [];
  for (const [r0, r1] of [[5.4, 5.6], [8, 8.15]]){
    const a = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 28),
      new THREE.MeshBasicMaterial({ color: '#39c6d0', transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false }));
    a.rotation.x = -Math.PI / 2;
    a.position.set(TORRE.x, .05, TORRE.z);
    escena.add(a);
    plataforma.push(a);
  }

  // anillos orbitales de la torre (planos: pocos triángulos)
  const anillos = [];
  [[4, 4.2, .9, .35], [7.5, 3.8, -1.3, -.25], [11, 3.4, 1.7, .5]].forEach(([y, r, vel, incl]) => {
    const pivote = new THREE.Group();
    pivote.position.set(TORRE.x, y, TORRE.z);
    pivote.rotation.z = incl;
    const aro = new THREE.Mesh(new THREE.RingGeometry(r - .07, r + .07, 32),
      new THREE.MeshBasicMaterial({ color: '#39c6d0', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    aro.rotation.x = Math.PI / 2;
    pivote.add(aro);
    escena.add(pivote);
    anillos.push({ pivote, aro, vel });
  });

  // satélites de datos orbitando la torre (octaedro + brillo)
  const GEO_SAT = compartida(new THREE.OctahedronGeometry(.3));
  const matSat = new THREE.MeshBasicMaterial({ color: '#bfeef2' });
  const satelites = [];
  for (let i = 0; i < 3; i++){
    const g = new THREE.Group();
    g.add(new THREE.Mesh(GEO_SAT, matSat));
    const gl = crearGlow('#39c6d0', 1.4);
    g.add(gl);
    escena.add(g);
    satelites.push({ g, gl, R: 6.5 + i * 1.2, y: 6 + i * 3, vel: (.5 + i * .13) * (i % 2 ? -1 : 1), fase: i * 2.1 });
  }

  // Eclipse (octaedro rojo latente) + fragmentos orbitando
  const eclipse = new THREE.Mesh(new THREE.OctahedronGeometry(1.3),
    new THREE.MeshStandardMaterial({ color: '#3a0a10', emissive: '#ff3b3b', emissiveIntensity: 1.2, flatShading: true }));
  eclipse.position.set(TORRE.x, EY, TORRE.z);
  escena.add(eclipse);
  const luzEclipse = new THREE.PointLight('#ff3b3b', 18, 30, 2);
  luzEclipse.position.set(TORRE.x, EY, TORRE.z + 1);
  escena.add(luzEclipse);
  const fragmentos = new THREE.Group();
  fragmentos.position.set(TORRE.x, EY, TORRE.z);
  const geoFragmento = new THREE.OctahedronGeometry(.28);
  const matFragmento = new THREE.MeshStandardMaterial({ color: '#3a0a10', emissive: '#ff3b3b', emissiveIntensity: 1, flatShading: true });
  for (let i = 0; i < 6; i++){
    const f = new THREE.Mesh(geoFragmento, matFragmento);
    const ang = (i / 6) * Math.PI * 2;
    f.position.set(Math.cos(ang) * 2.6, Math.sin(ang * 2) * .5, Math.sin(ang) * 2.6);
    fragmentos.add(f);
  }
  escena.add(fragmentos);

  // ciudad caída: torres oscuras en un anillo amplio (con ventanas que se «encienden» al restaurar)
  const matCiudadCaida = new THREE.MeshStandardMaterial({
    color: '#0b2229', emissive: '#39c6d0', emissiveMap: texVentanasTorre(), emissiveIntensity: .8, roughness: .7 });
  const ciudadCaida = new THREE.Group();
  for (let i = 0; i < 16; i++){
    const ang = (i / 16) * Math.PI * 2 + .2;
    const h = 5 + ((i * 37) % 9);
    const w = 2.4 + (i % 3) * .6;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), matCiudadCaida);
    const x = Math.cos(ang) * 34, z = Math.sin(ang) * 34;
    b.position.set(x, h / 2, z);
    b.rotation.y = ang;
    ciudadCaida.add(b);
    colisionadores.push({ minX: x - w, maxX: x + w, minZ: z - w, maxZ: z + w });
  }
  escena.add(ciudadCaida);

  // racks de servidor a los lados del camino terminal → torre (box = 12 tris)
  const matRack = new THREE.MeshStandardMaterial({
    color: '#ffffff', map: texRack(), emissive: '#39c6d0', emissiveMap: texRack(), emissiveIntensity: .6, roughness: .6 });
  const geoRack = new THREE.BoxGeometry(1.6, 3.2, 1.2);
  for (const z of [4, -4, -12]){
    for (const x of [-6, 6]){
      const r = new THREE.Mesh(geoRack, matRack);
      r.position.set(x, 1.6, z);
      escena.add(r);
      colisionadores.push({ minX: x - .9, maxX: x + .9, minZ: z - .7, maxZ: z + .7 });
    }
  }

  // glifos de código que flotan (sprites: 2 tris cada uno)
  const glifos = [];
  for (const txt of ['interface IResponsable', 'implements', '@override', 'coordinar()', 'polimorfismo',
                     'responderEmergencia()', 'for (r of equipo)', 'contrato', 'Eclipse.glitch()', '{ }']){
    const s = crearGlifo(txt);
    s.position.set((Math.random() - .5) * 60, 2 + Math.random() * 12, (Math.random() - .5) * 60);
    escena.add(s);
    glifos.push({ s, vy: .15 + Math.random() * .25, fase: Math.random() * 6 });
  }

  // partículas de datos que suben
  const NP = 240;
  const posP = new Float32Array(NP * 3);
  const velP = new Float32Array(NP);
  for (let i = 0; i < NP; i++){
    posP[i * 3] = (Math.random() - .5) * 70;
    posP[i * 3 + 1] = Math.random() * 18;
    posP[i * 3 + 2] = (Math.random() - .5) * 70;
    velP[i] = .4 + Math.random() * .9;
  }
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute('position', new THREE.BufferAttribute(posP, 3));
  const matP = new THREE.PointsMaterial({ color: '#5ff0e0', size: .14, transparent: true, opacity: .75, depthWrite: false });
  const particulas = new THREE.Points(geoP, matP);
  escena.add(particulas);

  /* ── terminal del Núcleo de Gobierno ──
     main.js lee mundo.terminal.cerca: con él muestra el aviso
     «PRESIONA E PARA USAR LA TERMINAL» y E abre el editor de gobierno. */
  const terminal = { cerca: false };
  const grupoTerminal = new THREE.Group();
  const luzTerminal = new THREE.PointLight('#5ff0e0', 4, 8);
  const anilloTerminal = new THREE.Mesh(new THREE.RingGeometry(.75, .85, 16),
    new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  const aroProximidad = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.5, 24),
    new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false }));
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, .9),
      new THREE.MeshStandardMaterial({ color: '#0f2e36', roughness: .7 }));
    base.position.y = .5;
    const poste = new THREE.Mesh(new THREE.BoxGeometry(.12, .5, .12),
      new THREE.MeshStandardMaterial({ color: '#2b8f99' }));
    poste.position.y = 1.15;
    const pantalla = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, .08),
      new THREE.MeshBasicMaterial({ color: '#5ff0e0' }));
    pantalla.position.set(0, 1.45, 0);
    pantalla.rotation.x = -.25;
    luzTerminal.position.set(0, 1.6, 1);
    anilloTerminal.position.set(0, 2.2, 0);
    anilloTerminal.rotation.x = Math.PI / 2;
    aroProximidad.rotation.x = -Math.PI / 2;
    aroProximidad.position.y = .05;
    const cartelTerminal = crearCartel('NÚCLEO DE GOBIERNO', '#5ff0e0');
    cartelTerminal.position.set(0, 3, 0);
    grupoTerminal.add(base, poste, pantalla, luzTerminal, anilloTerminal, aroProximidad, cartelTerminal);
    base.castShadow = true;
    grupoTerminal.position.set(0, 0, 13);
    escena.add(grupoTerminal);
    colisionadores.push({ minX: -.7, maxX: .7, minZ: 12.55, maxZ: 13.45 });
  }

  /* ── estado ── (antes de las estaciones: los efectos lo consultan) */
  const st = {
    indice: -1, registrados: [], visuales: [], acciones: [],
    eventos: { incendio: true, heridos: true, desabasto: true, glitch: true }, // true = pendiente
    conGlitch: false,
    coordinadorBase: null, elegante: false,
    restaurado: false, dialogoFinalDado: false,
    ultimoMostrado: undefined, intentos: {},
    puntos: 0, bonusIntentos: 0, luzBase: 14,
    inicioNivel: Date.now(), gestor: null,
    flashTorre: 0, fEclipse: 1, transicion: 1, ultimaOnda: 0, tRestaurado: 0,
  };

  /* ── estaciones de emergencia ──
     Van en `escena` (no en `dinamicos`) porque vaciarGrupo(dinamicos) las borraría.
     La baliza pulsa mientras el evento está pendiente y se pone verde al resolverlo;
     un cable la conecta con la torre. */
  const estaciones = {};
  const geoPlaca = new THREE.CylinderGeometry(2.2, 2.4, .2, 10);
  const geoColumna = new THREE.CylinderGeometry(.18, .18, 2.4, 5, 1, true);
  const matColumna = new THREE.MeshStandardMaterial({ color: '#1b4a55' });
  const geoAro = new THREE.RingGeometry(.85, .95, 20);
  const geoHazEst = new THREE.CylinderGeometry(.35, .35, 12, 8, 1, true);
  for (const [ev, e] of Object.entries(ESTACIONES)){
    const g = new THREE.Group();
    const placa = new THREE.Mesh(geoPlaca,
      new THREE.MeshStandardMaterial({ color: '#0f2e36', emissive: e.color, emissiveIntensity: .25 }));
    placa.position.y = .1;
    const columna = new THREE.Mesh(geoColumna, matColumna);
    columna.position.y = 1.3;
    const baliza = crearGlow(e.color, 1.8);
    baliza.position.y = 2.9;
    // aro inclinado dentro de un pivote: girar el pivote sí se ve
    const pivote = new THREE.Group();
    pivote.position.y = 2.9;
    const aro = new THREE.Mesh(geoAro,
      new THREE.MeshBasicMaterial({ color: e.color, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    aro.rotation.x = Math.PI / 2.4;
    pivote.add(aro);
    const hazEst = new THREE.Mesh(geoHazEst,
      new THREE.MeshBasicMaterial({ color: e.color, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
    hazEst.position.y = 6;
    const cartel = crearCartel(e.cartel, e.color);
    cartel.position.y = 4.4;
    const cable = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, .08, 0),
        new THREE.Vector3(TORRE.x - e.pos[0], .08, TORRE.z - e.pos[1]),
      ]),
      new THREE.LineBasicMaterial({ color: e.color, transparent: true, opacity: .4 }));
    g.add(placa, columna, baliza, pivote, hazEst, cartel, cable);
    g.position.set(e.pos[0], 0, e.pos[1]);
    escena.add(g);
    estaciones[ev] = { g, baliza, aro, pivote, hazEst, cable, color: e.color, previoPendiente: true };
  }

  /* ── holograma de Gustaff (aparece en la restauración) ── */
  const holograma = new THREE.Group();
  const cuerpoH = new THREE.Mesh(new THREE.ConeGeometry(.9, 2.6, 8),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .28, depthWrite: false }));
  cuerpoH.position.y = 1.3;
  const cabezaH = new THREE.Mesh(new THREE.SphereGeometry(.42, 6, 4),
    new THREE.MeshBasicMaterial({ color: '#ffe6b0', transparent: true, opacity: .5, depthWrite: false }));
  cabezaH.position.y = 2.9;
  const columnaLuz = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 14, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .1, side: THREE.DoubleSide, depthWrite: false }));
  columnaLuz.position.y = 7;
  const aroH = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.4, 24),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  aroH.rotation.x = -Math.PI / 2;
  aroH.position.y = .1;
  const cartelH = crearCartel('GUSTAFF', '#ffd27a');
  cartelH.position.y = 4.4;
  holograma.add(cuerpoH, cabezaH, columnaLuz, aroH, cartelH);
  holograma.position.set(7, 0, -9);
  holograma.visible = false;
  escena.add(holograma);

  function resetEventos(conGlitch){
    st.conGlitch = conGlitch;
    st.eventos = { incendio: true, heridos: true, desabasto: true, glitch: conGlitch };
  }

  /* Deja el sub-reto como al empezar: sin avatares, sin acciones y con los eventos
     pendientes. NO toca la ciudad restaurada ni el estado de «restaurado». */
  function reiniciarSubreto(sub){
    vaciarGrupo(dinamicos);
    st.visuales = []; st.registrados = []; st.acciones = [];
    st.ultimoMostrado = undefined;
    resetEventos(sub.id === 'n5-jefe');
    eclipse.visible = !st.restaurado;
    st.luzBase = st.restaurado ? 0 : (sub.id === 'n5-jefe' ? 26 : 14);
    luzEclipse.intensity = st.luzBase;
  }

  function cargarSubreto(i){
    const sub = SUBRETOS_NIVEL5[i];
    st.indice = i;
    reiniciarSubreto(sub);
    return sub;
  }

  /* ── avatares: cada uno camina a la estación de SU evento ── */
  function aparecer(obj){
    const claseNombre = obj.__clase?.nombre ?? '?';
    const color = COLOR_CLASE[claseNombre] ?? '#5ff0e0';
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Mesh(GEO_AVATAR,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(.35),
        emissive: color,
        emissiveIntensity: .6, roughness: .4,
      }));
    cuerpo.position.y = .9;
    grupo.add(cuerpo);
    const halo = new THREE.Mesh(GEO_HALO,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = .05;
    grupo.add(halo);
    const et = crearEtiqueta();
    pintarEtiqueta(et, obj.campos.get('nombre') ?? '?', claseNombre);
    grupo.add(et.sprite);
    grupo.position.set((Math.random() - .5) * 4, 0, 10);
    dinamicos.add(grupo);
    onda(grupo.position.x, grupo.position.z, color, { vel: 3, dur: .7 });
    const ev = EVENTO_DE_CLASE[claseNombre];
    const est = ev ? ESTACIONES[ev] : null;
    const destino = est
      ? new THREE.Vector3(est.pos[0] + (Math.random() - .5), 0, est.pos[1] + 2.6)
      : new THREE.Vector3((Math.random() - .5) * 8, 0, 4);
    st.visuales.push({ grupo, fase: Math.random() * 6, destino, color, llego: false });
  }

  /* ── API ── */
  function crearAPI(){
    const api = new RegistroAPI();
    api.registrar('registrarResponsable', obj => {
      if (!obj || typeof obj !== 'object' || !obj.__clase)
        throw new ErrorMotor('TYPE_ERROR', 'registrarResponsable solo acepta objetos.', 0);
      if (!implementaContrato(obj))
        throw new ErrorMotor('RUNTIME', `«${obj.__clase.nombre}» no cumple el contrato IResponsable: le falta responderEmergencia().`, 0);
      st.registrados.push(obj);
      aparecer(obj);
      return st.registrados.length;
    }, 'Registra a un responsable');
    const resolver = (evento, nombre) => api.registrar(nombre, () => {
      st.eventos[evento] = false;
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'eventoResuelto', args: [evento], resultado: evento });
      return true;
    }, `Resuelve el evento «${evento}»`);
    resolver('incendio', 'apagarFuego');
    resolver('heridos', 'curar');
    resolver('desabasto', 'abastecer');
    resolver('glitch', 'neutralizarGlitch');
    api.registrar('informar', () => {
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'eventoResuelto', args: ['informe'], resultado: 'informe' });
      return true;
    }, 'Informa a la ciudadanía');
    api.registrar('registrarAccion', texto => {
      st.acciones.push(String(texto));
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'accion', args: [texto], resultado: texto });
      return texto;
    }, 'Anota quién respondió');
    api.registrar('estadoGobierno', () => ({
      eventos: Object.fromEntries(Object.entries(st.eventos).map(([k, v]) => [k, v ? 'PENDIENTE' : 'resuelto'])),
      equipo: st.registrados.map(o => o.__clase.nombre),
      acciones: [...st.acciones],
    }), 'Estado del gobierno');
    api.registrar('mostrar', v => {
      st.ultimoMostrado = v;
      bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'mostrar', args: [v], resultado: v });
      return v;
    }, 'Muestra un valor');
    return api;
  }

  /* ── verificación ── */
  function clasesConContrato(ast){
    return ast.cuerpo.filter(d =>
      d.tipo === 'DeclClase' && (d.implementa ?? []).includes('IResponsable') &&
      d.metodos.some(m => m.nombre === 'responderEmergencia'));
  }

  function verificar(sub, { ast } = {}){
    switch (sub.verificar.tipo){
      case 'contratoImplementado': {
        const ok = clasesConContrato(ast).some(c => c.nombre === 'CiudadanoComun' || c.nombre === 'MedicoUrbano');
        return ok && st.registrados.length >= 1;
      }
      case 'situaciones': return true;
      case 'polimorfismo': {
        const fn = funcionCoordinar(ast);
        if (!fn || !esPolimorfico(fn)) return false;
        const distintas = new Set(st.acciones.filter(a => /cura|apaga|abastece/.test(a)));
        if (distintas.size < 3) return false;
        st.coordinadorBase = serAST(fn);
        st.elegante = true;
        return true;
      }
      case 'desacoplado': {
        const fn = funcionCoordinar(ast);
        if (!fn || st.coordinadorBase === null) return false;
        if (serAST(fn) !== st.coordinadorBase) return false; // tocaron el coordinador
        if (!st.acciones.some(a => a.includes('comunicador'))) return false;
        return clasesConContrato(ast).length >= 4;
      }
      case 'catastrofe': {
        const fn = funcionCoordinar(ast);
        if (!fn || serAST(fn) !== st.coordinadorBase) return false;
        const todo = Object.values(st.eventos).every(v => v === false);
        return todo && clasesConContrato(ast).length >= 5 && st.acciones.some(a => a.includes('glitch'));
      }
      default: return false;
    }
  }

  /* ── ejecución ── */
  async function ejecutar(ast, { animado = true } = {}){
    const sub = SUBRETOS_NIVEL5[st.indice];

    // cada ejecución parte de una escena limpia (sin avatares duplicados,
    // sin acciones acumuladas y con los eventos otra vez pendientes)
    reiniciarSubreto(sub);

    st.intentos[sub.id] = (st.intentos[sub.id] ?? 0) + 1;
    import('../sistema/telemetria.js').then(({ telemetria }) =>
      telemetria.registrar('intento_subreto', { nivel: 'nivel-5', subreto: sub.id, intento: st.intentos[sub.id] }));
    const motor = new MotorEjecucion(bus);
    const limites = { maxPasos: sub.maxPasos || 600, maxProfundidad: 16, tiempoMaxMs: 6000 };
    let res;
    try {
      res = await motor.ejecutar(ast, crearAPI(), limites, { animado, delayMundo: 200, delayPaso: 30 });
    } catch (e){
      res = { ok: false, error: e };
    }
    if (!res.ok) return { ok: false, error: res.error };
    if (!verificar(sub, { ast })){
      return { ok: true, superado: false, mensaje: 'El gobierno funciona, pero el diseño aún no cumple el objetivo.' };
    }
    st.puntos += 12;
    if (st.intentos[sub.id] === 1) st.bonusIntentos += 2;
    if (st.indice < OBJETIVO_DE_SUBRETO.length) st.gestor?.completarObjetivo(OBJETIVO_DE_SUBRETO[st.indice]);
    if (sub.esJefe) restaurarCiudad();
    return { ok: true, superado: true };
  }

  function completarSituaciones(aciertos, total){
    if (aciertos < total) return { ok: false };
    const sub = SUBRETOS_NIVEL5[st.indice];
    st.intentos[sub.id] = (st.intentos[sub.id] ?? 0) + 1;
    st.puntos += 12;
    if (st.intentos[sub.id] === 1) st.bonusIntentos += 2;
    if (st.indice < OBJETIVO_DE_SUBRETO.length) st.gestor?.completarObjetivo(OBJETIVO_DE_SUBRETO[st.indice]);
    return { ok: true, superado: true };
  }

  /* ── restauración final ── */
  const ciudadRestaurada = new THREE.Group();
  const edificiosDorados = [];
  function restaurarCiudad(){
    if (st.restaurado) return;
    st.restaurado = true;
    vaciarGrupo(dinamicos);
    st.visuales = [];
    eclipse.visible = false;
    fragmentos.visible = false;
    st.luzBase = 0;
    luzEclipse.intensity = 0;
    nucleoTorre.material.emissive.set('#ffd27a');
    nucleoTorre.material.emissiveIntensity = .8;
    rejilla.material.color.set(0xffd27a);
    matCiudadCaida.emissive.set('#ffc864');
    matRack.emissive.set('#ffd27a');
    matP.color.set('#ffd27a');
    matHaz.color.set('#ffd27a');
    matEstrellas.color.set('#ffe6b0');
    matHorizonte.color.set('#ffd9a0');
    planeta.material.color.set('#ffd27a');
    matSat.color.set('#ffe6b0');
    for (const s of satelites) s.gl.material.color.set('#ffd27a');
    for (const p of plataforma) p.material.color.set('#ffd27a');
    for (const a of anillos) a.aro.material.color.set('#ffd27a');
    anilloTerminal.material.color.set('#ffd27a');
    // anillo de edificios dorados que «brotan» del suelo
    const mat = new THREE.MeshStandardMaterial({ color: '#c9a15a', emissive: '#7a5a1e', emissiveIntensity: .5, roughness: .6 });
    for (let i = 0; i < 14; i++){
      const ang = (i / 14) * Math.PI * 2 + .15;
      const h = 2 + Math.random() * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 2.2), mat);
      b.position.set(Math.cos(ang) * 25, 0, Math.sin(ang) * 25);
      b.scale.y = .001;
      ciudadRestaurada.add(b);
      edificiosDorados.push({ b, h, retraso: .4 + (i / 14) * 1.6 });
    }
    escena.add(ciudadRestaurada);
    // ondas doradas desde la torre
    for (let i = 0; i < 4; i++) onda(TORRE.x, TORRE.z, '#ffd27a', { retraso: i * .35, vel: 14, dur: 1.8 });
    st.transicion = 0;
    st.tRestaurado = 0;
    holograma.visible = true;
    bus.emitir(EVENTOS.MOTOR_MUNDO, { nombre: 'ciudadRestaurada', args: [], resultado: true });
  }

  /* El nivel termina tras hablar con el holograma de Gustaff (ver update). */
  function completarNivel(){
    st.gestor?.completarObjetivo('obj-5-2', {
      metricas: {
        subretosPuntos: st.puntos,
        polimorfismoOk: st.elegante,
        primerIntento: Math.floor(st.bonusIntentos / 2),
        segundos: Math.round((Date.now() - st.inicioNivel) / 1000),
      },
    });
  }

  const mundo = {
    colisionadores,
    zonasDano: [],
    terminal,
    reto: {
      subretos: SUBRETOS_NIVEL5,
      indice: () => st.indice,
      actual: () => SUBRETOS_NIVEL5[st.indice],
      cargarSubreto,
      ejecutar,
      completarSituaciones,
      completarNivel,
      setGestor: g => { st.gestor = g; },
    },
    update(t, dt, posJugador){
      // terminal: proximidad y parpadeo
      if (posJugador){
        terminal.cerca = Math.hypot(posJugador.x - grupoTerminal.position.x,
                                    posJugador.z - grupoTerminal.position.z) < 2.5;
      }
      luzTerminal.intensity = 3 + Math.sin(t * 4) * 1.2;
      anilloTerminal.position.y = 2.2 + Math.sin(t * 2) * .08;
      aroProximidad.material.opacity = terminal.cerca ? .6 + Math.sin(t * 8) * .25 : .2 + Math.sin(t * 2) * .05;

      // efectos temporales
      for (let i = efectos.length - 1; i >= 0; i--){
        if (!efectos[i].update(dt)){
          efectos[i].dispose();
          efectos.splice(i, 1);
        }
      }

      // partículas de datos
      const arr = geoP.attributes.position.array;
      for (let i = 0; i < NP; i++){
        arr[i * 3 + 1] += velP[i] * dt;
        if (arr[i * 3 + 1] > 18) arr[i * 3 + 1] = 0;
      }
      geoP.attributes.position.needsUpdate = true;

      // glifos de código: suben despacio y se mecen
      for (const g of glifos){
        g.s.position.y += g.vy * dt;
        g.s.position.x += Math.sin(t * .6 + g.fase) * dt * .25;
        if (g.s.position.y > 15) g.s.position.y = 2;
        g.s.material.opacity = .35 + (Math.sin(t * 1.4 + g.fase) + 1) * .2;
      }

      // anillos de la torre, haz de luz y plataforma de la base
      for (const a of anillos) a.pivote.rotation.y += dt * a.vel;
      matHaz.opacity = .09 + Math.sin(t * 1.3) * .03;
      plataforma.forEach((p, i) => { p.material.opacity = .35 + Math.sin(t * 2 + i * 1.5) * .2; });

      // satélites orbitando la torre
      for (const s of satelites){
        const a = t * s.vel + s.fase;
        s.g.position.set(TORRE.x + Math.cos(a) * s.R, s.y + Math.sin(t * 2 + s.fase) * .3, TORRE.z + Math.sin(a) * s.R);
        s.g.rotation.y += dt * 2;
      }

      // racks: los LEDs parpadean
      matRack.emissiveIntensity = .5 + Math.abs(Math.sin(t * 5)) * .35;

      // destello de la torre cuando llega un paquete de datos
      st.flashTorre = Math.max(0, st.flashTorre - dt * 2.5);
      nucleoTorre.material.emissiveIntensity = (st.restaurado ? .8 : .5) + st.flashTorre * 1.5;

      // balizas, aros, haces y cables: color del evento si está pendiente, verde si se resolvió
      for (const [ev, e] of Object.entries(estaciones)){
        const visible = !st.restaurado && (ev !== 'glitch' || st.conGlitch);
        e.g.visible = visible;
        const pendiente = st.eventos[ev];
        if (visible && e.previoPendiente && !pendiente){
          onda(e.g.position.x, e.g.position.z, VERDE, { vel: 7, dur: 1 });
          paquete(e.g.position.x, e.g.position.z, VERDE);
        }
        e.previoPendiente = pendiente;
        e.baliza.material.color.set(pendiente ? e.color : VERDE);
        e.baliza.scale.setScalar(pendiente ? 1.8 * (1 + Math.sin(t * 6) * .18) : 1.4);
        e.aro.material.color.set(pendiente ? e.color : VERDE);
        e.hazEst.material.color.set(pendiente ? e.color : VERDE);
        e.hazEst.material.opacity = pendiente ? .14 + Math.sin(t * 4) * .05 : .07;
        e.pivote.rotation.y += dt * (pendiente ? 3 : .8);
        e.cable.material.color.set(pendiente ? e.color : VERDE);
        e.cable.material.opacity = pendiente ? .25 + Math.sin(t * 5) * .15 : .9;
      }

      if (!st.restaurado){
        // Eclipse se debilita conforme se resuelven las emergencias
        const total = st.conGlitch ? 4 : 3;
        const pend = Object.entries(st.eventos).filter(([k, v]) => v && (k !== 'glitch' || st.conGlitch)).length;
        const objetivo = .35 + .65 * (pend / total);
        st.fEclipse += (objetivo - st.fEclipse) * Math.min(1, dt * 4);
        eclipse.scale.setScalar(st.fEclipse);
        fragmentos.scale.setScalar(st.fEclipse);
        eclipse.rotation.y += dt * .8;
        eclipse.position.y = EY + Math.sin(t * 1.4) * .3;
        fragmentos.position.y = eclipse.position.y;
        fragmentos.rotation.y += dt * 1.5;
        luzEclipse.intensity = (st.luzBase + Math.sin(t * 9) * 5) * st.fEclipse;
        // pulso de escaneo desde la torre
        if (t - st.ultimaOnda > 4){
          st.ultimaOnda = t;
          onda(TORRE.x, TORRE.z, '#39c6d0', { vel: 9, dur: 2.2 });
        }
      } else {
        st.tRestaurado += dt;
        // transición suave de cielo, niebla, suelo y luces a tonos cálidos
        if (st.transicion < 1){
          st.transicion = Math.min(1, st.transicion + dt / 3);
          const k = st.transicion;
          escena.background.lerpColors(colIni.fondo, colFin.fondo, k);
          escena.fog.color.lerpColors(colIni.niebla, colFin.niebla, k);
          luzHemi.color.lerpColors(colIni.hemiCielo, colFin.hemiCielo, k);
          luzHemi.groundColor.lerpColors(colIni.hemiSuelo, colFin.hemiSuelo, k);
          luzSol.color.lerpColors(colIni.sol, colFin.sol, k);
          suelo.material.color.lerpColors(colIni.suelo, colFin.suelo, k);
        }
        // los edificios dorados suben del suelo
        for (const e of edificiosDorados){
          const k = Math.min(1, Math.max(0, (st.tRestaurado - e.retraso) / .9));
          const s = 1 - Math.pow(1 - k, 3);
          e.b.scale.y = Math.max(.001, s);
          e.b.position.y = (e.h / 2) * s;
        }
        holograma.rotation.y += dt * .4;
        cuerpoH.material.opacity = .24 + Math.sin(t * 2.2) * .08;
        columnaLuz.material.opacity = .08 + Math.sin(t * 1.5) * .03;
        aroH.scale.setScalar(1 + Math.sin(t * 3) * .08);
        cartelH.position.y = 4.4 + Math.sin(t * 2) * .1;
        // al acercarse al holograma de Gustaff: último registro, diálogo final y fin del nivel
        if (!st.dialogoFinalDado && posJugador){
          const d = Math.hypot(posJugador.x - holograma.position.x, posJugador.z - holograma.position.z);
          if (d < 2.6){
            st.dialogoFinalDado = true;
            if (!progreso.tieneRegistro('nivel-5')) progreso.marcarRegistro('nivel-5');
            import('../sistema/dialogos.js').then(({ dialogos }) =>
              dialogos.abrirPorId('gustaff-5', () => completarNivel()));
          }
        }
      }

      // avatares: caminan a la estación de su evento
      for (const v of st.visuales){
        const dx = v.destino.x - v.grupo.position.x, dz = v.destino.z - v.grupo.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > .3){
          v.grupo.position.x += (dx / dist) * dt * 3;
          v.grupo.position.z += (dz / dist) * dt * 3;
          v.grupo.rotation.y = Math.atan2(dx, dz);
        } else if (!v.llego){
          v.llego = true;
          onda(v.grupo.position.x, v.grupo.position.z, v.color, { vel: 3, dur: .7 });
        }
        v.grupo.position.y = Math.abs(Math.sin(t * (dist > .3 ? 8 : 3) + v.fase)) * .1;
      }
    },
  };
  return mundo;
}