// ═══════════════════════════════════════════════════════════
// datos/subretos-nivel3.js — Módulo de Ciudadanía.
// Tipos de verificación interpretados por moduloCiudadania.js.
// ═══════════════════════════════════════════════════════════

export const PLANTILLAS_METODOS = Object.freeze({
  trabajar: 'aportar(this.profesion, 2);\nthis.energia = this.energia - 20;',
  descansar: 'this.energia = this.energia + 30;',
  comunicarse: 'anunciar(this.nombre + " saluda a la ciudad");',
});

export const SUBRETOS_NIVEL3 = Object.freeze([
  {
    id: 'n3-sr1', nombre: '¿Qué es cada cosa?', concepto: 'Clases y objetos',
    objetivo: 'Clasifica los elementos de la ciudad: CLASE (molde), OBJETO (instancia) o ATRIBUTO (dato guardado).',
    verificar: { tipo: 'clasificacion' },
    sinCodigo: true,
    elementos: [
      { texto: 'Marta, 34 años, cultiva trigo en las afueras', respuesta: 'objeto' },
      { texto: 'CIUDADANO: molde con nombre, edad y profesión', respuesta: 'clase' },
      { texto: 'El valor 41 guardado en la edad de Leo', respuesta: 'atributo' },
      { texto: 'Esta ciudadana concreta que cura heridas en el hospital', respuesta: 'objeto' },
      { texto: 'El plano que describe cómo será cualquier vivienda', respuesta: 'clase' },
      { texto: 'La palabra «agricultora» guardada en una profesión', respuesta: 'atributo' },
    ],
    minBloques: 0, maxPasos: 1,
    solucionTexto: 'Clase = molde (CIUDADANO, el plano).\nObjeto = creación concreta (Marta, la ciudadana del hospital).\nAtributo = el dato guardado dentro (41, «agricultora»).',
    pistas: [
      'El molde describe; el objeto existe; el atributo se guarda.',
      'Si puedes señalarlo con el dedo en la ciudad, es un objeto.',
    ],
  },

  {
    id: 'n3-sr2', nombre: 'El molde del ciudadano', concepto: 'Clase: atributos y métodos',
    objetivo: 'Completa la ficha-molde: clase Ciudadano con atributos nombre (texto), edad (num), profesion (texto) y métodos trabajar(), descansar(), comunicarse(). Arrastra las plantillas de método.',
    verificar: {
      tipo: 'claseDefinida', clase: 'Ciudadano',
      atributos: ['nombre', 'edad', 'profesion'],
      metodos: ['trabajar', 'descansar', 'comunicarse'],
    },
    fichaInicial: { nombre: 'Ciudadano', atributos: [], metodos: [], conConstructor: false },
    codigoInicial: '',
    minBloques: 0, maxPasos: 400,
    solucionTexto:
      'class Ciudadano {\n  texto nombre;\n  num edad;\n  texto profesion;\n  num energia = 100;\n\n  void trabajar() {\n    aportar(this.profesion, 2);\n    this.energia = this.energia - 20;\n  }\n  void descansar() {\n    this.energia = this.energia + 30;\n  }\n  void comunicarse() {\n    anunciar(this.nombre + " saluda a la ciudad");\n  }\n}',
    pistas: [
      'La ficha genera el código: añade los tres atributos y marca sus tipos.',
      'Arrastra las plantillas trabajar/descansar/comunicarse a la zona de métodos.',
    ],
  },

    {
    id: 'n3-sr3', nombre: 'El nacimiento (constructor)', concepto: 'Constructores',
    objetivo: 'Ejecuta el código cargado: sin constructor, el ciudadano nace con todo en null. Luego añade el constructor (botón de la ficha), regenera y crea a Marta con valores iniciales.',
    verificar: { tipo: 'conConstructor', clase: 'Ciudadano' },
    fichaInicial: {
      nombre: 'Ciudadano',
      atributos: [
        { nombre: 'nombre', tipo: 'texto', valor: '', privado: false },
        { nombre: 'edad', tipo: 'num', valor: '', privado: false },
        { nombre: 'profesion', tipo: 'texto', valor: '', privado: false },
        { nombre: 'energia', tipo: 'num', valor: '100', privado: false },
      ],
      metodos: [
        { nombre: 'trabajar', retorno: 'void', params: '', plantilla: 'trabajar' },
        { nombre: 'descansar', retorno: 'void', params: '', plantilla: 'descansar' },
        { nombre: 'comunicarse', retorno: 'void', params: '', plantilla: 'comunicarse' },
      ],
      conConstructor: false,
    },
    codigoInicial:
      'class Ciudadano {\n  texto nombre;\n  num edad;\n  texto profesion;\n  num energia = 100;\n\n  void trabajar() {\n    aportar(this.profesion, 2);\n    this.energia = this.energia - 20;\n  }\n  void descansar() {\n    this.energia = this.energia + 30;\n  }\n  void comunicarse() {\n    anunciar(this.nombre + " saluda a la ciudad");\n  }\n}\n\nvar anonimo = new Ciudadano();\nregistrarCiudadano(anonimo);\nmostrar(anonimo.nombre);   // ¿qué aparece sobre su cabeza?',
    minBloques: 0, maxPasos: 400,
    solucionTexto:
      '// añade el constructor al molde:\nconstructor(texto nombre, num edad, texto profesion) {\n  this.nombre = nombre;\n  this.edad = edad;\n  this.profesion = profesion;\n}\n// y luego:\nvar marta = new Ciudadano("Marta", 34, "agricultora");\nregistrarCiudadano(marta);',
    pistas: [
      'Sin constructor, cada atributo se queda con su valor por defecto: null.',
      'El constructor recibe los valores y los guarda con this.atributo = parametro.',
    ],
  },

  {
    id: 'n3-sr4', nombre: 'El glitch de Eclipse', concepto: 'Encapsulamiento',
    objetivo: 'Marca energia como privada y añade getEnergia()/setEnergia(). Ejecuta: el glitch de Eclipse rebotará. Borra la línea del glitch, usa el setter/getter y muestra la energía (debe salir 80).',
    verificar: { tipo: 'encapsulado', clase: 'Ciudadano', mostrado: 80 },
    codigoInicial:
      'class Ciudadano {\n  texto nombre;\n  num edad;\n  texto profesion;\n  private num energia = 100;\n\n  constructor(texto nombre, num edad, texto profesion) {\n    this.nombre = nombre;\n    this.edad = edad;\n    this.profesion = profesion;\n  }\n\n  num getEnergia() { return this.energia; }\n  void setEnergia(num v) { this.energia = v; }\n\n  void trabajar() {\n    aportar(this.profesion, 2);\n    this.energia = this.energia - 20;\n  }\n  void descansar() { this.energia = this.energia + 30; }\n  void comunicarse() { anunciar(this.nombre + " saluda a la ciudad"); }\n}\n\nvar victima = new Ciudadano("Bianca", 29, "medica");\nregistrarCiudadano(victima);\n// GLITCH DE ECLIPSE: intenta corromper la energía\nvictima.energia = -50;\nvictima.setEnergia(80);\nmostrar(victima.getEnergia());',
    minBloques: 0, maxPasos: 400,
    solucionTexto:
      '// 1) Ejecuta tal cual: el glitch (victima.energia = -50) rebota porque energia es private.\n// 2) Borra esa línea y vuelve a ejecutar:\nvictima.setEnergia(80);\nmostrar(victima.getEnergia());   // 80',
    pistas: [
      'Un atributo private solo se toca desde dentro de su clase: ese es el escudo.',
      'Los getters leen, los setters escriben… y deciden qué se acepta.',
    ],
  },

  {
    id: 'n3-sr5', nombre: 'Que la ciudad respire', concepto: 'Instanciación y tareas',
    objetivo: 'Instancia Agricultora, Ingeniero, Médica y Comerciante (atributo profesion), regístralos y haz que trabajen hasta llenar los 4 medidores. Fíjate: todos usan el MISMO molde y las mismas llamadas…',
    verificar: { tipo: 'ciudadFuncionando' },
    registroG: { x: 0, z: 2 },
    minBloques: 0, maxPasos: 900,
    solucionTexto:
      'var marta = new Ciudadano("Marta", 34, "agricultora");\nvar leo   = new Ciudadano("Leo", 41, "ingeniero");\nvar bianca = new Ciudadano("Bianca", 29, "medica");\nvar tomás = new Ciudadano("Tomás", 38, "comerciante");\nregistrarCiudadano(marta);\nregistrarCiudadano(leo);\nregistrarCiudadano(bianca);\nregistrarCiudadano(tomás);\n\nmarta.trabajar(); marta.trabajar();\nleo.trabajar(); leo.trabajar();\nbianca.trabajar(); bianca.trabajar();\ntomás.trabajar(); tomás.trabajar();\nmostrar(estadoCiudad());\n// ¿Ves cuántas llamadas repetidas hacen falta? En el Nivel 4 habrá una forma mejor.',
    pistas: [
      'Cada trabajar() aporta 2 al medidor de su profesión y gasta 20 de energía.',
      'Los medidores necesitan llegar a 4: dos jornadas por ciudadano.',
    ],
  },
]); 