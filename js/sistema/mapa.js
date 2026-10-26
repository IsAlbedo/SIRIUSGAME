// ═══════════════════════════════════════════════════════════
// sistema/mapa.js — mapa de misión: camino de sectores + ficha del sector.
// Accesible desde el menú y la pausa. Desde el menú permite abrir la intro
// de un sector; en pausa (a mitad de un nivel) es solo de consulta.
// La ficha muestra la ilustración del sector y sus RECOMPENSAS (herramienta,
// emblema, logro). Al restaurar un sector por primera vez, el mapa lo celebra.
// ═══════════════════════════════════════════════════════════
import { TEXTOS, formatear } from '../../datos/textos.js';
import { NIVELES } from '../../datos/niveles.js';
import { PLAZA } from '../../datos/plaza.js';
import { HERRAMIENTAS } from '../../datos/herramientas.js';
import { logroPorId } from '../../datos/logros.js';
import { bus, EVENTOS } from './eventos.js';
import { progreso } from './progreso.js';
import { estado, Fases } from './estado.js';
import { rangoFinal } from './rango.js';
import { emblemasDesbloqueadosEn } from './arquitecto.js';
import { audio } from './audio.js';

const $ = id => document.getElementById(id);
const N = NIVELES.length;            // el índice N representa la Plaza de Cristales

/* Textos nuevos con respaldo: si no están en TEXTOS.mapa (textos.js), el mapa funciona igual.
   Cuando quieras, muévelos a textos.js dentro de `mapa: { ... }`. */
const MAPA = Object.freeze({
  recompensas: 'RECOMPENSAS',
  tipoHerramienta: 'HERRAMIENTA',
  tipoEmblema: 'EMBLEMA',
  tipoLogro: 'LOGRO',
  emblemaDesc: 'Para personalizar a tu Arquitecto.',
  restauradoAhora: '✨ ¡SECTOR RESTAURADO!',
  ...TEXTOS.mapa,
});

const ICONO_HERR = {
  'escaner-datos': '🔍',
  'ensamblador-modulos': '🧱',
  'moldeador-ciudadanos': '🧬',
  'camara-jerarquias': '🌳',
  'nucleo-polimorfico': '🔷',
};

/* Ilustraciones: trazos SVG (viewBox 64×64) que toman el color del sector con currentColor. */
const ILUSTRACIONES = {
  'nivel-1': // racks de servidores
    '<rect x="8" y="8" width="48" height="14" rx="3"/><rect x="8" y="25" width="48" height="14" rx="3"/><rect x="8" y="42" width="48" height="14" rx="3"/>' +
    '<path d="M28 15h22M28 32h22M28 49h22"/>' +
    '<circle cx="17" cy="15" r="2" fill="currentColor" stroke="none"/><circle cx="17" cy="32" r="2" fill="currentColor" stroke="none"/><circle cx="17" cy="49" r="2" fill="currentColor" stroke="none"/>',
  'nivel-2': // grúa y muro
    '<path d="M12 38V8h36"/><path d="M48 8v12"/><circle cx="48" cy="24" r="3"/>' +
    '<rect x="8" y="40" width="22" height="8" rx="1.5"/><rect x="34" y="40" width="22" height="8" rx="1.5"/>' +
    '<rect x="8" y="50" width="14" height="8" rx="1.5"/><rect x="25" y="50" width="22" height="8" rx="1.5"/><rect x="50" y="50" width="6" height="8" rx="1.5"/>',
  'nivel-3': // ciudadanos
    '<circle cx="32" cy="18" r="7"/><path d="M20 52c0-10 5-17 12-17s12 7 12 17z"/>' +
    '<circle cx="11" cy="28" r="5"/><path d="M3 52c0-8 3-12 8-12"/>' +
    '<circle cx="53" cy="28" r="5"/><path d="M61 52c0-8-3-12-8-12"/>',
  'nivel-4': // jerarquía
    '<rect x="22" y="6" width="20" height="12" rx="3"/><path d="M32 18v8M12 26h40M12 26v8M32 26v8M52 26v8"/>' +
    '<rect x="4" y="34" width="16" height="10" rx="2"/><rect x="24" y="34" width="16" height="10" rx="2"/><rect x="44" y="34" width="16" height="10" rx="2"/>' +
    '<path d="M12 44v8M52 44v8"/><circle cx="12" cy="56" r="3"/><circle cx="52" cy="56" r="3"/>',
  'nivel-5': // núcleo con contratos
    '<path d="M32 8l18 10v20L32 48 14 38V18z"/><circle cx="32" cy="28" r="6"/>' +
    '<path d="M32 48v8M14 18L6 12M50 18l8-6M14 38l-8 6M50 38l8 6"/>' +
    '<circle cx="32" cy="58" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="58" cy="12" r="2.5"/><circle cx="6" cy="44" r="2.5"/><circle cx="58" cy="44" r="2.5"/>',
  plaza: // cristal
    '<path d="M32 4l17 19-17 37L15 23z"/><path d="M15 23h34M32 4l-7 19 7 37 7-37z"/>',
};

const ESTILOS = `
#panel-mapa .pantalla-caja{width:min(1080px,95vw);padding:26px 32px 24px}
.mp2-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.mp2-cab h2{margin:0}
.mp2-prog{min-width:250px}
.mp2-prog .mini{margin:0 0 6px;text-align:right}
.mp2-barra{height:8px;border-radius:4px;background:rgba(8,14,26,.8);border:1px solid rgb(var(--cian-rgb) / .3);overflow:hidden}
.mp2-barra i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--acento-2),var(--acento));transition:width .4s}
.mp2-cuerpo{display:grid;grid-template-columns:minmax(260px,380px) minmax(0,1fr);gap:26px;margin-top:20px;align-items:start}

/* camino */
.mp2-ruta{list-style:none;margin:0;padding:0}
.mp2-item{position:relative;padding-bottom:14px}
.mp2-item:last-child{padding-bottom:0}
.mp2-item:not(:last-child)::after{content:"";position:absolute;left:36px;top:calc(100% - 14px);height:14px;width:3px;
  background:rgb(var(--cian-rgb) / .22)}
.mp2-item.hecho:not(:last-child)::after{background:var(--mp-color)}
.mp2-nodo{display:flex;align-items:center;gap:14px;width:100%;padding:10px 14px 10px 12px;text-align:left;cursor:pointer;
  color:var(--texto);background:rgb(var(--cian-rgb) / .05);border:1px solid rgb(var(--cian-rgb) / .22);
  border-left:4px solid var(--mp-color);border-radius:12px;
  transition:transform .18s,background .18s,border-color .18s,box-shadow .18s}
.mp2-nodo:hover,.mp2-item.sel .mp2-nodo{transform:translateX(6px);border-color:var(--mp-color);
  background:linear-gradient(90deg,color-mix(in srgb,var(--mp-color) 22%,transparent),rgb(var(--cian-rgb) / .04));
  box-shadow:0 8px 24px rgba(0,0,0,.3),0 0 18px color-mix(in srgb,var(--mp-color) 30%,transparent)}
.mp2-nodo:focus-visible{outline:2px solid var(--texto-fuerte);outline-offset:2px}
.mp2-bola{position:relative;flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;
  font:700 16px var(--fuente-titulo);color:var(--texto-fuerte);border:3px solid var(--mp-color);background:rgba(8,14,26,.85)}
.mp2-item.hecho .mp2-bola{background:var(--mp-color);color:#081018}
.mp2-item.actual .mp2-bola{animation:mp2-pulso 1.8s ease-in-out infinite}
@keyframes mp2-pulso{50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--mp-color) 25%,transparent),0 0 18px var(--mp-color)}}
.mp2-item.bloqueado .mp2-nodo{opacity:.55}
.mp2-item.bloqueado .mp2-bola{border-style:dashed}
.mp2-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.mp2-txt b{font:700 14px var(--fuente-titulo);letter-spacing:.06em;color:var(--texto-fuerte)}
.mp2-txt span{font:600 13px var(--fuente-texto);color:var(--texto-suave)}
.mp2-txt em{font:700 12px var(--fuente-texto);font-style:normal;letter-spacing:.08em;color:var(--acento-suave)}

/* iconos / ilustraciones */
.mp2-ico{margin-left:auto;flex:none;width:38px;height:38px;color:var(--mp-color);opacity:.9}
.mp2-item.bloqueado .mp2-ico{opacity:.3}
.mp2-ico svg,.mp2-ilu svg{display:block;width:100%;height:100%}
.mp2-ilu{flex:none;width:88px;height:88px;color:var(--mp-color);
  filter:drop-shadow(0 0 10px color-mix(in srgb,var(--mp-color) 55%,transparent))}

/* ficha del sector */
.mp2-det{position:relative;display:flex;flex-direction:column;gap:12px;padding:22px 24px;min-height:430px;border-radius:16px;
  border:1px solid color-mix(in srgb,var(--mp-color) 55%,transparent);
  background:linear-gradient(160deg,color-mix(in srgb,var(--mp-color) 14%,rgba(8,14,26,.7)),rgba(8,14,26,.6));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08);transition:border-color .2s}
.mp2-det::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;border-radius:16px 16px 0 0;
  background:linear-gradient(90deg,var(--mp-color),transparent)}
.mp2-cabdet{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.mp2-et{font:700 11px var(--fuente-titulo);letter-spacing:.3em;color:var(--mp-color)}
.mp2-det h3{margin:6px 0 0;font:900 clamp(22px,2.4vw,30px)/1.1 var(--fuente-titulo);color:var(--texto-fuerte)}
.mp2-fila{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.mp2-chip{padding:4px 12px;border-radius:999px;font:700 12px var(--fuente-texto);letter-spacing:.1em;color:var(--texto);
  background:rgb(var(--cian-rgb) / .08);border:1px solid rgb(var(--cian-rgb) / .35)}
.mp2-chip.ok{color:#58f0a0;border-color:rgb(88 240 160 / .5)}
.mp2-chip.bloq{color:var(--etq)}
.mp2-estrellas{font-size:26px;letter-spacing:.12em;color:#ffd27a}
.mp2-estrellas .off{color:rgb(255 255 255 / .18)}
.mp2-txtdet{margin:0;font:600 15px/1.55 var(--fuente-texto);color:var(--texto-suave)}
.mp2-sub{font:700 11px var(--fuente-titulo);letter-spacing:.26em;color:var(--etq);margin-top:4px}
.mp2-temas{display:flex;flex-wrap:wrap;gap:6px}
.mp2-tema{padding:4px 10px;border-radius:8px;font:600 12px var(--fuente-texto);color:var(--texto);
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.mp2-stats{display:flex;gap:26px;flex-wrap:wrap;margin-top:auto;padding-top:14px;border-top:1px solid rgb(var(--cian-rgb) / .15)}
.mp2-stat{display:flex;flex-direction:column;gap:2px}
.mp2-stat span{font:600 11px var(--fuente-texto);letter-spacing:.2em;color:var(--etq)}
.mp2-stat b{font:700 18px var(--fuente-titulo);color:var(--texto-fuerte)}
.mp2-acciones{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:20px}

/* recompensas */
.mp2-premios{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
.mp2-premio{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:10px;opacity:.6;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.mp2-premio.ok{opacity:1;border-color:color-mix(in srgb,var(--mp-color) 60%,transparent);
  background:color-mix(in srgb,var(--mp-color) 10%,rgba(255,255,255,.03))}
.mp2-premio-ico{flex:none;width:30px;font-size:22px;text-align:center;line-height:1.2}
.mp2-premio-txt{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.mp2-premio-txt em{font:700 10px var(--fuente-titulo);font-style:normal;letter-spacing:.22em;color:var(--mp-color)}
.mp2-premio-txt b{font:700 13px var(--fuente-titulo);letter-spacing:.04em;color:var(--texto-fuerte)}
.mp2-premio-txt span{font:600 12px/1.4 var(--fuente-texto);color:var(--texto-suave)}
.mp2-premio-est{flex:none;font:700 14px var(--fuente-texto);color:var(--etq)}
.mp2-premio.ok .mp2-premio-est{color:#58f0a0}

/* ── celebración al restaurar un sector por primera vez ── */
.mp2-banner{align-self:flex-start;padding:5px 14px;border-radius:999px;font:700 12px var(--fuente-titulo);letter-spacing:.22em;
  color:#081018;background:linear-gradient(90deg,var(--mp-color),#ffd27a);animation:mp2-banner .7s cubic-bezier(.2,.9,.3,1.3) both}
@keyframes mp2-banner{from{opacity:0;transform:translateY(-12px) scale(.85)}to{opacity:1;transform:none}}
.mp2-item.recien .mp2-bola{animation:mp2-pop 1s cubic-bezier(.2,.9,.3,1.4) both}
.mp2-item.recien .mp2-bola::after{content:"";position:absolute;inset:-4px;border-radius:50%;
  border:3px solid var(--mp-color);animation:mp2-onda 1.3s ease-out .35s 2 both;pointer-events:none}
@keyframes mp2-pop{0%{transform:scale(.4) rotate(-90deg);opacity:0}60%{transform:scale(1.25)}100%{transform:none;opacity:1}}
@keyframes mp2-onda{from{transform:scale(1);opacity:.9}to{transform:scale(2.7);opacity:0}}
.mp2-item.recien .mp2-nodo{animation:mp2-destello 1.8s ease-out .2s backwards}
@keyframes mp2-destello{0%{box-shadow:0 0 0 0 transparent}30%{box-shadow:0 0 36px 6px color-mix(in srgb,var(--mp-color) 70%,transparent)}100%{box-shadow:0 0 0 0 transparent}}
.mp2-det.recien{animation:mp2-det 1.4s ease-out backwards}
@keyframes mp2-det{0%{box-shadow:0 0 0 0 transparent}40%{box-shadow:0 0 60px color-mix(in srgb,var(--mp-color) 55%,transparent)}100%{box-shadow:0 0 0 0 transparent}}
.mp2-det.recien .mp2-ilu{animation:mp2-ilu 1.2s ease-out .15s both}
@keyframes mp2-ilu{0%{transform:scale(.3) rotate(-25deg);opacity:0}70%{transform:scale(1.15) rotate(4deg)}100%{transform:none;opacity:1}}
.mp2-det.recien .mp2-premio.ok{animation:mp2-premio .6s ease-out both;animation-delay:calc(.5s + var(--i, 0) * .3s)}
@keyframes mp2-premio{0%{opacity:0;transform:translateY(14px) scale(.92)}60%{transform:scale(1.04)}100%{opacity:1;transform:none}}

@media (max-width:860px){.mp2-cuerpo{grid-template-columns:1fr}.mp2-det{min-height:0}}
@media (max-height:800px){
  .mp2-det{min-height:0;padding:16px 18px;gap:8px}
  .mp2-ilu{width:64px;height:64px}
  .mp2-txtdet{font-size:14px}
}
@media (prefers-reduced-motion:reduce){
  .mp2-item.actual .mp2-bola,.mp2-item.recien .mp2-bola,.mp2-item.recien .mp2-bola::after,.mp2-item.recien .mp2-nodo,
  .mp2-det.recien,.mp2-det.recien .mp2-ilu,.mp2-det.recien .mp2-premio.ok,.mp2-banner{animation:none}
}
`;

let panel = null, elResumen = null, barra = null, ruta = null, det = null, nota = null;
let btnEntrar = null, btnCerrar = null;
let origen = null, alElegir = null, alEntrarPlaza = null, sel = 0;
let pendiente = null;          // id del sector recién restaurado que aún no se ha celebrado
let animando = null;           // id del sector que se está celebrando en este momento
const yaCompletados = new Set(); // sectores que ya estaban completos al empezarlos

const visible = () => panel && !panel.classList.contains('oculto');
const soloVer = () => estado.fase === Fases.NIVEL;      // a mitad de un nivel no se cambia de sector
const plazaLibre = () => NIVELES.some(n => progreso.nivelCompletado(n.id));
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

/** Ilustración del sector (SVG propio, no viene de fuera: es seguro usar innerHTML). */
function ilustracion(clave, cls){
  const s = el('span', cls);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ILUSTRACIONES[clave] ?? ILUSTRACIONES.plaza}</svg>`;
  return s;
}

/** Recompensas de un sector (i < N) o de la Plaza (i === N), con su estado ganado / por ganar. */
function recompensasDe(i){
  const M = MAPA;
  const logro = (id) => {
    const l = logroPorId(id);
    return l && { icono: '🏆', tipo: M.tipoLogro, titulo: l.nombre,
      desc: l.descripcion ?? l.texto ?? '', ok: progreso.tieneLogro(l.id) };
  };
  if (i >= N) return ['arquitecto-completo', 'perfeccionista'].map(logro).filter(Boolean);

  const cfg = NIVELES[i];
  const lista = [];
  for (const h of HERRAMIENTAS.filter(x => x.desbloqueadaEn === cfg.id)){
    lista.push({ icono: ICONO_HERR[h.id] ?? '🛠', tipo: M.tipoHerramienta, titulo: h.nombre,
      desc: h.descripcion, ok: progreso.herramientaDesbloqueada(h.id) });
  }
  for (const e of emblemasDesbloqueadosEn(cfg.id)){
    lista.push({ icono: e.icono, tipo: M.tipoEmblema, titulo: e.nombre,
      desc: M.emblemaDesc, ok: progreso.nivelCompletado(cfg.id) });
  }
  for (const id of cfg.logros ?? []){
    const l = logro(id);
    if (l) lista.push(l);
  }
  return lista;
}

function datosNivel(i){
  const recomendado = NIVELES.findIndex(n => !progreso.nivelCompletado(n.id)); // -1 = todo completado
  const cfg = NIVELES[i];
  const hecho = progreso.nivelCompletado(cfg.id);
  const bloqueado = recomendado !== -1 && i > recomendado;
  return { cfg, hecho, bloqueado };
}

function entrar(i){
  if (soloVer()) return;
  if (i < N){
    if (datosNivel(i).bloqueado) return;
    cerrar(); alElegir?.(i);
  } else {
    if (!plazaLibre()) return;
    cerrar(); alEntrarPlaza?.();
  }
}

/* ── camino de sectores ── */
function crearNodo(i, { color, clase, bola, titulo, sub, info, ilu }){
  const li = el('li', `mp2-item ${clase}${i === sel ? ' sel' : ''}`);
  li.style.setProperty('--mp-color', color);
  const b = el('button', 'mp2-nodo');
  b.type = 'button';
  b.setAttribute('aria-pressed', String(i === sel));
  const tx = el('span', 'mp2-txt');
  tx.append(el('b', '', titulo), el('span', '', sub), el('em', '', info));
  b.append(el('span', 'mp2-bola', bola), tx, ilustracion(ilu, 'mp2-ico'));
  b.addEventListener('mouseenter', () => seleccionar(i));
  b.addEventListener('focus', () => seleccionar(i));
  b.addEventListener('click', () => seleccionar(i));
  b.addEventListener('dblclick', () => entrar(i));
  li.appendChild(b);
  return li;
}

function pintarRuta(){
  const M = MAPA;
  ruta.replaceChildren();
  NIVELES.forEach((cfg, i) => {
    const { hecho, bloqueado } = datosNivel(i);
    const e = hecho ? progreso.estrellasDe(cfg.id) : 0;
    const base = hecho ? 'hecho' : bloqueado ? 'bloqueado' : 'actual';
    ruta.appendChild(crearNodo(i, {
      color: cfg.paleta.primario,
      clase: base + (animando === cfg.id ? ' recien' : ''),
      bola: hecho ? '✓' : bloqueado ? '🔒' : String(cfg.numero),
      titulo: `N${cfg.numero} · ${cfg.titulo}`,
      sub: cfg.sector,
      info: hecho ? `✓ ${'★'.repeat(e)}${'☆'.repeat(3 - e)}` : bloqueado ? `🔒 ${M.bloqueado}` : `▶ ${M.disponible}`,
      ilu: cfg.id,
    }));
  });
  const libre = plazaLibre();
  ruta.appendChild(crearNodo(N, {
    color: PLAZA.paleta.primario,
    clase: libre ? '' : 'bloqueado',
    bola: libre ? '★' : '🔒',
    titulo: `★ ${PLAZA.titulo}`,
    sub: PLAZA.sector,
    info: libre ? `▶ ${M.plazaVisitar}` : `🔒 ${M.plazaBloqueada}`,
    ilu: 'plaza',
  }));
}

function seleccionar(i){
  if (i === sel) return;
  sel = i;
  animando = null; // la celebración solo se ve al abrir el mapa
  [...ruta.children].forEach((li, k) => {
    li.classList.toggle('sel', k === sel);
    li.firstChild.setAttribute('aria-pressed', String(k === sel));
  });
  pintarDetalle();
}

/* ── ficha del sector seleccionado ── */
function pintarDetalle(){
  const M = MAPA;
  det.replaceChildren();
  const ver = soloVer();
  let color, et, titulo, chip, chipCls, estrellas = null, desc = '', subT = '', resumen = '', clave = 'plaza';
  let temas = [], stats = [], puede = false, boton = '', aviso = '', recien = false;

  if (sel < N){
    const { cfg, hecho, bloqueado } = datosNivel(sel);
    const ap = TEXTOS.aprendizaje?.niveles?.[cfg.id];
    clave = cfg.id;
    recien = animando === cfg.id;
    color = cfg.paleta.primario;
    et = `NIVEL ${cfg.numero} · ${cfg.sector}`;
    titulo = cfg.titulo;
    chip = hecho ? `✓ ${M.restaurado}` : bloqueado ? `🔒 ${M.bloqueado}` : `▶ ${M.disponible}`;
    chipCls = hecho ? 'ok' : bloqueado ? 'bloq' : '';
    estrellas = hecho ? progreso.estrellasDe(cfg.id) : null;
    desc = cfg.contexto ?? '';
    subT = hecho ? 'LO QUE APRENDISTE' : 'LO QUE VERÁS';
    resumen = hecho ? (ap?.resumen ?? '') : '';
    temas = ap?.temas ?? [];
    stats = [
      ['MEJOR PUNTUACIÓN', hecho ? String(progreso.datos.puntuaciones[cfg.id] ?? 0) : '—'],
      ['REGISTRO DE GUSTAFF', progreso.tieneRegistro(cfg.id) ? '📼 ✓' : '—'],
    ];
    puede = !bloqueado && !ver;
    boton = hecho ? '↻ REJUGAR SECTOR' : bloqueado ? '🔒 BLOQUEADO' : '▶ ENTRAR AL SECTOR';
    aviso = ver ? M.notaSoloVer : bloqueado ? M.notaBloqueado : '';
  } else {
    const libre = plazaLibre();
    const { rango, estrellas: ganadas, maxEstrellas } = rangoFinal();
    color = PLAZA.paleta.primario;
    et = `★ ${PLAZA.sector}`;
    titulo = PLAZA.titulo;
    chip = libre ? `▶ ${M.plazaVisitar}` : `🔒 ${M.plazaBloqueada}`;
    chipCls = libre ? '' : 'bloq';
    desc = PLAZA.contexto ?? 'Cada sector restaurado enciende un cristal. Examínalos para repasar lo que aprendiste; el Monumento central despierta cuando reúnes todas las estrellas.';
    stats = [['ESTRELLAS', `${ganadas}/${maxEstrellas}`], ['RANGO', rango.nombre]];
    puede = libre && !ver;
    boton = libre ? '▶ VISITAR LA PLAZA' : '🔒 BLOQUEADA';
    aviso = ver ? M.notaSoloVer : '';
  }

  det.style.setProperty('--mp-color', color);
  det.classList.toggle('recien', recien);
  if (recien) det.appendChild(el('div', 'mp2-banner', M.restauradoAhora));

  // cabecera: etiqueta + título a la izquierda, ilustración del sector a la derecha
  const cab = el('div', 'mp2-cabdet');
  const bloqueTitulo = el('div');
  bloqueTitulo.append(el('div', 'mp2-et', et), el('h3', '', titulo));
  cab.append(bloqueTitulo, ilustracion(clave, 'mp2-ilu'));
  det.appendChild(cab);

  const fila = el('div', 'mp2-fila');
  fila.appendChild(el('span', `mp2-chip ${chipCls}`, chip));
  if (estrellas != null){
    const s = el('span', 'mp2-estrellas');
    s.setAttribute('aria-label', `${estrellas} de 3 estrellas`);
    [0, 1, 2].forEach(k => s.appendChild(el('span', k < estrellas ? '' : 'off', '★')));
    fila.appendChild(s);
  }
  det.appendChild(fila);

  if (desc) det.appendChild(el('p', 'mp2-txtdet', desc));

  // recompensas del sector
  const premios = recompensasDe(sel);
  if (premios.length){
    det.appendChild(el('div', 'mp2-sub', M.recompensas));
    const caja = el('div', 'mp2-premios');
    let orden = 0;
    for (const p of premios){
      const f = el('div', `mp2-premio${p.ok ? ' ok' : ''}`);
      if (p.ok) f.style.setProperty('--i', String(orden++));
      const ic = el('span', 'mp2-premio-ico', p.icono);
      ic.setAttribute('aria-hidden', 'true');
      const tx = el('div', 'mp2-premio-txt');
      tx.append(el('em', '', p.tipo), el('b', '', p.titulo), el('span', '', p.desc));
      const est = el('span', 'mp2-premio-est', p.ok ? '✓' : '🔒');
      est.setAttribute('aria-label', p.ok ? 'ganada' : 'por ganar');
      f.append(ic, tx, est);
      caja.appendChild(f);
    }
    det.appendChild(caja);
  }

  if (resumen || temas.length) det.appendChild(el('div', 'mp2-sub', subT));
  if (resumen) det.appendChild(el('p', 'mp2-txtdet', resumen));
  if (temas.length){
    const t = el('div', 'mp2-temas');
    temas.forEach(x => t.appendChild(el('span', 'mp2-tema', x)));
    det.appendChild(t);
  }
  const st = el('div', 'mp2-stats');
  for (const [etq, val] of stats){
    const c = el('div', 'mp2-stat');
    c.append(el('span', '', etq), el('b', '', val));
    st.appendChild(c);
  }
  det.appendChild(st);

  btnEntrar.textContent = boton;
  btnEntrar.disabled = !puede;
  nota.textContent = aviso;
  nota.classList.toggle('oculto', !aviso);
}

function pintar(){
  const M = MAPA;
  const hechos = NIVELES.filter(n => progreso.nivelCompletado(n.id)).length;
  elResumen.textContent = formatear(M.resumen, { hechos, total: N, puntos: progreso.datos.total });
  barra.style.width = `${Math.round(100 * hechos / N)}%`;
  pintarRuta();
  pintarDetalle();
}

function abrir(){
  origen = document.activeElement;
  const rec = NIVELES.findIndex(n => !progreso.nivelCompletado(n.id));

  // ¿hay un sector recién restaurado por celebrar? (no se celebra a mitad de un nivel)
  const iPend = (!soloVer() && pendiente) ? NIVELES.findIndex(n => n.id === pendiente) : -1;
  animando = iPend >= 0 ? pendiente : null;
  if (iPend >= 0) pendiente = null;

  sel = soloVer() ? Math.max(0, Math.min(N - 1, estado.nivelActual ?? 0))
    : iPend >= 0 ? iPend
    : (rec >= 0 ? rec : N);
  pintar();
  panel.classList.remove('oculto');
  ruta.querySelectorAll('.mp2-nodo')[sel]?.focus();
  if (animando){ try { audio.feedback('exito'); } catch {} }
}

function cerrar(){
  panel.classList.add('oculto');
  animando = null;
  if (origen?.focus) origen.focus();
}

export const mapa = {
  /**
   * @param {(indiceNivel:number)=>void} elegir — abre la intro del nivel elegido
   * @param {()=>void} [entrarPlaza] — entra a la Plaza de Cristales
   */
  iniciar(elegir, entrarPlaza){
    alElegir = elegir;
    alEntrarPlaza = entrarPlaza ?? null;
    const M = MAPA;

    if (!document.getElementById('mp-estilos')){
      const st = document.createElement('style');
      st.id = 'mp-estilos'; st.textContent = ESTILOS;
      document.head.appendChild(st);
    }

    // celebración: solo la PRIMERA vez que se completa un sector
    bus.suscribir(EVENTOS.LEVEL_STARTED, ({ config }) => {
      if (!config) return;
      if (progreso.nivelCompletado(config.id)) yaCompletados.add(config.id);
      else yaCompletados.delete(config.id);
    });
    bus.suscribir(EVENTOS.LEVEL_COMPLETED, resultado => {
      const id = resultado?.config?.id;
      if (!id) return;
      if (!yaCompletados.has(id)) pendiente = id;
      yaCompletados.add(id);
    });

    panel = el('div', 'pantalla oculto');
    panel.id = 'panel-mapa';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'mp-titulo');

    const caja = el('div', 'pantalla-caja');
    const cab = el('div', 'mp2-cab');
    const h2 = el('h2', '', M.titulo);
    h2.id = 'mp-titulo';
    const prog = el('div', 'mp2-prog');
    elResumen = el('p', 'mini');
    barra = el('i');
    const pista = el('div', 'mp2-barra');
    pista.appendChild(barra);
    prog.append(elResumen, pista);
    cab.append(h2, prog);

    const cuerpo = el('div', 'mp2-cuerpo');
    ruta = el('ol', 'mp2-ruta');
    det = el('div', 'mp2-det');
    cuerpo.append(ruta, det);

    nota = el('p', 'mini oculto');
    const acciones = el('div', 'mp2-acciones');
    btnEntrar = el('button', 'btn');
    btnEntrar.type = 'button';
    btnEntrar.addEventListener('click', () => entrar(sel));
    btnCerrar = el('button', 'btn btn-sec', M.cerrar);
    btnCerrar.type = 'button';
    btnCerrar.addEventListener('click', cerrar);
    acciones.append(btnEntrar, btnCerrar);

    caja.append(cab, cuerpo, nota, acciones);
    panel.appendChild(caja);
    document.body.appendChild(panel);

    // Esc cierra; ↑↓ recorren el camino; Tab no se escapa del panel
    document.addEventListener('keydown', e => {
      if (!visible()) return;
      if (e.code === 'Escape'){ e.preventDefault(); e.stopPropagation(); cerrar(); return; }
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp'){
        const nodos = [...ruta.querySelectorAll('.mp2-nodo')];
        const i = nodos.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        nodos[(i + (e.code === 'ArrowDown' ? 1 : nodos.length - 1)) % nodos.length].focus();
        return;
      }
      if (e.code === 'Tab'){
        const orden = [...panel.querySelectorAll('button:not(:disabled)')];
        const i = orden.indexOf(document.activeElement);
        e.preventDefault();
        orden[(i + (e.shiftKey ? orden.length - 1 : 1)) % orden.length].focus();
      }
    }, true);

    // botón junto a AJUSTES en menú/pausa
    const btn = el('button', 'btn btn-sec btn-chico', M.boton);
    btn.type = 'button';
    btn.addEventListener('click', abrir);
    $('btn-ajustes')?.closest('.fila-ajustes')?.appendChild(btn);
  },
};