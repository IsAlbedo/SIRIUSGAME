// ═══════════════════════════════════════════════════════════
// datos/subretos-nivel2.js — Módulo de Construcción.
// Plano: lista de estructuras objetivo {x, y, tipo, alto?}.
// Robot: colocarBloque construye en SU casilla y luego avanza (modelo tortuga).
// El campo `objetivo` se muestra con innerHTML (admite <b>, <code>, <br>).
// conservarFunciones: ['nombre'] → el editor limpia el espacio y deja solo esas
// funciones, guardadas de los retos anteriores (ver ui/editor.js).
// ═══════════════════════════════════════════════════════════

export const CALIDAD_NIVEL2 = Object.freeze({
  verbosClaros: ['construir', 'colocar', 'instalar', 'calcular', 'pedir', 'reponer', 'preparar', 'armar', 'crear', 'mover'],
  largoMinimoNombre: 5,
  tamanoMinimoDuplicado: 3,   // bloques mínimos para considerar un subtree "copiado"
  penalizacionDuplicado: 5,
  bonusReutilizacion: 10,     // por función propia llamada 2+ veces
  topeReutilizacion: 30,
});

export const SUBRETOS_NIVEL2 = Object.freeze([
  {
    id: 'n2-sr1', nombre: 'La primera pared', concepto: 'Función sin parámetros',
    objetivo:
      '<b>META:</b> construir un muro de <b>3 bloques en fila</b> (las 3 casillas verdes del plano).<br>' +
      'Una <b>función</b> es una receta con nombre: la escribes una vez y la usas cuantas veces quieras.<br><br>' +
      '<b>PASO 1.</b> Define <code>construirPared</code>. Dentro pon «colocar bloque de altura» (con un <b>1</b> en su hueco: altura 1 = un bloque de alto) y debajo «mover adelante».<br>' +
      '<b>PASO 2.</b> Fuera de la función, llámala <b>3 veces</b>.<br>' +
      '<b>Verás:</b> cada llamada pone un bloque y avanza una casilla; la baldosa del plano se pone verde.',
    robot: { x: 2, y: 4, dir: 'E' },
    plano: [
      { x: 2, y: 4, tipo: 'bloque', alto: 1 },
      { x: 3, y: 4, tipo: 'bloque', alto: 1 },
      { x: 4, y: 4, tipo: 'bloque', alto: 1 },
    ],
    verificar: { tipo: 'plano' },
    mantenerEspacio: false,
    minBloques: 6, maxPasos: 120,
    solucionTexto:
      'function construirPared() {\n  colocarBloque(1);\n  moverAdelante();\n}\nconstruirPared();\nconstruirPared();\nconstruirPared();',
    pistas: [
      'Primero DEFINE la función (bloque «definir función»); luego llámala tres veces.',
      'Cada llamada pone un bloque en la casilla del robot y lo hace avanzar una.',
    ],
  },

  {
    id: 'n2-sr2', nombre: 'Parámetros en obra', concepto: 'Parámetros',
    objetivo:
      '<b>META:</b> construir una pared de <b>3 bloques</b> de altura 2, dejar <b>1 casilla vacía</b> (el pasillo) y poner una <b>puerta</b> después.<br>' +
      'Un <b>parámetro</b> es un dato que le pasas a la función para que cambie lo que hace. Sin parámetros tendrías que escribir una función distinta para cada tamaño de pared.<br><br>' +
      '<b>PASO 1.</b> Tu función <code>construirPared</code> del reto anterior ya está en el espacio de trabajo. Con la ruedita azul del bloque, agrégale dos parámetros: <code>largo</code> y <code>alto</code>.<br>' +
      '<b>PASO 2.</b> Dentro: «repetir <code>largo</code> veces» → «colocar bloque de altura <code>alto</code>» y «mover adelante». Arrastra las variables <code>largo</code> y <code>alto</code> a los huecos (cambia el 1 por <code>alto</code>), no escribas números.<br>' +
      '<b>PASO 3.</b> Fuera de la función, llama <code>construirPared</code> con largo 3 y alto 2.<br>' +
      '<b>PASO 4.</b> Tras la pared el robot queda en el hueco. Avanza 1 casilla («mover adelante») y pon la puerta.<br><br>' +
      '<b>Plano:</b> verde = bloque, naranja = puerta, la casilla sin color entre ellos se queda vacía a propósito.',
    robot: { x: 1, y: 2, dir: 'E' },
    plano: [
      { x: 1, y: 2, tipo: 'bloque', alto: 2 },
      { x: 2, y: 2, tipo: 'bloque', alto: 2 },
      { x: 3, y: 2, tipo: 'bloque', alto: 2 },
      { x: 5, y: 2, tipo: 'puerta' },
    ],
    verificar: { tipo: 'plano' },
    mantenerEspacio: false,
    conservarFunciones: ['construirPared'],
    minBloques: 12, maxPasos: 200,
    solucionTexto:
      'function construirPared(num largo, num alto) {\n  for (num i = 0; i < largo; i = i + 1) {\n    colocarBloque(alto);\n    moverAdelante();\n  }\n}\nconstruirPared(3, 2);\nmoverAdelante();   // cruza el hueco\nponerPuerta();',
    pistas: [
      'Si el robot construye en su casilla y luego avanza, tres vueltas del bucle dejan tres bloques seguidos.',
      'Después de la pared el robot está en la casilla vacía. La puerta va una casilla más adelante: mover adelante y poner puerta.',
      'En «colocar bloque de altura», suelta la variable alto del menú Variables; si pones un número fijo, funciona para esta pared pero no demuestra el parámetro.',
    ],
  },

  {
    id: 'n2-sr3', nombre: 'Lo que vuelve, importa', concepto: 'Retorno de valores',
    objetivo:
      '<b>META:</b> pedir al depósito la cantidad exacta de material y luego construir la pared del plano (3 bloques de altura 2).<br>' +
      'Una función puede <b>devolver</b> un valor con <code>return</code>. Sin return, quien la llama recibe «nada».<br><br>' +
      '<b>PASO 1.</b> Define <code>calcularMateriales(largo, alto)</code> que <b>devuelva</b> <code>largo × alto × 2</code> (bloque «devolver»).<br>' +
      '<b>PASO 2.</b> Guarda el resultado: variable <code>necesario</code> = <code>calcularMateriales(3, 2)</code>.<br>' +
      '<b>PASO 3.</b> Usa «pedir recursos» con la variable <code>necesario</code> (deben ser 12).<br>' +
      '<b>PASO 4.</b> Construye la pared con tu función <code>construirPared(3, 2)</code> del reto anterior (ya está en el espacio de trabajo).',
    robot: { x: 2, y: 5, dir: 'E' },
    plano: [
      { x: 2, y: 5, tipo: 'bloque', alto: 2 },
      { x: 3, y: 5, tipo: 'bloque', alto: 2 },
      { x: 4, y: 5, tipo: 'bloque', alto: 2 },
    ],
    verificar: { tipo: 'planoYRecursos' },
    mantenerEspacio: false,
    conservarFunciones: ['construirPared'],
    minBloques: 14, maxPasos: 200,
    solucionTexto:
      'function calcularMateriales(num largo, num alto) {\n  return largo * alto * 2;\n}\nvar necesario = calcularMateriales(3, 2);\npedirRecursos(necesario);\nconstruirPared(3, 2);',
    pistas: [
      'Sin return, pedirRecursos recibe «nada» y el depósito rechaza el pedido.',
      'El plano necesita 12 unidades: 3 de largo × 2 de alto × 2.',
    ],
  },

  {
    id: 'n2-sr4', nombre: 'El secreto del ámbito', concepto: 'Scope',
    objetivo:
      '<b>META:</b> arreglar un programa que falla y construir la pared de 3 bloques.<br>' +
      'El <b>ámbito</b> (scope) dice dónde vive una variable: la que creas dentro de una función muere al salir de ella.<br><br>' +
      '<b>PASO 1.</b> Pulsa «Ejecutar» sin tocar nada. El error dice que <code>ladrillos</code> no existe fuera de <code>preparar()</code>.<br>' +
      '<b>PASO 2.</b> Dentro de <code>preparar</code>, al final, añade «devolver» <code>ladrillos × 3</code>.<br>' +
      '<b>PASO 3.</b> Fuera, guarda el resultado en una variable (<code>total</code> = <code>preparar()</code>) y usa «pedir recursos» con <code>total</code>.<br>' +
      '<b>PASO 4.</b> Ejecuta otra vez: la pared se construye y el depósito acepta el pedido.',
    robot: { x: 2, y: 3, dir: 'E' },
    plano: [
      { x: 2, y: 3, tipo: 'bloque', alto: 1 },
      { x: 3, y: 3, tipo: 'bloque', alto: 1 },
      { x: 4, y: 3, tipo: 'bloque', alto: 1 },
    ],
    verificar: { tipo: 'planoYRecursos' },
    mantenerEspacio: false,
    programaInicial: [
      { t: 'def', nombre: 'preparar', params: [], cuerpo: [
        // ladrillos = 2 → return ladrillos × 3 = 6 = lo que pide el depósito (3 bloques × alto 1 × 2)
        { t: 'set', nombre: 'ladrillos', valor: { t: 'lit', v: 2 } },
        { t: 'bloque', alto: 1 }, { t: 'mover' },
        { t: 'bloque', alto: 1 }, { t: 'mover' },
        { t: 'bloque', alto: 1 }, { t: 'mover' },
      ] },
      { t: 'llamar', nombre: 'preparar', args: [] },
      { t: 'recursos', valor: { t: 'var', nombre: 'ladrillos' } },
    ],
    minBloques: 12, maxPasos: 200,
    solucionTexto:
      'function preparar() {\n  var ladrillos = 2;\n  colocarBloque(1); moverAdelante();\n  colocarBloque(1); moverAdelante();\n  colocarBloque(1); moverAdelante();\n  return ladrillos * 3;\n}\nvar total = preparar();\npedirRecursos(total);',
    pistas: [
      'Una variable declarada dentro de una función muere al salir de ella: eso es el ámbito.',
      'La salida elegante: return ladrillos * 3, y afuera la recoges con var total = preparar().',
    ],
  },

  {
    id: 'n2-sr5', nombre: 'La grúa y la lista compartida', concepto: 'Valor vs referencia',
    objetivo:
      '<b>META:</b> que la grúa termine con la lista <code>acero, vidrio, madera</code> y que muestres el número <b>10</b>.<br>' +
      'Los números viajan <b>por valor</b> (la función recibe una copia). La lista de la grúa es <b>compartida</b> (por referencia): todos ven los cambios.<br><br>' +
      '<b>PASO 1.</b> Crea <code>intentarCambiar(x)</code> que haga <code>x = 99</code>. Prueba con una variable <code>copias = 10</code> y luego «mostrar» <code>copias</code>: seguirá valiendo 10.<br>' +
      '<b>PASO 2.</b> Crea <code>reponer(m)</code> que use «agregar material» <code>m</code> a la grúa.<br>' +
      '<b>PASO 3.</b> Llama <code>reponer("vidrio")</code> y <code>reponer("madera")</code>.<br>' +
      '<b>Fíjate:</b> el número no cambió fuera de la función, pero la lista sí.',
    robot: { x: 2, y: 4, dir: 'E' },
    plano: [],
    verificar: { tipo: 'materialesYMostrar', materiales: ['acero', 'vidrio', 'madera'], mostrado: 10 },
    mantenerEspacio: false,
    minBloques: 12, maxPasos: 120,
    solucionTexto:
      'function intentarCambiar(num x) {\n  x = 99;\n}\nfunction reponer(texto m) {\n  agregarMaterial(m);\n}\nvar copias = 10;\nintentarCambiar(copias);\nmostrar(copias);\nreponer("vidrio");\nreponer("madera");',
    pistas: [
      'Los números viajan como copia: lo que pasa dentro de la función se queda dentro.',
      'La lista de la grúa es UN solo lugar: todos los que la tocan ven el cambio.',
    ],
  },

  {
    id: 'n2-sr6', nombre: 'La manzana completa', concepto: 'Modularización',
    objetivo:
      '<b>META:</b> construir 3 edificios (filas de arriba a abajo): vivienda, almacén y centro de comunicación, reutilizando TUS funciones.<br>' +
      '<b>Modularizar</b> = dividir un problema grande en funciones pequeñas que se reutilizan. Cada función reutilizada da bonus; copiar y pegar bloques resta.<br><br>' +
      '<b>PASO 1.</b> Usa tu <code>construirPared(largo, alto)</code> del reto 2 (ya está en el espacio de trabajo) para los muros. Crea <code>instalarVentanas(cuantas)</code> (avanzar y «instalar ventana», repetido).<br>' +
      '<b>PASO 2.</b> Fila 1: pared 3×2, puerta, avanzar, ventana.<br>' +
      '<b>PASO 3.</b> Desplázate (girar y mover, sin construir) a la fila 2: pared 4×3 y puerta.<br>' +
      '<b>PASO 4.</b> Desplázate a la fila 3: pared 5×2 y 2 ventanas.<br>' +
      '<b>Bonus:</b> el registro de Gustaff está en la fila del almacén, a la derecha: pasa por ahí.',
    robot: { x: 1, y: 1, dir: 'E' },
    plano: [
      { x: 1, y: 1, tipo: 'bloque', alto: 2 }, { x: 2, y: 1, tipo: 'bloque', alto: 2 },
      { x: 3, y: 1, tipo: 'bloque', alto: 2 }, { x: 4, y: 1, tipo: 'puerta' },
      { x: 5, y: 1, tipo: 'ventana' },
      { x: 1, y: 3, tipo: 'bloque', alto: 3 }, { x: 2, y: 3, tipo: 'bloque', alto: 3 },
      { x: 3, y: 3, tipo: 'bloque', alto: 3 }, { x: 4, y: 3, tipo: 'bloque', alto: 3 },
      { x: 5, y: 3, tipo: 'puerta' },
      { x: 1, y: 5, tipo: 'bloque', alto: 2 }, { x: 2, y: 5, tipo: 'bloque', alto: 2 },
      { x: 3, y: 5, tipo: 'bloque', alto: 2 }, { x: 4, y: 5, tipo: 'bloque', alto: 2 },
      { x: 5, y: 5, tipo: 'bloque', alto: 2 }, { x: 6, y: 5, tipo: 'ventana' },
      { x: 7, y: 5, tipo: 'ventana' },
    ],
    verificar: { tipo: 'plano' },
    mantenerEspacio: false,
    conservarFunciones: ['construirPared'],
    registroG: { x: 6, y: 3 },
    minBloques: 26, maxPasos: 600,
    calidadObligatoria: true,
    solucionTexto:
      '// construirPared(largo, alto) es la del reto 2\nfunction instalarVentanas(num cuantas) {\n  for (num k = 0; k < cuantas; k = k + 1) {\n    moverAdelante();\n    ponerVentana();\n  }\n}\n// fila 1: vivienda (el robot termina en x=4)\nconstruirPared(3, 2); ponerPuerta(); moverAdelante(); ponerVentana();\n// bajar a la fila 2 (x=1,y=3): caminar no construye\ngirar("derecha"); moverAdelante(); moverAdelante();\ngirar("derecha"); moverAdelante(); moverAdelante(); moverAdelante(); moverAdelante();\ngirar("derecha"); girar("derecha");\n// fila 2: almacén (termina en x=5)\nconstruirPared(4, 3); ponerPuerta();\n// pasar por el registro (6,3) y bajar a la fila 3 (x=1,y=5)\nmoverAdelante();\ngirar("derecha"); moverAdelante(); moverAdelante();\ngirar("derecha"); moverAdelante(); moverAdelante(); moverAdelante(); moverAdelante(); moverAdelante();\ngirar("derecha"); girar("derecha");\n// fila 3: centro de comunicación\nconstruirPared(5, 2); ponerVentana(); instalarVentanas(1);',
    pistas: [
      'Tres edificios, una sola construirPared: eso es modularizar.',
      'Caminar no construye: puedes cruzar casillas del plano sin dejar nada.',
      'El registro de Gustaff brilla entre el almacén y el centro: pasa por ahí.',
    ],
  },

  {
    id: 'n2-jefe', nombre: 'El Glitch de Eclipse', concepto: 'Refactorización',
    objetivo:
      '<b>META:</b> dejar la misma obra (3 filas de 3 bloques) pero con el código ordenado en UNA función llamada 3 veces.<br>' +
      '<b>Refactorizar</b> = cambiar cómo está escrito el código sin cambiar lo que hace. Si repites el mismo tramo tres veces, es una función que falta.<br><br>' +
      '<b>PASO 1.</b> Ejecuta el programa cargado: funciona, pero repite el mismo tramo (3 bloques + avanzar) tres veces.<br>' +
      '<b>PASO 2.</b> Crea <code>fila()</code> con «colocar bloque» y «mover adelante» ×3.<br>' +
      '<b>PASO 3.</b> Sustituye cada tramo repetido por una llamada a <code>fila()</code>. Deja los giros y movimientos entre filas como están.<br>' +
      '<b>PASO 4.</b> Ejecuta: el jefe se detiene solo si detecta una función llamada 3 veces.',
    robot: { x: 2, y: 2, dir: 'E' },
    plano: [
      { x: 2, y: 2, tipo: 'bloque', alto: 1 }, { x: 3, y: 2, tipo: 'bloque', alto: 1 },
      { x: 4, y: 2, tipo: 'bloque', alto: 1 },
      { x: 5, y: 3, tipo: 'bloque', alto: 1 }, { x: 4, y: 3, tipo: 'bloque', alto: 1 },
      { x: 3, y: 3, tipo: 'bloque', alto: 1 },
      { x: 2, y: 4, tipo: 'bloque', alto: 1 }, { x: 3, y: 4, tipo: 'bloque', alto: 1 },
      { x: 4, y: 4, tipo: 'bloque', alto: 1 },
    ],
    verificar: { tipo: 'planoYReutilizacion' },
    mantenerEspacio: false,
    esJefe: true,
    programaInicial: [
      { t: 'bloque', alto: 1 }, { t: 'mover' }, { t: 'bloque', alto: 1 }, { t: 'mover' },
      { t: 'bloque', alto: 1 }, { t: 'mover' },
      { t: 'girar', dir: 'derecha' }, { t: 'mover' },
      { t: 'girar', dir: 'derecha' },
      { t: 'bloque', alto: 1 }, { t: 'mover' }, { t: 'bloque', alto: 1 }, { t: 'mover' },
      { t: 'bloque', alto: 1 }, { t: 'mover' },
      { t: 'girar', dir: 'izquierda' }, { t: 'mover' },
      { t: 'girar', dir: 'izquierda' },
      { t: 'bloque', alto: 1 }, { t: 'mover' }, { t: 'bloque', alto: 1 }, { t: 'mover' },
      { t: 'bloque', alto: 1 }, { t: 'mover' },
    ],
    minBloques: 18, maxPasos: 400,
    calidadObligatoria: true,
    solucionTexto:
      'function fila() {\n  colocarBloque(1); moverAdelante();\n  colocarBloque(1); moverAdelante();\n  colocarBloque(1); moverAdelante();\n}\nfila();\ngirar("derecha"); moverAdelante(); girar("derecha"); moverAdelante();\nfila();\ngirar("izquierda"); moverAdelante(); girar("izquierda"); moverAdelante();\nfila();',
    pistas: [
      'Tres tramos idénticos gritan «¡convérteme en función!».',
      'El jefe solo se detiene si detecta una función llamada tres veces.',
    ],
  },
]);