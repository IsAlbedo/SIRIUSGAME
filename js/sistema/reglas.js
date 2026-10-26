// ═══════════════════════════════════════════════════════════
// sistema/reglas.js — pantalla de reglas del juego, accesible desde
// el menú y la pausa (#overlay). Ya no aparece en la intro de cada nivel.
// ═══════════════════════════════════════════════════════════
import { TEXTOS } from '../../datos/textos.js';

const $ = id => document.getElementById(id);
let panel = null, cuerpo = null, btnCerrar = null, origen = null;

const visible = () => panel && !panel.classList.contains('oculto');

function abrir(){
  origen = document.activeElement;
  panel.classList.remove('oculto');
  cuerpo.scrollTop = 0;
  btnCerrar.focus();
}

function cerrar(){
  panel.classList.add('oculto');
  if (origen?.focus) origen.focus();
}

function crearBoton(){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-sec btn-chico';
  b.textContent = TEXTOS.reglas.boton;
  b.addEventListener('click', abrir);
  return b;
}

export const reglas = {
  iniciar(){
    const R = TEXTOS.reglas;
    panel = document.createElement('div');
    panel.id = 'panel-reglas';
    panel.className = 'pantalla oculto';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'rg-titulo');

    const caja = document.createElement('div');
    caja.className = 'pantalla-caja';
    const h2 = document.createElement('h2');
    h2.id = 'rg-titulo';
    h2.textContent = R.titulo;
    caja.appendChild(h2);

    cuerpo = document.createElement('div');
    cuerpo.className = 'rg-cuerpo';
    cuerpo.tabIndex = 0;
    for (const s of R.secciones){
      const sec = document.createElement('section');
      sec.className = 'rg-sec';
      const h3 = document.createElement('h3');
      h3.textContent = s.titulo;
      const p = document.createElement('p');
      p.textContent = s.texto;
      sec.append(h3, p);
      cuerpo.appendChild(sec);
    }
    caja.appendChild(cuerpo);

    const fila = document.createElement('div');
    fila.className = 'fila-botones';
    btnCerrar = document.createElement('button');
    btnCerrar.type = 'button';
    btnCerrar.className = 'btn';
    btnCerrar.textContent = R.cerrar;
    btnCerrar.addEventListener('click', cerrar);
    fila.appendChild(btnCerrar);
    caja.appendChild(fila);
    panel.appendChild(caja);
    document.body.appendChild(panel);

    // Esc cierra; Tab no se escapa del panel
    document.addEventListener('keydown', e => {
      if (!visible()) return;
      if (e.code === 'Escape'){ e.preventDefault(); e.stopPropagation(); cerrar(); return; }
      if (e.code === 'Tab'){
        const orden = [cuerpo, btnCerrar];
        const i = orden.indexOf(document.activeElement);
        e.preventDefault();
        orden[(i + (e.shiftKey ? orden.length - 1 : 1)) % orden.length].focus();
      }
    }, true);

    // botón: junto a AJUSTES en menú/pausa (en la intro de cada nivel ya no se muestra)
    $('btn-ajustes')?.closest('.fila-ajustes')?.appendChild(crearBoton());
  },
  abrir,
  cerrar,
};