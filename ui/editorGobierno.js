// ═══════════════════════════════════════════════════════════
// ui/editorGobierno.js — panel plug-and-play: la interfaz es un
// socket; las clases son componentes que se enchufan.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from '../js/sistema/eventos.js';
import { estado, Modos } from '../js/sistema/estado.js';
import { parse } from '../js/motor/parser.js';
import { ERRORES_NARRATIVA } from '../datos/errores.js';
import { SUBRETOS_NIVEL5, COMPONENTES } from '../datos/subretos-nivel5.js';
import { telemetria } from '../js/sistema/telemetria.js';
import { crearAyudaAria } from '../js/sistema/ayudaAria.js';

const $ = id => document.getElementById(id);

export class EditorGobierno {
  constructor(){
    this.reto = null;
    this.conectados = new Set();
    this.ejecutando = false;
    this._debounceTimer = null;
    this._ayuda = crearAyudaAria({ pantalla: 'pantalla-editor-gobierno', botonPista: 'btn-gob-pista', consola: (t, c) => this.consola(t, c), subreto: () => this.reto?.actual()?.id });
    this._conectar();
    this._suscribir();
  }

  _conectar(){
    $('btn-gob-ejecutar').addEventListener('click', () => this.ejecutar());
    $('btn-gob-generar').addEventListener('click', () => this.generar(true));
    $('btn-gob-cerrar').addEventListener('click', () => this.cerrar());
    $('btn-gob-pista').addEventListener('click', () => this.pedirPista());
    $('btn-gob-comprobar').addEventListener('click', () => this.comprobarSituaciones());
    $('gob-interfaz').addEventListener('dragover', e => e.preventDefault());
    $('gob-interfaz').addEventListener('drop', e => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!COMPONENTES[id]) return;
      this.conectados.add(id);
      this._pintar();
      this._reprogramarGeneracion();
      this.consola(`🔌 ${COMPONENTES[id].nombre} conectado a IResponsable.`, 'msg-ok');
    });
  }

  _suscribir(){
    bus.suscribir(EVENTOS.MOTOR_ERROR, e => this._mostrarError(e));
    bus.suscribir(EVENTOS.MOTOR_MUNDO, m => {
      if (m.nombre === 'mostrar') this.consola(`📟 ${JSON.stringify(m.resultado)}`, 'msg-mundo');
      if (m.nombre === 'accion') this.consola(`🎬 ${m.resultado}`, 'msg-mundo');
      if (m.nombre === 'eventoResuelto') this.consola(`✔ Evento «${m.resultado}» resuelto.`, 'msg-ok');
      if (m.nombre === 'ciudadRestaurada'){
        this.consola('🌇 Eclipse se disuelve. La ciudad restaurada emerge a tu alrededor. El editor se cerrará: acércate al holograma dorado de Gustaff.', 'msg-ok');
      }
    });
    bus.suscribir(EVENTOS.MOTOR_FIN, f => {
      this.ejecutando = false;
      $('btn-gob-ejecutar').disabled = false;
      telemetria.registrar('ejecucion_codigo', { ok: f.ok, pasos: f.pasos, ms: f.ms, editor: 'gobierno', subreto: this.reto?.actual()?.id, numLineas: $('gob-codigo').value.split('\n').length });
    });
  }

  abrir(reto){
    this.reto = reto;
    $('pantalla-editor-gobierno').classList.remove('oculto');
    this.cargarSubreto(reto.indice() < 0 ? 0 : reto.indice());
  }

  cerrar(){
    $('pantalla-editor-gobierno').classList.add('oculto');
    estado.cambiarModo(Modos.EXPLORANDO);
    bus.emitir(EVENTOS.EDITOR_CERRADO, {});
  }

  cargarSubreto(i){
    const sub = this.reto.cargarSubreto(i);
    $('gob-subreto').textContent = `SUBRETO ${i + 1}/${this.reto.subretos.length}`;
    $('gob-objetivo').innerHTML = `<b>${sub.nombre}</b> · ${sub.concepto}<br>${sub.objetivo}`;
    $('gob-consola').innerHTML = '';
    const esSituaciones = sub.verificar.tipo === 'situaciones';
    $('gob-juego').classList.toggle('oculto', !esSituaciones);
    $('gob-panel').classList.toggle('oculto', esSituaciones);
    if (esSituaciones){ this._montarSituaciones(sub); $('gob-codigo').value = ''; }
    else {
      this.conectados = new Set(sub.presetConectados ?? []);
      this._pintar();
      if (sub.codigoInicial) $('gob-codigo').value = sub.codigoInicial;
      else this.generar(false);
    }
    this._botones();
  }

  /* ── componentes ── */
  _pintar(){
    const sub = this.reto.actual();
    const caja = $('gob-componentes');
    caja.innerHTML = '';
    for (const id of sub.componentesDisponibles ?? []){
      const c = COMPONENTES[id];
      const card = document.createElement('div');
      card.className = 'gob-card' + (this.conectados.has(id) ? ' conectada' : '') + (c.esGlitch ? ' glitch' : '') + (c.nuevo ? ' nueva' : '');
      card.draggable = true;
      card.innerHTML = `<b>${c.nombre}</b><span>${c.esGlitch ? '⚠ entidad inesperada' : c.nuevo ? '✦ tipo nuevo' : 'componente'}</span>`;
      card.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', id));
      caja.appendChild(card);
    }
    // socket de la interfaz
    const socket = $('gob-metodos-interfaz');
    socket.innerHTML = '';
    const fila = document.createElement('div');
    fila.className = 'gob-metodo';
    fila.textContent = 'void responderEmergencia();';
    socket.appendChild(fila);
    $('gob-conectados').textContent = [...this.conectados]
      .map(id => COMPONENTES[id].nombre).join(' · ') || 'nadie conectado';
  }

  /* ── generación de código ── */
  _reprogramarGeneracion(){
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this.generar(false), 120);
  }

  generar(avisar){
    const sub = this.reto.actual();
    let s = 'interface IResponsable {\n  void responderEmergencia();\n}\n\n';
    if (sub.id === 'n5-sr1'){
      // clase de trabajo del sub-reto 1
      s += this.conectados.has('medico')
        ? 'class CiudadanoComun implements IResponsable {\n  texto nombre;\n  constructor(texto nombre) { this.nombre = nombre; }\n  void responderEmergencia() { registrarAccion("ciudadano responde"); }\n}\n\nvar comun = new CiudadanoComun("Común");\nregistrarResponsable(comun);\n'
        : 'class CiudadanoComun implements IResponsable {\n  texto nombre;\n}\n\nvar comun = new CiudadanoComun();\nregistrarResponsable(comun);\n';
      $('gob-codigo').value = s;
      if (avisar) this.consola('⟳ Código generado.', 'msg-mundo');
      return;
    }
    for (const id of this.conectados){
      const c = COMPONENTES[id];
      s += `class ${c.nombre} implements IResponsable {\n`;
      s += '  texto nombre;\n';
      s += '  constructor(texto nombre) { this.nombre = nombre; }\n';
      s += `  void responderEmergencia() {\n    ${c.accion}();\n    registrarAccion("${c.etiqueta}");\n  }\n`;
      s += '}\n\n';
    }
    s += '// coordinador: programa hacia la interfaz, no hacia la implementación\n';
    s += 'function coordinar(equipo) {\n';
    s += '  for (num i = 0; i < equipo.longitud; i = i + 1) {\n';
    s += '    equipo[i].responderEmergencia();\n  }\n}\n\n';
    s += 'var equipo = [\n';
    for (const id of this.conectados){
      const c = COMPONENTES[id];
      s += `  new ${c.nombre}("${c.instancia}"),\n`;
    }
    s += '];\n\ncoordinar(equipo);\nmostrar(estadoGobierno());\n';
    $('gob-codigo').value = s;
    if (avisar) this.consola('⟳ Código generado desde el panel de conexiones.', 'msg-mundo');
  }

  /* ── situaciones abstracta vs interfaz ── */
  _montarSituaciones(sub){
    const caja = $('gob-situaciones');
    caja.innerHTML = '';
    this._respuestas = {};
    sub.situaciones.forEach((sit, i) => {
      const fila = document.createElement('div');
      fila.className = 'relacion-fila';
      fila.innerHTML = `<span>${sit.texto}</span>
        <span class="bins">
          <button data-b="abstracta">CLASE ABSTRACTA</button>
          <button data-b="interfaz">INTERFAZ</button>
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

  comprobarSituaciones(){
    const sub = this.reto.actual();
    let aciertos = 0;
    sub.situaciones.forEach((s, i) => { if (this._respuestas[i] === s.correcta) aciertos++; });
    const res = this.reto.completarSituaciones(aciertos, sub.situaciones.length);
    if (res.superado){
      this.consola(`✔ ${aciertos}/${sub.situaciones.length}.`, 'msg-ok');
      sub.situaciones.forEach(s => this.consola(`— ${s.explicacion}`, 'msg-aria'));
      this._ayuda.acierto();
      this._avanzar();
    } else {
      this.consola(`✖ ${aciertos}/${sub.situaciones.length}. ¿Comparten código (abstracta) o solo una capacidad (interfaz)?`, 'msg-error');
      this._ayuda.fallo();
    }
  }

  /* ── ejecución ── */
  async ejecutar(){
    if (this.ejecutando) return;
    this.ejecutando = true;
    $('btn-gob-ejecutar').disabled = true;
    let ast;
    try { ast = parse($('gob-codigo').value); }
    catch (e){
      this._mostrarError(e);
      this.ejecutando = false;
      $('btn-gob-ejecutar').disabled = false;
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
      // jefe superado: la ciudad se restaura y el editor se cierra para que el jugador
      // la vea. El nivel termina al hablar con el holograma de Gustaff (nucleoGobierno.js).
      setTimeout(() => this.cerrar(), 2500);
      return;
    }
    setTimeout(() => this.cargarSubreto(i + 1), 900);
  }

  pedirPista(){
    const sub = this.reto.actual();
    this._pistasDadas = this._pistasDadas ?? {};
    const dadas = this._pistasDadas[sub.id] ?? 0;
    if (!sub.pistas || dadas >= sub.pistas.length){
      this.consola('🗨 Aria: Ya no me quedan pistas. Confía en el diseño.', 'msg-aria');
      return;
    }
    this.consola(`💡 Aria: ${sub.pistas[dadas]}`, 'msg-aria');
    this._pistasDadas[sub.id] = dadas + 1;
    telemetria.registrar('pista_pedida', { nivel: 'nivel-5', subreto: sub.id, indice: dadas });
  }

  _mostrarError(err){
    const narr = ERRORES_NARRATIVA[err.categoria] ?? ERRORES_NARRATIVA.RUNTIME;
    this.consola(`✖ [${narr.titulo}] ${err.mensaje}`, 'msg-error');
    this.consola(`🗨 Aria: ${narr.aria}`, 'msg-aria');
    this._ayuda.fallo();
  }

  consola(texto, clase = ''){
    const c = $('gob-consola');
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    c.appendChild(p);
    c.scrollTop = c.scrollHeight;
  }

  _botones(){
    const sub = this.reto.actual();
    const esSituaciones = sub.verificar.tipo === 'situaciones';
    $('btn-gob-ejecutar').classList.toggle('oculto', esSituaciones);
    $('btn-gob-generar').classList.toggle('oculto', esSituaciones);
    $('btn-gob-comprobar').classList.toggle('oculto', !esSituaciones);
  }
}