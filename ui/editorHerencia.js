// ═══════════════════════════════════════════════════════════
// ui/editorHerencia.js — diagrama de herencia interactivo:
// flechas es-un, chips de método arrastrables, super() en el
// constructor y panel de código que se actualiza.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from '../js/sistema/eventos.js';
import { estado, Modos } from '../js/sistema/estado.js';
import { parse } from '../js/motor/parser.js';
import { ERRORES_NARRATIVA } from '../datos/errores.js';
import { CHIPS_METODOS, CALENTAMIENTO, SUBRETOS_NIVEL4 } from '../datos/subretos-nivel4.js';
import { telemetria } from '../js/sistema/telemetria.js';
import { crearAyudaAria } from '../js/sistema/ayudaAria.js';

const $ = id => document.getElementById(id);

export class EditorHerencia {
  constructor(){
    this.reto = null;
    this.modelo = null;
    this.modoConectar = false;
    this.hijoPendiente = null;
    this.ejecutando = false;
    this._debounceTimer = null;
    this._ayuda = crearAyudaAria({ pantalla: 'pantalla-editor-herencia', botonPista: 'btn-her-pista', consola: (t, c) => this.consola(t, c), subreto: () => this.reto?.actual()?.id });
    this._conectar();
    this._suscribir();
  }

  _conectar(){
    $('btn-her-ejecutar').addEventListener('click', () => this.ejecutar());
    $('btn-her-generar').addEventListener('click', () => this.generar(true));
    $('btn-her-conectar').addEventListener('click', () => {
      this.modoConectar = !this.modoConectar;
      this.hijoPendiente = null;
      $('btn-her-conectar').classList.toggle('btn-activo', this.modoConectar);
      this.consola(this.modoConectar
        ? '🔗 Modo conectar: clic en la clase HIJA y luego en la PADRE.'
        : '🔗 Modo conectar desactivado.', 'msg-mundo');
    });
    $('btn-her-cerrar').addEventListener('click', () => this.cerrar());
    $('btn-her-pista').addEventListener('click', () => this.pedirPista());
    $('btn-her-comprobar').addEventListener('click', () => this.comprobarRelaciones());
    $('her-calentamiento-ver').addEventListener('click', () => {
      $('her-calentamiento-codigo').classList.toggle('oculto');
    });
    $('her-paleta').addEventListener('dragstart', e => {
      const chip = e.target.closest('.chip');
      if (chip) e.dataTransfer.setData('text/plain', chip.dataset.chip);
    }, true);
  }

  _suscribir(){
    bus.suscribir(EVENTOS.MOTOR_ERROR, e => this._mostrarError(e));
    bus.suscribir(EVENTOS.MOTOR_MUNDO, m => {
      if (m.nombre === 'mostrar') this.consola(`📟 ${JSON.stringify(m.resultado)}`, 'msg-mundo');
      if (m.nombre === 'accion') this.consola(`🎬 Se ejecutó: ${m.resultado}`, 'msg-mundo');
      if (m.nombre === 'anunciar') this.consola(`💬 ${m.resultado}`, 'msg-aria');
      if (m.nombre === 'fuegoApagado') this.consola('🚒 El fuego se extingue entre vapor. ¡Especialización efectiva!', 'msg-ok');
      if (m.nombre === 'heridosCurados') this.consola('✚ Los heridos están atendidos. La Academia respira.', 'msg-ok');
    });
    bus.suscribir(EVENTOS.MOTOR_FIN, f => {
      this.ejecutando = false;
      $('btn-her-ejecutar').disabled = false;
      telemetria.registrar('ejecucion_codigo', { ok: f.ok, pasos: f.pasos, ms: f.ms, editor: 'herencia', subreto: this.reto?.actual()?.id, numLineas: $('her-codigo').value.split('\n').length });
    });
  }

  abrir(reto){
    this.reto = reto;
    $('pantalla-editor-herencia').classList.remove('oculto');
    this.cargarSubreto(reto.indice() < 0 ? 0 : reto.indice());
  }

  cerrar(){
    $('pantalla-editor-herencia').classList.add('oculto');
    estado.cambiarModo(Modos.EXPLORANDO);
    bus.emitir(EVENTOS.EDITOR_CERRADO, {});
  }

  cargarSubreto(i){
    const sub = this.reto.cargarSubreto(i);
    $('her-subreto').textContent = `SUBRETO ${i + 1}/${this.reto.subretos.length}`;
    $('her-objetivo').innerHTML = `<b>${sub.nombre}</b> · ${sub.concepto}<br>${sub.objetivo}`;
    $('her-consola').innerHTML = '';
    // al cambiar de sub-reto se sale del modo conectar
    this.modoConectar = false;
    this.hijoPendiente = null;
    $('btn-her-conectar').classList.remove('btn-activo');
    // calentamiento solo en el sub-reto 1
    $('her-calentamiento').classList.toggle('oculto', !sub.mostrarCalentamiento);
    if (sub.mostrarCalentamiento){
      $('her-calentamiento-titulo').textContent = CALENTAMIENTO.titulo;
      $('her-calentamiento-texto').textContent = CALENTAMIENTO.texto;
      $('her-calentamiento-codigo').textContent = CALENTAMIENTO.codigo;
      $('her-calentamiento-codigo').classList.add('oculto');
    }
    // juego de relaciones o diagrama
    $('her-juego').classList.toggle('oculto', sub.verificar.tipo !== 'relaciones');
    $('her-diagrama').classList.toggle('oculto', sub.verificar.tipo === 'relaciones');
    $('her-paleta').classList.toggle('oculto', !sub.diagrama?.chipsDisponibles?.length);
    if (sub.verificar.tipo === 'relaciones') this._montarRelaciones(sub);
    else this._montarDiagrama(sub);
    if (sub.diagrama) this.generar(false);
    else $('her-codigo').value = '';
    this._botones();
  }

  /* ── relaciones es-un / tiene-un ── */
  _montarRelaciones(sub){
    const caja = $('her-relaciones');
    caja.innerHTML = '';
    this._respuestas = {};
    sub.relaciones.forEach((r, i) => {
      const fila = document.createElement('div');
      fila.className = 'relacion-fila';
      fila.innerHTML = `<span><b>${r.a}</b> — <b>${r.b}</b></span>
        <span class="bins">
          <button data-b="es-un">ES-UN (herencia)</button>
          <button data-b="no-es-un">NO (tiene-un / otra)</button>
        </span>`;
      fila.querySelectorAll('button').forEach(b =>
        b.addEventListener('click', () => {
          fila.querySelectorAll('button').forEach(x => x.classList.remove('activo'));
          b.classList.add('activo');
          this._respuestas[i] = b.dataset.b;
        }));
      caja.appendChild(fila);
    });
  }

  comprobarRelaciones(){
    const sub = this.reto.actual();
    let aciertos = 0;
    sub.relaciones.forEach((r, i) => { if (this._respuestas[i] === r.respuesta) aciertos++; });
    const res = this.reto.completarRelaciones(aciertos, sub.relaciones.length);
    if (res.superado){
      this.consola(`✔ ${aciertos}/${sub.relaciones.length}. La jerarquía mental está lista.`, 'msg-ok');
      this._ayuda.acierto();
      this._avanzar();
    } else {
      this.consola(`✖ ${aciertos}/${sub.relaciones.length}. Recuerda: «tiene-un» no es herencia.`, 'msg-error');
      this._ayuda.fallo();
    }
  }

  /* ── diagrama de herencia ── */

  /** Crea el modelo desde la definición del sub-reto (SOLO al cargar el sub-reto)
      y lo dibuja. Los cambios del jugador viven en this.modelo. */
  _montarDiagrama(sub){
    this.modelo = { raiz: sub.diagrama.raiz, clases: JSON.parse(JSON.stringify(sub.diagrama.clases)) };
    for (const c of this.modelo.clases) c.superEnConstructor = !!c.superPreset;
    // paleta de chips
    const paleta = $('her-paleta');
    paleta.innerHTML = '';
    for (const id of sub.diagrama.chipsDisponibles ?? []){
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.draggable = true;
      chip.dataset.chip = id;
      chip.textContent = CHIPS_METODOS[id].etiqueta;
      paleta.appendChild(chip);
    }
    this._pintarDiagrama();
  }

  /** Redibuja el diagrama desde this.modelo SIN tocar lo que el jugador ya hizo
      (flechas, chips y casillas de super()). */
  _pintarDiagrama(){
    const cont = $('her-diagrama');
    cont.innerHTML = '<svg id="her-flechas"></svg>';
    const raizDiv = document.createElement('div');
    raizDiv.className = 'her-nivel';
    raizDiv.appendChild(this._tarjeta({ nombre: this.modelo.raiz, esRaiz: true }));
    cont.appendChild(raizDiv);
    const hijosDiv = document.createElement('div');
    hijosDiv.className = 'her-nivel her-hijos';
    for (const c of this.modelo.clases) hijosDiv.appendChild(this._tarjeta(c));
    cont.appendChild(hijosDiv);
    requestAnimationFrame(() => this._dibujarFlechas());
  }

  _tarjeta(c){
    const div = document.createElement('div');
    div.className = 'her-tarjeta' + (c.esRaiz ? ' raiz' : '');
    div.dataset.nombre = c.nombre;
    const metodos = (c.chips ?? []).map(id => `<span class="mini-metodo">${CHIPS_METODOS[id].etiqueta}</span>`).join('');
    div.innerHTML = `
      <div class="her-tarjeta-nombre">${c.nombre}</div>
      <div class="her-tarjeta-padre">${c.esRaiz ? 'clase base' : (c.extiende ? 'extends ' + c.extiende : 'sin padre')}</div>
      ${c.esRaiz ? '' : `<label class="chk"><input type="checkbox" class="her-super" ${c.superEnConstructor ? 'checked' : ''}> constructor con super()</label>`}
      <div class="her-metodos">${metodos}</div>`;
    div.addEventListener('click', () => this._clicTarjeta(c, div));
    if (!c.esRaiz){
      div.addEventListener('dragover', e => e.preventDefault());
      div.addEventListener('drop', e => {
        e.preventDefault();
        const chip = e.dataTransfer.getData('text/plain');
        if (!chip || !CHIPS_METODOS[chip]) return;
        c.chips = c.chips ?? [];
        if (!c.chips.includes(chip)) c.chips.push(chip);
        this._pintarDiagrama();
        this._reprogramarGeneracion();
        this.consola(`＋ ${CHIPS_METODOS[chip].etiqueta} añadido a ${c.nombre}.`, 'msg-mundo');
      });
      const chkSuper = div.querySelector('.her-super');
      chkSuper.addEventListener('click', e => e.stopPropagation());
      chkSuper.addEventListener('change', e => {
        c.superEnConstructor = e.target.checked;
        this._reprogramarGeneracion();F
      });
    }
    return div;
  }

  _clicTarjeta(c, div){
    if (!this.modoConectar) return;
    if (!this.hijoPendiente){
      if (c.esRaiz) return; // la raíz solo puede ser padre
      this.hijoPendiente = c;
      div.classList.add('sel');
      this.consola(`Hija seleccionada: ${c.nombre}. Ahora clic en la clase padre.`, 'msg-mundo');
      return;
    }
    if (this.hijoPendiente.nombre === c.nombre){
      c.extiende = null;
      this.hijoPendiente = null;
      this.consola(`✖ ${c.nombre} desconectada.`, 'msg-mundo');
      this._pintarDiagrama();
      this._reprogramarGeneracion();
      return;
    }
    this.hijoPendiente.extiende = c.nombre;
    this.consola(`✔ ${this.hijoPendiente.nombre} extends ${c.nombre} (es-un).`, 'msg-ok');
    this.hijoPendiente = null;
    this._pintarDiagrama();
    this._reprogramarGeneracion();
  }

    _dibujarFlechas(){
    const svg = $('her-flechas');
    const cont = $('her-diagrama');
    if (!svg || !cont || !this.modelo) return;
    svg.setAttribute('width', cont.scrollWidth);
    svg.setAttribute('height', cont.scrollHeight);
    svg.innerHTML = '';
    const base = cont.getBoundingClientRect();
    const abajo = el => {
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left + cont.scrollLeft + r.width / 2, y: r.bottom - base.top + cont.scrollTop };
    };
    const arriba = el => {
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left + cont.scrollLeft + r.width / 2, y: r.top - base.top + cont.scrollTop };
    };
    const NS = 'http://www.w3.org/2000/svg';
    for (const c of this.modelo.clases){
      if (!c.extiende) continue;
      const hijoEl = cont.querySelector(`.her-tarjeta[data-nombre="${c.nombre}"]`);
      const padreEl = cont.querySelector(`.her-tarjeta[data-nombre="${c.extiende}"]`);
      if (!hijoEl || !padreEl) continue;
      const h = arriba(hijoEl);
      const p = abajo(padreEl);
      const linea = document.createElementNS(NS, 'line');
      linea.setAttribute('x1', h.x); linea.setAttribute('y1', h.y);
      linea.setAttribute('x2', p.x); linea.setAttribute('y2', p.y + 10);
      linea.setAttribute('stroke', '#6fb0ff'); linea.setAttribute('stroke-width', '2');
      svg.appendChild(linea);
      const punta = document.createElementNS(NS, 'polygon');
      punta.setAttribute('points', `${p.x},${p.y} ${p.x - 6},${p.y + 10} ${p.x + 6},${p.y + 10}`);
      punta.setAttribute('fill', '#6fb0ff');
      svg.appendChild(punta);
      const etq = document.createElementNS(NS, 'text');
      etq.setAttribute('x', (h.x + p.x) / 2 + 6);
      etq.setAttribute('y', (h.y + p.y) / 2);
      etq.setAttribute('fill', '#9fc6ff');
      etq.setAttribute('font-size', '10');
      etq.textContent = 'es-un';
      svg.appendChild(etq);
    }
  }

  /* ── generación de código ── */
  _reprogramarGeneracion(){
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this.generar(false), 120);
  }

  generar(avisar){
    const sub = this.reto.actual();
    if (!this.modelo || !sub.diagrama) return;
    let s = sub.baseCodigo ?? '';
    for (const c of this.modelo.clases){
      s += `class ${c.nombre}${c.extiende ? ' extends ' + c.extiende : ''} {\n`;
      if (c.superEnConstructor && c.extiende){
        s += '  constructor(texto nombre, num edad, texto profesion) {\n    super(nombre, edad, profesion);\n  }\n';
      }
      for (const chip of c.chips ?? []){
        s += CHIPS_METODOS[chip].codigo.split('\n').map(l => '  ' + l).join('\n') + '\n';
      }
      s += '}\n\n';
    }
    s += '// ── código del reto (edítalo libremente) ──\n' + (sub.snippet ?? '');
    $('her-codigo').value = s;
    if (avisar) this.consola('⟳ Código generado desde el diagrama.', 'msg-mundo');
  }

  /* ── ejecución ── */
  async ejecutar(){
    if (this.ejecutando) return;
    this.ejecutando = true;
    $('btn-her-ejecutar').disabled = true;
    let ast;
    try { ast = parse($('her-codigo').value); }
    catch (e){
      this._mostrarError(e);
      this.ejecutando = false;
      $('btn-her-ejecutar').disabled = false;
      return;
    }
    const res = await this.reto.ejecutar(ast, {});
    if (res.ok && res.superado){
      this.consola(`✔ ¡${this.reto.actual().nombre} superado!`, 'msg-ok');
      this._ayuda.acierto();
      this._avanzar();
    } else if (res.ok){
      this.consola(`…${res.mensaje}`, 'msg-mundo');
      this._ayuda.fallo();
    }
  }

  _avanzar(){
    const i = this.reto.indice();
    if (i >= this.reto.subretos.length - 1){
      // último sub-reto: se cierra el editor y se lanza el final del nivel
      setTimeout(() => {
        this.cerrar();
        this.reto.completarNivel();
      }, 900);
      return;
    }
    setTimeout(() => this.cargarSubreto(i + 1), 900);
  }

  pedirPista(){
    const sub = this.reto.actual();
    this._pistasDadas = this._pistasDadas ?? {};
    const dadas = this._pistasDadas[sub.id] ?? 0;
    if (!sub.pistas || dadas >= sub.pistas.length){
      this.consola('🗨 Aria: Ya no me quedan pistas para esto.', 'msg-aria');
      return;
    }
    this.consola(`💡 Aria: ${sub.pistas[dadas]}`, 'msg-aria');
    this._pistasDadas[sub.id] = dadas + 1;
    telemetria.registrar('pista_pedida', { nivel: 'nivel-4', subreto: sub.id, indice: dadas });
  }

  _mostrarError(err){
    const narr = ERRORES_NARRATIVA[err.categoria] ?? ERRORES_NARRATIVA.RUNTIME;
    this.consola(`✖ [${narr.titulo}] ${err.mensaje}`, 'msg-error');
    this.consola(`🗨 Aria: ${narr.aria}`, 'msg-aria');
    this._ayuda.fallo();
  }

  consola(texto, clase = ''){
    const c = $('her-consola');
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    c.appendChild(p);
    c.scrollTop = c.scrollHeight;
  }

  _botones(){
    const sub = this.reto.actual();
    const esRelaciones = sub.verificar.tipo === 'relaciones';
    $('btn-her-ejecutar').classList.toggle('oculto', esRelaciones);
    $('btn-her-generar').classList.toggle('oculto', esRelaciones);
    $('btn-her-conectar').classList.toggle('oculto', esRelaciones);
    $('btn-her-comprobar').classList.toggle('oculto', !esRelaciones);
  }
}