// ═══════════════════════════════════════════════════════════
// ui/editorClases.js — Ficha-molde visual + mini-lenguaje.
// La ficha GENERA código; el textarea es la fuente de verdad y
// se puede editar a mano (transición guiada bloques → texto).
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from '../js/sistema/eventos.js';
import { estado, Modos } from '../js/sistema/estado.js';
import { parse } from '../js/motor/parser.js';
import { ERRORES_NARRATIVA } from '../datos/errores.js';
import { PLANTILLAS_METODOS, SUBRETOS_NIVEL3 } from '../datos/subretos-nivel3.js';
import { telemetria } from '../js/sistema/telemetria.js';
import { crearAyudaAria } from '../js/sistema/ayudaAria.js';

const $ = id => document.getElementById(id);

export class EditorClases { 
  constructor(){
    this.reto = null;
    this.ejecutando = false;
    this.modelo = null;            // ficha actual
    this._subs = [];
    this._ayuda = crearAyudaAria({ pantalla: 'pantalla-editor-clases', botonPista: 'btn-cls-pista', consola: (t, c) => this.consola(t, c), subreto: () => this.reto?.actual()?.id });
    this._conectar();
    this._suscribir();
  }

  _conectar(){
    $('btn-cls-ejecutar').addEventListener('click', () => this.ejecutar());
    $('btn-cls-generar').addEventListener('click', () => this.generarDesdeFicha());
    $('btn-cls-cerrar').addEventListener('click', () => this.cerrar());
    $('btn-cls-pista').addEventListener('click', () => this.pedirPista());
    $('btn-cls-comprobar').addEventListener('click', () => this.comprobarClasificacion());
    // drag & drop de chips
    document.querySelectorAll('#ficha-paleta .chip').forEach(chip => {
      chip.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', chip.dataset.chip));
    });
    for (const zona of ['ficha-atributos', 'ficha-metodos']){
      const el = $(zona);
      el.addEventListener('dragover', e => e.preventDefault());
      el.addEventListener('drop', e => {
        e.preventDefault();
        this._soltarChip(e.dataTransfer.getData('text/plain'), zona);
      });
    }
  }

  _suscribir(){
    this._subs.push(
      bus.suscribir(EVENTOS.MOTOR_ERROR, e => this._mostrarError(e)),
      bus.suscribir(EVENTOS.MOTOR_MUNDO, m => {
        if (m.nombre === 'mostrar') this.consola(`📟 ${JSON.stringify(m.resultado)}`, 'msg-mundo');
        if (m.nombre === 'anunciar') this.consola(`💬 ${m.resultado}`, 'msg-aria');
        if (m.nombre === 'glitchRebotado') this.consola('🛡 El glitch de Eclipse rebotó contra el atributo privado. ¡Encapsulamiento funcionando!', 'msg-ok');
        if (m.nombre === 'medidores'){
          const md = m.resultado;
          $('cls-medidores').textContent =
            `🌾 comida ${md.comida}/4 · ⚙ sistemas ${md.sistemas}/4 · ✚ salud ${md.salud}/4 · 🪙 comercio ${md.comercio}/4`;
        }
      }),
      bus.suscribir(EVENTOS.MOTOR_FIN, f => {
        this.ejecutando = false;
        $('btn-cls-ejecutar').disabled = false;
        telemetria.registrar('ejecucion_codigo', { ok: f.ok, pasos: f.pasos, ms: f.ms, editor: 'clases', subreto: this.reto?.actual()?.id, numLineas: this._numLineas });
      }),
    );
  }

  abrir(reto){
    this.reto = reto;
    $('pantalla-editor-clases').classList.remove('oculto');
    this.cargarSubreto(reto.indice() < 0 ? 0 : reto.indice());
  }

  cerrar(){
    $('pantalla-editor-clases').classList.add('oculto');
    estado.cambiarModo(Modos.EXPLORANDO);
    bus.emitir(EVENTOS.EDITOR_CERRADO, {});
  }

  cargarSubreto(i){
    const sub = this.reto.cargarSubreto(i);
    $('cls-subreto').textContent = `SUBRETO ${i + 1}/${this.reto.subretos.length}`;
    $('cls-objetivo').innerHTML = `<b>${sub.nombre}</b> · ${sub.concepto}<br>${sub.objetivo}`;
    $('cls-consola').innerHTML = '';
    $('cls-clasificacion').classList.toggle('oculto', sub.verificar.tipo !== 'clasificacion');
    $('cls-zona-codigo').classList.toggle('oculto', !!sub.sinCodigo);
    if (sub.verificar.tipo === 'clasificacion') this._montarClasificacion(sub);
    // código inicial del sub-reto (se conserva el textarea si el sub-reto trae vacío)
    if (sub.codigoInicial) $('cls-codigo').value = sub.codigoInicial;
    else if (!$('cls-codigo').value.trim() || sub.fichaInicial) $('cls-codigo').value = '';
    // ficha inicial
    this.modelo = sub.fichaInicial
      ? JSON.parse(JSON.stringify(sub.fichaInicial))
      : null;
    if (this.modelo) this._pintarFicha();
    else { $('ficha-atributos').innerHTML = ''; $('ficha-metodos').innerHTML = ''; $('ficha-nombre').value = 'Ciudadano'; $('ficha-constructor').checked = false; }
    const hayFicha = !!sub.fichaInicial;
    $('ficha-paleta').classList.toggle('oculto', !hayFicha);
    $('ficha-atributos').parentElement.classList.toggle('oculto', !hayFicha);
    $('btn-cls-generar').classList.toggle('oculto', !hayFicha);
    this._botones();
  }

  /* ── ficha de molde ── */
  _pintarFicha(){
    const m = this.modelo;
    $('ficha-nombre').value = m.nombre ?? '';
    $('ficha-constructor').checked = !!m.conConstructor;
    const at = $('ficha-atributos');
    at.innerHTML = '';
    (m.atributos ?? []).forEach((a, i) => at.appendChild(this._filaAtributo(a, i)));
    const mt = $('ficha-metodos');
    mt.innerHTML = '';
    (m.metodos ?? []).forEach((met, i) => mt.appendChild(this._filaMetodo(met, i)));
  }

  _filaAtributo(a, i){
    const fila = document.createElement('div');
    fila.className = 'fila-ficha';
    fila.innerHTML = `
      <label class="chk"><input type="checkbox" data-k="privado" ${a.privado ? 'checked' : ''}> private</label>
      <select data-k="tipo">
        ${['num','texto','bool'].map(t => `<option ${a.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <input data-k="nombre" value="${a.nombre}" placeholder="nombre">
      <input data-k="valor" value="${a.valor ?? ''}" placeholder="inicial">`;
    fila.addEventListener('input', () => {
      a.privado = fila.querySelector('[data-k=privado]').checked;
      a.tipo = fila.querySelector('[data-k=tipo]').value;
      a.nombre = fila.querySelector('[data-k=nombre]').value;
      a.valor = fila.querySelector('[data-k=valor]').value;
    });
    return fila;
  }

  _filaMetodo(met, i){
    const fila = document.createElement('div');
    fila.className = 'fila-ficha';
    fila.innerHTML = `<span class="etq">${met.retorno ?? 'void'} ${met.nombre}(${met.params ?? ''})</span>`;
    return fila;
  }

  _soltarChip(chip, zona){
    if (!this.modelo){
      this.modelo = { nombre: $('ficha-nombre').value || 'Ciudadano', atributos: [], metodos: [], conConstructor: false };
    }
    if (zona === 'ficha-atributos'){
      const tipo = { chipNum: 'num', chipTexto: 'texto', chipBool: 'bool' }[chip];
      if (tipo) this.modelo.atributos.push({ nombre: `atributo${this.modelo.atributos.length + 1}`, tipo, valor: '', privado: false });
    }
    if (zona === 'ficha-metodos'){
      const nombre = { chipTrabajar: 'trabajar', chipDescansar: 'descansar', chipComunicarse: 'comunicarse', chipConstructor: 'constructor' }[chip];
      if (nombre === 'constructor'){ this.modelo.conConstructor = true; }
      else if (nombre) this.modelo.metodos.push({ nombre, retorno: 'void', params: '', plantilla: nombre });
    }
    this._pintarFicha();
  }

  generarDesdeFicha(){
    if (!this.modelo) return;
    const m = this.modelo;
    m.nombre = $('ficha-nombre').value || m.nombre;
    m.conConstructor = $('ficha-constructor').checked;
    let s = `class ${m.nombre} {\n`;
    for (const a of m.atributos){
      const inicial = a.valor !== '' ? (a.tipo === 'texto' ? ` = "${a.valor}"` : ` = ${a.valor}`) : '';
      s += `  ${a.privado ? 'private ' : ''}${a.tipo} ${a.nombre}${inicial};\n`;
    }
    s += '\n';
    if (m.conConstructor){
      const conParam = m.atributos.filter(a => !a.privado && a.valor === '');
      s += `  constructor(${conParam.map(a => `${a.tipo} ${a.nombre}`).join(', ')}) {\n`;
      for (const a of conParam) s += `    this.${a.nombre} = ${a.nombre};\n`;
      s += '  }\n\n';
    }
    for (const met of m.metodos){
      const cuerpo = (PLANTILLAS_METODOS[met.plantilla] ?? '').split('\n').map(l => '    ' + l).join('\n');
      s += `  ${met.retorno} ${met.nombre}(${met.params}) {\n${cuerpo}\n  }\n`;
    }
    s += '}\n';
    $('cls-codigo').value = s;
    this.consola('⟳ Código generado desde la ficha. Puedes editarlo a mano: el texto manda.', 'msg-mundo');
  }

  /* ── clasificación (sub-reto 1) ── */
  _montarClasificacion(sub){
    const caja = $('cls-elementos');
    caja.innerHTML = '';
    this._respuestas = {};
    sub.elementos.forEach((el, i) => {
      const fila = document.createElement('div');
      fila.className = 'elemento-clase';
      fila.innerHTML = `<span>${el.texto}</span>
        <span class="bins">
          <button data-b="clase">CLASE</button>
          <button data-b="objeto">OBJETO</button>
          <button data-b="atributo">ATRIBUTO</button>
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

  comprobarClasificacion(){
    const sub = this.reto.actual();
    let aciertos = 0;
    sub.elementos.forEach((el, i) => { if (this._respuestas[i] === el.respuesta) aciertos++; });
    const res = this.reto.completarClasificacion(aciertos, sub.elementos.length);
    if (res.superado){
      this.consola(`✔ ${aciertos}/${sub.elementos.length} correctas. Aria asiente: «molde, creación y dato».`, 'msg-ok');
      this._ayuda.acierto();
      this._avanzar();
    } else {
      this.consola(`✖ ${aciertos}/${sub.elementos.length}. Revisa: ¿qué es molde, qué existe y qué se guarda?`, 'msg-error');
      this._ayuda.fallo();
    }
  }

  /* ── ejecución ── */
  async ejecutar(){
    if (this.ejecutando) return;
    this.ejecutando = true;
    $('btn-cls-ejecutar').disabled = true;
    const codigo = $('cls-codigo').value;
    this._numLineas = codigo.split('\n').length;
    let ast;
    try { ast = parse(codigo); }
    catch (e){
      this._mostrarError(e);
      this.ejecutando = false;
      $('btn-cls-ejecutar').disabled = false;
      return;
    }
    const res = await this.reto.ejecutar(ast, {});
    if (res.ok && res.superado){
      this.consola(`✔ ¡${this.reto.actual().nombre} superado!`, 'msg-ok');
      this._ayuda.acierto();
      this.consola('🗨 Aria: «Bien. El código ya es tuyo: la ficha solo te ayudó a empezar.»', 'msg-aria');
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
    telemetria.registrar('pista_pedida', { nivel: 'nivel-3', subreto: sub.id, indice: dadas });
  }

  _mostrarError(err){
    const narr = ERRORES_NARRATIVA[err.categoria] ?? ERRORES_NARRATIVA.RUNTIME;
    this.consola(`✖ [${narr.titulo}] ${err.mensaje}`, 'msg-error');
    this.consola(`🗨 Aria: ${narr.aria}`, 'msg-aria');
    this._ayuda.fallo();
  }

  consola(texto, clase = ''){
    const c = $('cls-consola');
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    c.appendChild(p);
    c.scrollTop = c.scrollHeight;
  }

  _botones(){
    const sub = this.reto.actual();
    $('btn-cls-ejecutar').classList.toggle('oculto', !!sub.sinCodigo);
    $('btn-cls-generar').classList.toggle('oculto', !!sub.sinCodigo);
    $('btn-cls-comprobar').classList.toggle('oculto', sub.verificar.tipo !== 'clasificacion');
  }
}