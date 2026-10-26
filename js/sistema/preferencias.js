// ═══════════════════════════════════════════════════════════
// sistema/preferencias.js — ajustes del jugador: tema de color, fuente,
// tamaño del texto y voz de ARIA. Se guardan en progreso.preferencias
// (sobreviven a «Reiniciar progreso») y se aplican al arrancar.
// Los textos viven en datos/textos.js (TEXTOS.ajustes).
// ═══════════════════════════════════════════════════════════
import { progreso } from './progreso.js';
import { voz } from './vozDialogos.js';
import { TEXTOS } from '../../datos/textos.js';

const $ = id => document.getElementById(id);
const T = TEXTOS.ajustes;

/**
 * Cada grupo del panel. `leer` devuelve el id de la opción activa y
 * `escribir` guarda la opción elegida; la voz es booleana en progreso.
 */
const GRUPOS = [
  { id: 'tema',   textos: T.tema,
    leer: () => progreso.preferencia('tema'),
    escribir: v => progreso.fijarPreferencia('tema', v) },
  { id: 'fuente', textos: T.fuente,
    leer: () => progreso.preferencia('fuente'),
    escribir: v => progreso.fijarPreferencia('fuente', v) },
  { id: 'tamano', textos: T.tamano,
    leer: () => progreso.preferencia('tamano'),
    escribir: v => progreso.fijarPreferencia('tamano', v) },
  { id: 'voz',    textos: T.voz,
    leer: () => progreso.preferencia('vozActiva') === false ? 'silenciada' : 'activada',
    escribir: v => progreso.fijarPreferencia('vozActiva', v === 'activada') },
];

/** Opción que se usa cuando lo guardado no existe (guardados antiguos o alterados). */
const DEFECTO = Object.freeze({ tema: 'neon', fuente: 'original', tamano: 'normal', voz: 'activada' });

/** Devuelve la opción con ese id; si no existe, la del valor por defecto del grupo. */
const opcionValida = (grupo, opciones, id) =>
  opciones.find(o => o.id === id) ?? opciones.find(o => o.id === DEFECTO[grupo]) ?? opciones[0];

export const preferencias = {
  abierto: false,
  _origen: null, // botón que abrió el panel, para devolverle el foco

  iniciar(){
    this._textos();
    this._construir();
    this.aplicar();

    $('btn-ajustes').addEventListener('click', e => this.abrir(e.currentTarget));
    $('btn-ajustes-intro').addEventListener('click', e => this.abrir(e.currentTarget));
    $('aj-cerrar').addEventListener('click', () => this.cerrar());
    $('aj-restablecer').addEventListener('click', () => {
      progreso.restablecerPreferencias();
      this.aplicar();
      this._marcar();
    });
    document.addEventListener('keydown', e => this._teclado(e));
  },

  _textos(){
    $('btn-ajustes').textContent = T.boton;
    $('btn-ajustes-intro').textContent = T.boton;
    $('aj-titulo').textContent = T.titulo;
    $('aj-nota').textContent = T.nota;
    $('aj-cerrar').textContent = T.cerrar;
    $('aj-restablecer').textContent = T.restablecer;
  },

  /** Crea los botones de cada grupo a partir de TEXTOS.ajustes. */
  _construir(){
    const caja = $('aj-grupos');
    caja.innerHTML = '';
    for (const g of GRUPOS){
      const grupo = document.createElement('div');
      grupo.className = 'aj-grupo';

      const etq = document.createElement('div');
      etq.className = 'etq';
      etq.id = `aj-etq-${g.id}`;
      etq.textContent = g.textos.etiqueta;

      const fila = document.createElement('div');
      fila.className = 'aj-opciones';
      fila.setAttribute('role', 'group');
      fila.setAttribute('aria-labelledby', etq.id);

      for (const op of g.textos.opciones){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aj-op';
        btn.dataset.grupo = g.id;
        btn.dataset.valor = op.id;
        if (g.id === 'tema'){
          const muestra = document.createElement('span');
          muestra.className = 'aj-muestra';
          muestra.setAttribute('aria-hidden', 'true');
          btn.appendChild(muestra);
        }
        btn.appendChild(document.createTextNode(op.nombre));
        btn.addEventListener('click', () => {
          g.escribir(op.id);
          this.aplicar();
          this._marcar();
        });
        fila.appendChild(btn);
      }
      grupo.append(etq, fila);
      caja.appendChild(grupo);
    }
    this._marcar();
  },

  /** Marca la opción activa de cada grupo (aria-pressed). */
  _marcar(){
    for (const g of GRUPOS){
      const activo = opcionValida(g.id, g.textos.opciones, g.leer()).id;
      for (const btn of document.querySelectorAll(`.aj-op[data-grupo="${g.id}"]`)){
        btn.setAttribute('aria-pressed', String(btn.dataset.valor === activo));
      }
    }
  },

  /** Vuelca las preferencias guardadas a la página y a la voz. */
  aplicar(){
    const raiz = document.documentElement;
    raiz.dataset.tema = opcionValida('tema', T.tema.opciones, progreso.preferencia('tema')).id;
    raiz.dataset.fuente = opcionValida('fuente', T.fuente.opciones, progreso.preferencia('fuente')).id;
    const tam = opcionValida('tamano', T.tamano.opciones, progreso.preferencia('tamano'));
    raiz.style.setProperty('--zoom-texto', String(tam.valor));
    voz.silenciar(progreso.preferencia('vozActiva') === false);
  },

  abrir(origen = null){
    if (this.abierto) return;
    this.abierto = true;
    this._origen = origen;
    this._marcar();
    $('panel-ajustes').classList.remove('oculto');
    $('aj-grupos').querySelector('.aj-op[aria-pressed="true"]')?.focus();
  },

  cerrar(){
    if (!this.abierto) return;
    this.abierto = false;
    $('panel-ajustes').classList.add('oculto');
    this._origen?.focus();
    this._origen = null;
  },

  /** Escape cierra el panel; Tab se queda dentro mientras está abierto. */
  _teclado(e){
    if (!this.abierto) return;
    if (e.code === 'Escape'){
      e.preventDefault();
      this.cerrar();
      return;
    }
    if (e.code !== 'Tab') return;
    const enfocables = [...$('panel-ajustes').querySelectorAll('button:not([disabled])')];
    if (!enfocables.length) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && document.activeElement === primero){ e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo){ e.preventDefault(); primero.focus(); }
  },
};