// ═══════════════════════════════════════════════════════════
// world.js — cielo, luces, suelo, obstáculos, cristales y zonas
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { CONFIG } from './config.js';

/* RNG determinista: el mapa es igual en cada carga */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function crearTexturaSuelo(anisotropia){
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#252b3f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++){
    g.fillStyle = Math.random() > .5
      ? `rgba(255,255,255,${Math.random() * .05})`
      : `rgba(0,0,0,${Math.random() * .18})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(150,180,230,.20)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);                       // rejilla principal
  g.strokeStyle = 'rgba(150,180,230,.07)';
  g.beginPath();
  g.moveTo(128, 0); g.lineTo(128, 256);
  g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();   // subdivisiones
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.anisotropy = anisotropia;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function crearMundo(scene, anisotropia = 4){
  const colisionadores = [];
  const rng = mulberry32(20261003);
  const M = CONFIG.arena.mitad;

  /* ── niebla + cielo degradado + sol ── */
  scene.fog = new THREE.Fog('#8a4a38', CONFIG.camara.nieblaInicio, CONFIG.camara.nieblaFin);

  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        uArriba:    { value: new THREE.Color('#0e1c36') },
        uHorizonte: { value: new THREE.Color('#c96a45') },
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
  );
  scene.add(cielo);

  const solMat = new THREE.MeshBasicMaterial({
    color: '#ffd9a0', transparent: true, opacity: .95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const sol = new THREE.Mesh(new THREE.CircleGeometry(20, 32), solMat);
  sol.position.set(-150, 55, -255); sol.lookAt(0, 20, 0); scene.add(sol);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(46, 32), solMat.clone());
  halo.material.opacity = .22;
  halo.position.copy(sol.position); halo.lookAt(0, 20, 0); scene.add(halo);

  /* ── luces ── */
  scene.add(new THREE.HemisphereLight('#7fa8ff', '#4a3228', 0.7));
  const luzSol = new THREE.DirectionalLight('#ffc07a', 2.6);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(2048, 2048);
  Object.assign(luzSol.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 5, far: 200 });
  luzSol.shadow.bias = -0.0004;
  luzSol.shadow.normalBias = 0.02;
  scene.add(luzSol, luzSol.target);

  /* ── suelo ── */
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(M * 2, M * 2),
    new THREE.MeshStandardMaterial({ map: crearTexturaSuelo(anisotropia), roughness: .95, metalness: 0 })
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  scene.add(suelo);

  /* ── muros perimetrales + franja luminosa ── */
  const matMuro = new THREE.MeshStandardMaterial({ color: '#1d2536', roughness: .85 });
  const matFranja = new THREE.MeshBasicMaterial({ color: '#ffb454' });
  const lados = [
    { x: 0, z: -(M + .6), w: M * 2 + 2.4, d: 1.2 },
    { x: 0, z:  (M + .6), w: M * 2 + 2.4, d: 1.2 },
    { x: -(M + .6), z: 0, w: 1.2, d: M * 2 + 2.4 },
    { x:  (M + .6), z: 0, w: 1.2, d: M * 2 + 2.4 },
  ];
  for (const l of lados){
    const muro = new THREE.Mesh(new THREE.BoxGeometry(l.w, 4.5, l.d), matMuro);
    muro.position.set(l.x, 2.25, l.z);
    muro.castShadow = muro.receiveShadow = true;
    scene.add(muro);
    const franja = new THREE.Mesh(
      l.w > l.d ? new THREE.BoxGeometry(l.w, .12, .2) : new THREE.BoxGeometry(.2, .12, l.d),
      matFranja
    );
    franja.position.set(l.x, 4.56, l.z);
    scene.add(franja);
    colisionadores.push({ minX: l.x - l.w/2, maxX: l.x + l.w/2, minZ: l.z - l.d/2, maxZ: l.z + l.d/2 });
  }

  /* ── zonas de daño (placas térmicas) ── */
  const zonasDano = [];
  const geoZona = new THREE.BoxGeometry(4.4, .08, 4.4);
  for (const [x, z] of [[12, -14], [-18, 6], [6, 24], [-10, -26]]){
    const mat = new THREE.MeshStandardMaterial({
      color: '#4a1a16', emissive: '#ff4438', emissiveIntensity: .8, roughness: .6,
    });
    const malla = new THREE.Mesh(geoZona, mat);
    malla.position.set(x, .045, z);
    scene.add(malla);
    zonasDano.push({ minX: x-2.2, maxX: x+2.2, minZ: z-2.2, maxZ: z+2.2, mat, fase: rng()*6 });
  }

  /* ── cristales flotantes sobre pedestales ── */
  const cristales = [];
  const posicionesCristal = [];
  for (let i = 0; i < 6; i++){
    const ang = (i / 6) * Math.PI * 2 + .5;
    const rad = 16 + (i % 2) * 9;
    posicionesCristal.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
  }
  const geoCristal = new THREE.OctahedronGeometry(.8);
  const geoPedestal = new THREE.CylinderGeometry(1.05, 1.35, .9, 8);
  const matPedestal = new THREE.MeshStandardMaterial({ color: '#2a3247', roughness: .7 });
  const colores = ['#5df2c7', '#ffb454', '#6fd7ff'];

  posicionesCristal.forEach(([x, z], i) => {
    const pedestal = new THREE.Mesh(geoPedestal, matPedestal);
    pedestal.position.set(x, .45, z);
    pedestal.castShadow = pedestal.receiveShadow = true;
    scene.add(pedestal);

    const col = colores[i % 3];
    const mat = new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 1.3, roughness: .3, flatShading: true,
    });
    const cristal = new THREE.Mesh(geoCristal, mat);
    cristal.position.set(x, 2.4, z);
    cristal.castShadow = true;
    scene.add(cristal);

    let luz = null;
    if (i % 2 === 0){
      luz = new THREE.PointLight(col, 26, 18, 2);
      luz.position.set(x, 2.6, z);
      scene.add(luz);
    }
    cristales.push({ malla: cristal, mat, luz, baseY: 2.4, vel: .6 + rng() * .8, fase: rng() * Math.PI * 2 });
    colisionadores.push({ minX: x-1.3, maxX: x+1.3, minZ: z-1.3, maxZ: z+1.3 });
  });

  /* ── obstáculos (área despejada cerca del spawn, cristales y zonas) ── */
  const exclusiones = [{ x: 0, z: 8, r: 6 }];
  posicionesCristal.forEach(([x, z]) => exclusiones.push({ x, z, r: 4 }));
  zonasDano.forEach(z => exclusiones.push({ x: (z.minX+z.maxX)/2, z: (z.minZ+z.maxZ)/2, r: 4.5 }));

  const geoCaja = new THREE.BoxGeometry(1, 1, 1);
  const paleta = ['#39506b', '#27454d', '#6b4634', '#555f78']
    .map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: .05 }));

  for (let i = 0; i < 46; i++){
    const ang = rng() * Math.PI * 2;
    const rad = 8 + rng() * (M - 12);
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (exclusiones.some(e => Math.hypot(x - e.x, z - e.z) < e.r)) continue;

    const w = 1.3 + rng() * 2.4, d = 1.3 + rng() * 2.4;
    let h = 1.5 + rng() * 4.2;
    if (rng() < .14) h = 6 + rng() * 3.5;   // monolitos altos

    const bloque = new THREE.Mesh(geoCaja, paleta[(rng() * paleta.length) | 0]);
    bloque.scale.set(w, h, d);
    bloque.position.set(x, h / 2, z);
    bloque.castShadow = bloque.receiveShadow = true;
    scene.add(bloque);
    colisionadores.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2 });
  }

  /* ── polvo ambiental ── */
  const N = 240, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++){
    pos[i*3]   = (rng() * 2 - 1) * M;
    pos[i*3+1] = .3 + rng() * 7;
    pos[i*3+2] = (rng() * 2 - 1) * M;
  }
  const geoPolvo = new THREE.BufferGeometry();
  geoPolvo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const polvo = new THREE.Points(geoPolvo, new THREE.PointsMaterial({
    color: '#ffcf9a', size: .1, transparent: true, opacity: .45, depthWrite: false,
  }));
  scene.add(polvo);

  /* ── actualización por frame ── */
  function update(t, dt, posJugador){
    // la sombra sigue al jugador → máxima calidad con mapa de 2048
    luzSol.position.set(posJugador.x - 42, 54, posJugador.z - 60);
    luzSol.target.position.set(posJugador.x, 0, posJugador.z);
    luzSol.target.updateMatrixWorld();

    for (const c of cristales){
      c.malla.rotation.y += dt * c.vel;
      c.malla.position.y = c.baseY + Math.sin(t * 1.25 + c.fase) * .3;
      c.mat.emissiveIntensity = 1.25 + Math.sin(t * 2.2 + c.fase) * .4;
      if (c.luz) c.luz.intensity = 24 + Math.sin(t * 6 + c.fase) * 5;
    }
    for (const z of zonasDano){
      z.mat.emissiveIntensity = .65 + .45 * (0.5 + 0.5 * Math.sin(t * 2.6 + z.fase));
    }
    polvo.rotation.y = t * .008;
  }

  return { colisionadores, zonasDano, update };
}