import { estado } from '../js/sistema/estado.js';

const hud = document.getElementById('hud');
const notif = document.getElementById('notif-terminal');
const editor = document.getElementById('pantalla-editor');

let timer = null;
let mostrada = false;

function ocultar(){
  clearTimeout(timer);
  notif.classList.remove('visible');
}

function mostrar(){
  mostrada = true;
  notif.classList.add('visible');
  timer = setTimeout(ocultar, 9000);
}
 
new MutationObserver(() => {
  const hudVisible = !hud.classList.contains('oculto');
  if (estado.nivelActual !== 0) { mostrada = false; ocultar(); return; }
  if (hudVisible && !mostrada) mostrar();
  if (!hudVisible) ocultar();
}).observe(hud, { attributes: true, attributeFilter: ['class'] });

// al abrir la terminal, el aviso ya cumplió su función
new MutationObserver(() => {
  if (!editor.classList.contains('oculto')) { mostrada = true; ocultar(); }
}).observe(editor, { attributes: true, attributeFilter: ['class'] });