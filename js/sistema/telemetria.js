// ═══════════════════════════════════════════════════════════
// sistema/telemetria.js — telemetría de investigación.
// Privacidad: id anónimo, sin datos personales, consentimiento.
// Registros estructurados: sesión / nivel / intento + export JSON/CSV.
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';

const CLAVE = 'adc_telemetria_v2';
const CLAVE_SESIONES = 'adc_sesiones';
const CLAVE_PARTICIPANTE = 'adc_participante';
const CLAVE_CONSENTIMIENTO = 'adc_consentimiento';

function idAleatorio(pref, len = 10){
  const base = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return pref + '-' + [...bytes].map(b => base[b % base.length]).join('');
}

export const telemetria = {
  activa: false,
  participanteId: '',
  sesionId: '',
  datos: { niveles: [], intentos: [], habilidades: [], logros: [], eventos: [] },
  _nivel: null,
  _nivelAbierto: null,
  _ultimoError: null,
  _inicioSesion: 0,
  _suscrito: false,
  _dirty: false, _timer: 0, _tamanioMax: 500_000,

  /* ── privacidad ── */
  consentimiento(){ return localStorage.getItem(CLAVE_CONSENTIMIENTO) ?? null; },
  establecerConsentimiento(v){ localStorage.setItem(CLAVE_CONSENTIMIENTO, v); },
  participante(){
    let p = localStorage.getItem(CLAVE_PARTICIPANTE);
    if (!p){ p = idAleatorio('P'); localStorage.setItem(CLAVE_PARTICIPANTE, p); }
    return p;
  },

  dispositivo(){
    return {
      pantalla: `${screen.width}x${screen.height}`,
      idioma: navigator.language ?? null,
      ua: navigator.userAgent ?? null,
      nucleos: navigator.hardwareConcurrency ?? null,
    };
  },

  iniciar(){
    if (this.consentimiento() !== 'aceptado'){ this.activa = false; return; }
    this.activa = true;
    this.participanteId = this.participante();
    this.sesionId = idAleatorio('S');
    this._inicioSesion = Date.now();
    try { this.datos = JSON.parse(localStorage.getItem(CLAVE)) ?? this.datos; } catch {}
    if (!this._suscrito){ this._suscrito = true; this._suscribir(); }
    if (!this._timer){
      this._timer = setInterval(() => this._flushSiSucio(), 3000);
    }
    this.registrar('sesion_inicio', { dispositivo: this.dispositivo() });
  },

  _suscribir(){
    bus.suscribir(EVENTOS.LEVEL_STARTED, ({ config }) => {
      this._nivel = config.id;
      this._nivelAbierto = {
        participante: this.participanteId, sesion: this.sesionId,
        nivel: config.id, inicio: Date.now(), fin: null,
        segundos: 0, intentos: 0, pistas: 0, fallos: 0,
        puntuacion: 0, completado: false,
      };
    });
    bus.suscribir(EVENTOS.LEVEL_COMPLETED, resultado => {
      if (!this._nivelAbierto) return;
      this._nivelAbierto.fin = Date.now();
      this._nivelAbierto.segundos = resultado.metricas?.segundos
        ?? Math.round((this._nivelAbierto.fin - this._nivelAbierto.inicio) / 1000);
      this._nivelAbierto.puntuacion = resultado.puntos;
      this._nivelAbierto.completado = true;
      this.datos.niveles.push(this._nivelAbierto);
      this._nivelAbierto = null;
      this.guardar();
    });
    bus.suscribir(EVENTOS.LEVEL_FAILED, () => {
      if (this._nivelAbierto) this._nivelAbierto.fallos++;
    });
    bus.suscribir(EVENTOS.MOTOR_INICIO, () => { this._ultimoError = null; });
    bus.suscribir(EVENTOS.MOTOR_ERROR, e => { this._ultimoError = e; });
    bus.suscribir(EVENTOS.SKILL_UNLOCKED, ({ id }) => {
      this.datos.habilidades.push({ id, momento: new Date().toISOString() });
      this.guardar();
    });
    bus.suscribir(EVENTOS.ACHIEVEMENT_UNLOCKED, ({ id }) => {
      this.datos.logros.push({ id, momento: new Date().toISOString() });
      this.guardar();
    });
  },

  /** Canal genérico; además estructura intentos/pistas automáticamente. */
  registrar(tipo, payload = {}){
    if (!this.activa) return;
    // el nombre del Arquitecto es un dato personal: nunca entra a la telemetría
    if (payload && payload.clave === 'nombreArquitecto') payload = { ...payload, valor: '[omitido]' };
    this.datos.eventos.push({ t: Date.now(), sesion: this.sesionId, tipo, datos: payload });
    if (this.datos.eventos.length > 2000) this.datos.eventos.splice(0, this.datos.eventos.length - 2000);

    if (tipo === 'ejecucion_codigo'){
      this.datos.intentos.push({
        participante: this.participanteId, sesion: this.sesionId,
        nivel: this._nivel, subreto: payload.subreto ?? null,
        editor: payload.editor ?? null,
        duracionMs: payload.ms ?? 0,
        ok: !!payload.ok,
        categoriaError: payload.ok ? null : (this._ultimoError?.categoria ?? null),
        numLineas: payload.numLineas ?? null,
        numBloques: payload.numBloques ?? null,
        t: Date.now(),
      });
    }
    if (tipo === 'pista_pedida' && this._nivelAbierto) this._nivelAbierto.pistas++;
    if (tipo === 'intento_subreto' && this._nivelAbierto) this._nivelAbierto.intentos++;
    this.guardar();
  },

  guardar(){ this._dirty = true; },

  _flushSiSucio(){
    if (!this._dirty) return;
    this._dirty = false;
    try {
      let txt = JSON.stringify(this.datos);
      // recortar eventos viejos (conservando al menos 200) hasta caber
      while (txt.length > this._tamanioMax && this.datos.eventos.length > 200){
        this.datos.eventos.splice(0, Math.min(this.datos.eventos.length - 200, 50));
        txt = JSON.stringify(this.datos);
      }
      localStorage.setItem(CLAVE, txt);
    } catch {}
  },

  finalizarSesion(){
    if (!this.activa) return;
    // flush síncrono al salir
    this._dirty = true; this._flushSiSucio();
    const fin = Date.now();
    const resumen = {
      participante: this.participanteId, sesion: this.sesionId,
      inicio: this._inicioSesion, fin,
      duracionMin: Math.round((fin - this._inicioSesion) / 600) / 10,
      horaLocal: new Date(this._inicioSesion).getHours(),
      dispositivo: this.dispositivo(),
    };
    const historial = this.historialSesiones();
    historial.push(resumen);
    try { localStorage.setItem(CLAVE_SESIONES, JSON.stringify(historial)); } catch {}
    this.registrar('sesion_fin', { duracionMin: resumen.duracionMin });
    this._flushSiSucio(); // registrar() solo marca sucio: sin esto se pierde sesion_fin
  },

  historialSesiones(){
    try { return JSON.parse(localStorage.getItem(CLAVE_SESIONES)) ?? []; } catch { return []; }
  },

  /* ── exportación ── */
  exportarJSON(){
    return JSON.stringify({
      exportado: new Date().toISOString(),
      participante: this.participanteId,
      consentimiento: this.consentimiento(),
      sesiones: this.historialSesiones(),
      niveles: this.datos.niveles,
      intentos: this.datos.intentos,
      habilidades: this.datos.habilidades,
      logros: this.datos.logros,
      eventos: this.datos.eventos,
    }, null, 2);
  },

  /** @param {'sesiones'|'niveles'|'intentos'} tabla */
  exportarCSV(tabla){
    const esc = v => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const armar = (cab, filas) => [cab.join(','), ...filas.map(f => f.map(esc).join(','))].join('\n');
    if (tabla === 'sesiones'){
      return armar(
        ['participante', 'sesion', 'inicio_iso', 'fin_iso', 'duracion_min', 'hora_local', 'pantalla', 'idioma'],
        this.historialSesiones().map(s => [
          s.participante, s.sesion, new Date(s.inicio).toISOString(),
          s.fin ? new Date(s.fin).toISOString() : '',
          s.duracionMin, s.horaLocal, s.dispositivo?.pantalla, s.dispositivo?.idioma,
        ]),
      );
    }
    if (tabla === 'niveles'){
      return armar(
        ['participante', 'sesion', 'nivel', 'inicio_iso', 'segundos', 'intentos', 'pistas', 'fallos', 'puntuacion', 'completado'],
        this.datos.niveles.map(n => [
          n.participante, n.sesion, n.nivel, new Date(n.inicio).toISOString(),
          n.segundos, n.intentos, n.pistas, n.fallos, n.puntuacion, n.completado,
        ]),
      );
    }
    // intentos
    return armar(
      ['participante', 'sesion', 'nivel', 'subreto', 'editor', 'duracion_ms', 'ok', 'categoria_error', 'num_lineas', 'num_bloques', 't_iso'],
      this.datos.intentos.map(i => [
        i.participante, i.sesion, i.nivel, i.subreto, i.editor, i.duracionMs,
        i.ok, i.categoriaError, i.numLineas, i.numBloques, new Date(i.t).toISOString(),
      ]),
    );
  },

  limpiar(){
    this.datos = { niveles: [], intentos: [], habilidades: [], logros: [], eventos: [] };
    this._dirty = false;
    localStorage.removeItem(CLAVE);
  },
};