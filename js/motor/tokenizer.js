// motor/tokenizer.js — fuente → tokens (nunca eval/Function)
import { ErrorMotor, Categorias } from './errores.js';

const CLAVES = new Set([
  'var','num','texto','bool','void','true','false','null',
  'if','else','switch','case','default','break','continue','for','while',
  'function','return','new','class','abstract','extends','implements',
  'interface','constructor','public','private','override','super','this',
]);

const esDigito = c => c >= '0' && c <= '9';
const esLetra = c => /[a-zA-Z_áéíóúüñÁÉÍÓÚÜÑ]/.test(c);
const esAlnum = c => esLetra(c) || esDigito(c);

/** @returns {{tipo:string, valor:any, linea:number}[]} */
export function tokenizar(fuente){
  const tokens = [];
  let i = 0, linea = 1;
  while (i < fuente.length){
    const c = fuente[i];
    if (c === '\n'){ linea++; i++; continue; }
    if (/\s/.test(c)){ i++; continue; }
    if (c === '/' && fuente[i+1] === '/'){
      while (i < fuente.length && fuente[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && fuente[i+1] === '*'){
      i += 2;
      while (i < fuente.length && !(fuente[i] === '*' && fuente[i+1] === '/')){
        if (fuente[i] === '\n') linea++;
        i++;
      }
      if (i >= fuente.length) throw new ErrorMotor(Categorias.SYNTAX, 'Comentario sin cerrar', linea);
      i += 2; continue;
    }
    if (esDigito(c)){
      let s = '';
      while (i < fuente.length && (esDigito(fuente[i]) || fuente[i] === '.')) s += fuente[i++];
      tokens.push({ tipo: 'num', valor: Number(s), linea });
      continue;
    }
    if (c === '"' || c === "'"){
      const q = c; i++; let s = '';
      while (i < fuente.length && fuente[i] !== q){
        if (fuente[i] === '\n') throw new ErrorMotor(Categorias.SYNTAX, 'Cadena sin cerrar', linea);
        s += fuente[i++];
      }
      if (i >= fuente.length) throw new ErrorMotor(Categorias.SYNTAX, 'Cadena sin cerrar', linea);
      i++;
      tokens.push({ tipo: 'texto', valor: s, linea });
      continue;
    }
    if (esLetra(c)){
      let s = '';
      while (i < fuente.length && esAlnum(fuente[i])) s += fuente[i++];
      tokens.push({ tipo: CLAVES.has(s) ? 'clave' : 'ident', valor: s, linea });
      continue;
    }
    const dos = fuente.substr(i, 2);
    if (['==','!=','<=','>=','&&','||'].includes(dos)){
      tokens.push({ tipo: 'op', valor: dos, linea }); i += 2; continue;
    }
    if ('+-*/%<>=!'.includes(c)){ tokens.push({ tipo: 'op', valor: c, linea }); i++; continue; }
    if ('(){};,.:[]'.includes(c)){ tokens.push({ tipo: 'punct', valor: c, linea }); i++; continue; }
    throw new ErrorMotor(Categorias.SYNTAX, `Carácter inesperado «${c}»`, linea);
  }
  tokens.push({ tipo: 'fin', valor: null, linea });
  return tokens;
}