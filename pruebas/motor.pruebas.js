// pruebas/motor.pruebas.js — 44 casos del motor (sin frameworks)
import { parse } from '../js/motor/parser.js';
import { tokenizar } from '../js/motor/tokenizer.js';
import { evaluarPrograma } from '../js/motor/interprete.js';
import { analizar } from '../js/motor/analizar.js';
import { ErrorMotor, Categorias } from '../js/motor/errores.js';
import { RegistroAPI } from '../js/motor/apiMundo.js';

const salida = document.getElementById('salida');
let casos = 0, fallos = 0;
function prueba(nombre, fn){
  casos++;
  try { fn(); salida.insertAdjacentHTML('beforeend', `<p class="ok">✔ ${nombre}</p>`); }
  catch (e){ fallos++; salida.insertAdjacentHTML('beforeend', `<p class="fail">✖ ${nombre}: ${e.message}</p>`); }
}
function igual(a, b){ if (a !== b) throw new Error(`esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); }
function ejecuta(fuente, api = new RegistroAPI()){
  const gen = evaluarPrograma(parse(fuente), { api, limites: { maxPasos: 5000, maxProfundidad: 32, tiempoMaxMs: 1e9 } });
  let r; for (;;){ const { value, done } = gen.next(); if (done){ r = value; break; } }
  return r;
}
function ejecutaCon(ast, api = new RegistroAPI()){
  const gen = evaluarPrograma(ast, { api, limites: { maxPasos: 5000, maxProfundidad: 32, tiempoMaxMs: 1e9 } });
  for (;;){ const { done } = gen.next(); if (done) break; }
}
function esperaError(fuente, categoria, api){
  try { ejecuta(fuente, api); }
  catch (e){ if (e instanceof ErrorMotor && e.categoria === categoria) return; throw new Error(`categoría esperada ${categoria}, obtenida ${e.categoria ?? typeof e}: ${e.message}`); }
  throw new Error(`se esperaba ${categoria} y no hubo error`);
}
const capturar = (api, nombre, fn) => api.registrar(nombre, fn);

/* ── tokenizer (6) ── */
prueba('T1 números', () => igual(tokenizar('42 3.14').filter(t=>t.tipo==='num').length, 2));
prueba('T2 cadenas', () => igual(tokenizar('"hola" \'b\'')[0].valor, 'hola'));
prueba('T3 clave vs ident', () => { const t = tokenizar('if x'); igual(t[0].tipo,'clave'); igual(t[1].tipo,'ident'); });
prueba('T4 operadores dobles', () => igual(tokenizar('a == b')[1].valor, '=='));
prueba('T5 líneas con comentarios', () => igual(tokenizar('x\n//c\ny')[1].linea, 3));
prueba('T6 carácter ilegal', () => { try { tokenizar('@'); } catch(e){ igual(e.categoria, Categorias.SYNTAX); } });

/* ── parser (12) ── */
prueba('P1 decl var tipada', () => igual(parse('num x = 5;').cuerpo[0].tipo, 'DeclVar'));
prueba('P2 asignación', () => igual(parse('x = 3;').cuerpo[0].tipo, 'Asignar'));
prueba('P3 if/else', () => igual(parse('if (x == 1) { y = 2; } else { y = 3; }').cuerpo[0].tipo, 'Si'));
prueba('P4 switch', () => igual(parse('switch (x) { case 1: break; default: break; }').cuerpo[0].casos.length, 1));
prueba('P5 while', () => igual(parse('while (x < 3) { x = x + 1; }').cuerpo[0].tipo, 'Mientras'));
prueba('P6 for completo', () => igual(parse('for (num i = 0; i < 3; i = i + 1) { }').cuerpo[0].tipo, 'Para'));
prueba('P7 función con params', () => igual(parse('function f(num a) { return a; }').cuerpo[0].params.length, 1));
prueba('P8 clase extends constructor', () => { const c = parse('class B extends A { constructor(num x){ } }').cuerpo[0]; igual(c.extiende,'A'); });
prueba('P9 interfaz', () => igual(parse('interface I { void m(); }').cuerpo[0].tipo, 'DeclInterfaz'));
prueba('P10 precedencia', () => { const v = ejecuta('var r = 2 + 3 * 4;'); /* r no sale; usa retorno de programa */ });
prueba('P10b precedencia (eval)', () => igual(ejecutarYLeer('var r = 2 + 3 * 4;'), 14));
prueba('P11 paréntesis', () => igual(ejecutarYLeer('var r = (2 + 3) * 4;'), 20));
prueba('P12 error con línea', () => { try { parse('num x = ;'); } catch(e){ igual(e.categoria, Categorias.SYNTAX); } });
function ejecutarYLeer(fuente){
  let r;
  const api = new RegistroAPI();
  api.registrar('leer', () => r);
  ejecuta(fuente + ' guardar(r);', (() => { const a = new RegistroAPI(); a.registrar('guardar', v => { r = v; }); return a; })());
  return r;
}

/* ── evaluador (16) ── */
prueba('E1 aritmética', () => igual(ejecutarYLeer('guardar(7 - 2 * 2);'), 3));
prueba('E2 comparación', () => igual(ejecutarYLeer('guardar(3 > 2);'), true));
prueba('E3 concatenación', () => igual(ejecutarYLeer('guardar("a" + "b");'), 'ab'));
prueba('E4 ramas if', () => igual(ejecutarYLeer('if (1 == 1) { guardar("si"); } else { guardar("no"); }'), 'si'));
prueba('E5 while suma', () => igual(ejecutarYLeer('var s = 0; var i = 1; while (i <= 4) { s = s + i; i = i + 1; } guardar(s);'), 10));
prueba('E6 for acumulador', () => igual(ejecutarYLeer('var s = 0; for (num i = 0; i < 5; i = i + 1) { s = s + 2; } guardar(s);'), 10));
prueba('E7 break', () => igual(ejecutarYLeer('var i = 0; while (true) { i = i + 1; if (i == 3) { break; } } guardar(i);'), 3));
prueba('E8 continue', () => igual(ejecutarYLeer('var s = 0; for (num i = 1; i <= 4; i = i + 1) { if (i == 2) { continue; } s = s + i; } guardar(s);'), 8));
prueba('E9 función y return', () => igual(ejecutarYLeer('function doble(num x) { return x * 2; } guardar(doble(21));'), 42));
prueba('E10 scope', () => igual(ejecutarYLeer('var x = 1; function f() { var x = 2; return x; } f(); guardar(x);'), 1));
prueba('E11 recursión factorial', () => igual(ejecutarYLeer('function fact(num n) { if (n <= 1) { return 1; } return n * fact(n - 1); } guardar(fact(5));'), 120));
prueba('E12 clase e instancia', () => igual(ejecutarYLeer('class C { num v = 5; } var o = new C(); guardar(o.v);'), 5));
prueba('E13 método con this', () => igual(ejecutarYLeer('class C { num v = 4; num dar() { return this.v; } } guardar(new C().dar());'), 4));
prueba('E14 herencia + super', () => igual(ejecutarYLeer('class A { num v = 1; } class B extends A { num w = 2; } var b = new B(); guardar(b.v + b.w);'), 3));
prueba('E15 override dispatch', () => igual(ejecutarYLeer('class A { num q() { return 1; } } class B extends A { override num q() { return 2; } } var a = new A(); var b = new B(); guardar(a.q() + b.q());'), 3));
prueba('E16 API del mundo', () => {
  const api = new RegistroAPI(); let senso = 'libre';
  capturar(api, 'leerSensor', () => senso);
  igual(ejecuta('guardar(leerSensor());', api), undefined);
});

/* ── protecciones (4) ── */
prueba('L1 while(true) → INFINITE_LOOP', () => esperaError('while (true) { var x = 1; }', Categorias.INFINITE_LOOP));
prueba('L2 for(;;) → INFINITE_LOOP', () => esperaError('for (;;) { }', Categorias.INFINITE_LOOP));
prueba('L3 recursión infinita', () => esperaError('function f() { return f(); } f();', Categorias.RUNTIME));
prueba('L4 límites por contexto', () => {
  try {
    const gen = evaluarPrograma(parse('while (true) { }'), { api: new RegistroAPI(), limites: { maxPasos: 50, maxProfundidad: 8, tiempoMaxMs: 1e9 } });
    for (;;){ if (gen.next().done) break; }
    throw new Error('no lanzó');
  } catch (e){ igual(e.categoria, Categorias.INFINITE_LOOP); }
});

/* ── semánticos (6) ── */
prueba('S1 UNDECLARED_VARIABLE', () => esperaError('guardar(y);', Categorias.UNDECLARED_VARIABLE));
prueba('S2 MISSING_RETURN', () => {
  const errs = analizar(parse('function f() -> num { var x = 1; }'.replace('-> num','')));
  // la forma simple no declara retorno; forzamos con retorno declarado vía clase método
  const e2 = analizar(parse('class C { num m() { var x = 1; } }'));
  igual(e2.some(e => e.categoria === Categorias.MISSING_RETURN), true);
});
prueba('S3 abstracta no instanciable', () => esperaError('abstract class A { } var a = new A();', Categorias.TYPE_ERROR));
prueba('S4 INTERFACE_NOT_IMPLEMENTED', () => {
  const errs = analizar(parse('interface I { void m(); } class C implements I { }'));
  igual(errs.some(e => e.categoria === Categorias.INTERFACE_NOT_IMPLEMENTED), true);
});
prueba('S5 INVALID_INHERITANCE', () => {
  const errs = analizar(parse('class B extends Fantasma { }'));
  igual(errs.some(e => e.categoria === Categorias.INVALID_INHERITANCE), true);
});
prueba('S6 TYPE_ERROR asignación', () => esperaError('num x = "texto";', Categorias.TYPE_ERROR));

salida.insertAdjacentHTML('beforeend', `<h1>${casos - fallos}/${casos} pruebas superadas</h1>`);