// ═══════════════════════════════════════════════════════════
// player.js — movimiento FPS, física, colisiones y daño.
// MODIFICADO: `activo` ahora es un getter sobre la máquina de
// estados; añade setColisionadores() y reaparecer(silencioso).
// NUEVO: altura de terreno. El mundo puede exponer alturaEn(x, z)
// (por ejemplo el mirador del nivel 3) y el jugador sube y baja
// por las lomas. Sin alturaEn el suelo es plano (y = 0), como antes.
// ═══════════════════════════════════════════════════════════
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { estado } from './sistema/estado.js';

const J = CONFIG.jugador;

/* Cuánto puede bajar el jugador en un frame y seguir "pegado" al suelo
   (bajar una loma no cuenta como caída ni hace daño). */
const PEGADO_AL_SUELO = .6;

/* Empuja un punto (círculo de radio `radio`) fuera de una caja AABB (solo XZ) */
function resolverCirculoCaja(pos, radio, caja){
  const cx = Math.max(caja.minX, Math.min(pos.x, caja.maxX));
  const cz = Math.max(caja.minZ, Math.min(pos.z, caja.maxZ));
  const dx = pos.x - cx, dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > radio * radio) return;
  if (d2 > 1e-8){
    const d = Math.sqrt(d2), e = (radio - d) / d;
    pos.x += dx * e; pos.z += dz * e;
  } else { // centro dentro de la caja → salir por el lado más cercano
    const izq = pos.x - caja.minX, der = caja.maxX - pos.x;
    const fon = pos.z - caja.minZ, fre = caja.maxZ - pos.z;
    const m = Math.min(izq, der, fon, fre);
    if (m === izq) pos.x = caja.minX - radio;
    else if (m === der) pos.x = caja.maxX + radio;
    else if (m === fon) pos.z = caja.minZ - radio;
    else pos.z = caja.maxZ + radio;
  }
}

export class Jugador {
  /**
   * @param {Object} camara — THREE.PerspectiveCamera
   * @param {Object[]} colisionadores — AABB {minX,maxX,minZ,maxZ}
   * @param {Object[]} zonasDano — AABB de placas térmicas
   * @param {Function|null} [alturaEn] — (x, z) → altura del terreno (opcional)
   */
  constructor(camara, colisionadores, zonasDano, alturaEn = null){
    this.camara = camara;
    this.colisionadores = colisionadores;
    this.zonasDano = zonasDano;
    this.alturaEn = alturaEn;

    camara.rotation.order = 'YXZ';
    this.posicion = new THREE.Vector3(0, this.piso(0, 8), 8);
    this.velocidad = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.fovActual = CONFIG.camara.fov;
    camara.position.copy(this.posicion);

    this.vida = J.vidaMax;
    this.resistencia = J.resistenciaMax;
    this.enSuelo = true;
    this.corriendo = false;
    this.agotado = false;
    this.enZonaPeligro = false;
    this.teclas = Object.create(null);
    this.sacudida = 0;
    this.tBob = 0;

    // callbacks que conecta main.js con el HUD / narrativa
    this.alRecibirDano = null;
    this.alCurar = null;
    this.alReaparecer = null;
    this.alEntrarZona = null;
  }

  /**
   * El jugador solo se mueve en estado EXPLORANDO.
   * Mantiene la API antigua (`jugador.activo`) sin estado binario manual.
   * @returns {boolean}
   */
  get activo(){
    return estado.explorando();
  }

  /**
   * Altura de los OJOS cuando el jugador está de pie en (x, z).
   * = altura del terreno + altura de ojos.
   */
  piso(x, z){
    return J.alturaOjos + (this.alturaEn ? this.alturaEn(x, z) : 0);
  }

  /**
   * Cambia el mundo contra el que colisiona (al cargar otro nivel).
   * @param {Object[]} colisionadores
   * @param {Object[]} zonasDano
   * @param {Function|null} [alturaEn] — altura del terreno del nuevo nivel
   *   (si se omite, el suelo vuelve a ser plano)
   */
  setColisionadores(colisionadores, zonasDano, alturaEn = null){
    this.colisionadores = colisionadores;
    this.zonasDano = zonasDano;
    this.alturaEn = alturaEn;
  }

  girar(dx, dy){
    if (estado.modo !== 'EXPLORANDO') return;  // NUEVO: ignorar en LIBRE
    this.yaw -= dx * J.sensibilidad;
    this.pitch -= dy * J.sensibilidad;
    const lim = Math.PI / 2 - .02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  limpiarEntrada(){ this.teclas = Object.create(null); }

  curar(cantidad = 25){
    if (this.vida >= J.vidaMax) return false;
    this.vida = Math.min(J.vidaMax, this.vida + cantidad);
    if (this.alCurar) this.alCurar();
    return true;
  }

  recibirDano(cantidad){
    this.vida = Math.max(0, this.vida - cantidad);
    if (this.alRecibirDano) this.alRecibirDano(Math.round(cantidad));
    if (this.vida <= 0) this.reaparecer();
  }

  /**
   * @param {boolean} [silencioso] — true en cargas de nivel (sin aviso en HUD)
   */
  reaparecer(silencioso = false){
    this.posicion.set(0, this.piso(0, 8), 8);
    this.velocidad.set(0, 0, 0);
    this.vida = J.vidaMax;
    this.resistencia = J.resistenciaMax;
    this.sacudida = 0;
    this.enZonaPeligro = false;
    if (this.alReaparecer) this.alReaparecer(silencioso);
  }

  update(dt){
    if (!estado.explorando()){ this.aplicarCamara(dt, 0); return; }
    const t = this.teclas;
    const ix = ((t.KeyD || t.ArrowRight) ? 1 : 0) - ((t.KeyA || t.ArrowLeft) ? 1 : 0);
    const iz = ((t.KeyW || t.ArrowUp)    ? 1 : 0) - ((t.KeyS || t.ArrowDown) ? 1 : 0);
    const hayEntrada = ix !== 0 || iz !== 0;

    /* ── sprint + resistencia ── */
    const quiereCorrer = (t.ShiftLeft || t.ShiftRight) && hayEntrada;
    if (this.agotado && this.resistencia > 35) this.agotado = false;
    this.corriendo = quiereCorrer && !this.agotado && this.resistencia > 0;
    if (this.corriendo){
      this.resistencia = Math.max(0, this.resistencia - J.costeCorrer * dt);
      if (this.resistencia === 0) this.agotado = true;
    } else {
      this.resistencia = Math.min(J.resistenciaMax, this.resistencia + J.regenResistencia * dt);
    }

    /* ── dirección relativa a la cámara ── */
    let mx = 0, mz = 0;
    if (hayEntrada){
      const len = Math.hypot(ix, iz);
      const nx = ix / len, nz = iz / len;
      mx =  Math.cos(this.yaw) * nx - Math.sin(this.yaw) * nz;
      mz = -Math.sin(this.yaw) * nx - Math.cos(this.yaw) * nz;
    }
    const velObjetivo = this.corriendo ? J.velCorrer : J.velCaminar;
    const k = 1 - Math.exp(-(hayEntrada ? J.aceleracion : J.frenado) * dt);
    this.velocidad.x += (mx * velObjetivo - this.velocidad.x) * k;
    this.velocidad.z += (mz * velObjetivo - this.velocidad.z) * k;

    /* ── salto + gravedad ── */
    if (t.Space && this.enSuelo){
      this.velocidad.y = J.fuerzaSalto;
      this.enSuelo = false;
    }
    this.velocidad.y -= J.gravedad * dt;

    /* ── integrar ── */
    this.posicion.x += this.velocidad.x * dt;
    this.posicion.y += this.velocidad.y * dt;
    this.posicion.z += this.velocidad.z * dt;

    /* ── colisiones con el escenario (XZ) ──
       Van antes del suelo para leer la altura ya en la posición final. */
    for (const caja of this.colisionadores){
      resolverCirculoCaja(this.posicion, J.radio, caja);
    }

    /* ── suelo / terreno ── */
    const piso = this.piso(this.posicion.x, this.posicion.z);
    // al bajar una loma el jugador sigue pegado al suelo (no es una caída)
    if (this.enSuelo && this.posicion.y > piso && this.posicion.y - piso <= PEGADO_AL_SUELO){
      this.posicion.y = piso;
    }
    if (this.posicion.y > piso + .001) this.enSuelo = false;

    /* ── aterrizaje + daño por caída ── */
    if (this.posicion.y <= piso){
      const impacto = -this.velocidad.y;
      this.posicion.y = piso;
      this.velocidad.y = 0;
      if (!this.enSuelo){
        this.enSuelo = true;
        if (impacto > J.umbralDanoCaida){
          this.recibirDano((impacto - J.umbralDanoCaida) * 7);
          this.sacudida = Math.min(.4, impacto * .02);
        } else if (impacto > 6){
          this.sacudida = Math.min(.12, impacto * .008);
        }
      }
    }

    /* ── zonas de daño (puedes saltarlas por encima) ── */
    let dentro = false;
    if (this.enSuelo){
      for (const z of this.zonasDano){
        if (this.posicion.x > z.minX - J.radio && this.posicion.x < z.maxX + J.radio &&
            this.posicion.z > z.minZ - J.radio && this.posicion.z < z.maxZ + J.radio){
          dentro = true; break;
        }
      }
    }
    if (dentro){
      if (!this.enZonaPeligro && this.alEntrarZona) this.alEntrarZona();
      this.vida = Math.max(0, this.vida - J.danoZona * dt);
      if (this.vida <= 0) this.reaparecer();
    }
    this.enZonaPeligro = dentro;

    /* ── head-bob ── */
    const velH = Math.hypot(this.velocidad.x, this.velocidad.z);
    if (this.enSuelo && velH > .5) this.tBob += dt * velH * 1.7;

    this.aplicarCamara(dt, velH);
  }

  aplicarCamara(dt, velH){
    /* FOV dinámico al esprintar */
    const fovObj = this.corriendo ? CONFIG.camara.fovSprint : CONFIG.camara.fov;
    this.fovActual += (fovObj - this.fovActual) * Math.min(1, dt * 7);
    if (Math.abs(this.fovActual - this.camara.fov) > .01){
      this.camara.fov = this.fovActual;
      this.camara.updateProjectionMatrix();
    }
    /* head-bob + sacudida de aterrizaje */
    const amp = this.enSuelo ? Math.min(velH / J.velCorrer, 1) * .045 : 0;
    const bobY = Math.sin(this.tBob * 2) * amp;
    const bobX = Math.cos(this.tBob) * amp * .5;
    this.sacudida = Math.max(0, this.sacudida - dt * 1.6);
    const sx = (Math.random() - .5) * this.sacudida * .35;
    const sy = (Math.random() - .5) * this.sacudida * .35;

    this.camara.position.set(
      this.posicion.x + Math.cos(this.yaw) * bobX + sx,
      this.posicion.y + bobY + sy,
      this.posicion.z - Math.sin(this.yaw) * bobX
    );
    this.camara.rotation.set(this.pitch, this.yaw, 0);
  }
}