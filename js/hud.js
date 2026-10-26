import { CONFIG } from './config.js';
import { TEXTOS } from '../datos/textos.js';

export class HUD {
  constructor(){
    const $ = id => document.getElementById(id);
    this.raiz        = $('hud');
    this.panelEstado = $('panel-estado');
    this.vidaNum     = $('vida-num');
    this.vidaFill    = $('vida-fill');
    this.resFill     = $('res-fill');
    this.fpsNum      = $('fps-num');
    this.msNum       = $('ms-num');
    this.posNum      = $('pos-num');
    this.avisoEl     = $('aviso');
    this.flashEl     = $('flash-dano');
    this.nivelNum    = $('hud-nivel-num');
    this.nivelNombre = $('hud-nivel-nombre');
    this.nivelSector = $('hud-nivel-sector');
    this.herrCaja    = $('hud-herramientas');
    this.pistasInfo  = $('pistas-info');
    this.registrosEl = $('hud-registros');
    this.promptReg   = $('aviso-registro');
    this.misionResumen = $('mision-resumen');
    this.misionDetalle = $('mision-detalle');
    this.misionToggle  = $('mision-toggle');
    this.herrToggle    = $('herramientas-toggle');
    this.herrCajaPanel = $('hud-herramientas-panel');
    this.modoLibreEl   = $('modo-libre');
    // zona 3: progreso del nivel
    this.panelProgreso = $('panel-progreso');
    this.progFill      = $('prog-fill');
    this.progNum       = $('prog-num');
    $('etq-progreso').textContent = TEXTOS.hud.progreso;

    this._misionAbierta = false;
    this._herrAbiertas = false;
    this._objetivos = [];   // [{ id, descripcion, hecho }]
    this._objTotal = 0;
    this._objHechos = 0;
    this._vida = -1; this._res = -1; this._fps = -1; this._pos = ''; this._peligro = false;
    this._ms = 0;
    this._conectarBotones();
    this._actualizarResumen();
  }

  _conectarBotones(){
    this.misionToggle?.addEventListener('click', e => {
      e.stopPropagation();
      this.alternarMision();
    });
    this.herrToggle?.addEventListener('click', e => {
      e.stopPropagation();
      this._herrAbiertas = !this._herrAbiertas;
      this.herrCajaPanel.classList.toggle('abierto', this._herrAbiertas);
      this.herrToggle.classList.toggle('abierto', this._herrAbiertas);
    });
  }

  /** Abre/cierra el detalle de la misión (botón ▾ o tecla M). */
  alternarMision(){
    this._misionAbierta = !this._misionAbierta;
    this.misionDetalle.classList.toggle('abierto', this._misionAbierta);
    this.misionToggle?.classList.toggle('abierto', this._misionAbierta);
  }

  mostrar(v){ this.raiz.classList.toggle('oculto', !v); }

  /** Sustituye el resumen de misión por un texto libre (p. ej. en la Plaza de Cristales). */
  setResumenLibre(texto){ this.misionResumen.textContent = texto; }

  /** Indicador de modo puntero libre. */
  setModoLibre(v){ this.modoLibreEl?.classList.toggle('visible', v); }

  setVida(v){
    const r = Math.max(0, Math.ceil(v));
    if (r === this._vida) return;
    this._vida = r;
    this.vidaNum.textContent = r;
    this.vidaFill.style.width = (v / CONFIG.jugador.vidaMax * 100) + '%';
    this.panelEstado.classList.toggle('vida-baja', v < 30);
    this.panelEstado.classList.toggle('vida-media', v >= 30 && v < 60);
  }

  setResistencia(v){
    const r = Math.round(v);
    if (r === this._res) return;
    this._res = r;
    this.resFill.style.width = (v / CONFIG.jugador.resistenciaMax * 100) + '%';
    this.panelEstado.classList.toggle('agotado', v <= .5);
  }

  /** @param {import('../datos/niveles.js').LevelConfig} config */
  setNivel(config){
    if (!config) return;
    this.nivelNum.textContent = `N${config.numero}`;
    this.nivelNombre.textContent = config.titulo;
    this.nivelSector.textContent = config.sector;
    this.misionDetalle.innerHTML = '';
    this._objetivos = [];
    for (const obj of config.objetivos ?? []){
      const li = document.createElement('li');
      li.textContent = obj.descripcion;
      li.dataset.id = obj.id;
      this.misionDetalle.appendChild(li);
      this._objetivos.push({ id: obj.id, descripcion: obj.descripcion, hecho: false });
    }
    this._objTotal = this._objetivos.length;
    this._objHechos = 0;
    this._actualizarResumen();
  }

  /** Zona 2: siguiente objetivo pendiente. Zona 3: barra y contador. */
  _actualizarResumen(){
    const total = this._objetivos.length;
    const hechos = this._objetivos.filter(o => o.hecho).length;
    const sig = this._objetivos.find(o => !o.hecho);
    this._objTotal = total;
    this._objHechos = hechos;

    this.misionResumen.textContent = total === 0 ? ''
      : sig ? `▸ ${sig.descripcion}`
      : `✓ ${TEXTOS.hud.objetivos} ${hechos}/${total}`;

    this.progNum.textContent = `${hechos}/${total}`;
    this.progFill.style.width = total ? `${Math.round(100 * hechos / total)}%` : '0%';
    this.panelProgreso.classList.toggle('sin-objetivos', total === 0);
  }

  /** Marca objetivos completados (se llama al recibir OBJECTIVE_COMPLETED). */
  marcarObjetivo(id){
    const li = this.misionDetalle?.querySelector(`li[data-id="${id}"]`);
    if (!li || li.classList.contains('completado')) return;
    li.classList.add('completado');
    const o = this._objetivos.find(x => x.id === id);
    if (o) o.hecho = true;
    this._actualizarResumen();
  }

  /** @param {{def: Object, desbloqueada: boolean}[]} items */
  setHerramientas(items){
    this.herrCaja.innerHTML = '';
    this.herrCajaPanel.innerHTML = '';
    for (const item of items){
      const chipCorto = document.createElement('span');
      chipCorto.className = 'herr-mini' + (item.desbloqueada ? '' : ' bloqueada');
      chipCorto.textContent = item.desbloqueada ? '✓' : '🔒';
      chipCorto.title = item.def.nombre;
      this.herrCaja.appendChild(chipCorto);

      const chipLargo = document.createElement('div');
      chipLargo.className = 'herr-fila' + (item.desbloqueada ? '' : ' bloqueada');
      chipLargo.innerHTML = `<b>${item.desbloqueada ? '' : '🔒 '}${item.def.nombre}</b><span>${item.def.descripcion}</span>`;
      this.herrCajaPanel.appendChild(chipLargo);
    }
  }

  setPistas(usadas, total){ this.pistasInfo.textContent = `${usadas}/${total}`; }
  setRegistros(recogidos, total){
    this.registrosEl.textContent = `${TEXTOS.hud.registros}: ${recogidos}/${total}`;
  }
  mostrarPromptRegistro(v){ this.promptReg.classList.toggle('oculto', !v); }

  setEstado(corriendo){ this.raiz.classList.toggle('corriendo', corriendo); }
  setPeligro(v){
    if (v === this._peligro) return;
    this._peligro = v;
    this.raiz.classList.toggle('peligro', v);
  }

  setFps(fps, ms){
    const r = Math.round(fps);
    if (r === this._fps && Math.abs(ms - this._ms) < .5) return;
    this._fps = r; this._ms = ms;
    this.fpsNum.textContent = r;
    this.msNum.textContent = ms.toFixed(0);
    this.fpsNum.classList.toggle('fps-medio', r < 50 && r >= 30);
    this.fpsNum.classList.toggle('fps-bajo', r < 30);
  }

  setPos(x, z){
    const s = `${x.toFixed(0)},${z.toFixed(0)}`;
    if (s === this._pos) return;
    this._pos = s;
    this.posNum.textContent = s;
  }

  flashDano(){ this._animar(this.flashEl, 'activo'); }

  avisar(texto){
    this.avisoEl.textContent = texto;
    this._animar(this.avisoEl, 'visible');
  }

  _animar(el, clase){
    el.classList.remove(clase);
    void el.offsetWidth;
    el.classList.add(clase);
  }
}