// ═══════════════════════════════════════════════════════════
// sistema/vozDialogos.js — reproduce la voz de cada línea de diálogo.
//
// Convención de archivos (se vinculan por NOMBRE, sin tocar el JSON):
//   <BASE>/<hablante>/<id>.<EXT>
//   ej.  audio/voces/aria/cine-04.mp3
//        audio/voces/eclipse/intro-nivel-5b.mp3
//        audio/voces/gustaff/gustaff-3.mp3
//
// Opcional: si una línea del JSON trae  "audio": "otro-nombre"  se usa ese
// nombre en lugar del id.
//
// Si el archivo no existe, simplemente no suena nada (el diálogo sigue igual).
// ═══════════════════════════════════════════════════════════
import { bus, EVENTOS } from './eventos.js';

// Ruta relativa a la página (index.html), no a este archivo.
const BASE = 'audio/voces';
const EXT = 'mp3';

class VozDialogos {
  constructor() {
    this.actual = null;
    this.volumen = 1;
    this.activa = true; // para un futuro botón de silenciar voces

    // Al cerrarse el diálogo (terminar u omitir) se corta la voz.
    bus.suscribir(EVENTOS.DIALOGO_TERMINADO, () => this.detener());
  }

  /**
   * @param {{id:string, hablante:string, audio?:string}} d  línea de diálogo
   * @returns {Promise<number|null>} duración del audio en segundos cuando EMPIEZA a
   *          sonar, o null si no hay archivo / está bloqueado / está silenciado.
   * Llamar cada vez que se MUESTRA una línea. Corta la anterior automáticamente,
   * así que al continuar u omitir, la voz anterior nunca se queda sonando.
   */
  reproducir(d) {
    this.detener();
    if (!this.activa || !d) return Promise.resolve(null);

    const nombre = d.audio ?? d.id;
    const url = `${BASE}/${d.hablante}/${nombre}.${EXT}`;

    const a = new Audio(url);
    a.volume = this.volumen;
    this.actual = a;

    return new Promise(resolve => {
      const espera = setTimeout(() => resolve(null), 800); // si tarda, el texto usa su velocidad normal
      a.play()
        .then(() => { clearTimeout(espera); resolve(Number.isFinite(a.duration) ? a.duration : null); })
        .catch(() => { clearTimeout(espera); resolve(null); }); // sin archivo, bloqueado o cortado
    });
  }

  detener() {
    const a = this.actual;
    if (!a) return;
    this.actual = null;
    a.pause();
  }

  silenciar(si) {
    this.activa = !si;
    if (si) this.detener();
  }
}

export const voz = new VozDialogos();