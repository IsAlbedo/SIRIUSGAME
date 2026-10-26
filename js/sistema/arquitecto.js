// ═══════════════════════════════════════════════════════════
// sistema/arquitecto.js — personalización del Arquitecto:
// nombre y emblema. Se guardan solo en este dispositivo
// (progreso.js) y NUNCA entran a la telemetría de investigación.
// ═══════════════════════════════════════════════════════════
import { TEXTOS } from '../../datos/textos.js';
import { bus, EVENTOS } from './eventos.js';
import { progreso } from './progreso.js';

// Textos de respaldo: si TEXTOS.arquitecto no existe en textos.js, el panel funciona igual.
const POR_DEFECTO = {
  titulo: 'EL ARQUITECTO',
  etiquetaNombre: 'Tu nombre',
  etiquetaEmblema: 'Tu emblema',
  nota: 'Se guarda solo en este dispositivo y no entra en los datos de investigación.',
  cerrar: '← VOLVER',
  boton: '👤 ARQUITECTO',
  emblemas: [
    { id: 'nucleo', nombre: 'Núcleo', icono: '⚛' },
    { id: 'circuito', nombre: 'Circuito', icono: '⚡' },
    { id: 'llave', nombre: 'Llave', icono: '🔑' },
    { id: 'estrella', nombre: 'Estrella', icono: '★' },
  ],
};
const TXT = { ...POR_DEFECTO, ...(TEXTOS?.arquitecto ?? {}) };

/** Qué hay que lograr para usar cada emblema (el que no aparece aquí es libre). */
const REQUISITOS = {
  circuito: { nivel: 'nivel-1', texto: 'Completa el Nivel 1' },
  llave:    { nivel: 'nivel-2', texto: 'Completa el Nivel 2' },
  estrella: { nivel: 'nivel-3', texto: 'Completa el Nivel 3' },
};
const emblemaLibre = id => {
  const r = REQUISITOS[id];
  return !r || progreso.nivelCompletado(r.nivel);
};

/** Emblemas que se desbloquean al completar ese nivel (para la pantalla de resultado). */
export const emblemasDesbloqueadosEn = nivelId =>
  TXT.emblemas.filter(e => REQUISITOS[e.id]?.nivel === nivelId);

const $ = id => document.getElementById(id);
const NOMBRE_POR_DEFECTO = 'Arquitecto';
const MAX_LETRAS = 16;

/** Limpia lo que escribe el jugador: sin caracteres de control, < > { } ni espacios de más. */
export function limpiarNombre(s){
  const limpio = String(s ?? '').normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(limpio).slice(0, MAX_LETRAS).join('');
}

/** Nombre elegido, o «Arquitecto» si no hay. */
export function nombreArquitecto(){
  return limpiarNombre(progreso.preferencia('nombreArquitecto')) || NOMBRE_POR_DEFECTO;
}

/** Sustituye {arquitecto} (y {ARQUITECTO}, en mayúsculas) por el nombre. */
export function conNombre(texto, nombre = nombreArquitecto()){
  return String(texto ?? '')
    .replace(/\{arquitecto\}/g, () => nombre)
    .replace(/\{ARQUITECTO\}/g, () => nombre.toUpperCase());
}

export const emblemaActual = () => {
  const e = TXT.emblemas.find(x => x.id === progreso.preferencia('emblema'));
  // si el emblema guardado aún no se ha ganado (p. ej. tras «Reiniciar progreso»), se usa el primero
  return e && emblemaLibre(e.id) ? e : TXT.emblemas[0];
};

let panel = null, campo = null, grupoEmblemas = null, btnCerrar = null, origen = null;
let hudEmblema = null, hudNombre = null;

const visible = () => panel && !panel.classList.contains('oculto');

function pintarHud(){
  if (!hudNombre) return;
  hudEmblema.textContent = emblemaActual().icono;
  hudNombre.textContent = nombreArquitecto();
}

function pintarEmblemas(){
  const actual = emblemaActual().id;
  for (const b of grupoEmblemas.querySelectorAll('button')){
    const e = TXT.emblemas.find(x => x.id === b.dataset.valor);
    const libre = emblemaLibre(e.id);
    b.disabled = !libre;
    b.title = libre ? '' : REQUISITOS[e.id].texto;
    b.textContent = `${libre ? e.icono : '🔒'} ${e.nombre}`;
    b.setAttribute('aria-pressed', String(e.id === actual));
  }
}

function guardarNombre(){
  const limpio = limpiarNombre(campo.value);
  campo.value = limpio;
  progreso.fijarPreferencia('nombreArquitecto', limpio);
}

function abrir(){
  origen = document.activeElement;
  campo.value = limpiarNombre(progreso.preferencia('nombreArquitecto'));
  pintarEmblemas();
  panel.classList.remove('oculto');
  campo.focus();
}

function cerrar(){
  guardarNombre();
  panel.classList.add('oculto');
  if (origen?.focus) origen.focus();
}

export const arquitecto = {
  iniciar(){
    const T = TXT;

    if (!document.getElementById('arq-estilos')){
      const st = document.createElement('style');
      st.id = 'arq-estilos';
      st.textContent = `
/* encima de TODO (menú de inicio y pausa), tapando lo de atrás. No fija display: así .oculto sigue funcionando */
#panel-arquitecto{position:fixed;inset:0;z-index:300;background:rgba(5,8,24,.97)}
#panel-arquitecto .etq{display:block;margin-bottom:6px}
#panel-arquitecto .aj-grupo{margin-bottom:16px}
.arq-campo{display:block;width:min(340px,100%);box-sizing:border-box;padding:10px 12px;background:#0a0f2e;color:#eef0ff;
  border:1px solid #7b5cff;border-radius:6px;font:inherit;font-size:1.1em;letter-spacing:.06em}
.arq-campo::placeholder{color:#6b73b8}
.arq-campo:focus{outline:2px solid #ffd27a;outline-offset:2px}
.arq-hud{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:700;letter-spacing:.08em}
.arq-emblema{font-size:1.3em}
`;
      document.head.appendChild(st);
    }

    /* panel */
    panel = document.createElement('div');
    panel.id = 'panel-arquitecto';
    panel.className = 'pantalla oculto';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'arq-titulo');

    const caja = document.createElement('div');
    caja.className = 'pantalla-caja';
    const h2 = document.createElement('h2');
    h2.id = 'arq-titulo';
    h2.textContent = T.titulo;

    const gNombre = document.createElement('div');
    gNombre.className = 'aj-grupo';
    const etqNombre = document.createElement('label');
    etqNombre.className = 'etq';
    etqNombre.htmlFor = 'arq-nombre';
    etqNombre.textContent = T.etiquetaNombre;
    campo = document.createElement('input');
    campo.id = 'arq-nombre';
    campo.className = 'arq-campo';
    campo.type = 'text';
    campo.maxLength = MAX_LETRAS;
    campo.autocomplete = 'off';
    campo.spellcheck = false;
    campo.placeholder = NOMBRE_POR_DEFECTO;
    campo.addEventListener('change', guardarNombre);
    campo.addEventListener('keydown', e => { if (e.code === 'Enter'){ e.preventDefault(); cerrar(); } });
    gNombre.append(etqNombre, campo);

    const gEmb = document.createElement('div');
    gEmb.className = 'aj-grupo';
    const etqEmb = document.createElement('div');
    etqEmb.className = 'etq';
    etqEmb.textContent = T.etiquetaEmblema;
    grupoEmblemas = document.createElement('div');
    grupoEmblemas.className = 'aj-opciones';
    for (const e of T.emblemas){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'aj-op';
      b.dataset.valor = e.id;
      b.textContent = `${e.icono} ${e.nombre}`;
      b.addEventListener('click', () => {
        progreso.fijarPreferencia('emblema', e.id);
        pintarEmblemas();
      });
      grupoEmblemas.appendChild(b);
    }
    gEmb.append(etqEmb, grupoEmblemas);

    const nota = document.createElement('p');
    nota.className = 'mini aj-nota';
    nota.textContent = T.nota;

    const fila = document.createElement('div');
    fila.className = 'fila-botones';
    btnCerrar = document.createElement('button');
    btnCerrar.type = 'button';
    btnCerrar.className = 'btn';
    btnCerrar.textContent = T.cerrar;
    btnCerrar.addEventListener('click', cerrar);
    fila.appendChild(btnCerrar);

    caja.append(h2, gNombre, gEmb, nota, fila);
    panel.appendChild(caja);
    document.body.appendChild(panel);

    // Esc cierra; Tab no se escapa del panel
    document.addEventListener('keydown', e => {
      if (!visible()) return;
      if (e.code === 'Escape'){ e.preventDefault(); e.stopPropagation(); cerrar(); return; }
      if (e.code === 'Tab'){
        const orden = [campo, ...grupoEmblemas.querySelectorAll('button:not(:disabled)'), btnCerrar];
        const i = orden.indexOf(document.activeElement);
        e.preventDefault();
        orden[(i + (e.shiftKey ? orden.length - 1 : 1)) % orden.length].focus();
      }
    }, true);

    /* botón junto a AJUSTES en menú/pausa */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sec btn-chico';
    btn.textContent = T.boton;
    btn.addEventListener('click', abrir);
    const ref = $('btn-ajustes');
    const filaAj = ref?.closest('.fila-ajustes') ?? ref?.parentElement;
    if (filaAj) filaAj.appendChild(btn);
    else {
      // respaldo: no se encontró dónde ponerlo → botón flotante arriba a la derecha
      btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:45;opacity:.9';
      document.body.appendChild(btn);
    }

    /* tarjeta del Arquitecto en el HUD (arriba de VIDA) */
    const estadoHud = $('panel-estado');
    if (estadoHud){
      const fila = document.createElement('div');
      fila.className = 'arq-hud';
      hudEmblema = document.createElement('span');
      hudEmblema.className = 'arq-emblema';
      hudNombre = document.createElement('span');
      hudNombre.className = 'arq-nombre';
      fila.append(hudEmblema, hudNombre);
      estadoHud.insertBefore(fila, estadoHud.firstChild);
    }
    pintarHud();
    bus.suscribir(EVENTOS.PREFERENCIAS_CAMBIADAS, pintarHud);
  },
};