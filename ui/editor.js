// ═══════════════════════════════════════════════════════════
// ui/editor.js — consola del Arquitecto: Blockly (N1–N2),
// código equivalente, ejecución animada, predicción y pistas.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from '../js/sistema/eventos.js';
import { estado, Fases, Modos } from '../js/sistema/estado.js';
import { bloquesAAST, descriptorAXml } from '../js/motor/fuenteBloques.js';
import { imprimir, fijarResolvedorNombres } from '../js/motor/imprimir.js';
import { ERRORES_NARRATIVA } from '../datos/errores.js';
import { TEXTOS, formatear } from '../datos/textos.js';
import { telemetria } from '../js/sistema/telemetria.js';
import { analizarCalidad } from '../js/motor/calidad.js';
import { crearAyudaAria } from '../js/sistema/ayudaAria.js';

const $ = id => document.getElementById(id);

/* bloques propios del mundo */
if (window.Blockly){
  Blockly.defineBlocksWithJsonArray([
    { type: 'mover_adelante', message0: 'avanzar', previousStatement: null, nextStatement: null, colour: 260 },
    { type: 'girar', message0: 'girar %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: [['derecha','derecha'],['izquierda','izquierda']] }], previousStatement: null, nextStatement: null, colour: 260 },
    { type: 'recolectar', message0: 'recolectar fragmento', previousStatement: null, nextStatement: null, colour: 160 },
    { type: 'leer_sensor', message0: 'leer sensor', output: null, colour: 190 },
    { type: 'leer_panel', message0: 'leer panel de datos', output: null, colour: 190 },
    { type: 'leer_codigo', message0: 'leer código numérico', output: ['Number'], colour: 190 },
    { type: 'abrir_puerta', message0: 'abrir puerta con %1', args0: [{ type: 'input_value', name: 'CODIGO' }], previousStatement: null, nextStatement: null, colour: 160 },
    { type: 'mostrar_valor', message0: 'mostrar %1', args0: [{ type: 'input_value', name: 'VALOR' }], previousStatement: null, nextStatement: null, colour: 190 },
    { type: 'switch_codigo', message0: 'según el código: | caso 1 %1 caso 2 %2 caso 3 %3',
      args0: [
        { type: 'input_statement', name: 'CASO1' },
        { type: 'input_statement', name: 'CASO2' },
        { type: 'input_statement', name: 'CASO3' },
      ], previousStatement: null, nextStatement: null, colour: 210 },
  ]);

  /* bloques del taller (nivel 2) */
  Blockly.defineBlocksWithJsonArray([
    { type: 'colocar_bloque', message0: 'colocar bloque de altura %1', args0: [{ type: 'input_value', name: 'ALTO', check: 'Number' }], previousStatement: null, nextStatement: null, colour: 130 },
    { type: 'poner_puerta', message0: 'poner puerta', previousStatement: null, nextStatement: null, colour: 35 },
    { type: 'poner_ventana', message0: 'instalar ventana', previousStatement: null, nextStatement: null, colour: 190 },
    { type: 'pedir_recursos', message0: 'pedir recursos: %1', args0: [{ type: 'input_value', name: 'CANTIDAD' }], previousStatement: null, nextStatement: null, colour: 130 },
    { type: 'agregar_material', message0: 'agregar material %1 a la grúa', args0: [{ type: 'input_value', name: 'NOMBRE' }], previousStatement: null, nextStatement: null, colour: 130 },
    { type: 'materiales', message0: 'materiales de la grúa', output: null, colour: 190 },
  ]);
}

const TOOLBOX_N1 = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: 'Acciones', colour: '#7b5cff', contents: [
      { kind: 'block', type: 'mover_adelante' }, { kind: 'block', type: 'girar' },
      { kind: 'block', type: 'recolectar' }, { kind: 'block', type: 'abrir_puerta' },
      { kind: 'block', type: 'mostrar_valor' },
    ]},
    { kind: 'category', name: 'Entrada de Datos', colour: '#3fb6ff', contents: [
      { kind: 'block', type: 'leer_sensor' }, { kind: 'block', type: 'leer_panel' },
      { kind: 'block', type: 'leer_codigo' },
    ]},
    { kind: 'category', name: 'Variables', custom: 'VARIABLE', colour: '#a55eea' },
    { kind: 'category', name: 'Control', colour: '#ffb454', contents: [
      { kind: 'block', type: 'controls_if' }, { kind: 'block', type: 'switch_codigo' },
      { kind: 'block', type: 'controls_repeat_ext' }, { kind: 'block', type: 'controls_whileUntil' },
    ]},
    { kind: 'category', name: 'Operadores', colour: '#58f0a0', contents: [
      { kind: 'block', type: 'logic_compare' }, { kind: 'block', type: 'math_arithmetic' },
      { kind: 'block', type: 'math_number' }, { kind: 'block', type: 'text' },
      { kind: 'block', type: 'logic_boolean' },
    ]},
  ],
};

const TOOLBOX_N2 = {
  kind: 'categoryToolbox',
  contents: [
    { kind: 'category', name: 'Obra', colour: '#5ad08a', contents: [
      { kind: 'block', type: 'mover_adelante' }, { kind: 'block', type: 'girar' },
      // «colocar bloque» sale de la caja con un 1 ya puesto: el hueco nunca queda vacío
      { kind: 'block', type: 'colocar_bloque',
        inputs: { ALTO: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
      { kind: 'block', type: 'poner_puerta' },
      { kind: 'block', type: 'poner_ventana' },
    ]},
    { kind: 'category', name: 'Recursos', colour: '#8a9ba8', contents: [
      { kind: 'block', type: 'pedir_recursos' }, { kind: 'block', type: 'agregar_material' },
      { kind: 'block', type: 'materiales' }, { kind: 'block', type: 'mostrar_valor' },
    ]},
    { kind: 'category', name: 'Variables', custom: 'VARIABLE', colour: '#a55eea' },
    { kind: 'category', name: 'Funciones', custom: 'PROCEDURE', colour: '#58f0a0' },
    { kind: 'category', name: 'Control', colour: '#ffb454', contents: [
      { kind: 'block', type: 'controls_if' }, { kind: 'block', type: 'controls_repeat_ext' },
      { kind: 'block', type: 'controls_for' }, { kind: 'block', type: 'controls_whileUntil' },
    ]},
    { kind: 'category', name: 'Operadores', colour: '#3fb6ff', contents: [
      { kind: 'block', type: 'logic_compare' }, { kind: 'block', type: 'math_arithmetic' },
      { kind: 'block', type: 'math_number' }, { kind: 'block', type: 'text' },
      { kind: 'block', type: 'logic_boolean' },
    ]},
  ],
};
const toolboxPara = nivel => (nivel === 2 ? TOOLBOX_N2 : TOOLBOX_N1);

/* Las categorías dinámicas no tienen bloques individuales: se muestran solo si
   el sub-reto permite el bloque que las representa. */
const CUSTOM_REQUIERE = { VARIABLE: 'variables_set', PROCEDURE: 'procedures_defnoreturn' };

/** Deja en la caja solo los bloques de `permitidos`; sin lista, devuelve la caja completa. */
function filtrarToolbox(toolbox, permitidos){
  if (!permitidos) return toolbox;
  const contents = [];
  for (const cat of toolbox.contents){
    if (cat.custom){
      if (permitidos.includes(CUSTOM_REQUIERE[cat.custom])) contents.push(cat);
      continue;
    }
    const hijos = cat.contents.filter(b => permitidos.includes(b.type));
    if (hijos.length) contents.push({ ...cat, contents: hijos });
  }
  return { ...toolbox, contents };
}

const NOMBRE_BLOQUE = {
  controls_if: 'si / si no',
  variables_set: 'asignar variable',
  switch_codigo: 'según el código',
  controls_repeat_ext: 'repetir',
  controls_whileUntil: 'mientras',
  controls_for: 'contar con',
};

/** descriptorAXml devuelve texto; Blockly espera un elemento DOM. */
const xmlADom = xml => (Blockly.utils?.xml?.textToDom ?? Blockly.Xml.textToDom)(xml);

/** Compara nombres de función sin importar mayúsculas, espacios ni guiones bajos. */
const normNombre = s => String(s ?? '').toLowerCase().replace(/[\s_]/g, '');

export class EditorCodigo {
  constructor(){
    this.workspace = null;
    this.reto = null;
    this.ejecutando = false;
    this.prediccionOk = false;
    this._subs = [];
    this._debounceTimer = null;
    this._reinicioTimer = null;
    this._retoCargado = null;  // reto y sub-reto cuyos bloques están en el workspace
    this._subCargado = -1;
    this._funciones = new Map(); // nombre normalizado → { nombre, dom } (definiciones de función guardadas)
    this._ayuda = crearAyudaAria({ pantalla: 'pantalla-editor', botonPista: 'btn-pista-editor', consola: (t, c) => this.consola(t, c), subreto: () => this.reto?.actual()?.id });
    if (window.Blockly){
      // Blockly mide el texto al crearse: con el panel en display:none lo mide en 0
      // y los bloques/menús salen sin letra. Se muestra antes de inyectar.
      $('pantalla-editor').classList.remove('oculto');

      const temaAlbeacon = Blockly.Theme.defineTheme('albeacon', {
        name: 'albeacon',
        base: Blockly.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: '#0d1226',
          toolboxBackgroundColour: '#0b1020',
          toolboxForegroundColour: '#cfe8ff',
          flyoutBackgroundColour: '#141a30',
          flyoutForegroundColour: '#cfe8ff',
          flyoutOpacity: 1,
          scrollbarColour: '#39406e',
          scrollbarOpacity: 0.7,
          insertionMarkerColour: '#ffffff',
          insertionMarkerOpacity: 0.3,
        },
      });

      this.workspace = Blockly.inject('editor-bloques', {
        toolbox: toolboxPara(estado.nivelActual + 1),
        theme: temaAlbeacon,
        trashcan: true,
        zoom: { controls: true, startScale: 0.9 },
        grid: { spacing: 24, length: 2, colour: '#1c2447', snap: true },
      });
      this._flyoutFijo();
      // nombres reales de variables en el panel de código (Blockly las guarda por ID)
      fijarResolvedorNombres(id => this.workspace?.getVariableById(id)?.name ?? id);

      // Blockly recalcula su tamaño cuando cambia el contenedor (ventana, zoom del navegador)
      new ResizeObserver(() => Blockly.svgResize(this.workspace)).observe($('editor-bloques'));
      this.workspace.addChangeListener(e => {
        // ignorar eventos de UI: selección, arrastre, click en campo
        if (!e || e.type === Blockly.Events.SELECTED ||
            e.type === Blockly.Events.BLOCK_DRAG ||
            e.type === Blockly.Events.CLICK ||
            e.type === Blockly.Events.BLOCK_MOVE && !e.oldParentId && !e.newParentId) return;
        this._reprogramarCodigo();
      });
    }
    this._conectarBotones();
    this._suscribirEventos();
    // window.__editor = this; 
  }

  /** El menú de bloques ya no se cierra al sacar un bloque. */
   /** El menú de bloques ya no se cierra al sacar un bloque y arranca abierto. */
  _flyoutFijo(){
    const tb = this.workspace?.getToolbox?.();
    const f = tb?.getFlyout?.();
    if (f) f.autoClose = false;
    // abre la primera categoría (Mundo / Obra) una vez que Blockly terminó de armar la caja
    setTimeout(() => {
      try { tb?.selectItemByPosition(0); } catch {}
    }, 0);
  } 

  _reprogramarCodigo(){
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._actualizarCodigo(), 120);
  }

  _conectarBotones(){
    $('btn-ejecutar').addEventListener('click', () => this.ejecutar());
    $('btn-detener').addEventListener('click', () => this.detener());
    $('btn-cerrar-editor').addEventListener('click', () => this.cerrar());
    $('btn-pista-editor').addEventListener('click', () => this.pedirPista());
  }

  _suscribirEventos(){
    this._subs.push(
      bus.suscribir(EVENTOS.MOTOR_PASO, p => this._resaltar(p)),
      bus.suscribir(EVENTOS.MOTOR_ERROR, e => this._mostrarError(e)),
      bus.suscribir(EVENTOS.MOTOR_MUNDO, m => {
        if (m.nombre === 'mostrar') this.consola(`📟 ${JSON.stringify(m.args[0])}`, 'msg-mundo');
      }),
      bus.suscribir(EVENTOS.MOTOR_FIN, f => {
        this.ejecutando = false;
        this._botones();
        telemetria.registrar('ejecucion_codigo', { ok: f.ok, pasos: f.pasos, ms: f.ms, subreto: this.reto?.actual()?.id, numBloques: this._numBloques });
      }),
    );
  }

  /** @param {Object} reto — mundo.reto del nivel activo */
  abrir(reto){
    const i = reto.indice() < 0 ? 0 : reto.indice();
    // mismo reto y mismo sub-reto: se vuelve a mostrar el editor tal como estaba
    const mismo = this._retoCargado === reto && this._subCargado === i;
    this.reto = reto;
    $('pantalla-editor').classList.remove('oculto');
    if (this.workspace){
      Blockly.svgResize(this.workspace);     // se creó con el panel oculto
    }
    if (mismo){
      this.workspace.updateToolbox(filtrarToolbox(toolboxPara(estado.nivelActual + 1), reto.actual()?.bloques));
      this._flyoutFijo();
      this._actualizarCodigo();
      this._botones();
      return;
    }
    this.workspace?.updateToolbox(toolboxPara(estado.nivelActual + 1)); // el workspace se reutiliza entre niveles
    this._flyoutFijo();
    this.cargarSubreto(i);
  }

  cerrar(){
    $('pantalla-editor').classList.add('oculto');
    estado.cambiarModo(Modos.EXPLORANDO);
    bus.emitir(EVENTOS.EDITOR_CERRADO, {});
  }

  /** Guarda (por nombre) las definiciones de función que haya ahora en el espacio de trabajo. */
  _guardarFunciones(){
    if (!this.workspace) return;
    for (const b of this.workspace.getTopBlocks(false)){
      if (!/^procedures_def/.test(b.type)) continue;
      const nombre = b.getFieldValue('NAME');
      this._funciones.set(normNombre(nombre), { nombre, dom: Blockly.Xml.blockToDom(b) });
    }
  }

  /** Limpia el espacio y deja solo las funciones guardadas con esos nombres. */
  _restaurarFunciones(nombres){
    this.workspace.clear();
    for (const n of nombres){
      const guardada = this._funciones.get(normNombre(n));
      if (guardada) Blockly.Xml.domToBlock(guardada.dom, this.workspace);
    }
  }

  cargarSubreto(i){
    this._guardarFunciones();   // recuerda las funciones del sub-reto que se acaba de dejar
    const sub = this.reto.cargarSubreto(i);
    this._retoCargado = this.reto;
    this._subCargado = i;
    // caja de herramientas limitada a los bloques de la lección
    this.workspace.updateToolbox(filtrarToolbox(toolboxPara(estado.nivelActual + 1), sub.bloques));
    this._flyoutFijo();
    $('editor-subreto').textContent = formatear(TEXTOS.editor.subreto, { i: i + 1, n: this.reto.subretos.length });
    $('editor-objetivo').innerHTML =
      `<b>${sub.nombre}</b> · ${sub.concepto}<br>${sub.objetivo}` +
      (sub.esJefe ? '<br><span class="jefe">⚠ MINI-JEFE: EL ERROR DE SINTAXIS</span>' : '');
    $('editor-consola').innerHTML = '';
    this.prediccionOk = !sub.prediccion;
    if (sub.programaInicial){
      Blockly.Xml.clearWorkspaceAndLoadFromXml(xmlADom(descriptorAXml(sub.programaInicial)), this.workspace);
      this.consola('⚠ Programa cargado de fábrica: revísalo antes de ejecutar.', 'msg-error');
    } else if (sub.conservarFunciones){
      // espacio limpio, pero con las funciones de retos anteriores que este reto reutiliza
      this._restaurarFunciones(sub.conservarFunciones);
    } else if (!sub.mantenerEspacio){
      this.workspace.clear();
    }
    this._actualizarCodigo();
    this._botones();
    if (sub.prediccion) this._mostrarPrediccion(sub);
  }

  /** Reinicia el mundo del sub-reto actual (robot, fragmentos, puerta) SIN tocar los bloques. */
    /** Reinicia el mundo del sub-reto actual (robot, fragmentos, puerta) SIN tocar los bloques. */
  _reiniciarMundo(){
    clearTimeout(this._reinicioTimer);
    this._huboError = false; // ← NUEVO
    const i = this.reto?.indice?.() ?? -1;
    if (i >= 0) this.reto.cargarSubreto(i);
  }

  _reiniciarMundoConPausa(){
    clearTimeout(this._reinicioTimer);
    // si hubo error, la explosión del robot dura ~2,2 s: no se corta a los 700 ms
    const espera = this._huboError ? 2400 : 700;
    this._huboError = false;
    this._reinicioTimer = setTimeout(() => this._reiniciarMundo(), espera);
  }

  detener(){
    this.reto?.detener?.();
    this._reiniciarMundoConPausa();
  }

  _actualizarCodigo(){
    if (!this.workspace) return;
    try {
      const ast = bloquesAAST(this.workspace);
      $('editor-codigo').textContent = imprimir(ast);
      const n = this.workspace.getAllBlocks(false).length;
      const min = this.reto?.actual()?.minBloques ?? 0;
      $('editor-info').textContent = `${TEXTOS.editor.bloques}: ${n} · ${TEXTOS.editor.minimo}: ${min}`;
    } catch (e){
      $('editor-codigo').textContent = `⚠ ${e.message}`;
    }
  }

  _resaltar(paso){
    if (this.workspace && paso.nodo?.bloqueId){
      try { this.workspace.highlightBlock(paso.nodo.bloqueId); } catch {}
    }
  }

  _mostrarError(err){
    const narr = ERRORES_NARRATIVA[err.categoria] ?? ERRORES_NARRATIVA.RUNTIME;
    this.consola(`✖ [${narr.titulo}] ${err.mensaje ?? err.message ?? 'Error sin descripción'}`, 'msg-error');
    this.consola(`🗨 Aria: ${narr.aria}`, 'msg-aria');
    this._huboError = true; // ← NUEVO: el robot va a explotar, hay que darle tiempo
    this._ayuda.fallo();
  }


    /** Ejecuta `fn` tras 900 ms; si en ese momento Aria está hablando, espera a que termine. */
  _trasDialogo(fn){
    setTimeout(() => {
      if (estado.modo !== Modos.DIALOGO){ fn(); return; }
      let off = null;
      off = bus.suscribir(EVENTOS.DIALOGO_TERMINADO, () => {
        if (typeof off === 'function') off();
        setTimeout(fn, 0); // después de que main.js restaure el modo
      });
    }, 900);
  }

  async ejecutar(){
    if (this.ejecutando) return;
    if (!this.prediccionOk){ this.consola('🗨 Aria: Primero predice el resultado. Sin miedo.', 'msg-aria'); return; }
    // el programa debe usar el bloque clave de la lección
    const usados = this.workspace.getAllBlocks(false).map(b => b.type);
    const faltan = (this.reto.actual()?.requiere ?? []).filter(t => !usados.includes(t));
    if (faltan.length){
      const nombres = faltan.map(t => `«${NOMBRE_BLOQUE[t] ?? t}»`).join(', ');
      this.consola(`🗨 Aria: Este reto exige usar el bloque ${nombres}. Búscalo en la caja de herramientas.`, 'msg-aria');
      return;
    }
    this._reiniciarMundo(); // cada ejecución parte del estado inicial del sub-reto
    this.ejecutando = true;
    this._botones();
    let ast;
    try { ast = bloquesAAST(this.workspace); }
    catch (e){
      this._mostrarError(e);
      this.ejecutando = false;
      this._botones();
      return;
    }
    const bloquesUsados = this.workspace.getAllBlocks(false).length;
    this._numBloques = bloquesUsados;
    const subActual = this.reto.actual();
    let calidad = null;
    if (subActual?.calidadObligatoria){
      calidad = analizarCalidad(this.workspace);
      this.consola(`📊 Calidad: ${calidad.funcionesReutilizadas} función(es) reutilizada(s), ${calidad.duplicados} duplicado(s), nombres claros: ${calidad.nombresClaros ? 'sí' : 'no'}, parámetros usados: ${calidad.paramsUsados ? 'sí' : 'no'}`, 'msg-mundo');
    }
    const res = await this.reto.ejecutarAST(ast, { bloquesUsados, calidad });
    if (res.ok && res.superado){
      const sub = this.reto.actual();
      this.consola(`✔ ¡${sub.nombre} superado!`, 'msg-ok');
      this._ayuda.acierto();
      if (res.esJefe){
        this.consola('🗨 Aria: El Error de Sintaxis se disuelve entre corchetes. Has liberado el Sector Alfa.', 'msg-aria');
        this.cerrar(); // cierra el editor antes de lanzar el final, para que no tape el outro
        this.reto.completarNivel(); // dispara objetivo final → outro → RESULTADO
      } else {
        this.consola('🗨 Aria: Bien hecho. Siguiente sub-reto en marcha…', 'msg-aria');
        const siguiente = this.reto.indice() + 1;
        this._trasDialogo(() => this.cargarSubreto(siguiente));
      }
    } else {
      if (res.ok){
        this.consola(res.mensaje ?? '…el programa terminó, pero faltan fragmentos por recolectar. Se reinicia el sub-reto; tus bloques siguen ahí.', 'msg-mundo');
        this._ayuda.fallo();
      }
      this._reiniciarMundoConPausa(); // error o incompleto: vuelve al inicio sin borrar la lógica
    }
  }

  pedirPista(){
    const sub = this.reto.actual();
    if (!sub?.pistas?.length) return;
    this._pistasDadas = this._pistasDadas ?? {};
    const dadas = this._pistasDadas[sub.id] ?? 0;
    if (dadas >= sub.pistas.length){
      this.consola('🗨 Aria: Ya no tengo más pistas. Esta es una solución posible:', 'msg-aria');
      if (sub.solucionTexto) this.consola(sub.solucionTexto, 'msg-mundo');
      return; 
    }
    this.consola(`💡 Aria: ${sub.pistas[dadas]}`, 'msg-aria');
    this._pistasDadas[sub.id] = dadas + 1;
    telemetria.registrar('pista_pedida', { nivel: `nivel-${estado.nivelActual + 1}`, subreto: sub.id, indice: dadas });
  }

  _mostrarPrediccion(sub){
    $('pred-pregunta').textContent = sub.prediccion.pregunta;
    $('pred-codigo').textContent = sub.prediccion.codigo;
    const caja = $('pred-opciones');
    caja.innerHTML = '';

    // mensaje de retroalimentación (se crea una sola vez, debajo de los botones)
    let aviso = $('pred-aviso');
    if (!aviso){
      aviso = document.createElement('p');
      aviso.id = 'pred-aviso';
      caja.insertAdjacentElement('afterend', aviso);
    }
    aviso.textContent = '';
    aviso.className = '';

    let intentos = 0;
    sub.prediccion.opciones.forEach((op, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-sec';
      b.textContent = op;
      b.addEventListener('click', () => {
        const acierto = i === sub.prediccion.correcta;
        intentos++;
        telemetria.registrar('prediccion', { subreto: sub.id, eleccion: i, acierto, intento: intentos });

        if (acierto){
          b.classList.add('pred-ok');
          aviso.className = 'pred-aviso-ok';
          aviso.textContent = '✔ ¡Correcto!';
          caja.querySelectorAll('button').forEach(x => x.disabled = true);
          this.prediccionOk = true;
          this.consola('🗨 Aria: Predicción correcta. Ejecuta cuando quieras.', 'msg-ok');
          setTimeout(() => {
            $('editor-prediccion').classList.add('oculto');
            this._botones();
          }, 800);
        } else {
          b.classList.add('pred-mal');
          b.disabled = true;               // esa opción ya no se puede volver a elegir
          aviso.className = 'pred-aviso-mal';
          aviso.textContent = '✖ Esa no es. Revisa el bucle y vuelve a intentarlo.';
        }
      });
      caja.appendChild(b);
    });
    $('editor-prediccion').classList.remove('oculto');
  }

  consola(texto, clase = ''){
    const c = $('editor-consola');
    const p = document.createElement('p');
    p.className = clase;
    p.textContent = texto;
    c.appendChild(p);
    c.scrollTop = c.scrollHeight;
  }

  _botones(){
    $('btn-ejecutar').disabled = this.ejecutando || !this.prediccionOk;
    $('btn-detener').disabled = !this.ejecutando;
  }
}