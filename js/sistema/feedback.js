// ═══════════════════════════════════════════════════════════
// sistema/feedback.js — feedback inmediato transversal.
// SOLO escucha el bus: ningún nivel lo llama directamente.
// Partículas 2D de pantalla + check/advertencia + notificación de logro.
// El sonido lo pone audio.js. La barra de progreso del nivel ya NO vive
// aquí: la dibuja hud.js en #panel-progreso (zona 3 del HUD).
//
// Si el HTML no trae los elementos (canvas, aviso de logro,
// check/advertencia), este módulo los CREA solo, con sus estilos.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';
import { LOGROS } from '../../datos/logros.js';

const $ = id => document.getElementById(id);

const ESTILOS = `
#logro-toast.fb-auto{position:fixed;top:70px;right:16px;z-index:60;max-width:300px;padding:10px 14px;
  background:rgba(10,15,46,.94);border:2px solid #ffd27a;border-radius:10px;color:#eef0ff;font:13px/1.35 monospace;
  opacity:0;transform:translateX(30px);transition:opacity .3s,transform .3s;pointer-events:none}
#logro-toast.fb-auto.visible{opacity:1;transform:none}
#logro-toast .lg-nombre{font-weight:700;color:#ffd27a;margin-bottom:3px}
.fb-icono.fb-auto{position:fixed;left:50%;top:40%;z-index:50;font:700 44px monospace;opacity:0;pointer-events:none;
  transform:translate(-50%,-50%);text-shadow:0 0 12px currentColor}
.fb-icono.fb-auto.visible{animation:fb-pop 1s ease-out}
#feedback-check.fb-auto{color:#58f0a0}
#feedback-warning.fb-auto{color:#ff5d5d}
@keyframes fb-pop{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}
  80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
@media (prefers-reduced-motion:reduce){#logro-toast.fb-auto{transition:none}}
`;

export const feedback = {
  canvas: null, ctx: null,
  particulas: [],
  // los lee menuVida.js (pausa); los actualiza este módulo escuchando el bus
  totalObjetivos: 0,
  objetivosCompletados: 0,

  iniciar(){
    this._asegurarUI();
    this.canvas = $('feedback-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._ajustar();
    window.addEventListener('resize', () => this._ajustar());
    this._suscribir();
    this._bucle();
  },

  /** Crea lo que falte en el HTML. */
  _asegurarUI(){
    const crear = (tag, id, clases, padre = document.body) => {
      const el = document.createElement(tag);
      el.id = id; el.className = clases;
      padre.appendChild(el);
      return el;
    };
    if (!$('feedback-estilos')){
      const st = document.createElement('style');
      st.id = 'feedback-estilos'; st.textContent = ESTILOS;
      document.head.appendChild(st);
    }
    if (!$('feedback-canvas')){
      const c = crear('canvas', 'feedback-canvas', '');
      c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40';
    }
    if (!$('logro-toast')){
      const t = crear('div', 'logro-toast', 'fb-auto');
      t.setAttribute('role', 'status');
      crear('div', 'logro-nombre', 'lg-nombre', t);
      crear('div', 'logro-texto', '', t);
    }
    if (!$('feedback-check')) crear('div', 'feedback-check', 'fb-icono fb-auto');
    if (!$('feedback-warning')) crear('div', 'feedback-warning', 'fb-icono fb-auto');
  },

  _ajustar(){
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  _suscribir(){
    bus.suscribir(EVENTOS.CODIGO_CORRECTO, () => {
      this._explosion(this.canvas.width / 2, this.canvas.height * .55, '#58f0a0', 70);
      this._icono('feedback-check', '✔');
    });
    bus.suscribir(EVENTOS.CODIGO_INCORRECTO, ({ categoria }) => {
      this._explosion(this.canvas.width / 2, this.canvas.height * .55, '#ff5d5d', 70);
      this._icono('feedback-warning', '⚠ ' + (categoria ?? 'ERROR'));
    });
    bus.suscribir(EVENTOS.LEVEL_COMPLETED, () => {
      this._explosion(this.canvas.width / 2, this.canvas.height * .4, '#58f0a0', 160);
      this._explosion(this.canvas.width * .3, this.canvas.height * .5, '#ffd27a', 80);
      this._explosion(this.canvas.width * .7, this.canvas.height * .5, '#6fe3ff', 80);
    });
    bus.suscribir(EVENTOS.LEVEL_FAILED, () => {
      this._explosion(this.canvas.width / 2, this.canvas.height * .45, '#ff5d5d', 140);
    });
    bus.suscribir(EVENTOS.SKILL_UNLOCKED, () => {
      this._explosion(this.canvas.width / 2, this.canvas.height * .3, '#6fe3ff', 60);
    });
    bus.suscribir(EVENTOS.ACHIEVEMENT_UNLOCKED, ({ id }) => this._toastLogro(id));

    // contadores de objetivos (la barra visible la pinta hud.js)
    bus.suscribir(EVENTOS.LEVEL_STARTED, ({ config }) => {
      this.totalObjetivos = config.objetivos?.length ?? 0;
      this.objetivosCompletados = 0;
    });
    bus.suscribir(EVENTOS.OBJECTIVE_COMPLETED, () => {
      this.objetivosCompletados++;
      this._explosion(this.canvas.width / 2, this.canvas.height * .35, '#ffd27a', 40);
    });
  },

  _explosion(x, y, color, n){
    for (let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2;
      const v = 120 + Math.random() * 260;
      this.particulas.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 80,
        vida: .7 + Math.random() * .5,
        color,
        r: 1.5 + Math.random() * 2.5,
      });
    }
  },

  _icono(id, texto){
    const el = $(id);
    if (!el) return;
    el.textContent = texto;
    el.classList.remove('visible');
    void el.offsetWidth;
    el.classList.add('visible');
  },

  _toastLogro(id){
    const logro = LOGROS.find(l => l.id === id);
    const toast = $('logro-toast');
    if (!logro || !toast) return;
    $('logro-nombre').textContent = `🏆 LOGRO: ${logro.nombre}`;
    $('logro-texto').textContent = logro.texto;
    toast.classList.remove('visible');
    void toast.offsetWidth;
    toast.classList.add('visible');
    clearTimeout(this._tLogro);
    this._tLogro = setTimeout(() => toast.classList.remove('visible'), 4200);
  },

  _bucle(){
    requestAnimationFrame(() => this._bucle());
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.particulas.length) return;
    const dt = 1 / 60;
    for (let i = this.particulas.length - 1; i >= 0; i--){
      const p = this.particulas[i];
      p.vida -= dt;
      if (p.vida <= 0){ this.particulas.splice(i, 1); continue; }
      p.vy += 320 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida * 1.6));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};