// ═══════════════════════════════════════════════════════════
// datos/subretos-nivel4.js — Academia de Especialización.
// ═══════════════════════════════════════════════════════════

export const CALENTAMIENTO = Object.freeze({
  titulo: 'Calentamiento: Animal → Perro / Gato',
  texto:
    'Animal define hablar(). Perro y Gato heredan de Animal y SOBRESCRIBEN hablar(): ' +
    'cada uno a su manera. El hijo recibe todo del padre y añade lo suyo.',
  codigo:
    'class Animal {\n  void hablar() { anunciar("...sonido misterioso..."); }\n}\nclass Perro extends Animal {\n  override void hablar() { anunciar("¡Guau!"); }\n}\nclass Gato extends Animal {\n  override void hablar() { anunciar("¡Miau!"); }\n}',
});

export const CHIPS_METODOS = Object.freeze({
  trabajarOverride: {
    etiqueta: 'trabajar() [override]',
    codigo: 'override void trabajar() {\n  this.extinguirFuego();\n}',
  },
  extinguirFuego: { 
    etiqueta: 'extinguirFuego()',
    codigo: 'void extinguirFuego() {\n  apagarFuego();\n  registrarAccion("Bombero extingue el fuego");\n}',
  },
  atenderHeridos: {
    etiqueta: 'atenderHeridos()',
    codigo: 'void atenderHeridos() {\n  curar();\n  registrarAccion("Médico atiende a los heridos");\n}',
  },
});

const BASE_CIUDADANO =
  'class Ciudadano {\n' +
  '  texto nombre;\n  num edad;\n  texto profesion;\n  num energia = 100;\n\n' +
  '  constructor(texto nombre, num edad, texto profesion) {\n' +
  '    this.nombre = nombre;\n    this.edad = edad;\n    this.profesion = profesion;\n  }\n\n' +
  '  void trabajar() { registrarAccion("Ciudadano trabaja (genérico)"); }\n' +
  '  void descansar() { this.energia = this.energia + 30; }\n' +
  '}\n\n';

export const SUBRETOS_NIVEL4 = Object.freeze([
  {
    id: 'n4-sr1', nombre: '¿Es-un o tiene-un?', concepto: 'Relación "es-un"',
    objetivo: 'Decide qué pares son herencia (es-un) y cuáles no. Ojo con «tiene-un»: heredar de más es el error clásico.',
    verificar: { tipo: 'relaciones' },
    sinCodigo: true,
    mostrarCalentamiento: true,
    relaciones: [
      { a: 'Bombero', b: 'Ciudadano', respuesta: 'es-un' },
      { a: 'Ciudad', b: 'Ciudadano', respuesta: 'no-es-un' },
      { a: 'MédicoComunitario', b: 'Ciudadano', respuesta: 'es-un' },
      { a: 'Motor', b: 'Coche', respuesta: 'no-es-un' },
      { a: 'Perro', b: 'Animal', respuesta: 'es-un' },
      { a: 'Rueda', b: 'Coche', respuesta: 'no-es-un' },
    ],
    solucionTexto: 'Bombero/MédicoComunitario/Perro: ES-UN (herencia).\nCiudad tiene ciudadanos, el Coche tiene motor y ruedas: TIENE-UN (composición, no herencia).',
    pistas: [
      'Pregunta en voz alta: «¿un X es-un Y?». Si suena absurdo, no es herencia.',
      'Si la relación es «contiene» o «tiene partes», es composición.',
    ],
  },

  {
    id: 'n4-sr2', nombre: 'Extender y llamar al padre', concepto: 'extends + super()',
    objetivo: 'Conecta las 4 flechas es-un hacia Ciudadano, activa el constructor en cada clase y asegúrate de que el código llame a super(nombre, edad, profesion).',
    verificar: {
      tipo: 'extendsSuper',
      clases: ['TrabajadorIndustrial', 'TécnicoSistemas', 'ComercianteMercado', 'MédicoComunitario'],
      padre: 'Ciudadano',
    },
    baseCodigo: BASE_CIUDADANO,
    diagrama: {
      raiz: 'Ciudadano',
      clases: [
        { nombre: 'TrabajadorIndustrial', extiende: null, superPreset: false, chips: [] },
        { nombre: 'TécnicoSistemas', extiende: null, superPreset: false, chips: [] },
        { nombre: 'ComercianteMercado', extiende: null, superPreset: false, chips: [] },
        { nombre: 'MédicoComunitario', extiende: null, superPreset: false, chips: [] },
      ],
    },
    snippet: '// comprueba la cadena de constructores:\nvar leo = new TécnicoSistemas("Leo", 41, "técnico");\nregistrarCiudadano(leo);\nmostrar(leo.nombre);',
    minBloques: 0, maxPasos: 400,
    solucionTexto:
      'class TrabajadorIndustrial extends Ciudadano {\n  constructor(texto nombre, num edad, texto profesion) {\n    super(nombre, edad, profesion);\n  }\n}\n// …y lo mismo con TécnicoSistemas, ComercianteMercado y MédicoComunitario.',
    pistas: [
      'Modo «conectar es-un»: clic en la hija, clic en el padre.',
      'super(...) debe ser la primera acción del constructor hijo: el padre construye primero.',
    ],
  },

  {
    id: 'n4-sr3', nombre: 'Sobrescribir con propósito', concepto: 'Override',
    objetivo: 'Conecta Bombero a TrabajadorIndustrial. Arrastra trabajar()[override] y extinguirFuego() a Bombero, y atenderHeridos() a MédicoComunitario. Genera el código y ejecuta.',
    verificar: { tipo: 'override' },
    baseCodigo: BASE_CIUDADANO,
    diagrama: {
      raiz: 'Ciudadano',
      clases: [
        { nombre: 'TrabajadorIndustrial', extiende: 'Ciudadano', superPreset: true, chips: [] },
        { nombre: 'TécnicoSistemas', extiende: 'Ciudadano', superPreset: true, chips: [] },
        { nombre: 'ComercianteMercado', extiende: 'Ciudadano', superPreset: true, chips: [] },
        { nombre: 'MédicoComunitario', extiende: 'Ciudadano', superPreset: true, chips: ['atenderHeridos'] },
        { nombre: 'Bombero', extiende: null, superPreset: true, chipsDisponibles: ['trabajarOverride', 'extinguirFuego'] },
      ],
      chipsDisponibles: ['trabajarOverride', 'extinguirFuego', 'atenderHeridos'],
    },
    snippet:
      'var ivan = new Bombero("Iván", 33, "bombero");\nregistrarCiudadano(ivan);\nivan.trabajar();   // ¿trabaja… o extingue?\nmostrar(ivan.profesion);',
    minBloques: 0, maxPasos: 400,
    solucionTexto:
      'class Bombero extends TrabajadorIndustrial {\n  constructor(texto nombre, num edad, texto profesion) {\n    super(nombre, edad, profesion);\n  }\n  override void trabajar() {\n    this.extinguirFuego();\n  }\n  void extinguirFuego() {\n    apagarFuego();\n    registrarAccion("Bombero extingue el fuego");\n  }\n}',
    pistas: [
      'El Bombero es-un TrabajadorIndustrial, que es-un Ciudadano: jerarquía de dos pisos.',
      'override anuncia que el método del padre se reemplaza: sin override, el analizador protesta.',
    ],
  },

  {
    id: 'n4-sr4', nombre: '¡Incendio en la Academia!', concepto: 'Especialización en acción',
    objetivo: 'Emergencia real: instancia Bombero y MédicoComunitario, regístralos y ejecuta sus comportamientos. El bombero debe apagar el fuego y el médico atender a los heridos. Se ve en 3D.',
    verificar: { tipo: 'emergencia' },
    baseCodigo: BASE_CIUDADANO,
    diagrama: {
      raiz: 'Ciudadano',
      clases: [
        { nombre: 'TrabajadorIndustrial', extiende: 'Ciudadano', superPreset: true, chips: [] },
        { nombre: 'TécnicoSistemas', extiende: 'Ciudadano', superPreset: true, chips: [] },
        { nombre: 'ComercianteMercado', extiende: 'Ciudadano', superPreset: true, chips: [] },
        { nombre: 'MédicoComunitario', extiende: 'Ciudadano', superPreset: true, chips: ['atenderHeridos'] },
        { nombre: 'Bombero', extiende: 'TrabajadorIndustrial', superPreset: true, chips: ['trabajarOverride', 'extinguirFuego'] },
      ],
    },
    snippet:
      '// ── prueba de emergencia ──\nvar ivan = new Bombero("Iván", 33, "bombero");\nvar sara = new MédicoComunitario("Sara", 45, "medica");\nregistrarCiudadano(ivan);\nregistrarCiudadano(sara);\nivan.trabajar();\nsara.atenderHeridos();\nmostrar(estadoAcademia());',
    minBloques: 0, maxPasos: 600,
    solucionTexto: 'El snippet ya es la solución si el diagrama está bien generado: ivan.trabajar() ejecuta el override que apaga el fuego.',
    pistas: [
      'ivan.trabajar() ya no es genérico: el override lo convierte en extinguirFuego().',
      'Cada especialista responde con lo suyo: eso es la jerarquía funcionando.',
    ],
  },

  {
    id: 'n4-sr5', nombre: 'Un Bombero llamado Ciudadano', concepto: 'Aperitivo de polimorfismo',
    objetivo: 'Declara una variable de tipo PADRE (Ciudadano) que apunta a un Bombero. Llama a trabajar() y observa qué método se ejecuta. El tipo de la variable no decide: el objeto sí.',
    verificar: { tipo: 'polimorfismo' },
    baseCodigo: BASE_CIUDADANO,
    diagrama: {
      raiz: 'Ciudadano',
      clases: [
        { nombre: 'TrabajadorIndustrial', extiende: 'Ciudadano', superPreset: true, chips: [] },
        { nombre: 'MédicoComunitario', extiende: 'Ciudadano', superPreset: true, chips: ['atenderHeridos'] },
        { nombre: 'Bombero', extiende: 'TrabajadorIndustrial', superPreset: true, chips: ['trabajarOverride', 'extinguirFuego'] },
      ],
    },
    snippet:
      '// ── aperitivo de polimorfismo ──\nCiudadano ciudadano = new Bombero("Iván", 33, "bombero");\nregistrarCiudadano(ciudadano);\nciudadano.trabajar();      // ¿qué método se ejecuta realmente?\nmostrar(estadoAcademia());',
    minBloques: 0, maxPasos: 400,
    solucionTexto:
      'Ciudadano ciudadano = new Bombero("Iván", 33, "bombero");\nciudadano.trabajar();\n// La variable es de tipo Ciudadano, pero el OBJETO es Bombero:\n// se ejecuta Bombero.trabajar() → extinguirFuego(). Eso es dispatch dinámico.',
    pistas: [
      'La variable dice QUÉ tipo espera; el objeto decide QUÉ método corre.',
      'Mira la consola: registrarAccion revela quién trabajó de verdad.',
    ],
  },
]);