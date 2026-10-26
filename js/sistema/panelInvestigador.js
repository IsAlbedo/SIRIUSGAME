// ═══════════════════════════════════════════════════════════
// sistema/panelInvestigador.js — panel oculto para el equipo
// investigador. Atajo secreto: teclear D-A-T-O-S (fuera de
// campos de texto). Exporta JSON y CSV, gestiona consentimiento.
// ═══════════════════════════════════════════════════════════
import { telemetria } from './telemetria.js';

const $ = id => document.getElementById(id);

function descargar(nombre, contenido, mime){
  const blob = new Blob([contenido], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const panelInvestigador = {
  buffer: '',
  visible: false,

  iniciar(){
    document.addEventListener('keydown', e => {
      const tag = (e.target?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      this.buffer = (this.buffer + e.key.toLowerCase()).slice(-5);
      if (this.buffer === 'datos') this.toggle();
    });
    $('inv-json').addEventListener('click', () =>
      descargar(`adc_${telemetria.participanteId}_completo.json`, telemetria.exportarJSON(), 'application/json'));
    for (const tabla of ['sesiones', 'niveles', 'intentos']){
      $(`inv-csv-${tabla}`).addEventListener('click', () =>
        descargar(`adc_${telemetria.participanteId}_${tabla}.csv`, telemetria.exportarCSV(tabla), 'text/csv'));
    }
    $('inv-limpiar').addEventListener('click', () => {
      telemetria.limpiar();
      this.pintar();
    });
    $('inv-consentir').addEventListener('click', () => {
      telemetria.establecerConsentimiento('aceptado');
      telemetria.iniciar();
      this.pintar();
    });
    $('inv-cerrar').addEventListener('click', () => this.toggle());
  },

  toggle(){
    this.visible = !this.visible;
    $('panel-investigador').classList.toggle('oculto', !this.visible);
    if (this.visible) this.pintar();
  },

  pintar(){
    $('inv-participante').textContent = telemetria.participante();
    $('inv-consentimiento').textContent = telemetria.consentimiento() ?? 'sin respuesta';
    $('inv-activo').textContent = telemetria.activa ? 'recogiendo datos' : 'INACTIVA';
    $('inv-resumen').textContent =
      `${telemetria.historialSesiones().length} sesiones · ` +
      `${telemetria.datos.niveles.length} niveles · ` +
      `${telemetria.datos.intentos.length} intentos · ` +
      `${telemetria.datos.logros.length} logros`;
  },
};