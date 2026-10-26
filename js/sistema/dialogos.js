// ═══════════════════════════════════════════════════════════
// sistema/dialogos.js — motor de diálogo:
// typewriter letra a letra, botón saltar, opciones de respuesta,
// retrato/holograma por hablante. Datos: datos/dialogues.json.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';
import { estado, Fases, Modos } from './estado.js';
import { telemetria } from './telemetria.js';
import { voz } from './vozDialogos.js';
import { conNombre } from './arquitecto.js';

const $ = id => document.getElementById(id);
const VELOCIDAD = 24; // ms por letra (cuando no hay voz)

// Sincronía texto ↔ voz: el texto se escribe repartido en la duración del audio.
const AJUSTE_VOZ = 0.9; // 1.0 = el texto termina justo cuando acaba la voz; menos = más rápido
const MS_MIN = 15;      // límites de velocidad por letra
const MS_MAX = 120;

const NOMBRES = Object.freeze({
  aria: 'ARIA · IA MENTORA',
  gustaff: 'DR. GUSTAFF · REGISTRO',
  eclipse: 'ECLIPSE · AMENAZA',
  sistema: 'SISTEMA',
  narrador: '',
});

export const dialogos = {
  /** @type {{dialogos:Object, pistas:Object}|null} */
  datos: null,
  nodo: null,
  alTerminar: null,
  escribiendo: false,
  _timer: 0,

  /** Carga dialogues.json y conecta la UI. */
  async iniciar(){
    const res = await fetch('datos/dialogues.json');
    if (!res.ok) throw new Error('No se pudo cargar datos/dialogues.json');
    this.datos = await res.json();
    bus.suscribir(EVENTOS.EDITOR_CERRADO, () => { this._modoPrevio = null; });

    $('panel-dialogo').addEventListener('click', e => {
      if (e.target.closest('#btn-saltar') || e.target.closest('.opcion')) return;
      this.avanzar();
    });
    $('btn-saltar').addEventListener('click', e => { e.stopPropagation(); this.saltar(); });

    document.addEventListener('keydown', e => {
      if (estado.modo !== Modos.DIALOGO) return;
      if (e.code === 'Enter' || e.code === 'Space'){ e.preventDefault(); this.avanzar(); }
    });
  },

  /** @param {string} id */
  dialogoPorId(id){ return this.datos?.dialogos?.[id] ?? null; },
  /** @param {string} nivelId @returns {string[]} */
  pistasDe(nivelId){ return this.datos?.pistas?.[nivelId] ?? []; },

  /**
   * Abre un diálogo por id (sigue la cadena `siguiente`/`opciones`).
   * @param {string} id
   * @param {() => void} [alTerminar]
   */
  abrirPorId(id, alTerminar){
    const nodo = this.dialogoPorId(id);
    if (!nodo){
      console.warn(`[dialogos] Diálogo «${id}» no existe`);
      alTerminar?.();
      return;
    }
    this._abrir(nodo, alTerminar);
  },

  /**
   * Abre un nodo efímero (p. ej. una pista).
   * @param {{id:string, hablante:string, texto:string}} nodo
   * @param {() => void} [alTerminar]
   */
  abrirNodo(nodo, alTerminar){ this._abrir(nodo, alTerminar); },

  _abrir(nodo, alTerminar){
    this.alTerminar = alTerminar ?? null;
    // recuerda el modo anterior (p. ej. EDITOR) para volver a él al terminar
    if (estado.modo !== Modos.DIALOGO) this._modoPrevio = estado.modo;
    estado.cambiarModo(Modos.DIALOGO); // bloquea el movimiento del jugador
    try { document.exitPointerLock(); } catch {}
    telemetria.registrar('dialogo_abierto', { dialogo: nodo.id });
    bus.emitir(EVENTOS.DIALOGO_ABIERTO, { id: nodo.id });
    this._mostrar(nodo);
  },

  _mostrar(original){
    // el texto lleva el nombre del jugador; la voz sigue diciendo «Arquitecto»
    const nodo = { ...original, texto: conNombre(original.texto) };
    const nodoVoz = { ...original, texto: conNombre(original.texto, 'Arquitecto') };
    this.nodo = nodo;
    const panel = $('panel-dialogo');
    panel.classList.remove('oculto');
    panel.classList.toggle('modo-cine', nodo.hablante === 'narrador');
    $('dialogo-retrato').className = `retrato retrato-${nodo.hablante}`;
    $('dialogo-nombre').textContent = NOMBRES[nodo.hablante] ?? String(nodo.hablante).toUpperCase();
    $('dialogo-opciones').innerHTML = '';
    $('dialogo-continuar').classList.add('oculto');

    // El texto espera a que la voz empiece para repartirse en su duración.
    clearInterval(this._timer);
    this.escribiendo = true;
    $('dialogo-texto').textContent = '';
    voz.reproducir(nodoVoz).then(dur => {
      if (this.nodo !== nodo || !this.escribiendo) return; // ya avanzaron u omitieron
      const ms = dur
        ? Math.min(MS_MAX, Math.max(MS_MIN, (dur * 1000 * AJUSTE_VOZ) / nodo.texto.length))
        : VELOCIDAD;
      this._escribir(nodo.texto, ms);
    });
  },

  /** Efecto letra a letra. @param {string} texto @param {number} [ms] ms por letra */
  _escribir(texto, ms = VELOCIDAD){
    clearInterval(this._timer);
    this.escribiendo = true;
    const el = $('dialogo-texto');
    el.classList.add('tecleando');
    el.textContent = '';
    let i = 0;
    this._timer = setInterval(() => {
      i++;
      el.textContent = texto.slice(0, i);
      if (i >= texto.length) this._finEscritura();
    }, ms);
  },

  _finEscritura(){
    clearInterval(this._timer);
    this.escribiendo = false;
    $('dialogo-texto').classList.remove('tecleando');
    const nodo = this.nodo;
    if (nodo.opciones?.length){
      const caja = $('dialogo-opciones');
      nodo.opciones.forEach((op, i) => {
        const btn = document.createElement('button');
        btn.className = 'opcion';
        btn.textContent = `${i + 1}. ${conNombre(op.texto)}`;
        btn.addEventListener('click', e => { e.stopPropagation(); this._elegir(op); });
        caja.appendChild(btn);
      });
    } else {
      const cont = $('dialogo-continuar');
      const esCine = nodo.hablante === 'narrador';
      cont.textContent = esCine ? '▼' : (nodo.siguiente ? '▼ CONTINUAR' : '▼ CERRAR');
      cont.classList.remove('oculto');
    }
  },

  /** Avanzar: completa la línea si está escribiendo; si no, pasa al siguiente nodo. */
  avanzar(){
    if (!this.nodo) return;
    if (this.escribiendo){
      clearInterval(this._timer);
      $('dialogo-texto').textContent = this.nodo.texto;
      this._finEscritura();
      return;
    }
    if (this.nodo.opciones?.length) return; // obliga a elegir
    if (this.nodo.siguiente){
      const nodo = this.dialogoPorId(this.nodo.siguiente);
      if (nodo){ this._mostrar(nodo); return; }
    }
    this._terminar();
  },

  /** Saltar: completa la línea actual; si ya está completa, salta el resto del diálogo. */
  saltar(){
    if (this.escribiendo){ this.avanzar(); return; }
    this._terminar();
  },

  /** @param {{texto:string, siguiente?:string, alElegir?:() => void}} op */
  _elegir(op){
    // una opción puede traer su propia acción (p. ej. valorar una pista)
    try { op.alElegir?.(); } catch (e) { console.warn('[dialogos] alElegir falló', e); }
    if (op.siguiente){
      const nodo = this.dialogoPorId(op.siguiente);
      if (nodo){ this._mostrar(nodo); return; }
    }
    this._terminar();
  },

  _terminar(){
    clearInterval(this._timer);
    this.escribiendo = false;
    this.nodo = null;
    $('panel-dialogo').classList.add('oculto');
    if (estado.fase !== Fases.NIVEL) estado.cambiarModo(Modos.PAUSA);
    else if (this._modoPrevio === Modos.EDITOR) estado.cambiarModo(Modos.EDITOR); // el diálogo salió desde el editor
    this._modoPrevio = null;
    const cb = this.alTerminar;
    this.alTerminar = null;
    bus.emitir(EVENTOS.DIALOGO_TERMINADO, {});
    if (cb) cb();
  },
};