// motor/imprimir.js — AST → Python legible (panel "código equivalente")
const esBin = n => n && (n.tipo === 'Binaria' || n.tipo === 'Logica');

/* Blockly guarda las variables por ID; esto traduce ID → nombre visible */
let resolverNombre = n => n;
export const fijarResolvedorNombres = fn => { resolverNombre = fn; };

/* nombres de la API del mundo: camelCase → snake_case */
const API = {
  moverAdelante: 'mover_adelante', girar: 'girar', recolectar: 'recolectar',
  leerSensor: 'leer_sensor', leerPanel: 'leer_panel', leerCodigo: 'leer_codigo',
  abrirPuerta: 'abrir_puerta', mostrar: 'mostrar',
  colocarBloque: 'colocar_bloque', ponerPuerta: 'poner_puerta',
  ponerVentana: 'poner_ventana', pedirRecursos: 'pedir_recursos',
  agregarMaterial: 'agregar_material', materiales: 'materiales',
};
const snake = s => API[s] ?? s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

const IND = '    ';

/** cuerpo de un bloque: sus líneas, o `pass` si está vacío */
function cuerpo(n, indent){
  const s = n ? imprimir(n, indent) : '';
  return s.trim() ? s : `${IND.repeat(indent)}pass`;
}

/** lista de sentencias (Switch) → texto */
const lista = (arr, indent) =>
  arr && arr.length ? arr.map(x => imprimir(x, indent)).join('\n') : `${IND.repeat(indent)}pass`;

export function imprimir(ast, indent = 0){
  const p = IND.repeat(indent);
  switch (ast.tipo){
    case 'Programa': return ast.cuerpo.map(d => imprimir(d, indent)).join('\n');
    case 'DeclVar': return `${p}${expr({ tipo: 'Ident', nombre: ast.nombre })} = ${expr(ast.valor)}`;
    case 'DeclFuncion': {
      let s = `${p}def ${snake(ast.nombre)}(${ast.params.map(x => snake(resolverNombre(x.nombre))).join(', ')}):\n`;
      const c = ast.cuerpo ? imprimir(ast.cuerpo, indent + 1) : '';
      if (c.trim()) s += c + '\n';
      if (ast.retornoExpr) s += `${IND.repeat(indent + 1)}return ${expr(ast.retornoExpr)}`;
      else if (!c.trim()) s += `${IND.repeat(indent + 1)}pass`;
      return s.replace(/\n$/, '');
    }
    case 'Bloque': return ast.sentencias.map(s => imprimir(s, indent)).join('\n');
    case 'Si': {
      let s = `${p}if ${expr(ast.cond)}:\n${cuerpo(ast.ent, indent + 1)}`;
      let sino = ast.sino;
      while (sino && sino.tipo === 'Si'){
        s += `\n${p}elif ${expr(sino.cond)}:\n${cuerpo(sino.ent, indent + 1)}`;
        sino = sino.sino;
      }
      if (sino) s += `\n${p}else:\n${cuerpo(sino, indent + 1)}`;
      return s;
    }
    case 'Switch': {
      // match/case (Python 3.10+). Sin "break": en Python no hace falta.
      let s = `${p}match ${expr(ast.expr)}:\n`;
      for (const c of ast.casos){
        s += `${p}${IND}case ${expr(c.valor)}:\n${lista(c.cuerpo, indent + 2)}\n`;
      }
      if (ast.porDefecto) s += `${p}${IND}case _:\n${lista(ast.porDefecto, indent + 2)}\n`;
      return s.replace(/\n$/, '');
    }
    case 'Mientras': return `${p}while ${expr(ast.cond)}:\n${cuerpo(ast.cuerpo, indent + 1)}`;
    case 'Para': return para(ast, indent, p);
    case 'Retornar': return `${p}return${ast.valor ? ' ' + expr(ast.valor) : ''}`;
    case 'Romper': return `${p}break`;
    case 'Continuar': return `${p}continue`;
    default: return p + expr(ast);
  }
}

/** for (i = a; i < b; i = i + 1) → for i in range(a, b)  ·  si no encaja, cae a while */
function para(ast, indent, p){
  const ini = ast.init, c = ast.cond, paso = ast.paso;
  const nombre = ini && (ini.tipo === 'DeclVar' ? ini.nombre : ini.objetivo?.nombre);
  const valIni = ini && ini.valor;
  const pasoOk = paso && paso.tipo === 'Asignar' && paso.objetivo?.nombre === nombre &&
    paso.valor?.tipo === 'Binaria' && paso.valor.op === '+' &&
    paso.valor.izq?.nombre === nombre && paso.valor.der?.tipo === 'Literal' && paso.valor.der.valor === 1;
  const condOk = c && c.tipo === 'Binaria' && c.izq?.nombre === nombre && (c.op === '<' || c.op === '<=');

  if (nombre && pasoOk && condOk){
    const i = expr({ tipo: 'Ident', nombre });
    const ini0 = expr(valIni);
    const fin = c.op === '<=' ? `${expr(c.der)} + 1` : expr(c.der);
    const rango = ini0 === '0' ? `range(${fin})` : `range(${ini0}, ${fin})`;
    return `${p}for ${i} in ${rango}:\n${cuerpo(ast.cuerpo, indent + 1)}`;
  }
  // caso general: while
  let s = ini ? imprimir(ini, indent) + '\n' : '';
  s += `${p}while ${c ? expr(c) : 'True'}:\n${cuerpo(ast.cuerpo, indent + 1)}`;
  if (paso) s += `\n${IND.repeat(indent + 1)}${expr(paso)}`;
  return s;
}

const OPS = { '&&': 'and', '||': 'or', '===': '==', '!==': '!=' };

function expr(n){
  if (!n) return '';
  const hijo = x => (esBin(x) ? `(${expr(x)})` : expr(x));
  switch (n.tipo){
    case 'Literal':
      if (n.tipoDato === 'texto') return `"${n.valor}"`;
      if (n.tipoDato === 'nulo' || n.valor === null) return 'None';
      if (n.valor === true) return 'True';
      if (n.valor === false) return 'False';
      return String(n.valor);
    case 'Ident': return snake(resolverNombre(n.nombre.replace(/^_i[A-Za-z0-9]{6,}$/, 'i')));
    case 'Este': return 'self';
    case 'Asignar': return `${expr(n.objetivo)} = ${expr(n.valor)}`;
    case 'Binaria': return `${hijo(n.izq)} ${OPS[n.op] ?? n.op} ${hijo(n.der)}`;
    case 'Logica': return `${hijo(n.izq)} ${n.op === '&&' ? 'and' : 'or'} ${hijo(n.der)}`;
    case 'Unaria': return n.op === '!' ? `not ${hijo(n.expr)}` : `${n.op}${hijo(n.expr)}`;
    case 'Llamar': return `${expr(n.callee)}(${n.args.map(expr).join(', ')})`;
    case 'Acceso': return `${expr(n.obj)}.${n.prop}`;
    case 'Nuevo': return `${n.clase}(${n.args.map(expr).join(', ')})`;
    case 'Super': return n.metodo ? `super().${n.metodo}(${n.args.map(expr).join(', ')})` : `super().__init__(${n.args.map(expr).join(', ')})`;
    case 'Lista': return `[${n.elementos.map(expr).join(', ')}]`;
    case 'Indice': return `${expr(n.obj)}[${expr(n.indice)}]`;
    default: return '…';
  }
}