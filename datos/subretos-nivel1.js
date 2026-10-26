// ═══════════════════════════════════════════════════════════
// datos/subretos-nivel1.js — 6 sub-retos + mini-jefe.
// Mapa: # servidor bloqueado · . pasillo · R robot · F fragmento
//       P puerta · G registro de Gustaff
// El campo `objetivo` se muestra con innerHTML (admite <b>, <code>, <br>).
// ═══════════════════════════════════════════════════════════
export const SUBRETOS_NIVEL1 = Object.freeze([
  {
    id: 'sr1', nombre: 'Primeros pasos', concepto: 'Secuencia',
    objetivo:
      '<b>META:</b> llevar al robot hasta el <b>fragmento verde</b> y recolectarlo.<br>' +
      'Una <b>secuencia</b> es una lista de órdenes que el robot cumple en orden, una por una. La flecha dorada de la vista aérea indica hacia dónde mira.<br><br>' +
      '<b>PASO 1.</b> «mover adelante» 4 veces (hasta el final del pasillo de arriba).<br>' +
      '<b>PASO 2.</b> «girar derecha»: ahora mira hacia abajo.<br>' +
      '<b>PASO 3.</b> «mover adelante» 2 veces.<br>' +
      '<b>PASO 4.</b> «girar derecha» y «mover adelante» 4 veces hasta quedar sobre el fragmento.<br>' +
      '<b>PASO 5.</b> «recolectar fragmento».',
    mapa: [
      '#######',
      '#R....#',
      '####..#',
      '#F....#',
      '#######',
    ],
    direccionInicial: 'E',
    minBloques: 7, maxPasos: 40,
    solucionTexto: 'moverAdelante(); moverAdelante(); moverAdelante(); moverAdelante();\ngirar("derecha");\nmoverAdelante(); moverAdelante();\ngirar("derecha");\nmoverAdelante(); moverAdelante(); moverAdelante(); moverAdelante();\nrecolectar();',
    pistas: [
      'Cuenta las casillas: el robot avanza de una en una.',
      'Tras el primer tramo necesita mirar hacia abajo: girar("derecha").',
    ],
  },
  {
    id: 'sr2', nombre: 'La puerta de datos', concepto: 'Variables',
    objetivo:
      '<b>META:</b> abrir la puerta con el código del panel y recolectar el fragmento que hay detrás.<br>' +
      'Una <b>variable</b> es una cajita con nombre donde guardas un dato. Hay datos de distintos tipos: número (42), decimal (3.14), verdadero/falso y texto («ALFA»). El panel guarda un texto.<br><br>' +
      '<b>PASO 1.</b> Crea una variable (menú Variables), por ejemplo <code>codigo</code>, y asígnale «leer panel de datos».<br>' +
      '<b>PASO 2.</b> Usa «abrir puerta con» y arrastra a su hueco la variable <code>codigo</code> (no escribas el texto a mano).<br>' +
      '<b>PASO 3.</b> «mover adelante» 5 veces: cruzas la puerta hasta el fragmento.<br>' +
      '<b>PASO 4.</b> «recolectar fragmento».',
    mapa: [
      '########',
      '#R...PF#',
      '########',
    ],
    direccionInicial: 'E',
    panelTexto: 'ALFA',
    fichas: [{ v: 42, tipo: 'num' }, { v: 3.14, tipo: 'num' }, { v: true, tipo: 'bool' }, { v: 'ALFA', tipo: 'texto' }],
    minBloques: 6, maxPasos: 40,
    solucionTexto: 'var codigo = leerPanel();\nabrirPuerta(codigo);\nmoverAdelante(); moverAdelante(); moverAdelante(); moverAdelante(); moverAdelante();\nrecolectar();',
    pistas: [
      'leerPanel() devuelve lo que muestra el panel: guárdalo en una variable.',
      'abrirPuerta necesita la variable, no un número.',
    ],
  },
  {
    id: 'sr3', nombre: 'La compuerta', concepto: 'Condicional if/else',
    objetivo:
      '<b>META:</b> cruzar el pasillo hasta el <b>fragmento</b>. A mitad de camino hay una <b>compuerta</b>: a veces está abierta y a veces un servidor la bloquea. No sabes cuál toca, así que tu programa debe funcionar en los dos casos.<br>' +
      'Un <b>condicional</b> es una pregunta con dos respuestas: <b>si</b> se cumple, haces una cosa; <b>si no</b>, haces otra. «leer sensor» responde <code>"muro"</code> si hay un servidor delante, o <code>"libre"</code> si no.<br><br>' +
      '<b>PASO 1.</b> «mover adelante» 2 veces: quedas justo antes de la compuerta.<br>' +
      '<b>PASO 2.</b> Pon un «si / si no» con la condición <code>leer sensor = "muro"</code>.<br>' +
      '<b>PASO 3.</b> Dentro del <b>SI</b> (hay muro, hay que rodear): girar izquierda, avanzar 1, girar derecha, avanzar 2, girar derecha, avanzar 1, girar izquierda.<br>' +
      'Dentro del <b>SI NO</b> (está libre): avanzar 2.<br>' +
      '<b>PASO 4.</b> Los dos caminos terminan en el mismo sitio, mirando al este. Después del «si / si no»: «mover adelante» 2 veces y «recolectar fragmento».<br>' +
      '<b>Truco:</b> la estación holográfica junto al inicio muestra si la compuerta está cerrada o abierta. Al reiniciar el reto puede cambiar.',
    mapa: [
      '#########',
      '###...###',
      '#R..C..F#',
      '#########',
    ],
    direccionInicial: 'E',
    minBloques: 19, maxPasos: 60,
    solucionTexto: 'moverAdelante(); moverAdelante();\nif (leerSensor() == "muro") {\n  girar("izquierda"); moverAdelante(); girar("derecha");\n  moverAdelante(); moverAdelante();\n  girar("derecha"); moverAdelante(); girar("izquierda");\n} else {\n  moverAdelante(); moverAdelante();\n}\nmoverAdelante(); moverAdelante();\nrecolectar();',
    pistas: [
      'La compuerta es la casilla justo delante del robot tras avanzar 2: leerSensor() te dice si está bloqueada.',
      'El desvío sube por la fila de arriba y vuelve a bajar; los dos caminos terminan en la misma casilla.',
    ],
  },
  {
    id: 'sr4', nombre: 'El panel de acceso', concepto: 'switch',
    objetivo:
      '<b>META:</b> llegar al fragmento, que aparece en un pasillo distinto según el código del panel (1, 2 o 3). El código cambia en cada ejecución, así que tu programa debe servir para los tres.<br>' +
      'Un <b>switch</b> («según el código») elige entre varios casos: es un «si» con más de dos salidas.<br><br>' +
      '<b>PASO 1.</b> Usa el bloque «según el código». El robot empieza mirando al norte.<br>' +
      '<b>PASO 2.</b> <b>Caso 1</b>: déjalo vacío (el fragmento está al norte, de frente). <b>Caso 2</b>: «girar derecha» (este). <b>Caso 3</b>: «girar derecha» dos veces (sur).<br>' +
      '<b>PASO 3.</b> Fuera del switch: «mover adelante» 3 veces y «recolectar fragmento».',
    mapa: [
      '#########',
      '####.####',
      '####.####',
      '####.####',
      '####R...#',
      '####.####',
      '####.####',
      '####.####',
      '#########',
    ],
    direccionInicial: 'N',
    minBloques: 9, maxPasos: 60,
    solucionTexto: 'switch (leerCodigo()) {\n  case 1: break;                    // norte: recto\n  case 2: girar("derecha"); break;  // este\n  case 3: girar("derecha"); girar("derecha"); // sur\n}\nmoverAdelante(); moverAdelante(); moverAdelante();\nrecolectar();',
    pistas: [
      'El fragmento aparece en el pasillo que indica el código.',
      'Código 2 está a la derecha; código 3 exige girar dos veces.',
    ],
  },
  {
    id: 'sr5', nombre: 'El pasillo infinito', concepto: 'Bucle for',
    objetivo:
      '<b>META:</b> llegar al fragmento del final del pasillo (8 casillas) usando un bucle en vez de 8 bloques iguales.<br>' +
      'Un <b>bucle</b> repite un bloque de órdenes. «repetir N veces» equivale al <code>for</code> del código equivalente.<br><br>' +
      '<b>PASO 1.</b> Responde primero la pregunta de predicción para desbloquear «Ejecutar». Fíjate bien en dónde empieza y dónde termina el conteo.<br>' +
      '<b>PASO 2.</b> Arma «repetir <code>8</code> veces» y dentro pon «mover adelante».<br>' +
      '<b>PASO 3.</b> Después del bucle, «recolectar fragmento».<br>' +
      '<b>Fíjate:</b> por el camino pasas junto a un registro de Gustaff.',
    mapa: [
      '#############',
      '#R....G..F..#',
      '#############',
    ],
    direccionInicial: 'E',
    minBloques: 3, maxPasos: 80,
    prediccion: {
      pregunta: 'Antes de ejecutar: ¿cuántas casillas avanzará este programa?',
      codigo: 'for i in range(1, 6):\n  mover_adelante()',
      opciones: ['4 casillas', '5 casillas', '6 casillas'],
      correcta: 1,
    },
    solucionTexto: 'for (num i = 0; i < 8; i = i + 1) {\n  moverAdelante();\n}\nrecolectar();',
    pistas: [
      'Cuenta las casillas hasta el fragmento: el bucle hace el trabajo sucio.',
      'El robot pasa junto a un registro de Gustaff por el camino.',
    ],
  },
  {
    id: 'sr6', nombre: 'Hasta el final', concepto: 'Bucle while',
    objetivo:
      '<b>META:</b> llegar al fragmento sin saber cuántas casillas tiene el pasillo.<br>' +
      'Un bucle <b>mientras</b> repite hasta que su condición deje de cumplirse. Sirve cuando no sabes cuántas veces hará falta.<br><br>' +
      '<b>PASO 1.</b> Arma «mientras» con la condición <code>leer sensor ≠ "muro"</code> (usa el comparador y cambia la igualdad por «≠»).<br>' +
      '<b>PASO 2.</b> Dentro: «mover adelante».<br>' +
      '<b>PASO 3.</b> Después del bucle: «recolectar fragmento».<br>' +
      '<b>Cómo termina:</b> el fragmento cuenta como camino libre; el robot lo pisa y se detiene cuando tiene el muro delante.',
    mapa: [
      '#############',
      '#R.........F#',
      '#############',
    ],
    direccionInicial: 'E',
    minBloques: 4, maxPasos: 80,
    solucionTexto: 'while (leerSensor() != "muro") {\n  moverAdelante();\n}\nrecolectar();',
    pistas: [
      'while necesita una condición que cambie: el sensor cambia al llegar al muro.',
      'El fragmento cuenta como camino libre: el robot se detiene justo después.',
    ],
  },
  { 
    id: 'jefe', nombre: 'El Error de Sintaxis', concepto: 'Depuración',
    objetivo:
      '<b>META:</b> armar tú solo el programa completo y llegar al fragmento. Aquí se juntan todos los conceptos.<br>' +
      'Depurar es encontrar por qué un programa no hace lo que quieres: casi siempre es un giro al revés o un paso de más.<br><br>' +
      '<b>PASO 1.</b> Dibuja el camino con el dedo sobre la vista aérea antes de poner bloques.<br>' +
      '<b>PASO 2.</b> Este: 4 casillas. Giro a la derecha (sur): 2 casillas.<br>' +
      '<b>PASO 3.</b> Giro a la izquierda (este): 2 casillas hasta el fragmento.<br>' +
      '<b>PASO 4.</b> «mostrar» un mensaje de victoria y «recolectar fragmento».<br>' +
      '<b>Si choca:</b> el robot vuelve al inicio y tus bloques se quedan; mira en qué casilla chocó y corrige solo ese tramo.',
    mapa: [
      '##########',
      '#R....#..#', 
      '#.....#..#',
      '#......F.#',
      '##########',
    ],
    direccionInicial: 'E',
    minBloques: 10, maxPasos: 60,
    esJefe: true,
    solucionTexto: 'moverAdelante(); moverAdelante(); moverAdelante(); moverAdelante();\ngirar("derecha");\nmoverAdelante(); moverAdelante();\ngirar("izquierda");\nmostrar("¡Error de Sintaxis, borrado!");\nmoverAdelante(); moverAdelante();\nrecolectar();',
    pistas: [
      'Dibuja el camino con el dedo antes de colocar bloques.',
      'Cuatro pasos al este, luego abajo, luego otra vez al este hasta el fragmento.',
    ],
  },
]);