// ═══════════════════════════════════════════════════════════
// sistema/pantallas.js — intro, resultado, cierre y panel debug.
// Solo renderiza y emite eventos UI; la lógica vive en main.js.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';
import { TEXTOS, formatear } from '../../datos/textos.js';
import { progreso } from './progreso.js';
import { HERRAMIENTAS } from '../../datos/herramientas.js';
import { logroPorId } from '../../datos/logros.js';
import { emblemasDesbloqueadosEn } from './arquitecto.js';
import { rangoFinal } from './rango.js';

const $ = id => document.getElementById(id);

export const pantallas = {
  _logrosNivel: [],       // logros ganados desde que empezó el nivel actual
  _resultadoCompleto: null,

  iniciar(){
    // textos estáticos desde datos
    $('btn-comenzar').textContent = TEXTOS.intro.boton;
    $('etq-res-desglose').textContent = TEXTOS.resultado.etDesglose;
    $('btn-repetir').textContent = TEXTOS.resultado.botonRepetir;
    $('btn-menu-r').textContent = TEXTOS.resultado.botonMenu;
    $('btn-menu-c').textContent = TEXTOS.cierre.botonMenu;
    $('btn-reinicio').textContent = TEXTOS.cierre.botonReiniciar;
    $('cierre-titulo').textContent = TEXTOS.cierre.titulo;
    $('cierre-texto').textContent = TEXTOS.cierre.texto;
    $('cierre-marca').textContent = TEXTOS.cierre.marca;
    $('etq-res-aprendido').textContent = TEXTOS.aprendizaje.etiqueta;
    $('etq-res-premios').textContent = TEXTOS.aprendizaje.etiquetaPremios;
    $('etq-cierre-logros').textContent = TEXTOS.aprendizaje.etiquetaLogrosCierre;

    // logros nuevos del nivel en curso (para la pantalla de resultado)
    bus.suscribir(EVENTOS.LEVEL_STARTED, () => { this._logrosNivel = []; });
    bus.suscribir(EVENTOS.ACHIEVEMENT_UNLOCKED, ({ id }) => {
      this._logrosNivel.push(id);
      this._pintarPremios(); // si el resultado ya está en pantalla, se actualiza
    });

    // emisión de eventos UI
    $('btn-comenzar').addEventListener('click', () => bus.emitir(EVENTOS.UI_INICIAR_NIVEL));
    $('btn-siguiente').addEventListener('click', () => bus.emitir(EVENTOS.UI_SIGUIENTE));
    $('btn-repetir').addEventListener('click', () => bus.emitir(EVENTOS.UI_REPETIR));
    $('btn-menu-r').addEventListener('click', () => bus.emitir(EVENTOS.UI_MENU));
    $('btn-menu-c').addEventListener('click', () => bus.emitir(EVENTOS.UI_MENU));
    $('btn-reinicio').addEventListener('click', () => bus.emitir(EVENTOS.UI_DEBUG, { accion: 'reset' }));

    $('btn-controles').addEventListener('click', () => {
      this._setControles($('intro-controles').classList.contains('oculto'));
    });

    $('debug').addEventListener('click', e => {
      const btn = e.target.closest('button[data-accion]');
      if (!btn) return;
      bus.emitir(EVENTOS.UI_DEBUG, {
        accion: btn.dataset.accion,
        nivel: btn.dataset.nivel !== undefined ? Number(btn.dataset.nivel) : undefined,
      });
    });
  },

  /** @param {import('../../datos/niveles.js').LevelConfig} config */
  mostrarIntro(config){
    $('intro-marca').textContent = formatear(TEXTOS.intro.marca, {
      numero: config.numero, sector: config.sector,
    });
    $('intro-titulo').textContent = config.titulo;
    $('intro-contexto').textContent = config.contexto;

    // controles: solo en la intro. Desplegados en el nivel 1; en los demás, tras el botón.
    const caja = $('intro-controles');
    if (!caja) return;
    caja.innerHTML = '';
    for (const c of TEXTOS.ui.controles){
      const div = document.createElement('div');
      div.className = 'ctrl-item';
      const kbd = document.createElement('kbd');
      kbd.textContent = c.tecla;
      div.appendChild(kbd);
      div.appendChild(document.createTextNode(c.accion));
      caja.appendChild(div);
    }
    this._setControles(config.numero === 1);
  },

  /** Despliega o pliega la lista de controles de la intro. */
  _setControles(abierto){
    $('intro-controles').classList.toggle('oculto', !abierto);
    $('btn-controles').textContent = TEXTOS.ui.botonControles + (abierto ? ' ▴' : ' ▾');
  },

  /**
   * @param {{config:Object, completado:boolean, segundos?:number, puntos?:number, motivo?:string}} resultado
   * @param {boolean} esUltimo
   */
  mostrarResultado(resultado, esUltimo){
    const t = TEXTOS.resultado;
    $('resultado-titulo').textContent = resultado.completado ? t.tituloOk : t.tituloFail;
    $('resultado-mensaje').textContent = resultado.completado
      ? formatear(t.mensajeOk, { nombre: resultado.config.titulo })
      : formatear(t.mensajeFail, { motivo: resultado.motivo ?? 'desconocido' });
    $('res-puntos').textContent = String(resultado.puntos ?? 0);
    $('res-tiempo').textContent = `${resultado.segundos ?? 0} s`;
    $('res-objetivos').textContent = resultado.completado ? '✓' : '—';
    const nEstrellas = resultado.completado ? (resultado.estrellas ?? 0) : 0;
    const cajaEstrellas = $('res-estrellas'); // si index.html aún no lo tiene, simplemente no se pinta
    if (cajaEstrellas){
      cajaEstrellas.textContent = nEstrellas ? '★'.repeat(nEstrellas) + '☆'.repeat(3 - nEstrellas) : '';
      cajaEstrellas.setAttribute('aria-label', nEstrellas ? `${nEstrellas} de 3 estrellas` : '');
    }
    this._pintarDesglose(resultado);
    $('btn-siguiente').textContent = esUltimo ? t.botonFinalizar : t.botonSiguiente;
    $('btn-siguiente').classList.toggle('oculto', !resultado.completado);
    this._resultadoCompleto = resultado.completado ? resultado : null;
    this._pintarAprendido();
    this._pintarPremios();
  },

  /** Mensaje breve con los temas de programación del nivel superado. */
  _pintarAprendido(){
    const datos = TEXTOS.aprendizaje.niveles[this._resultadoCompleto?.config?.id];
    $('res-aprendido-caja').classList.toggle('oculto', !datos);
    if (!datos) return;
    $('res-aprendido-texto').textContent = datos.resumen;
    $('res-aprendido-temas').textContent = datos.temas.join(' · ');
  },

  /** Herramienta que desbloquea el nivel + logros ganados en él. */
  _pintarPremios(){
    const lista = $('res-premios');
    lista.innerHTML = '';
    const items = [];
    const nivelId = this._resultadoCompleto?.config?.id;
    if (nivelId){
      for (const h of HERRAMIENTAS){
        if (h.desbloqueadaEn === nivelId) items.push({ etq: TEXTOS.aprendizaje.herramienta, nombre: h.nombre, desc: h.descripcion });
      }
      for (const e of emblemasDesbloqueadosEn(nivelId)){
        items.push({ etq: TEXTOS.aprendizaje.emblema, nombre: `${e.icono} ${e.nombre}`, desc: TEXTOS.aprendizaje.emblemaDesc });
      }
      for (const id of this._logrosNivel){
        const l = logroPorId(id);
        if (l) items.push({ etq: TEXTOS.aprendizaje.logro, nombre: l.nombre, desc: l.descripcion });
      }
    }
    $('res-premios-caja').classList.toggle('oculto', items.length === 0);
    for (const it of items){
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = `${it.etq}: ${it.nombre}`;
      const s = document.createElement('span');
      s.textContent = it.desc;
      li.append(b, s);
      lista.appendChild(li);
    }
  },

  /** Lista de dónde salen los puntos (solo si el nivel se completó). */
  _pintarDesglose(resultado){
    const caja = $('res-desglose-caja');
    const lista = $('res-desglose');
    lista.innerHTML = '';
    const items = resultado.completado ? (resultado.desglose ?? []) : [];
    caja.classList.toggle('oculto', items.length === 0);
    const reglas = resultado.config?.puntuacion?.reglas ?? [];
    for (const d of items){
      const li = document.createElement('li');
      const nombre = document.createElement('span');
      nombre.textContent = reglas.find(r => r.id === d.id)?.descripcion ?? d.id;
      const pts = document.createElement('b');
      pts.textContent = d.puntos > 0 ? `+${d.puntos}` : `−${Math.abs(d.puntos)}`;
      if (d.puntos < 0) li.classList.add('neg');
      li.appendChild(nombre);
      li.appendChild(pts);
      lista.appendChild(li);
    }
  },

  /** @param {number} puntosTotales */
  mostrarCierre(puntosTotales){
    $('cierre-puntos').textContent = String(puntosTotales);

    // rango final según las estrellas de los cinco sectores (el bloque se crea aquí: no requiere cambios en index.html)
    const C = TEXTOS.cierre;
    const { rango, estrellas, maxEstrellas } = rangoFinal();
    let cajaRango = $('cierre-rango');
    if (!cajaRango){
      cajaRango = document.createElement('div');
      cajaRango.id = 'cierre-rango';
      $('cierre-puntos').closest('p').after(cajaRango);
    }
    cajaRango.innerHTML = '';
    const etqRango = document.createElement('div');
    etqRango.className = 'etq';
    etqRango.textContent = C.etiquetaRango;
    const linRango = document.createElement('p');
    linRango.className = 'contexto';
    const nomRango = document.createElement('b');
    nomRango.textContent = rango.nombre;
    linRango.append(nomRango, document.createTextNode(` · ★ ${formatear(C.estrellas, { n: estrellas, max: maxEstrellas })}`));
    const txtRango = document.createElement('p');
    txtRango.className = 'mini';
    txtRango.textContent = rango.texto;
    const pistaPlaza = document.createElement('p');
    pistaPlaza.className = 'mini';
    pistaPlaza.textContent = C.pistaPlaza;
    cajaRango.append(etqRango, linRango, txtRango, pistaPlaza);
    const guion = $('cierre-guion');
    guion.innerHTML = '';
    for (const linea of TEXTOS.cierre.guion){
      const p = document.createElement('p');
      p.innerHTML = `<b>${linea.autor}</b> — ${linea.texto}`;
      guion.appendChild(p);
    }
    const conceptos = $('cierre-conceptos');
    conceptos.innerHTML = '';
    for (const c of TEXTOS.cierre.conceptos){
      const li = document.createElement('li');
      li.textContent = c;
      conceptos.appendChild(li);
    }
    const lg = $('cierre-logros');
    lg.innerHTML = '';
    const ganados = progreso.datos.logros.map(logroPorId).filter(Boolean);
    for (const l of ganados){
      const li = document.createElement('li');
      li.textContent = `🏆 ${l.nombre}`;
      lg.appendChild(li);
    }
    if (!ganados.length){
      const li = document.createElement('li');
      li.textContent = TEXTOS.aprendizaje.sinLogros;
      lg.appendChild(li);
    }
    const creditos = $('cierre-creditos');
    creditos.innerHTML = '';
    for (const cr of TEXTOS.cierre.creditos){
      const li = document.createElement('li');
      li.textContent = cr;
      creditos.appendChild(li);
    }
  },

  /** @param {boolean} v @param {{renderer:THREE.WebGLRenderer}} [ctx] */
  toggleDebug(v, ctx = null){
    document.getElementById('debug').classList.toggle('oculto', !v);
    if (!v){ cancelAnimationFrame(this._rafDebug); return; }
    this._ctxDebug = ctx;
    const loop = () => {
      if (!document.getElementById('debug').classList.contains('oculto') && ctx){
        const i = ctx.renderer.info;
        document.getElementById('dbg-fps').textContent = `FPS ${ctx.hudFps?.toFixed(0) ?? '—'}`;
        document.getElementById('dbg-ms').textContent = `MS ${ctx.hudMs?.toFixed(1) ?? '—'}`;
        document.getElementById('dbg-render').textContent =
          `draws ${i.render.calls} · tris ${i.render.triangles} · points ${i.render.points}`;
        document.getElementById('dbg-mem').textContent =
          `geom ${i.memory.geometries} · tex ${i.memory.textures}`;
        document.getElementById('dbg-prog').textContent =
          `programs ${i.programs?.length ?? 0}`;
      }
      this._rafDebug = requestAnimationFrame(loop);
    };
    loop();
  },
};