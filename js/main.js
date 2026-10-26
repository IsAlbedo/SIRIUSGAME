// ═══════════════════════════════════════════════════════════
  // main.js — orquestador: flujo de fases, LevelManager, narrativa
  // (cine, diálogos, pistas, registros), HUD, audio, logros, telemetría.
  // ═══════════════════════════════════════════════════════════
  import * as THREE from 'three';
  import { CONFIG } from './config.js';
  import { Jugador } from './player.js';
  import { HUD } from './hud.js';
  import { bus, EVENTOS } from './sistema/eventos.js';
  import { estado, Fases, Modos } from './sistema/estado.js';
  import { LevelManager } from './sistema/niveles.js';
  import { progreso } from './sistema/progreso.js';
  import { logros } from './sistema/logros.js';
  import { audio } from './sistema/audio.js';
  import { pantallas } from './sistema/pantallas.js';
  import { telemetria } from './sistema/telemetria.js';
  import { dialogos } from './sistema/dialogos.js';
  import { cine } from './sistema/cine.js';
  import { pistas } from './sistema/pistas.js';
  import { registros } from './sistema/registros.js';
  import { feedback } from './sistema/feedback.js';
  import { panelInvestigador } from './sistema/panelInvestigador.js';
  import { preferencias } from './sistema/preferencias.js';
  import { reglas } from './sistema/reglas.js';
  import { mapa } from './sistema/mapa.js';
  import { alternarVozAria } from './sistema/ayudaAria.js';
  import { NIVELES } from '../datos/niveles.js';
  import { TEXTOS, formatear } from '../datos/textos.js';
  import { herramientaPorId } from '../datos/herramientas.js';
  import { logroPorId } from '../datos/logros.js';
  import { EditorCodigo } from '../ui/editor.js';
  import { EditorClases } from '../ui/editorClases.js';
  import { EditorHerencia } from '../ui/editorHerencia.js';
  import { EditorGobierno } from '../ui/editorGobierno.js';
  import { arquitecto } from './sistema/arquitecto.js';
  import { menuVida } from './sistema/menuVida.js';
  import { PLAZA } from '../datos/plaza.js';
  import { rangoFinal } from './sistema/rango.js';

  const camPersp = new THREE.PerspectiveCamera(40, 1, .1, 200);
  const $ = id => document.getElementById(id);

  let editorGobierno = null;
  let editorHerencia = null;
  let editorClases = null;

  /* ── renderer / escena / cámara ── */
  const canvas = document.getElementById('escena');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render?.pixelRatioMax ?? 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(CONFIG.camara.fov, window.innerWidth / window.innerHeight, .1, 500);

  /* ── consentimiento de telemetría ──
    La telemetría solo arranca si el jugador aceptó. Con 'rechazado' no se
    inicia nunca (ni en visitas posteriores). */
  function flujoConsentimiento(){
    return new Promise(resolver => {
    const guardado = telemetria.consentimiento();
    if (guardado === 'aceptado'){ telemetria.iniciar(); resolver(); return; }
    if (guardado === 'rechazado'){ resolver(); return; }

    const ov = $('consentimiento');
    ov.classList.remove('oculto');
    $('cons-id').textContent = formatear(TEXTOS.privacidad.id, { id: telemetria.participante() });
    $('cons-texto').textContent = TEXTOS.privacidad.texto;
    $('cons-titulo').textContent = TEXTOS.privacidad.titulo;
    $('btn-consentir').textContent = TEXTOS.privacidad.aceptar;
    $('btn-rechazar').textContent = TEXTOS.privacidad.rechazar;
    $('btn-consentir').addEventListener('click', () => {
      telemetria.establecerConsentimiento('aceptado');
      ov.classList.add('oculto');
      telemetria.iniciar();
      resolver();
    }, { once: true });
    $('btn-rechazar').addEventListener('click', () => {
      telemetria.establecerConsentimiento('rechazado');
      ov.classList.add('oculto');
      resolver();
    }, { once: true });
    });
  }

  /* ── sistemas ── */
  const consentimientoListo = flujoConsentimiento();
  progreso.iniciar();
  logros.iniciar();
  audio.iniciarSuscripciones();
  pantallas.iniciar();
  feedback.iniciar();
  panelInvestigador.iniciar();
  preferencias.iniciar(); // aplica tema, fuente, tamaño y voz guardados
  reglas.iniciar(); // pantalla de reglas + botones en menú/pausa e intro
  arquitecto.iniciar(); // nombre y emblema del Arquitecto
  mapa.iniciar(i => abrirIntro(i), () => entrarPlaza()); // mapa de misión: elegir sector o visitar la Plaza
  menuVida.iniciar();
  window.addEventListener('pagehide', () => telemetria.finalizarSesion());
  await dialogos.iniciar(); // carga datos/dialogues.json

  const levels = new LevelManager(scene, renderer.capabilities.getMaxAnisotropy(), progreso);
  registros.iniciar();
  let editor = null;

  /* ── estado del flujo ── */
  let nivelPendiente = -1;
  let mundo = null;
  let debugVisible = false;
  let dialogoEntradaPendiente = false;
  let visitandoPlaza = false; // dentro de la Plaza de Cristales las fases no se registran en la telemetría
  let resultadoListo = false; // la pantalla de resultado solo se muestra cuando ya está rellena
  let secuenciaInicio = true; // CINE → diálogo intro: el menú no se muestra hasta que terminen

  function nivelRecomendado(){
    const idx = NIVELES.findIndex(n => !progreso.nivelCompletado(n.id));
    return idx === -1 ? 0 : idx;
  }

  /* ── precarga: el menú muestra el mundo 3D de fondo ── */
  nivelPendiente = nivelRecomendado();
  mundo = levels.cargar(NIVELES[nivelPendiente]);
  const jugador = new Jugador(camara, mundo.colisionadores, mundo.zonasDano, mundo.alturaEn);
  const hud = new HUD();
  pistas.iniciar(hud);
  
  /* ── textos de la UI (todo desde datos/) ──
    Los controles ya NO se pintan aquí: viven en la intro de nivel
    (pantallas.mostrarIntro → #intro-controles). */
  function llenarTextosUI(){
    const $ = id => document.getElementById(id);
    document.title = TEXTOS.ui.tituloPagina;
    $('ov-titulo').textContent = TEXTOS.ui.titulo;
    $('ov-titulo-acento').textContent = TEXTOS.ui.tituloAcento;
    $('overlay-sub').textContent = TEXTOS.ui.subtitulo;
    $('btn-jugar').textContent = TEXTOS.ui.botonIniciar;
    $('overlay-estado').textContent = TEXTOS.ui.notaInicial;
    $('etq-vida').textContent = TEXTOS.hud.vida;
    $('etq-resistencia').textContent = TEXTOS.hud.resistencia;
    $('etq-fps').textContent = TEXTOS.hud.fps;
    $('etq-herramientas').textContent = TEXTOS.hud.herramientas;
    $('etq-res-puntos').textContent = TEXTOS.resultado.etPuntos;
    $('etq-res-tiempo').textContent = TEXTOS.resultado.etTiempo;
    $('etq-res-objetivos').textContent = TEXTOS.resultado.etObjetivos;
    $('aviso-registro').textContent = TEXTOS.registro.prompt;
  }
  llenarTextosUI();

  /* ══════════ FLUJO DE FASES ══════════ */

  function abrirIntro(n){
    nivelPendiente = Math.max(0, Math.min(NIVELES.length - 1, n));
    visitandoPlaza = false;
    try { document.exitPointerLock(); } catch {}
    estado.cambiarFase(Fases.INTRO, nivelPendiente);
    pantallas.mostrarIntro(NIVELES[nivelPendiente]);
  }

  function comenzarNivel(){
    if (estado.fase !== Fases.INTRO) return;
    estado.cambiarFase(Fases.NIVEL, nivelPendiente);
    // cargar() reutiliza el mundo ya construido si es el mismo nivel y no se ha tocado
    levels.cargar(NIVELES[nivelPendiente]);
    levels.reiniciarCronometro();
    dialogoEntradaPendiente = true;
    notifPendiente = (nivelPendiente === 0);
    ocultarNotifTerminal();
    audio.asegurar();
    capturar();
  }

  /** Visita la Plaza de Cristales: sin intro, sin objetivos, sin puntos y sin telemetría de nivel. */
  function entrarPlaza(){
    if (!progreso.datos.nivelesCompletados.length) return; // se abre al restaurar el primer sector
    visitandoPlaza = true;
    // el estado solo admite MENU → INTRO → NIVEL: se pasa por INTRO sin mostrarla
    estado.cambiarFase(Fases.INTRO, nivelPendiente);
    estado.cambiarFase(Fases.NIVEL, nivelPendiente);
    levels.cargar(PLAZA);
    levels.reiniciarCronometro();
    dialogoEntradaPendiente = false;
    notifPendiente = false;
    ocultarNotifTerminal();
    audio.asegurar();
    capturar();
  }

  /** Botón REINICIAR NIVEL de la pausa: vuelve a construir el nivel en curso y regresa al juego. */
  function reiniciarNivel(){
    if (estado.fase !== Fases.NIVEL || !levels.defActual) return;
    levels.reiniciar();            // mundo nuevo, objetivos y fallos a cero, cronómetro a cero
    dialogoEntradaPendiente = false; // ya viste el diálogo de entrada: no se repite
    notifPendiente = false;
    ocultarNotifTerminal();
    capturar();                    // sale de la pausa sin pasar por la intro
  }

  function irAMenu(){
    try { document.exitPointerLock(); } catch {}
    estado.cambiarFase(Fases.MENU);
    // el fondo del menú vuelve a ser el nivel recomendado
    nivelPendiente = nivelRecomendado();
    visitandoPlaza = false;
    levels.descargar();                       // fuerza reconstrucción completa
    levels.cargar(NIVELES[nivelPendiente]);
  }

  function abrirEditor(){
    if (estado.fase !== Fases.NIVEL) return;
    notifPendiente = false;
    ocultarNotifTerminal();
    const tipo = levels.defActual?.editor ?? 'bloques';
    estado.cambiarModo(Modos.EDITOR);
    try { document.exitPointerLock(); } catch {}
    if (tipo === 'clases'){
      editorClases ??= new EditorClases();
      editorClases.abrir(levels.mundo.reto);
    } else if (tipo === 'herencia'){
      editorHerencia ??= new EditorHerencia();
      editorHerencia.abrir(levels.mundo.reto);
    } else if (tipo === 'gobierno'){
      editorGobierno ??= new EditorGobierno();
      editorGobierno.abrir(levels.mundo.reto);
    } else {
      editor ??= new EditorCodigo();
      editor.abrir(levels.mundo.reto);
    }
    levels.mundo.reto.setGestor(levels);
  }

  /* ══════════ EVENTOS DE NIVEL ══════════ */

  bus.suscribir(EVENTOS.LEVEL_STARTED, ({ config, mundo: nuevoMundo, herramientas }) => {
    mundo = nuevoMundo;
    jugador.setColisionadores(mundo.colisionadores, mundo.zonasDano, mundo.alturaEn);
    jugador.posicion.set(...config.zona.spawn);
    // nivel 1: el laberinto se construye al cargar el sub-reto; se hace ya para que se vea desde el inicio
    if (mundo.terminal && mundo.reto?.indice() < 0) mundo.reto.cargarSubreto(0);
    jugador.velocidad.set(0, 0, 0);
    hud.setNivel(config);
    if (config.id === PLAZA.id){
      const { estrellas, maxEstrellas } = rangoFinal();
      hud.setResumenLibre(formatear(TEXTOS.plaza.resumenHud, { n: estrellas, max: maxEstrellas }));
    }
    hud.setHerramientas(herramientas);
    // registro de Gustaff del nivel
    scene.add(registros.grupo);
    registros.prepararParaNivel(config.id); 
    if (config.id === PLAZA.id){
      hud.setRegistros(NIVELES.filter(n => progreso.tieneRegistro(n.id)).length, NIVELES.length);
    } else {
      hud.setRegistros(progreso.tieneRegistro(config.id) ? 1 : 0, 1);
    }
    hud.setPistas(progreso.pistasUsadas(config.id), dialogos.pistasDe(config.id).length);
    if (estado.fase === Fases.NIVEL){
      hud.avisar(formatear(TEXTOS.avisos.nivelCargado, { nombre: config.sector }));
    }
    if (config.id !== PLAZA.id && estado.fase === Fases.NIVEL) telemetria.registrar('nivel_iniciado', { nivel: config.id, numero: config.numero });
  });

  bus.suscribir(EVENTOS.OBJECTIVE_COMPLETED, ({ objetivo, restantes }) => {
    if (objetivo) hud.marcarObjetivo(objetivo.id);
    hud.avisar(formatear(TEXTOS.avisos.objetivo, { restantes }));
    audio.feedback('exito');
  });

  bus.suscribir(EVENTOS.LEVEL_COMPLETED, resultado => {
    telemetria.registrar('nivel_completado', {
      nivel: resultado.config.id, puntos: resultado.puntos,
      segundos: resultado.segundos, fallos: resultado.fallos,
    });
    const esUltimo = resultado.config.numero === NIVELES.length;
    const mostrar = () => {
      pantallas.mostrarResultado(resultado, esUltimo);
      resultadoListo = true;
      actualizarVisibilidad();
    };
    // diálogo de salida (Aria) primero; el resultado aparece al terminarlo
    if (resultado.config.dialogos?.salida) dialogos.abrirPorId(resultado.config.dialogos.salida, mostrar);
    else mostrar();
  });

  bus.suscribir(EVENTOS.LEVEL_FAILED, payload => {
    pantallas.mostrarResultado({ ...payload, completado: false, puntos: 0, segundos: 0 }, false);
    resultadoListo = true;
    actualizarVisibilidad();
    telemetria.registrar('nivel_fallido', { nivel: payload.config.id, motivo: payload.motivo });
  });

  bus.suscribir(EVENTOS.SKILL_UNLOCKED, ({ id }) => {
    const h = herramientaPorId(id);
    if (h) hud.avisar(formatear(TEXTOS.avisos.herramientaNueva, { nombre: h.nombre }));
  });

  bus.suscribir(EVENTOS.ACHIEVEMENT_UNLOCKED, ({ id }) => {
    const l = logroPorId(id);
    if (l) hud.avisar(formatear(TEXTOS.avisos.logroNuevo, { nombre: l.nombre }));
  });

  /* ══════════ NARRATIVA ══════════ */

  /* Secuencia de arranque: CINE → DIÁLOGOS (dialogues.json) → MENÚ DE INICIO →
    intro del nivel → mundo. El menú solo aparece cuando terminan los diálogos. */
  const ID_DIALOGO_INTRO = 'intro'; // ← id del diálogo inicial dentro de datos/dialogues.json

  bus.suscribir(EVENTOS.CINE_TERMINADO, () => {
    let hecho = false;
    const alMenu = () => {
      if (hecho) return;
      hecho = true;
      secuenciaInicio = false;
      irAMenu();
      actualizarVisibilidad(); // irAMenu() no emite FASE_CAMBIADA si ya estás en MENU
    };
    try { dialogos.abrirPorId(ID_DIALOGO_INTRO, alMenu); }
    catch { alMenu(); } // si el diálogo no existe, no se queda atascado
  });

  // al terminar cualquier diálogo dentro de un nivel, se recupera el cursor
    // al terminar cualquier diálogo dentro de un nivel, se recupera el cursor
  // (excepto si el diálogo salió desde el editor: ahí el cursor debe seguir libre)
  bus.suscribir(EVENTOS.DIALOGO_TERMINADO, () => {
    if (estado.fase !== Fases.NIVEL) return;
    if (estado.modo === Modos.EDITOR) return;
    capturar();
    if (notifPendiente){
      notifPendiente = false;
      setTimeout(mostrarNotifTerminal, 500);
    }
  });

  // diálogo de entrada: se abre la primera vez que el jugador queda en EXPLORANDO
  bus.suscribir(EVENTOS.MODO_CAMBIADO, ({ actual }) => {
    if (actual === Modos.EXPLORANDO && dialogoEntradaPendiente && estado.fase === Fases.NIVEL){
      dialogoEntradaPendiente = false;
      const config = levels.defActual;
      if (config?.dialogos?.entrada) dialogos.abrirPorId(config.dialogos.entrada);
    }
  });

  bus.suscribir(EVENTOS.REGISTRO_RECOGIDO, ({ nivelId }) => {
    hud.setRegistros(1, 1);
    hud.avisar(TEXTOS.avisos.registro);
    telemetria.registrar('registro_recogido', { nivel: nivelId });
  });

  /* ══════════ EDITOR DE CÓDIGO ══════════ */

  const promptTerminal = $('aviso-terminal');
    const notifTerminal = $('notif-terminal');
  let notifTimer = null;
  let notifPendiente = false;
  function ocultarNotifTerminal(){
    clearTimeout(notifTimer);
    notifTerminal.classList.remove('visible');
  }
  function mostrarNotifTerminal(){
    ocultarNotifTerminal();
    void notifTerminal.offsetWidth; // reinicia la animación
    notifTerminal.classList.add('visible');
    notifTimer = setTimeout(ocultarNotifTerminal, 9000);
  }
  const TXT_TERMINAL = 'PRESIONA E PARA USAR LA TERMINAL';
  promptTerminal.textContent = TXT_TERMINAL;
  let promptModo = 'terminal'; // qué texto muestra ahora el aviso: terminal | salida | cristal
  const terminalCerca = () => !!levels.mundo?.terminal?.cerca && estado.fase === Fases.NIVEL;
  const plazaSalidaCerca = () => !!levels.mundo?.salida?.cerca && estado.fase === Fases.NIVEL;
  const plazaCristalCerca = () => !!levels.mundo?.cristal?.cerca && estado.fase === Fases.NIVEL;

  bus.suscribir(EVENTOS.EDITOR_CERRADO, () => { if (estado.fase === Fases.NIVEL) capturar(); });
  bus.suscribir(EVENTOS.MOTOR_ERROR, e => telemetria.registrar('error_codigo', { categoria: e.categoria, linea: e.linea, nivel: estado.nivelActual }));

  /* ══════════ EVENTOS DE UI (pantallas y debug) ══════════ */

  bus.suscribir(EVENTOS.UI_INICIAR_NIVEL, comenzarNivel);
  bus.suscribir(EVENTOS.UI_MENU, irAMenu);
  // desde la pausa (fase NIVEL) = reiniciar el nivel en curso; desde el resultado = volver a la intro
  bus.suscribir(EVENTOS.UI_REPETIR, () => estado.fase === Fases.NIVEL ? reiniciarNivel() : abrirIntro(nivelPendiente));
  bus.suscribir(EVENTOS.UI_SIGUIENTE, () => {
    if (nivelPendiente >= NIVELES.length - 1){
      estado.cambiarFase(Fases.CIERRE);
      pantallas.mostrarCierre(progreso.datos.total);
    } else {
      abrirIntro(nivelPendiente + 1);
    }
  });

  bus.suscribir(EVENTOS.UI_DEBUG, ({ accion, nivel }) => {
    switch (accion){
      case 'ir': abrirIntro(nivel ?? 0); break;
      case 'objetivo': {
        const [primero] = levels.objetivosPendientes;
        if (primero) levels.completarObjetivo(primero);
        break;
      }
      case 'fallar': levels.fallarNivel('prueba de debug'); break;
      case 'menu': irAMenu(); break;
      case 'reset':
        progreso.resetear();
        hud.avisar(TEXTOS.avisos.progresoReiniciado);
        break;
      case 'cine': secuenciaInicio = true; irAMenu(); cine.iniciar(); break;
    }
  });

  /* ══════════ VISIBILIDAD POR FASE/MODO ══════════ */

  function actualizarVisibilidad(){
    const { fase, modo } = estado;
    const pausaEnNivel = fase === Fases.NIVEL && modo === Modos.PAUSA;
    document.getElementById('overlay').classList.toggle('oculto',
      secuenciaInicio || !(fase === Fases.MENU || pausaEnNivel));
    document.getElementById('pantalla-intro').classList.toggle('oculto', fase !== Fases.INTRO);
    document.getElementById('pantalla-resultado').classList.toggle('oculto', !(fase === Fases.RESULTADO && resultadoListo));
    document.getElementById('pantalla-cierre').classList.toggle('oculto', fase !== Fases.CIERRE);
    hud.mostrar(fase === Fases.NIVEL && (modo === Modos.EXPLORANDO || modo === Modos.LIBRE));

    // indicador de puntero libre (Alt)
    hud.setModoLibre(fase === Fases.NIVEL && modo === Modos.LIBRE);

    const btnJugar = document.getElementById('btn-jugar');
    const overlayEstado = document.getElementById('overlay-estado');
    if (pausaEnNivel){
      btnJugar.textContent = TEXTOS.ui.botonReanudar;
      overlayEstado.textContent = TEXTOS.ui.notaPausa;
    } else {
      btnJugar.textContent = progreso.datos.nivelesCompletados.length
        ? TEXTOS.ui.botonContinuar : TEXTOS.ui.botonIniciar;
      overlayEstado.textContent = formatear(TEXTOS.ui.notaMenu, { nivel: nivelRecomendado() + 1 });
    }
  }
  bus.suscribir(EVENTOS.FASE_CAMBIADA, payload => {
    resultadoListo = false; // cada cambio de fase vuelve a ocultar el resultado
    actualizarVisibilidad();
    if (!visitandoPlaza) telemetria.registrar('fase', payload);
  });
  bus.suscribir(EVENTOS.MODO_CAMBIADO, () => actualizarVisibilidad());
  actualizarVisibilidad();

  /* ══════════ POINTER LOCK Y ENTRADA ══════════ */

  function capturar(){
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => canvas.requestPointerLock());
    } catch { canvas.requestPointerLock(); }
  }

  const overlay = document.getElementById('overlay');
  function clicOverlay(e){
    e.stopPropagation();
    audio.asegurar();
    if (estado.fase === Fases.NIVEL){ capturar(); return; }   // reanudar pausa
    abrirIntro(nivelRecomendado());
  }
  overlay.addEventListener('click', e => e.stopPropagation()); // clic fuera del botón: no hace nada
  document.getElementById('btn-jugar').addEventListener('click', clicOverlay);

  document.addEventListener('pointerlockchange', () => {
    const bloqueado = document.pointerLockElement === canvas;
    jugador.limpiarEntrada();
    // Solo actualizar modo si el cambio no fue programático desde el toggle de Alt
    if (bloqueado && estado.fase === Fases.NIVEL && estado.modo !== Modos.EXPLORANDO){
      estado.cambiarModo(Modos.EXPLORANDO);
    } else if (!bloqueado && estado.fase === Fases.NIVEL && estado.modo === Modos.EXPLORANDO){
      // liberación involuntaria (ESC del navegador) = pausa real
      estado.cambiarModo(Modos.PAUSA);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.code === 'F2'){
      e.preventDefault();
      debugVisible = !debugVisible;
      pantallas.toggleDebug(debugVisible, {
        renderer,
        get hudFps(){ return hud._fps; },
        get hudMs(){ return hud._ms; },
      });
      return;
    }
    // Alt alterna puntero libre ↔ cámara
    if (e.code === 'AltLeft' || e.code === 'AltRight'){
      e.preventDefault();
      if (estado.fase !== Fases.NIVEL) return;
      if (estado.modo === Modos.EXPLORANDO){
        estado.cambiarModo(Modos.LIBRE);
        try { document.exitPointerLock(); } catch {}
      } else if (estado.modo === Modos.LIBRE){
        estado.cambiarModo(Modos.EXPLORANDO);
        capturar();
      }
      return;
    }

    // M: ver/ocultar misión sin soltar la cámara
    if (e.code === 'KeyM' && estado.fase === Fases.NIVEL &&
        (estado.modo === Modos.EXPLORANDO || estado.modo === Modos.LIBRE)){
      hud.alternarMision();
      return;
    }

    if (!jugador.activo) return;
    jugador.teclas[e.code] = true;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.code === 'KeyH' && !jugador.curar()) hud.avisar(TEXTOS.avisos.vidaCompleta);
    if (e.code === 'KeyE'){
      // nivel con terminal física: E abre el editor si estás cerca; si no, recoge registro
      if (terminalCerca() && estado.modo === Modos.EXPLORANDO) abrirEditor();
      else if (plazaSalidaCerca() && estado.modo === Modos.EXPLORANDO) irAMenu();
      else if (plazaCristalCerca() && estado.modo === Modos.EXPLORANDO) levels.mundo.cristal.abrir();
      else registros.recoger();
    }
    if (e.code === 'KeyP') pistas.pedir();
    if (e.code === 'KeyV' && !e.repeat) hud.avisar(alternarVozAria() ? TEXTOS.avisos.vozAriaOn : TEXTOS.avisos.vozAriaOff);
    // niveles sin terminal física conservan la tecla C
    if (e.code === 'KeyC' && levels.mundo?.reto && !levels.mundo.terminal) abrirEditor();
  });
  document.addEventListener('keyup', e => { jugador.teclas[e.code] = false; });
  document.addEventListener('mousemove', e => {
    if (jugador.activo && estado.modo === Modos.EXPLORANDO)
      jugador.girar(e.movementX, e.movementY);
  });
  window.addEventListener('blur', () => jugador.limpiarEntrada());

  window.addEventListener('resize', () => {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ══════════ CALLBACKS DEL JUGADOR ══════════ */

  jugador.alRecibirDano = cant => {
    hud.flashDano();
    hud.avisar(formatear(TEXTOS.avisos.dano, { n: cant }));
    telemetria.registrar('jugador_dano', { cantidad: cant });
  };
  jugador.alCurar = () => hud.avisar(formatear(TEXTOS.avisos.curar, { n: 25 }));
  jugador.alReaparecer = silencioso => {
    if (!silencioso) hud.avisar(TEXTOS.avisos.reaparecido);
    telemetria.registrar('jugador_reaparece', {});
  };
  jugador.alEntrarZona = () => { hud.flashDano(); hud.avisar(TEXTOS.avisos.zonaTermica); };

  /* ── gancho de depuración/investigación ── */
  window.__adc = { bus, estado, levels, progreso, telemetria, dialogos };

  /* ── objetos persistentes para evitar asignaciones por frame ── */
  const _vDestino = new THREE.Vector3();

  /* ── pausa de render bajo pantallas opacas ── */
  const PANTALLAS_OPACAS = new Set([
    Fases.MENU, Fases.INTRO, Fases.RESULTADO, Fases.CIERRE, Fases.CINE,
  ]);
    function modoEsOpaco(){
    // Resultado con el diálogo de Aria encima: aún no hay pantalla opaca, hay que dibujar el mundo
    if (estado.fase === Fases.RESULTADO && estado.modo === Modos.DIALOGO) return false;
    if (PANTALLAS_OPACAS.has(estado.fase)) return true;
    if (estado.fase === Fases.NIVEL && estado.modo === Modos.EDITOR) return true;
    return false;
  }

  /* ── pixelRatio adaptativo ── */
  const prOriginal = Math.min(window.devicePixelRatio, CONFIG.render?.pixelRatioMax ?? 1.75);
  let prActual = prOriginal, fpsAcumBajo = 0, fpsAcumAlto = 0;
  function ajustarPixelRatio(fps){
    if (fps > 0 && fps < 30){
      fpsAcumBajo += 1; fpsAcumAlto = 0;
      if (fpsAcumBajo > 90 && prActual > 1){
        prActual = Math.max(1, prActual - .25);
        renderer.setPixelRatio(prActual);
        fpsAcumBajo = 0;
      }
    } else if (fps >= 55){
      fpsAcumAlto += 1; fpsAcumBajo = 0;
      if (fpsAcumAlto > 120 && prActual < prOriginal){
        prActual = Math.min(prOriginal, prActual + .25);
        renderer.setPixelRatio(prActual);
        fpsAcumAlto = 0;
      }
    } else { fpsAcumBajo = 0; fpsAcumAlto = 0; }
  }

  /* ── arranque: lo primero que se ve es la cinemática ──
    (espera al consentimiento para que no se encimen las pantallas) */
  consentimientoListo.then(() => {
    try { cine.iniciar(); }
    catch (e){
      // si la cinemática no arranca, no dejamos el menú oculto para siempre
      console.warn('[cine] no pudo iniciar:', e);
      secuenciaInicio = false;
      actualizarVisibilidad();
    }
  });

  /* ── vista aérea del laberinto dentro del editor ──
    Cámara ortográfica cenital fija sobre el laberinto (mundo.aerea()). Se renderiza
    en cada frame del editor, así que muestra al robot moviéndose en vivo, y se
    copia al <canvas id="vista-aerea">. */
  const camAerea = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 150);
  camAerea.up.set(0, 0, -1); // norte hacia arriba
  const lienzoAereo = $('vista-aerea');
  const ctxAereo = lienzoAereo?.getContext('2d');

  /* Clic en la vista: activa/desactiva el seguimiento del robot al ejecutar */
/* Clic en la vista: activa/desactiva la vista del robot al ejecutar */
let vistaRobotAuto = true;
lienzoAereo?.addEventListener('click', () => { vistaRobotAuto = !vistaRobotAuto; });

/* Cámara aérea del nivel, ajustada a la proporción del recuadro */
function camaraAerea(info, aspecto){
  const m = info.medio;
  let cam;
  if (info.inclinacion != null){
    cam = camPersp;
    cam.fov = 40;
    cam.aspect = aspecto;
    cam.updateProjectionMatrix();
    const a = THREE.MathUtils.degToRad(info.inclinacion);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const distV = (m * Math.sin(a) + 1) / tanV;
    const distH = m / (tanV * aspecto);
    const dist = Math.max(distV, distH) * 1.05;
    const g = THREE.MathUtils.degToRad(info.giro ?? 0);
    const horiz = Math.cos(a) * dist;
    cam.up.set(0, 1, 0);
    cam.position.set(info.x + Math.sin(g) * horiz, Math.sin(a) * dist, info.z + Math.cos(g) * horiz);
    cam.lookAt(info.x, 0.5, info.z);
  } else {
    cam = camAerea;
    cam.left = -m * Math.max(1, aspecto); cam.right = m * Math.max(1, aspecto);
    cam.top = m / Math.min(1, aspecto);   cam.bottom = -m / Math.min(1, aspecto);
    cam.updateProjectionMatrix();
    cam.up.set(0, 0, -1);
    cam.position.set(info.x, 60, info.z);
    cam.lookAt(info.x, 0.5, info.z);
  }
  cam.updateMatrixWorld(true);
  return cam;
}

/* Renderiza `cam` en w×h (px CSS) y lo copia al canvas del editor en (dx, dy, dw, dh) */
function renderACanvas(cam, w, h, dx, dy, dw, dh, pr){
  const niebla = scene.fog; scene.fog = null;
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.render(scene, cam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  scene.fog = niebla;
  ctxAereo.drawImage(canvas, 0, canvas.height - Math.round(h * pr),
    Math.round(w * pr), Math.round(h * pr), dx, dy, dw, dh);
}

function dibujarVistaAerea(){
  if (!ctxAereo) return;
  const info = mundo?.aerea?.();
  lienzoAereo.style.display = info ? '' : 'none';
  if (!info) return;

  const cw = Math.min(lienzoAereo.clientWidth, window.innerWidth);
  const ch = Math.min(lienzoAereo.clientHeight, window.innerHeight);
  if (!cw || !ch) return;
  const pr = renderer.getPixelRatio();
  const W = Math.round(cw * pr), H = Math.round(ch * pr);
  if (lienzoAereo.width !== W || lienzoAereo.height !== H){
    lienzoAereo.width = W; lienzoAereo.height = H;
  }

  const robot = (vistaRobotAuto && editor?.ejecutando) ? mundo?.camaraRobot?.() : null;

  if (!robot){
    renderACanvas(camaraAerea(info, cw / ch), cw, ch, 0, 0, W, H, pr);
    return;
  }

  /* ── primera persona: ojos del robot ── */
  const fx = -Math.sin(robot.yaw), fz = -Math.cos(robot.yaw);
  const cam = camPersp;
  cam.fov = 75;
  cam.aspect = cw / ch;
  cam.updateProjectionMatrix();
  cam.up.set(0, 1, 0);
  cam.position.set(robot.x + fx * .25, 1.0, robot.z + fz * .25);
  cam.lookAt(robot.x + fx * 5, 0.9, robot.z + fz * 5);
  cam.updateMatrixWorld(true);

  mundo.mostrarRobot?.(false);                       // por dentro, sin ver su propio cuerpo
  renderACanvas(cam, cw, ch, 0, 0, W, H, pr);
  mundo.mostrarRobot?.(true);

  /* minimapa aéreo en la esquina inferior derecha */
  const mw = Math.round(cw * .3), mh = Math.round(ch * .3);
  const dw = Math.round(mw * pr), dh = Math.round(mh * pr);
  const dx = W - dw - 10 * pr, dy = H - dh - 10 * pr;
  renderACanvas(camaraAerea(info, mw / mh), mw, mh, dx, dy, dw, dh, pr);
  ctxAereo.strokeStyle = '#7b5cff';
  ctxAereo.lineWidth = 2 * pr;
  ctxAereo.strokeRect(dx, dy, dw, dh);

  ctxAereo.font = `bold ${12 * pr}px monospace`;
  ctxAereo.fillStyle = '#ffd27a';
  ctxAereo.fillText('● VISTA DEL ROBOT (clic para volver a la aérea)', 10 * pr, 18 * pr);
}


  /* ── bucle ── */
  const reloj = new THREE.Clock();
  let acumFps = 0, frames = 0;

  function bucle(){
    requestAnimationFrame(bucle);
    const dt = Math.min(reloj.getDelta(), .05);
    const t = reloj.elapsedTime;

    const opaco = modoEsOpaco();

    if (jugador.activo) jugador.update(dt);
    if (mundo?.update) mundo.update(t, dt, jugador.posicion);
    registros.update(t, dt, jugador.posicion);
    hud.mostrarPromptRegistro(registros.cerca);
    const modoPrompt = terminalCerca() ? 'terminal' : plazaSalidaCerca() ? 'salida' : plazaCristalCerca() ? 'cristal' : '';
    promptTerminal.classList.toggle('oculto', !(modoPrompt && estado.modo === Modos.EXPLORANDO));
    if (modoPrompt && modoPrompt !== promptModo){
      promptModo = modoPrompt;
      promptTerminal.textContent = modoPrompt === 'terminal' ? TXT_TERMINAL
        : modoPrompt === 'salida' ? TEXTOS.plaza.promptSalida : TEXTOS.plaza.promptCristal;
    }

    if (!opaco){
      hud.setVida(jugador.vida);
      hud.setResistencia(jugador.resistencia);
      hud.setEstado(jugador.corriendo);
      hud.setPeligro(jugador.enZonaPeligro && jugador.activo);
      hud.setPos(jugador.posicion.x, jugador.posicion.z);
    }

    frames++; acumFps += dt;
    if (acumFps >= .25){
      const fps = frames / acumFps;
      hud.setFps(fps, 1000 / fps);
      if (!opaco) ajustarPixelRatio(fps);
      frames = 0; acumFps = 0;
    }

    if (estado.fase === Fases.NIVEL && estado.modo === Modos.EDITOR) dibujarVistaAerea();

    if (opaco) return; // NO renderizar bajo pantallas opacas
    renderer.render(scene, camara);
  }
  bucle();

 