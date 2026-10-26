// ═══════════════════════════════════════════════════════════
// sistema/menuVida.js — menú de inicio y pausa con submenús laterales:
//  · CENTRO: título, tarjeta del Arquitecto (emblema, nombre, ruta de los 5 sectores,
//    próxima misión) e INICIAR / REANUDAR. Nada más: queda despejado.
//  · IZQUIERDA (flotante): AJUSTES · REGLAS · MAPA · ARQUITECTO · LOGROS.
//    En la pausa se añaden, separados, REINICIAR NIVEL y SALIR AL MENÚ (piden confirmar).
//  · DERECHA (flotante): al pasar el ratón (o el foco) por un botón de la izquierda muestra
//    de qué trata y cómo lo tienes ahora; si no, el consejo de Aria y tu próximo logro.
//  · PAUSA distinta del inicio: etiqueta ⏸, color ámbar, nivel y objetivos.
//  · Panel 🏆 LOGROS (ganados / por ganar) y fondo animado (CSS puro).
// En pantallas angostas (< 1240 px) los submenús pasan a una fila bajo la tarjeta.
// Todo se crea desde aquí: no hace falta tocar index.html ni styles.css.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';
import { estado, Fases, Modos } from './estado.js';
import { progreso } from './progreso.js';
import { feedback } from './feedback.js';
import { nombreArquitecto, emblemaActual } from './arquitecto.js';
import { NIVELES } from '../../datos/niveles.js';
import { LOGROS } from '../../datos/logros.js';

const $ = id => document.getElementById(id);

const CONSEJOS = [
  'Pulsa P y te doy una pista.',
  'Acércate a la terminal y pulsa E para programar.',
  'Pulsa M para ver u ocultar tu misión sin soltar la cámara.',
  'Alt libera el cursor sin pausar el juego.',
  'Pulsa V para silenciar o activar mi voz.',
  'Si te lastimas, pulsa H para curarte.',
];

const ESTILOS = `
/* ── fondo con vida ── */
#overlay{isolation:isolate}
#overlay::before{content:"";position:absolute;inset:-20%;z-index:-1;pointer-events:none;
  background:radial-gradient(40% 35% at 22% 30%,rgb(var(--acento-rgb) / .16),transparent 70%),
             radial-gradient(38% 36% at 78% 68%,rgb(var(--cian-rgb) / .20),transparent 70%),
             radial-gradient(30% 30% at 60% 15%,rgb(var(--cian-rgb) / .10),transparent 70%);
  animation:mv-deriva 18s ease-in-out infinite alternate}
#overlay::after{content:"";position:absolute;left:-50%;right:-50%;bottom:-8%;height:52%;z-index:-1;pointer-events:none;
  background-image:linear-gradient(rgb(var(--cian-rgb) / .22) 1px,transparent 1px),
                   linear-gradient(90deg,rgb(var(--cian-rgb) / .22) 1px,transparent 1px);
  background-size:52px 52px;
  transform:perspective(520px) rotateX(64deg);transform-origin:50% 100%;
  -webkit-mask-image:linear-gradient(to top,#000 5%,transparent 88%);mask-image:linear-gradient(to top,#000 5%,transparent 88%);
  animation:mv-suelo 3.2s linear infinite}
@keyframes mv-deriva{from{transform:translate(-3%,-2%) scale(1)}to{transform:translate(3%,2%) scale(1.08)}}
@keyframes mv-suelo{to{background-position:0 52px}}
#overlay.mv-modo-pausa::after{background-image:linear-gradient(rgb(var(--acento-rgb) / .20) 1px,transparent 1px),
                   linear-gradient(90deg,rgb(var(--acento-rgb) / .20) 1px,transparent 1px)}
html[data-tema="alto-contraste"] #overlay::before,html[data-tema="alto-contraste"] #overlay::after{display:none}

/* ── 3 columnas: submenús · caja central · información ── */
#overlay{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}
#overlay > .overlay-caja{grid-column:2;grid-row:1}
#overlay .overlay-simple{width:min(600px,94vw);padding:26px 34px 22px}
#overlay .fila-ajustes{display:none}
#ov-titulo-acento{animation:mv-respira 4s ease-in-out infinite}
@keyframes mv-respira{0%,100%{text-shadow:0 0 4px currentColor}50%{text-shadow:0 0 20px currentColor}}
#overlay #btn-jugar{padding:16px 64px;font-size:16px;animation:mv-latido 2.6s ease-in-out infinite}
@keyframes mv-latido{0%,100%{filter:brightness(1)}50%{filter:brightness(1.14)}}
#overlay.mv-modo-pausa .overlay-caja{border-color:rgb(var(--acento-rgb) / .5)}
#overlay.mv-modo-pausa .overlay-sub{display:none}
#overlay.mv-modo-pausa h1{font-size:clamp(24px,4vw,34px)}
.mv-tag{display:none;margin:0 auto 10px;width:max-content;padding:5px 16px;font:700 12px var(--fuente-titulo);letter-spacing:.4em;
  color:var(--acento);border:1px solid rgb(var(--acento-rgb) / .6);background:rgb(var(--acento-rgb) / .10)}
#overlay.mv-modo-pausa .mv-tag{display:block}

/* ── submenús flotantes (izquierda) ── */
.mv-rail,.mv-info{align-self:center;zoom:var(--zoom-texto);padding:14px 16px;
  background:rgba(8,14,26,.55);border:1px solid rgb(var(--cian-rgb) / .28);backdrop-filter:blur(8px);
  clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
#overlay.mv-modo-pausa .mv-rail,#overlay.mv-modo-pausa .mv-info{border-color:rgb(var(--acento-rgb) / .4)}
.mv-rail{grid-column:1;grid-row:1;justify-self:end;margin-right:26px;width:214px;display:flex;flex-direction:column;gap:8px}
.mv-rail-tit,.mv-info-tit{font:700 11px var(--fuente-titulo);letter-spacing:.3em;color:var(--etq)}
.mv-rail-tit{margin-bottom:4px}
#overlay .mv-rail .btn{flex:none;width:100%;min-width:0;padding:12px 14px;text-align:left;font-size:12px;letter-spacing:.14em;
  white-space:nowrap;cursor:pointer}
#overlay .mv-rail .btn:hover{transform:translateX(4px)}
.mv-sep{display:none;flex:none;height:0;width:100%}
#overlay.mv-modo-pausa .mv-sep{display:block;height:1px;margin:6px 0 2px;background:rgb(var(--cian-rgb) / .2)}
#overlay:not(.mv-modo-pausa) .mv-solo-pausa{display:none}
#overlay .mv-rail .mv-peligro{border-color:rgba(255,141,122,.6);color:#ffb3a3}
#overlay .mv-rail .mv-peligro[data-armado="1"]{background:rgba(255,93,93,.3);color:#fff;border-color:#ff5d5d}

/* ── información (derecha) ── */
.mv-info{grid-column:3;grid-row:1;justify-self:start;margin-left:26px;width:262px;min-height:168px}
.mv-info-tit{color:var(--acento)}
.mv-info-txt{margin-top:10px;font:600 14px/1.5 var(--fuente-texto);color:var(--texto)}
.mv-info-extra{margin-top:12px;padding-top:10px;border-top:1px solid rgb(var(--cian-rgb) / .15);
  font:600 12px/1.5 var(--fuente-texto);letter-spacing:.04em;color:var(--texto-suave)}

/* ── pantallas angostas: los submenús pasan a una fila bajo la tarjeta ── */
@media (max-width:1240px){
  #overlay{grid-template-columns:minmax(0,1fr);align-content:center;gap:14px;overflow:auto;padding:12px 0}
  #overlay > .overlay-caja{grid-column:1;grid-row:1;justify-self:center}
  .mv-rail{grid-column:1;grid-row:2;justify-self:center;margin:0;width:min(94vw,600px);flex-direction:row;flex-wrap:wrap;justify-content:center}
  .mv-rail-tit{display:none}
  #overlay .mv-rail .btn{width:auto;flex:1 1 calc(33.333% - 8px);text-align:center}
  .mv-sep{flex:0 0 100%}
  .mv-info{display:none}
}

/* ── tarjeta del Arquitecto: cabecera · ruta · misión ── */
.mv-card{margin:16px auto 22px;width:100%;max-width:560px;padding:16px 20px 14px;text-align:left;
  border:1px solid rgb(var(--cian-rgb) / .30);background:rgba(8,14,26,.55);
  clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
.mv-cab{display:flex;align-items:center;gap:14px}
.mv-emblema{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;font-size:26px;
  background:radial-gradient(circle,rgb(var(--acento-rgb) / .28),rgb(var(--cian-rgb) / .10));
  border:2px solid var(--acento);box-shadow:0 0 16px rgb(var(--acento-rgb) / .35)}
.mv-id{min-width:0}
.mv-nombre{display:block;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font:700 19px var(--fuente-titulo);letter-spacing:.08em;color:var(--texto-fuerte)}
.mv-rango{display:block;margin-top:3px;font:600 11px var(--fuente-texto);letter-spacing:.3em;color:var(--etq);text-transform:uppercase}
.mv-chips{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.mv-chip{padding:3px 12px;border-radius:999px;font:700 12px var(--fuente-texto);letter-spacing:.1em;color:var(--texto);white-space:nowrap;
  background:rgb(var(--cian-rgb) / .08);border:1px solid rgb(var(--cian-rgb) / .35)}

.mv-ruta{display:flex;align-items:center;justify-content:center;gap:26px;margin-top:16px;padding-top:16px;
  border-top:1px solid rgb(var(--cian-rgb) / .15)}
.mv-pip{position:relative;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;
  font:700 12px var(--fuente-titulo);color:var(--etq);border:2px solid rgb(var(--cian-rgb) / .35);background:rgba(8,14,26,.8)}
.mv-pip:not(:first-child)::before{content:"";position:absolute;right:100%;top:50%;width:26px;height:2px;
  background:rgb(var(--cian-rgb) / .25)}
.mv-pip.hecho{color:#081018;background:var(--acento);border-color:var(--acento);box-shadow:0 0 10px rgb(var(--acento-rgb) / .45)}
.mv-pip.hecho::before{background:var(--acento)}
.mv-pip.actual{color:var(--acento);border-color:var(--acento);animation:mv-pip 1.8s ease-in-out infinite}
@keyframes mv-pip{50%{box-shadow:0 0 14px rgb(var(--acento-rgb) / .65)}}

.mv-mision,.mv-pausa{margin-top:14px;padding:8px 12px;text-align:center;font:600 13px var(--fuente-texto);letter-spacing:.06em;color:var(--texto)}
.mv-mision{border:1px solid rgb(var(--acento-rgb) / .35);background:rgb(var(--acento-rgb) / .07)}
.mv-mision b{color:var(--acento)}
.mv-pausa{display:none;border:1px solid rgb(var(--acento-rgb) / .5);background:rgb(var(--acento-rgb) / .10);color:var(--acento-suave)}
.mv-pausa.on{display:block}
.mv-barra{height:5px;margin-top:6px;background:rgba(8,14,26,.8);border:1px solid rgb(var(--acento-rgb) / .3);border-radius:3px;overflow:hidden}
.mv-barra i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--acento-2),var(--acento));transition:width .4s}
@media (max-width:560px){.mv-cab{flex-wrap:wrap}.mv-chips{margin-left:0;width:100%;flex-direction:row}.mv-ruta{gap:18px}}
@media (max-height:720px){.mv-ruta{margin-top:10px;padding-top:10px}}

/* ── panel de logros ── */
#panel-logros{position:fixed;inset:0;z-index:300;background:rgba(5,8,24,.97)}
#panel-logros .mv-lista{list-style:none;margin:12px 0;padding:0 6px 0 0;max-height:55vh;overflow:auto;display:grid;gap:8px}
.mv-logro{display:flex;gap:12px;align-items:center;padding:10px 12px;
  border:1px solid rgb(var(--cian-rgb) / .3);background:rgb(var(--cian-rgb) / .05);opacity:.7}
.mv-logro.ganado{opacity:1;border-color:var(--acento);background:rgb(var(--acento-rgb) / .08)}
.mv-logro .ic{font-size:26px;flex:none;width:34px;text-align:center}
.mv-logro .nm{font:700 14px var(--fuente-titulo);letter-spacing:.05em;color:var(--texto-fuerte)}
.mv-logro .tx{margin-top:2px;font:600 13px var(--fuente-texto);color:var(--texto-suave)}
.mv-logro .cita{margin-top:4px;font:600 13px var(--fuente-texto);font-style:italic;color:var(--acento-suave)}
.mv-logro .st{margin-left:auto;font:700 11px var(--fuente-texto);letter-spacing:.14em;color:var(--etq);flex:none}
.mv-logro.ganado .st{color:#58f0a0}

/* ── intro del nivel: el botón principal primero y bien separado; AJUSTES y REGLAS debajo, discretos ── */
#pantalla-intro .pantalla-caja{display:flex;flex-direction:column;align-items:center}
#pantalla-intro .pantalla-caja .fila-botones{justify-content:center}
#pantalla-intro .fila-botones:has(#btn-comenzar){order:2;margin-top:24px}
#pantalla-intro .fila-botones:has(#btn-ajustes-intro){order:3;margin-top:18px}
#pantalla-intro #btn-comenzar{padding:15px 56px;font-size:15px}

@media (prefers-reduced-motion:reduce){
  #overlay::before,#overlay::after,#ov-titulo-acento,#overlay #btn-jugar,.mv-pip.actual{animation:none}
}

/* ── LAYOUT UNIFICADO: una columna centrada ── */
#overlay{grid-template-columns:minmax(0,1fr);grid-template-rows:auto;align-content:center;
  justify-items:center;row-gap:14px;overflow:auto;padding:16px 0}
#overlay > .overlay-caja{grid-column:1;grid-row:1}
#overlay .mv-rail,#overlay .mv-info{display:none}
#overlay .mv-rail{grid-row:2;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:8px}
#overlay .mv-rail-tit{display:none}
#overlay .mv-rail .btn{width:auto;flex:1 1 0;min-width:96px;text-align:center;
  padding:11px 8px;font-size:11px;letter-spacing:.1em}
#overlay .mv-rail .btn:hover{transform:translateY(-2px)}
#overlay .mv-sep{flex:0 0 100%}
#overlay .mv-info{display:none}

/* ── submenús: se ve el menú desenfocado detrás, no otro fondo ── */
#panel-mapa,#panel-ajustes,#panel-reglas,#panel-logros,#panel-arquitecto{
  background:rgba(4,7,14,.72);backdrop-filter:blur(10px)}


/* ═══ MENÚ v3: lista vertical centrada + perfil de cristal ═══ */
#overlay{display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:0}
#overlay .overlay-caja{display:contents}
#overlay .overlay-caja::before,#overlay .overlay-caja::after{display:none}
#overlay .mv-info{display:none}

/* centro: título → botón principal → lista de opciones */
#overlay .mv-tag{order:0;margin:0 0 12px}
#overlay h1{order:1;text-align:center;font-size:clamp(36px,4.6vw,68px);letter-spacing:.05em;line-height:1.05}
#overlay h1 #ov-titulo-acento{font-size:.45em;letter-spacing:.55em;margin-top:10px}
#overlay .overlay-sub{order:2;text-align:center;margin:14px 0 0;font-size:14px;letter-spacing:.2em}
#overlay #btn-jugar{order:3;width:min(440px,92vw);margin:30px 0 20px;padding:19px 30px;font-size:18px;text-align:center}
#overlay .mv-rail{order:4;display:flex;flex-direction:column;flex-wrap:nowrap;gap:6px;
  width:min(440px,92vw);margin:0;padding:0;background:none;border:none;clip-path:none;backdrop-filter:none}
#overlay .overlay-nota{order:5;text-align:center;margin:18px 0 0;font-size:11px}
#overlay .mv-rail-tit{display:none}
#overlay .mv-sep{flex:none;width:100%}
#overlay .mv-rail .btn{
  position:relative;flex:none;width:100%;min-width:0;padding:13px 40px 13px 22px;text-align:left;
  font-size:13px;letter-spacing:.2em;color:var(--texto-suave);
  background:linear-gradient(90deg,rgb(var(--cian-rgb) / .10),transparent 85%);
  border:none;border-left:3px solid rgb(var(--cian-rgb) / .35);clip-path:none;
  transition:transform .18s ease,background .18s,border-color .18s,color .18s}
#overlay .mv-rail .btn::after{content:"›";position:absolute;right:18px;top:50%;margin-top:-.6em;font-size:20px;
  color:var(--acento);opacity:0;transform:translateX(-8px);transition:opacity .18s,transform .18s}
#overlay .mv-rail .btn:hover,#overlay .mv-rail .btn:focus-visible{
  transform:translateX(8px);color:var(--texto-fuerte);border-left-color:var(--acento);box-shadow:none;filter:none;
  background:linear-gradient(90deg,rgb(var(--acento-rgb) / .24),transparent 92%)}
#overlay .mv-rail .btn:hover::after,#overlay .mv-rail .btn:focus-visible::after{opacity:1;transform:none}
#overlay .mv-rail .mv-peligro{border-left-color:#ff8d7a;color:#ffb3a3}
#overlay .mv-rail .mv-peligro[data-armado="1"]{background:rgba(255,93,93,.3);color:#fff;border-left-color:#ff5d5d}

/* ── perfil de cristal (arriba a la derecha) ── */
#overlay .mv-card{
  position:absolute;top:22px;right:26px;z-index:5;width:350px;max-width:calc(100vw - 52px);margin:0;padding:12px 16px;
  overflow:hidden;clip-path:none;border-radius:18px;
  background:linear-gradient(135deg,rgb(var(--acento-rgb) / .10),rgba(8,14,26,.28) 45%,rgb(var(--cian-rgb) / .08));
  backdrop-filter:blur(16px) saturate(1.5);-webkit-backdrop-filter:blur(16px) saturate(1.5);
  border:1px solid rgb(var(--cian-rgb) / .32);
  box-shadow:0 12px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.10);
  transition:background .25s,border-color .25s,box-shadow .25s}
#overlay .mv-card::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--acento),var(--cian),transparent)}
#overlay .mv-card:hover,#overlay .mv-card:focus-within{
  background:linear-gradient(135deg,rgb(var(--acento-rgb) / .16),rgba(8,14,26,.45) 50%,rgb(var(--cian-rgb) / .12));
  border-color:rgb(var(--acento-rgb) / .55);box-shadow:0 16px 50px rgba(0,0,0,.45),0 0 28px rgb(var(--acento-rgb) / .14)}
#overlay .mv-cab{display:flex;flex-direction:row;align-items:center;text-align:left;gap:12px}
#overlay .mv-emblema{width:46px;height:46px;font-size:23px;
  box-shadow:0 0 0 4px rgb(var(--acento-rgb) / .12),0 0 18px rgb(var(--acento-rgb) / .45)}
#overlay .mv-nombre{max-width:130px;font-size:16px}
#overlay .mv-rango{display:block;margin-top:2px;font-size:9px;letter-spacing:.28em}
#overlay .mv-chips{margin-left:auto;flex-direction:column;align-items:flex-end;gap:4px}
#overlay .mv-chip{font-size:11px;padding:2px 10px;background:rgba(255,255,255,.05);backdrop-filter:blur(4px)}
#overlay .mv-cab::after{content:"▾";color:var(--acento);font-size:14px;transition:transform .25s}
#overlay .mv-card:hover .mv-cab::after{transform:rotate(180deg)}

#overlay .mv-ruta,#overlay .mv-mision,#overlay .mv-pausa{display:none}
#overlay .mv-card:hover .mv-ruta,#overlay .mv-card:focus-within .mv-ruta{
  display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:6px;
  margin:14px 0 12px;padding-top:14px;animation:mv-aparece .28s ease both}
#overlay .mv-card:hover .mv-mision,#overlay .mv-card:focus-within .mv-mision{display:block;animation:mv-aparece .28s .05s ease both}
#overlay .mv-card:hover .mv-pausa.on,#overlay .mv-card:focus-within .mv-pausa.on{display:block;animation:mv-aparece .28s .05s ease both}
#overlay .mv-mision,#overlay .mv-pausa{margin-top:0;border-radius:10px;background:rgb(var(--acento-rgb) / .08);backdrop-filter:blur(4px)}
@keyframes mv-aparece{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}

/* filas de sectores (transparentes) */
.mv-sec{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:10px;
  background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);
  font:600 13px var(--fuente-texto);letter-spacing:.06em;color:var(--texto-suave)}
.mv-sec i{flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;
  font:700 11px var(--fuente-titulo);font-style:normal;border:2px solid rgb(var(--cian-rgb) / .4)}
.mv-sec.hecho i{background:var(--acento);border-color:var(--acento);color:#081018;box-shadow:0 0 10px rgb(var(--acento-rgb) / .4)}
.mv-sec.actual{color:var(--texto-fuerte);border-color:rgb(var(--acento-rgb) / .5);
  background:linear-gradient(90deg,rgb(var(--acento-rgb) / .18),rgba(255,255,255,.03))}
.mv-sec.actual i{border-color:var(--acento);color:var(--acento)}

@media (max-height:820px){
  #overlay h1{font-size:clamp(30px,4vw,50px)}
  #overlay #btn-jugar{margin:18px 0 12px;padding:14px 24px;font-size:16px}
  #overlay .mv-rail{gap:4px}
  #overlay .mv-rail .btn{padding:9px 36px 9px 20px;font-size:12px}
  #overlay .overlay-nota{margin-top:10px}
}

/* tarjeta de perfil más ancha + misión en una sola línea */
#overlay .mv-card{width:440px}
#overlay .mv-mision,#overlay .mv-pausa{padding:9px 10px;font-size:12.5px;letter-spacing:.03em;text-wrap:balance}

/* la tarjeta solo se despliega con el ratón encima */
#overlay .mv-card:not(:hover) .mv-ruta,
#overlay .mv-card:not(:hover) .mv-mision,
#overlay .mv-card:not(:hover) .mv-pausa.on{display:none}
#overlay .mv-card:not(:hover){
  background:linear-gradient(135deg,rgb(var(--acento-rgb) / .10),rgba(8,14,26,.28) 45%,rgb(var(--cian-rgb) / .08));
  border-color:rgb(var(--cian-rgb) / .32);
  box-shadow:0 12px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.10)}

/* pantallas chicas (1366×768 y similares): perfil compacto para no tapar el título */
@media (max-width:1500px), (max-height:800px){
  #overlay .mv-card{width:340px;top:14px;right:14px;padding:9px 12px}
  #overlay .mv-emblema{width:38px;height:38px;font-size:19px}
  #overlay .mv-nombre{font-size:14px;max-width:110px}
  #overlay .mv-chip{font-size:10px;padding:2px 8px}
  #overlay .mv-ruta .mv-sec{margin-left:26px}
  #overlay .mv-ruta .mv-sec i{width:26px;height:26px;font-size:11px}
  #overlay .mv-ruta .mv-sec:not(:first-child)::before{width:26px}
  #overlay .mv-mision,#overlay .mv-pausa{font-size:11.5px;padding:7px 8px}
  #overlay h1{font-size:clamp(30px,3.6vw,52px)}
}
/* si la pantalla es muy angosta, el perfil pasa arriba al centro */
@media (max-width:1100px){
  #overlay .mv-card{right:50%;transform:translateX(50%);width:min(340px,94vw)}
`;

let tarjeta, tag, elEmblema, elNombre, elRuta, chips, elMision, elPausa, elPausaTxt, elPausaBarra, filaAj;
let rail, info, infoTit, infoTxt, infoExtra, infoMapa, previewKey = null;
let panel, lista, titulo, btnCerrar, origen;
const desarmares = [];
let iConsejo = Math.floor(Math.random() * CONSEJOS.length);

const enPausa = () => estado.fase === Fases.NIVEL && estado.modo === Modos.PAUSA;
const panelVisible = () => panel && !panel.classList.contains('oculto');
const chip = txt => { const c = document.createElement('span'); c.className = 'mv-chip'; c.textContent = txt; return c; };
const etiquetaNivel = (n, i) => `Nivel ${n.numero ?? i + 1}${n.sector ? ' · ' + n.sector : ''}`;
const P = clave => progreso.preferencia(clave);
const ganadosN = () => LOGROS.filter(l => progreso.tieneLogro(l.id)).length;
const sigLogro = () => LOGROS.find(l => !progreso.tieneLogro(l.id));
const descLogro = l => l.descripcion ?? l.texto ?? '';
const iProxima = () => NIVELES.findIndex(n => !progreso.nivelCompletado(n.id));

/* qué se muestra a la derecha al pasar por cada submenú: [título, texto, extra] */
const PREVIEW = {
  AJUSTES: () => ['AJUSTES', 'Tema de color, fuente, tamaño del texto y voz de Aria.',
    `Ahora: tema ${P('tema')} · fuente ${P('fuente')} · texto ${P('tamano')} · voz de Aria ${P('vozActiva') ? 'activa' : 'silenciada'}`],
  REGLAS: () => ['REGLAS', 'Cómo se juega y cómo se puntúa. Puedes volver a leerlas cuando quieras.', ''],
  MAPA: () => {
    const hechos = NIVELES.filter(n => progreso.nivelCompletado(n.id)).length, i = iProxima();
    return ['MAPA DE MISIÓN', 'Tus cinco sectores y cuáles ya restauraste. Desde aquí puedes rejugar los que ya completaste.',
      `${hechos}/${NIVELES.length} restaurados` + (i >= 0 ? ` · sigue: ${etiquetaNivel(NIVELES[i], i)}` : ' · ¡todos listos!')];
  },
  ARQUITECTO: () => ['ARQUITECTO', 'Tu nombre y tu emblema. Aria y Eclipse te llaman por tu nombre.',
    `Ahora: ${emblemaActual().icono} ${nombreArquitecto()}`],
  LOGROS: () => {
    const f = sigLogro();
    return ['LOGROS', 'Tus insignias de Arquitecto y cómo conseguir las que faltan.',
      `${ganadosN()}/${LOGROS.length} ganados` + (f ? ` · próximo: ${f.nombre}` : ' · ¡todos!')];
  },
  REINICIAR: () => ['REINICIAR NIVEL', 'Empiezas el nivel actual desde el principio.', 'Pide confirmación con un segundo clic.'],
  SALIR: () => ['SALIR AL MENÚ', 'Vuelves al menú principal.',
    'El avance de este nivel se pierde; los niveles ya completados se conservan. Pide confirmación.'],
};

function pintarInfo(){
  if (!info) return;
  let t, txt, extra;
  if (previewKey && PREVIEW[previewKey]) [t, txt, extra] = PREVIEW[previewKey]();
  else {
    const f = sigLogro();
    t = 'ARIA';
    txt = CONSEJOS[iConsejo];
    extra = f ? `🔒 Próximo logro: ${f.nombre} — ${descLogro(f)}` : '🎉 ¡Ya ganaste todos los logros!';
  }
  infoTit.textContent = t;
  infoTxt.textContent = txt;
  infoExtra.textContent = extra ?? '';
  infoExtra.style.display = extra ? '' : 'none';
}

function refrescar(){
  if (!tarjeta) return;
  const pausa = enPausa();
  $('overlay')?.classList.toggle('mv-modo-pausa', pausa);
  desarmares.forEach(f => f());

  elEmblema.textContent = emblemaActual().icono;
  elNombre.textContent = nombreArquitecto();

  /* ruta de sectores */
  const hechos = NIVELES.filter(n => progreso.nivelCompletado(n.id)).length;
  const iActual = iProxima();
  elRuta.setAttribute('aria-label', `Sectores restaurados: ${hechos} de ${NIVELES.length}`);
   elRuta.replaceChildren(...NIVELES.map((n, i) => {
    const hecho = progreso.nivelCompletado(n.id);
    const fila = document.createElement('div');
    fila.className = 'mv-sec' + (hecho ? ' hecho' : i === iActual ? ' actual' : '');
    fila.title = etiquetaNivel(n, i);
    const num = document.createElement('i');
    num.textContent = hecho ? '✓' : String(i + 1);
    const nom = document.createElement('span');
    nom.textContent = n.sector ?? n.titulo;
    fila.append(num, nom);
    return fila;
  }));
  chips.replaceChildren(
    chip(`★ ${progreso.datos.total} puntos`),
    chip(`🏆 ${ganadosN()}/${LOGROS.length} logros`),
  );

  /* próxima misión (menú) o dónde estás (pausa) */
  if (pausa){
    const i = Math.max(0, estado.nivelActual ?? 0), n = NIVELES[i];
    elMision.style.display = 'none';
    elPausaTxt.textContent = `⏸ ${n ? etiquetaNivel(n, i) : 'Nivel en curso'}`
      + (feedback.totalObjetivos ? ` · Objetivos ${feedback.objetivosCompletados}/${feedback.totalObjetivos}` : '');
    elPausaBarra.style.width = feedback.totalObjetivos
      ? `${Math.round(100 * feedback.objetivosCompletados / feedback.totalObjetivos)}%` : '0%';
    elPausaBarra.parentElement.style.display = feedback.totalObjetivos ? '' : 'none';
    elPausa.classList.add('on');
  } else {
    elPausa.classList.remove('on');
    elMision.style.display = '';
    const n = NIVELES[iActual];
    const b = document.createElement('b');
    b.textContent = n ? etiquetaNivel(n, iActual) : 'Todos los sectores restaurados';
    elMision.replaceChildren(document.createTextNode(n ? '🎯 Próxima misión: ' : '🎉 '), b);
  }

  ordenarBotones();
  pintarInfo();
}

/* orden visual de los submenús (los crean varios módulos distintos) */
const ORDEN = [['AJUSTES', 1], ['REGLAS', 2], ['MAPA', 3], ['ARQUITECTO', 4], ['LOGROS', 5], ['REINICIAR', 7], ['SALIR', 8]];
function ordenarBotones(){
  const donde = rail ?? filaAj;
  if (!donde) return;
  for (const b of donde.querySelectorAll('button')){
    if (!b.dataset.mvKey){
      const o = ORDEN.find(([k]) => b.textContent.toUpperCase().includes(k));
      if (o) b.dataset.mvKey = o[0];
    }
    const o = ORDEN.find(([k]) => k === b.dataset.mvKey);
    if (o) b.style.order = String(o[1]);
  }
}

function nuevoConsejo(){
  iConsejo = (iConsejo + 1) % CONSEJOS.length;
  pintarInfo();
}

/* ── panel de logros ── */
function pintarLogros(){
  titulo.textContent = `LOGROS · ${ganadosN()}/${LOGROS.length}`;
  lista.replaceChildren(...LOGROS.map(l => {
    const ok = progreso.tieneLogro(l.id);
    const li = document.createElement('li');
    li.className = 'mv-logro' + (ok ? ' ganado' : '');
    const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = ok ? (l.icono ?? '🏆') : '🔒';
    const cuerpo = document.createElement('div');
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = l.nombre;
    const tx = document.createElement('div'); tx.className = 'tx'; tx.textContent = descLogro(l);
    cuerpo.append(nm, tx);
    if (ok && l.texto && l.descripcion){
      const q = document.createElement('div'); q.className = 'cita'; q.textContent = l.texto;
      cuerpo.append(q);
    }
    const st = document.createElement('span'); st.className = 'st'; st.textContent = ok ? 'GANADO' : 'POR GANAR';
    li.append(ic, cuerpo, st);
    return li;
  }));
}
function abrirLogros(){
  origen = document.activeElement;
  pintarLogros();
  panel.classList.remove('oculto');
  btnCerrar.focus();
}
function cerrarLogros(){
  panel.classList.add('oculto');
  if (origen?.focus) origen.focus();
}

export const menuVida = {
  iniciar(){
    if (!document.getElementById('mv-estilos')){
      const st = document.createElement('style');
      st.id = 'mv-estilos'; st.textContent = ESTILOS;
      document.head.appendChild(st);
    }

    /* etiqueta PAUSA arriba de la caja */
    tag = document.createElement('div');
    tag.className = 'mv-tag';
    tag.textContent = '⏸ PAUSA';
    document.querySelector('#overlay .overlay-caja')?.prepend(tag);

    /* tarjeta bajo el subtítulo */
    tarjeta = document.createElement('div');
    tarjeta.className = 'mv-card';
    const cab = document.createElement('div'); cab.className = 'mv-cab';
    elEmblema = document.createElement('span'); elEmblema.className = 'mv-emblema'; elEmblema.setAttribute('aria-hidden', 'true');
    const id = document.createElement('div'); id.className = 'mv-id';
    elNombre = document.createElement('span'); elNombre.className = 'mv-nombre';
    const rango = document.createElement('span'); rango.className = 'mv-rango'; rango.textContent = 'Arquitecto Digital';
    id.append(elNombre, rango);
    chips = document.createElement('div'); chips.className = 'mv-chips';
    cab.append(elEmblema, id, chips);
    elRuta = document.createElement('div'); elRuta.className = 'mv-ruta'; elRuta.setAttribute('role', 'img');
    elMision = document.createElement('div'); elMision.className = 'mv-mision';
    elPausa = document.createElement('div'); elPausa.className = 'mv-pausa';
    elPausaTxt = document.createElement('div');
    const barra = document.createElement('div'); barra.className = 'mv-barra';
    elPausaBarra = document.createElement('i'); barra.appendChild(elPausaBarra);
    elPausa.append(elPausaTxt, barra);
    tarjeta.append(cab, elRuta, elMision, elPausa);
    const ancla = $('overlay-sub') ?? $('ov-titulo-acento');
    if (ancla) ancla.after(tarjeta); else $('overlay')?.prepend(tarjeta);

    /* botón y panel de logros */
    panel = document.createElement('div');
    panel.id = 'panel-logros';
    panel.className = 'pantalla oculto';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'mv-logros-titulo');
    const caja = document.createElement('div'); caja.className = 'pantalla-caja';
    titulo = document.createElement('h2'); titulo.id = 'mv-logros-titulo';
    lista = document.createElement('ul'); lista.className = 'mv-lista'; lista.tabIndex = 0;
    const filaB = document.createElement('div'); filaB.className = 'fila-botones';
    btnCerrar = document.createElement('button'); btnCerrar.type = 'button'; btnCerrar.className = 'btn'; btnCerrar.textContent = '← VOLVER';
    btnCerrar.addEventListener('click', cerrarLogros);
    filaB.appendChild(btnCerrar);
    caja.append(titulo, lista, filaB);
    panel.appendChild(caja);
    document.body.appendChild(panel);

    document.addEventListener('keydown', e => {
      if (!panelVisible()) return;
      if (e.code === 'Escape'){ e.preventDefault(); e.stopPropagation(); cerrarLogros(); return; }
      if (e.code === 'Tab'){
        const orden = [lista, btnCerrar];
        const i = orden.indexOf(document.activeElement);
        e.preventDefault();
        orden[(i + (e.shiftKey ? orden.length - 1 : 1)) % orden.length].focus();
      }
    }, true);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sec btn-chico';
    btn.textContent = '🏆 LOGROS';
    btn.addEventListener('click', abrirLogros);
    const ref = $('btn-ajustes');
    filaAj = ref?.closest('.fila-ajustes') ?? ref?.parentElement;
    filaAj?.appendChild(btn);
    const sep = document.createElement('div'); sep.className = 'mv-sep'; sep.style.order = '6';
    filaAj?.appendChild(sep);

    /* solo en pausa: reiniciar nivel / salir al menú. Piden confirmar con un segundo clic,
       porque al salir a medio nivel el LevelManager lo vuelve a construir desde cero. */
    const accion = (texto, aviso, ejecutar) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sec btn-chico mv-solo-pausa mv-peligro';
      b.textContent = texto;
      let t = 0;
      const desarmar = () => { clearTimeout(t); b.dataset.armado = '0'; b.textContent = texto; };
      b.addEventListener('click', () => {
        if (b.dataset.armado === '1'){ desarmar(); ejecutar(); return; }
        b.dataset.armado = '1'; b.textContent = aviso;
        t = setTimeout(desarmar, 4000);
      });
      desarmares.push(desarmar);
      filaAj?.appendChild(b);
    };
    accion('↺ REINICIAR NIVEL', '¿SEGURO? OTRO CLIC', () => bus.emitir(EVENTOS.UI_REPETIR, {}));
    accion('⌂ SALIR AL MENÚ', '¿SEGURO? OTRO CLIC', () => bus.emitir(EVENTOS.UI_MENU, {}));
    ordenarBotones(); // fija la clave de cada botón mientras su texto aún es el original

    /* submenús flotantes a la izquierda: se MUEVEN los botones (conservan sus clics) */
    if (filaAj && $('overlay')){
      rail = document.createElement('nav');
      rail.className = 'mv-rail';
      rail.setAttribute('aria-label', 'Menú');
      const rt = document.createElement('div'); rt.className = 'mv-rail-tit'; rt.textContent = 'MENÚ';
      rail.appendChild(rt);
      for (const el of [...filaAj.children]) rail.appendChild(el);
      $('overlay').appendChild(rail);

      /* información flotante a la derecha */
      info = document.createElement('aside');
      info.className = 'mv-info';
      info.setAttribute('aria-live', 'polite');
      infoTit = document.createElement('div'); infoTit.className = 'mv-info-tit';
      infoTxt = document.createElement('div'); infoTxt.className = 'mv-info-txt';
      infoExtra = document.createElement('div'); infoExtra.className = 'mv-info-extra';
      infoMapa = document.createElement('div'); infoMapa.className = 'mv-info-mapa';
      info.append(infoTit, infoTxt, infoMapa, infoExtra);
      $('overlay').appendChild(info);

      const mostrar = b => { previewKey = b.dataset.mvKey ?? null; pintarInfo(); };
      const ocultar = () => { previewKey = null; pintarInfo(); };
      for (const b of rail.querySelectorAll('button')){
        b.addEventListener('mouseenter', () => mostrar(b));
        b.addEventListener('focus', () => mostrar(b));
        b.addEventListener('mouseleave', ocultar);
        b.addEventListener('blur', ocultar);
      }
    }

    /* se mantiene al día */
    const alCambiar = () => refrescar();
    bus.suscribir(EVENTOS.PREFERENCIAS_CAMBIADAS, alCambiar);
    bus.suscribir(EVENTOS.ACHIEVEMENT_UNLOCKED, alCambiar);
    bus.suscribir(EVENTOS.LEVEL_COMPLETED, alCambiar);
    bus.suscribir(EVENTOS.OBJECTIVE_COMPLETED, alCambiar);
    bus.suscribir(EVENTOS.FASE_CAMBIADA, () => { nuevoConsejo(); refrescar(); });
    bus.suscribir(EVENTOS.MODO_CAMBIADO, () => { if (enPausa()) nuevoConsejo(); refrescar(); });
    nuevoConsejo();
    refrescar();
  },
};