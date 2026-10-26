// ui/controlesFlotante.js — pestaña escondida con el teclado (aparece con hover)
import { TEXTOS } from '../datos/textos.js';

const FILAS = [
  { off: 0,    teclas: [['ESC', 1.2]] },
  { off: 0,    teclas: 'Q W E R T Y U I O P'.split(' ').map(k => [k, 1]) },
  { off: 0.5,  teclas: 'A S D F G H J K L'.split(' ').map(k => [k, 1]) },
  { off: 0,    teclas: [['SHIFT', 1.9], ...'Z X C V B N M'.split(' ').map(k => [k, 1])] },
  { off: 0,    teclas: [['CTRL', 1.3], ['ALT', 1.3], ['ESPACIO', 5.5]] },
];

function crear(){
  // tecla → acción, a partir de TEXTOS (una sola fuente de verdad)
  const acciones = {};
  let raton = '';
  for (const c of TEXTOS.ui.controles){
    if (c.tecla === 'RATÓN'){ raton = c.accion; continue; }
    for (const t of c.tecla.split(' ')) acciones[t] = c.accion;
  }

  const raiz = document.createElement('div');
  raiz.id = 'ctrl-flotante';

  const tab = document.createElement('div');
  tab.className = 'ctrl-tab';
  tab.textContent = '⌨ CONTROLES';
  raiz.appendChild(tab);

  const panel = document.createElement('div');
  panel.className = 'ctrl-panel';

  const teclado = document.createElement('div');
  teclado.className = 'ctrl-teclado';
  for (const fila of FILAS){
    const f = document.createElement('div');
    f.className = 'ctrl-fila';
    f.style.marginLeft = `calc(${fila.off} * (var(--u) + 4px))`;
    for (const [k, w] of fila.teclas){
      const el = document.createElement('div');
      el.className = 'ctrl-tecla';
      el.style.width = `calc(var(--u) * ${w} + 4px * ${w - 1})`;
      const letra = document.createElement('b');
      letra.textContent = k === 'ESPACIO' && !acciones[k] ? '' : k;
      el.appendChild(letra);
      if (acciones[k]){
        el.classList.add('activa');
        const s = document.createElement('span');
        s.textContent = acciones[k];
        el.appendChild(s);
      }
      f.appendChild(el);
    }
    teclado.appendChild(f);
  }
  panel.appendChild(teclado);

  if (raton){
    const r = document.createElement('div');
    r.className = 'ctrl-raton';
    r.innerHTML = '<i></i>';
    const t = document.createElement('span');
    t.textContent = `RATÓN · ${raton}`;
    r.appendChild(t);
    panel.appendChild(r);
  }
  raiz.appendChild(panel);
  document.body.appendChild(raiz);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crear);
else crear();