// ═══════════════════════════════════════════════════════════
// mundo/plazaCristales.js — Plaza de Cristales: un cristal por sector
// (apagado hasta restaurarlo, encendido después, con sus estrellas
// orbitando) y un Monumento central que despierta con todas las estrellas.
// E junto a un cristal repasa lo aprendido; E en la salida vuelve al menú.
// Contrato con LevelManager: devuelve { colisionadores, zonasDano, update }
// y, además, { salida, cristal, circuito } que main.js consulta.
//
// NOVEDADES
//  · CAMINOS DE ENERGÍA: una cinta del Monumento a cada cristal; se enciende
//    con el color del sector al restaurarlo y por ella viaja un pulso de luz.
//  · MONUMENTO DESPIERTO (15 estrellas): haz de luz al cielo y lluvia de chispas
//    doradas en espiral.
//  · CIRCUITO DEL ARQUITECTO: 9 aros alrededor de la plaza. Cruza el dorado para
//    arrancar el cronómetro y sigue el orden; los aros altos (▲) obligan a SALTAR.
//    Medallas oro/plata/bronce y récord guardado en este dispositivo.
//    No toca el motor del jugador: usa la posición que ya recibe update().
//
// PRESUPUESTO DE TRIÁNGULOS (estimado; confírmalo con F2)
//  Antes ≈ 3030: los dos aros del Monumento (torus 8×48) costaban 1536 solos.
//  Ahora: torus 3×40 (480), cielo 16×8 (224), anillos de suelo 64 seg (256),
//  salida 32 seg (64) → ≈ 1500 la escena base. El circuito suma ≈ 510 y las
//  cintas/pulsos ≈ 20 (+ 24 del haz si el Monumento está despierto).
//  Total ≈ 2050–2100, muy por debajo de 3000.
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { NIVELES } from '../../datos/niveles.js';
import { TEXTOS, formatear } from '../../datos/textos.js';
import { progreso } from '../sistema/progreso.js';
import { dialogos } from '../sistema/dialogos.js';
import { rangoFinal } from '../sistema/rango.js';
import { estado } from '../sistema/estado.js';

const M = 28;                    // mitad del lado de la plaza
const RADIO_CIRCULO = 13;        // radio del círculo donde se colocan los cinco cristales
const DIST_CRISTAL = 3.4;        // distancia para poder examinar un cristal
const DIST_MONUMENTO = 4.6;
const DIST_SALIDA = 2.4;
const POS_SALIDA = [0, 23];

/* ── Circuito del Arquitecto: ajusta aquí la dificultad ── */
const CIRCUITO = [               // [ángulo en grados, radio, ¿hay que saltar?]
  [120, 21, false],              // 0 · SALIDA (aro dorado al principio)
  [160, 23, false],
  [200, 20, true],
  [240, 23, false],
  [280, 20, false],
  [320, 23, true],
  [  0, 20, false],
  [ 35, 23, true],
  [ 70, 21, false],              // 8 · META
];
const R_PASO = 1.7;              // distancia horizontal para contar un aro
const SALTO_MIN = 0.45;          // metros sobre el suelo que hay que subir en los aros altos
const LIMITE_S = 150;            // si pasa este tiempo sin terminar, el circuito se reinicia
const MEDALLAS = [               // tiempos máximos en segundos (afínalos tras tu primera vuelta)
  { nombre: 'ORO',    max: 40 },
  { nombre: 'PLATA',  max: 55 },
  { nombre: 'BRONCE', max: Infinity },
];
const CLAVE_RECORD = 'adc_plaza_circuito';

const medallaDe = s => MEDALLAS.find(m => s <= m.max);
function leerRecord(){
  try { const v = parseFloat(localStorage.getItem(CLAVE_RECORD)); return Number.isFinite(v) ? v : null; }
  catch { return null; }
}
function guardarRecord(s){ try { localStorage.setItem(CLAVE_RECORD, String(s)); } catch {} }

function crearTexturaSuelo(anisotropia){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2236'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(150,200,230,.22)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  g.strokeStyle = 'rgba(150,200,230,.08)';
  g.beginPath();
  g.moveTo(128, 0); g.lineTo(128, 256);
  g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(M, M);          // baldosas de 2 m
  tex.anisotropy = anisotropia;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Halo radial suave para sprites (0 triángulos de coste real: 2 por sprite). */
function crearTexturaGlow(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(.35, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Cinta plana en el suelo entre dos puntos (2 triángulos). */
function crearCinta(x0, z0, x1, z1, ancho, y){
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
  const px = -dz / L * ancho / 2, pz = dx / L * ancho / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    x0 - px, y, z0 - pz,  x0 + px, y, z0 + pz,  x1 + px, y, z1 + pz,  x1 - px, y, z1 - pz,
  ], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** Cartel flotante de dos líneas. */
function crearEtiqueta(linea1, linea2, color){
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.fillStyle = color; g.font = 'bold 54px monospace'; g.fillText(linea1, 256, 64);
  g.fillStyle = '#e8f1fa'; g.font = '26px monospace'; g.fillText(linea2, 256, 118);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sprite.scale.set(6.4, 2, 1);
  return sprite;
}

const estrellasTexto = n => n ? '★'.repeat(n) + '☆'.repeat(3 - n) : '—';

export function crearPlaza(scene, anisotropia = 4){
  const P = TEXTOS.plaza;
  const colisionadores = [];
  const { estrellas: totalEstrellas, maxEstrellas, rango } = rangoFinal();
  const monumentoDespierto = totalEstrellas >= maxEstrellas;
  const ADITIVO = THREE.AdditiveBlending;
  const TEX_GLOW = crearTexturaGlow();

  /* ── niebla + cielo (los nombres de uniforms son los que usa aplicarPaleta) ── */
  scene.fog = new THREE.Fog('#3a2a4a', 40, 150);
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(320, 16, 8),   // el degradado se calcula por píxel: no necesita más segmentos
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        uArriba:    { value: new THREE.Color('#0a1230') },
        uHorizonte: { value: new THREE.Color('#e08a52') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uArriba; uniform vec3 uHorizonte; varying vec3 vDir;
        void main(){
          float h = clamp(normalize(vDir).y, 0.0, 1.0);
          gl_FragColor = vec4(mix(uHorizonte, uArriba, pow(h, 0.55)), 1.0);
        }`,
    })
  ));

  /* ── luces ── */
  scene.add(new THREE.HemisphereLight('#6a7ab0', '#2a2438', 0.9));
  const sol = new THREE.DirectionalLight('#ffd9a0', 2.2);
  sol.position.set(20, 40, 25);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 5, far: 120 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  scene.add(sol);

  /* ── suelo + anillos luminosos ── */
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(M * 2, M * 2),
    new THREE.MeshStandardMaterial({ map: crearTexturaSuelo(anisotropia), roughness: .95, metalness: 0 })
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  scene.add(suelo);

  for (const [r, op] of [[RADIO_CIRCULO, .35], [RADIO_CIRCULO + 6, .15]]){
    const anillo = new THREE.Mesh(
      new THREE.RingGeometry(r - .08, r + .08, 64),
      new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })
    );
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.y = .03;
    scene.add(anillo);
  }

  /* ── muros perimetrales bajos con franja ── */
  const matMuro = new THREE.MeshStandardMaterial({ color: '#1d2536', roughness: .85 });
  const matFranja = new THREE.MeshBasicMaterial({ color: '#5ff0e0' });
  for (const l of [
    { x: 0, z: -(M + .6), w: M * 2 + 2.4, d: 1.2 },
    { x: 0, z:  (M + .6), w: M * 2 + 2.4, d: 1.2 },
    { x: -(M + .6), z: 0, w: 1.2, d: M * 2 + 2.4 },
    { x:  (M + .6), z: 0, w: 1.2, d: M * 2 + 2.4 },
  ]){
    const muro = new THREE.Mesh(new THREE.BoxGeometry(l.w, 3, l.d), matMuro);
    muro.position.set(l.x, 1.5, l.z);
    muro.castShadow = muro.receiveShadow = true;
    scene.add(muro);
    const franja = new THREE.Mesh(
      l.w > l.d ? new THREE.BoxGeometry(l.w, .12, .2) : new THREE.BoxGeometry(.2, .12, l.d),
      matFranja
    );
    franja.position.set(l.x, 3.06, l.z);
    scene.add(franja);
    colisionadores.push({ minX: l.x - l.w / 2, maxX: l.x + l.w / 2, minZ: l.z - l.d / 2, maxZ: l.z + l.d / 2 });
  }

  /* ── cinco cristales: uno por sector ── */
  const geoPedestal = new THREE.CylinderGeometry(1.05, 1.35, .9, 8);
  const matPedestal = new THREE.MeshStandardMaterial({ color: '#2a3247', roughness: .7 });
  const geoCristal = new THREE.OctahedronGeometry(.9);
  const geoEstrella = new THREE.OctahedronGeometry(.2);
  const items = [];

  NIVELES.forEach((n, i) => {
    const ang = -Math.PI / 2 + i * (Math.PI * 2 / NIVELES.length);
    const x = Math.cos(ang) * RADIO_CIRCULO, z = Math.sin(ang) * RADIO_CIRCULO;
    const hecho = progreso.nivelCompletado(n.id);
    const col = n.paleta.primario;

    const pedestal = new THREE.Mesh(geoPedestal, matPedestal);
    pedestal.position.set(x, .45, z);
    pedestal.castShadow = pedestal.receiveShadow = true;
    scene.add(pedestal);
    colisionadores.push({ minX: x - 1.3, maxX: x + 1.3, minZ: z - 1.3, maxZ: z + 1.3 });

    const mat = new THREE.MeshStandardMaterial({
      color: hecho ? col : '#2a3247', emissive: hecho ? col : '#000000',
      emissiveIntensity: hecho ? 1.3 : 0, roughness: .3, flatShading: true,
    });
    const malla = new THREE.Mesh(geoCristal, mat);
    malla.scale.set(1, 1.5, 1);
    malla.position.set(x, 2.6, z);
    malla.castShadow = true;
    scene.add(malla);

    let luz = null;
    if (hecho){
      luz = new THREE.PointLight(col, 24, 16, 2);
      luz.position.set(x, 2.8, z);
      scene.add(luz);
    }

    // estrellas ganadas: orbitan sobre el cristal (doradas = ganadas, apagadas = pendientes)
    const ganadas = progreso.estrellasDe(n.id);
    const estrellas = [0, 1, 2].map(k => {
      const ok = k < ganadas;
      const em = new THREE.MeshStandardMaterial({
        color: ok ? '#ffd27a' : '#3a3f55', emissive: ok ? '#ffb02e' : '#000000',
        emissiveIntensity: ok ? 1.2 : 0, roughness: .35, flatShading: true,
      });
      const m = new THREE.Mesh(geoEstrella, em);
      scene.add(m);
      return { malla: m };
    });

    const etiqueta = crearEtiqueta(`N${n.numero}`, hecho ? n.titulo : P.etiquetaSinRestaurar, hecho ? col : '#7a84a8');
    etiqueta.position.set(x, 5.9, z);
    scene.add(etiqueta);

    items.push({ x, z, ang, col, hecho, mat, malla, luz, estrellas, baseY: 2.6, vel: .6 + i * .12, fase: i * 1.3 });
  });

  /* ── caminos de energía: Monumento → cada cristal (se encienden al restaurar el sector) ── */
  const R_CINTA_0 = 3.2, R_CINTA_1 = RADIO_CIRCULO - 1.7;
  const pulsos = [];
  items.forEach((c, i) => {
    const cx0 = Math.cos(c.ang) * R_CINTA_0, cz0 = Math.sin(c.ang) * R_CINTA_0;
    const cx1 = Math.cos(c.ang) * R_CINTA_1, cz1 = Math.sin(c.ang) * R_CINTA_1;
    const cinta = new THREE.Mesh(
      crearCinta(cx0, cz0, cx1, cz1, c.hecho ? .5 : .3, .045),
      new THREE.MeshBasicMaterial({
        color: c.hecho ? c.col : '#3a4466', transparent: true, opacity: c.hecho ? .5 : .22,
        side: THREE.DoubleSide, depthWrite: false, blending: c.hecho ? ADITIVO : THREE.NormalBlending,
      })
    );
    scene.add(cinta);
    if (c.hecho){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: TEX_GLOW, color: c.col, transparent: true, opacity: .95, blending: ADITIVO, depthWrite: false, fog: false }));
      s.scale.set(1.6, 1.6, 1);
      scene.add(s);
      pulsos.push({ s, c, cx0, cz0, cx1, cz1, fase: i * .2 });
    }
  });

  /* ── Monumento central: despierta con todas las estrellas ── */
  const pedMon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.6, .9, 12),
    matPedestal
  );
  pedMon.position.set(0, .45, 0);
  pedMon.castShadow = pedMon.receiveShadow = true;
  scene.add(pedMon);
  colisionadores.push({ minX: -2.6, maxX: 2.6, minZ: -2.6, maxZ: 2.6 });

  const matMon = new THREE.MeshStandardMaterial({
    color: monumentoDespierto ? '#ffd27a' : '#3a4466',
    emissive: monumentoDespierto ? '#ffb02e' : '#5ff0e0',
    emissiveIntensity: monumentoDespierto ? 1.6 : .25,
    roughness: .25, flatShading: true,
  });
  const monumento = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), matMon);
  monumento.scale.set(1, 1.6, 1);
  monumento.position.set(0, 4.2, 0);
  monumento.castShadow = true;
  scene.add(monumento);

  const matAro = new THREE.MeshBasicMaterial({
    color: monumentoDespierto ? '#ffd27a' : '#5ff0e0', transparent: true, opacity: monumentoDespierto ? .7 : .25,
  });
  const aros = [0, 1].map(k => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(2.6 + k * .5, .04, 3, 40), matAro);  // antes 8×48: 768 tris c/u
    a.position.set(0, 4.2, 0);
    scene.add(a);
    return a;
  });
  let luzMon = null, haz = null, chispas = null;
  if (monumentoDespierto){
    luzMon = new THREE.PointLight('#ffd27a', 60, 26, 2);
    luzMon.position.set(0, 5, 0);
    scene.add(luzMon);

    // haz de luz hacia el cielo (24 triángulos)
    haz = new THREE.Mesh(
      new THREE.CylinderGeometry(.9, .9, 44, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .16, side: THREE.DoubleSide,
        blending: ADITIVO, depthWrite: false, fog: false })
    );
    haz.position.set(0, 27, 0);
    scene.add(haz);

    // lluvia de chispas doradas en espiral alrededor del Monumento (Points: 0 triángulos)
    const NS = 140;
    const pos = new Float32Array(NS * 3), ang = new Float32Array(NS), rad = new Float32Array(NS), vel = new Float32Array(NS);
    for (let i = 0; i < NS; i++){
      ang[i] = Math.random() * Math.PI * 2; rad[i] = 2.4 + Math.random() * 3.6; vel[i] = .8 + Math.random() * 1.6;
      pos[i * 3 + 1] = Math.random() * 18;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
      size: .38, map: TEX_GLOW, color: '#ffd27a', transparent: true, opacity: .9, blending: ADITIVO, depthWrite: false }));
    puntos.frustumCulled = false;
    scene.add(puntos);
    chispas = { pos, ang, rad, vel, NS, geo };
  }
  const etiquetaMon = crearEtiqueta(P.etiquetaMonumento, rango.nombre, monumentoDespierto ? '#ffd27a' : '#7a84a8');
  etiquetaMon.position.set(0, 7.6, 0);
  scene.add(etiquetaMon);

  /* ── salida ── */
  const padSalida = new THREE.Mesh(
    new THREE.RingGeometry(.9, 1.4, 32),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })
  );
  padSalida.rotation.x = -Math.PI / 2;
  padSalida.position.set(POS_SALIDA[0], .04, POS_SALIDA[1]);
  scene.add(padSalida);
  const etiquetaSalida = crearEtiqueta(P.etiquetaSalida, P.etiquetaSalidaSub, '#ffd27a');
  etiquetaSalida.scale.multiplyScalar(.7);
  etiquetaSalida.position.set(POS_SALIDA[0], 2.4, POS_SALIDA[1]);
  scene.add(etiquetaSalida);

  /* ══════════ CIRCUITO DEL ARQUITECTO ══════════
     Cruza el aro dorado para empezar y sigue el orden. Los aros con ▲ están en lo alto:
     hay que saltar al cruzarlos. Corre con SHIFT. */
  const CI = CIRCUITO.map(([grados, r, salto]) => {
    const a = grados * Math.PI / 180;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: salto ? 2.9 : 1.7, salto };
  });
  const geoAroCircuito = new THREE.RingGeometry(1.0, 1.18, 24);          // 48 triángulos c/u
  const aros3 = CI.map((c, i) => {
    const prev = CI[Math.max(0, i - 1)], next = CI[Math.min(CI.length - 1, i + 1)];
    const mat = new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: .35,
      side: THREE.DoubleSide, depthWrite: false });
    const malla = new THREE.Mesh(geoAroCircuito, mat);
    malla.position.set(c.x, c.y, c.z);
    malla.rotation.y = Math.atan2(next.x - prev.x, next.z - prev.z);      // mira en la dirección del recorrido
    scene.add(malla);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX_GLOW, color: '#5ff0e0', transparent: true, opacity: .35, blending: ADITIVO, depthWrite: false, fog: false }));
    halo.scale.setScalar(3.4);
    halo.position.copy(malla.position);
    scene.add(halo);
    if (c.salto){
      const aviso = crearEtiqueta('▲', 'salta', '#ffd27a');
      aviso.scale.multiplyScalar(.4);
      aviso.position.set(c.x, c.y + 1.7, c.z);
      scene.add(aviso);
    }
    return { malla, mat, halo, c };
  });
  // guía en el suelo entre aros
  const matGuia = new THREE.MeshBasicMaterial({ color: '#5ff0e0', transparent: true, opacity: .12,
    side: THREE.DoubleSide, depthWrite: false, blending: ADITIVO });
  for (let i = 0; i < CI.length - 1; i++){
    scene.add(new THREE.Mesh(crearCinta(CI[i].x, CI[i].z, CI[i + 1].x, CI[i + 1].z, .5, .05), matGuia));
  }
  // marca de salida en el suelo
  const padCircuito = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.75, 32),
    new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false })
  );
  padCircuito.rotation.x = -Math.PI / 2;
  padCircuito.position.set(CI[0].x, .045, CI[0].z);
  scene.add(padCircuito);

  const circ = { estado: 'espera', siguiente: 0, tiempo: 0, base: null, mejor: leerRecord(), ultimo: 0 };

  let etiquetaInicio = null;
  function repintarEtiquetaInicio(){
    if (etiquetaInicio){
      scene.remove(etiquetaInicio);
      etiquetaInicio.material.map?.dispose(); etiquetaInicio.material.dispose();
    }
    etiquetaInicio = crearEtiqueta('CIRCUITO',
      circ.mejor != null ? `mejor ${circ.mejor.toFixed(1)} s · ${medallaDe(circ.mejor).nombre}` : 'cruza el aro y corre',
      '#ffd27a');
    etiquetaInicio.position.set(CI[0].x, 5.2, CI[0].z);
    scene.add(etiquetaInicio);
  }
  repintarEtiquetaInicio();

  function pintarAros(){
    aros3.forEach((a, i) => {
      const hecho = i < circ.siguiente, activo = i === circ.siguiente;
      const color = activo ? '#ffd27a' : hecho ? '#58f0a0' : '#5ff0e0';
      a.mat.color.set(color);
      a.mat.opacity = activo ? 1 : hecho ? .25 : .35;
      a.halo.material.color.set(color);
      a.halo.material.opacity = activo ? .8 : hecho ? .12 : .3;
    });
  }
  pintarAros();

  function terminarCircuito(){
    const tiempo = circ.tiempo;
    const medalla = medallaDe(tiempo);
    const record = circ.mejor === null || tiempo < circ.mejor;
    if (record){ circ.mejor = tiempo; guardarRecord(tiempo); }
    circ.ultimo = tiempo;
    circ.estado = 'espera'; circ.siguiente = 0;
    pintarAros(); repintarEtiquetaInicio();
    dialogos.abrirNodo({
      id: 'plaza-circuito', hablante: 'sistema',
      texto: `Circuito completado en ${tiempo.toFixed(1)} s · medalla de ${medalla.nombre}. ` +
        (record ? '¡Nuevo récord! ' : `Tu récord es ${circ.mejor.toFixed(1)} s. `) +
        'Vuelve al aro dorado para intentarlo de nuevo.',
    });
  }

  function pasarAro(){
    if (circ.siguiente === 0){ circ.estado = 'corriendo'; circ.tiempo = 0; }
    circ.siguiente++;
    if (circ.siguiente >= CI.length){ terminarCircuito(); return; }
    pintarAros();
  }

  /** Texto para el HUD (main.js lo muestra en el panel de misión de la Plaza). */
  function resumen(){
    const base = formatear(P.resumenHud, { n: totalEstrellas, max: maxEstrellas });
    if (circ.estado === 'corriendo')
      return `${base} · CIRCUITO: aro ${circ.siguiente}/${CI.length} · ${circ.tiempo.toFixed(1)} s`;
    let extra = '';
    if (circ.ultimo) extra += ` · ÚLTIMO ${circ.ultimo.toFixed(1)} s`;
    if (circ.mejor != null) extra += ` · MEJOR ${circ.mejor.toFixed(1)} s`;
    return `${base} · CIRCUITO: cruza el aro dorado${extra}`;
  }
  const circuito = { resumen };

  /* ── polvo ambiental ── */
  const N = 160, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++){
    pos[i * 3]     = (Math.random() * 2 - 1) * M;
    pos[i * 3 + 1] = .3 + Math.random() * 8;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * M;
  }
  const geoPolvo = new THREE.BufferGeometry();
  geoPolvo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const polvo = new THREE.Points(geoPolvo, new THREE.PointsMaterial({
    color: '#ffe3b0', size: .1, transparent: true, opacity: .45, depthWrite: false,
  }));
  scene.add(polvo);

  /* ── interacción (la consulta main.js al pulsar E) ── */
  const salida = { cerca: false };
  const cristal = {
    cerca: false,
    indice: -1,            // 0..n-1 = cristal de ese sector · -2 = Monumento · -1 = ninguno
    abrir(){
      let texto, id;
      if (this.indice === -2){
        id = 'plaza-monumento';
        texto = formatear(monumentoDespierto ? P.monumentoEncendido : P.monumentoApagado,
          { rango: rango.nombre, n: totalEstrellas, max: maxEstrellas, texto: rango.texto });
      } else if (this.indice >= 0){
        const n = NIVELES[this.indice];
        id = `plaza-cristal-${n.numero}`;
        if (!progreso.nivelCompletado(n.id)){
          texto = formatear(P.cristalApagado, { titulo: n.titulo });
        } else {
          const ap = TEXTOS.aprendizaje.niveles[n.id];
          texto = [
            formatear(P.cristalEncendido, { titulo: n.titulo, resumen: ap?.resumen ?? '' }),
            ap ? formatear(P.temas, { temas: ap.temas.join(', ') }) : '',
            formatear(P.calificacion, {
              estrellas: estrellasTexto(progreso.estrellasDe(n.id)),
              puntos: progreso.datos.puntuaciones[n.id] ?? 0,
            }),
          ].filter(Boolean).join(' ');
        }
      } else return;
      dialogos.abrirNodo({ id, hablante: 'sistema', texto });
    },
  };

  /* ── actualización por frame ── */
  function update(t, dt, posJugador){
    for (const c of items){
      c.malla.rotation.y += dt * (c.hecho ? c.vel : c.vel * .3);
      c.malla.position.y = c.baseY + Math.sin(t * 1.25 + c.fase) * (c.hecho ? .25 : .08);
      if (c.hecho){
        c.mat.emissiveIntensity = 1.2 + Math.sin(t * 2.2 + c.fase) * .35;
        if (c.luz) c.luz.intensity = 22 + Math.sin(t * 5 + c.fase) * 4;
      }
      c.estrellas.forEach((e, k) => {
        const a = t * .9 + k * 2.0944 + c.fase;
        e.malla.position.set(c.x + Math.cos(a) * 1.15, 4.5 + Math.sin(t * 1.6 + k) * .12, c.z + Math.sin(a) * 1.15);
        e.malla.rotation.y = t * 2;
      });
    }
    // pulsos de luz que viajan por los caminos de energía
    for (const p of pulsos){
      const k = (t * .35 + p.fase) % 1;
      p.s.position.set(p.cx0 + (p.cx1 - p.cx0) * k, .5, p.cz0 + (p.cz1 - p.cz0) * k);
      p.s.material.opacity = Math.sin(k * Math.PI) * .95;
    }
    monumento.rotation.y += dt * (monumentoDespierto ? .8 : .25);
    monumento.position.y = 4.2 + Math.sin(t * 1.1) * (monumentoDespierto ? .3 : .1);
    aros[0].rotation.x = t * .5; aros[0].rotation.y = t * .3;
    aros[1].rotation.x = -t * .4; aros[1].rotation.z = t * .35;
    if (luzMon) luzMon.intensity = 55 + Math.sin(t * 3) * 8;
    if (haz) haz.material.opacity = .13 + Math.sin(t * 2) * .05;
    if (chispas){
      const { pos: p, ang, rad, vel, NS, geo } = chispas;
      for (let i = 0; i < NS; i++){
        p[i * 3 + 1] += vel[i] * dt;
        ang[i] += dt * .6;
        if (p[i * 3 + 1] > 18) p[i * 3 + 1] = .5;
        p[i * 3]     = Math.cos(ang[i]) * rad[i];
        p[i * 3 + 2] = Math.sin(ang[i]) * rad[i];
      }
      geo.attributes.position.needsUpdate = true;
    }
    padSalida.material.opacity = .55 + .25 * Math.sin(t * 3);
    polvo.rotation.y = t * .01;

    /* circuito: calibra la altura del suelo y comprueba el siguiente aro */
    if (circ.base === null || posJugador.y < circ.base) circ.base = posJugador.y;
    if (estado.mundoActivo()){               // el cronómetro se pausa en diálogos, editor y pausa
      if (circ.estado === 'corriendo'){
        circ.tiempo += dt;
        if (circ.tiempo > LIMITE_S){ circ.estado = 'espera'; circ.siguiente = 0; pintarAros(); }
      }
      const a = CI[circ.siguiente];
      if (a){
        const dx = posJugador.x - a.x, dz = posJugador.z - a.z;
        if (dx * dx + dz * dz < R_PASO * R_PASO && (!a.salto || posJugador.y >= circ.base + SALTO_MIN)) pasarAro();
      }
    }
    aros3.forEach((a, i) => {                 // el aro activo late
      const activo = i === circ.siguiente;
      a.malla.scale.setScalar(activo ? 1 + Math.sin(t * 5) * .07 : 1);
      a.halo.scale.setScalar(activo ? 3.4 + Math.sin(t * 5) * .5 : 3.4);
    });
    padCircuito.material.opacity = .45 + .25 * Math.sin(t * 3);

    // ¿qué hay cerca para pulsar E?
    let mejor = -1, dMejor = DIST_CRISTAL;
    items.forEach((c, i) => {
      const d = Math.hypot(posJugador.x - c.x, posJugador.z - c.z);
      if (d < dMejor){ dMejor = d; mejor = i; }
    });
    if (Math.hypot(posJugador.x, posJugador.z) < DIST_MONUMENTO) mejor = -2;
    cristal.indice = mejor;
    cristal.cerca = mejor !== -1;
    salida.cerca = Math.hypot(posJugador.x - POS_SALIDA[0], posJugador.z - POS_SALIDA[1]) < DIST_SALIDA;
  }

  return { colisionadores, zonasDano: [], update, salida, cristal, circuito };
}