// ═══════════════════════════════════════════════════════════
// datos/subretos-nivel5.js — Módulo de Gobierno: interfaces,
// polimorfismo y el duelo final contra Eclipse.
// El campo `objetivo` se muestra con innerHTML (admite <b>, <code>, <br>).
// ═══════════════════════════════════════════════════════════

export const COMPONENTES = Object.freeze({
  medico:      { id: 'medico', nombre: 'MedicoUrbano', instancia: 'Sara', accion: 'curar', etiqueta: 'médico cura', evento: 'heridos' },
  bombero:     { id: 'bombero', nombre: 'BomberoMetropolitano', instancia: 'Iván', accion: 'apagarFuego', etiqueta: 'bombero apaga', evento: 'incendio' },
  comerciante: { id: 'comerciante', nombre: 'ComercianteNocturno', instancia: 'Tomás', accion: 'abastecer', etiqueta: 'comerciante abastece', evento: 'desabasto' },
  comunicador: { id: 'comunicador', nombre: 'ComunicadorNodo', instancia: 'Ada', accion: 'informar', etiqueta: 'comunicador informa', nuevo: true },
  glitch:      { id: 'glitch', nombre: 'GlitchDeEclipse', instancia: 'Eco', accion: 'neutralizarGlitch', etiqueta: 'glitch se neutraliza', esGlitch: true },
});

export const SUBRETOS_NIVEL5 = Object.freeze([
  {
    id: 'n5-sr1', nombre: 'El contrato de conducta', concepto: 'Interfaces',
    objetivo:
      '<b>META:</b> que CiudadanoComun cumpla el contrato IResponsable y se pueda registrar sin error.<br>' +
      'Una <b>interfaz</b> es un contrato: lista los métodos que toda clase que la firme está obligada a tener. ' +
      'Aquí IResponsable exige <code>responderEmergencia()</code>.<br><br>' +
      '<b>PASO 1.</b> Pulsa «Ejecutar» sin tocar nada. Verás un error: CiudadanoComun firmó el contrato (<code>implements</code>) pero no escribió el método.<br>' +
      '<b>PASO 2.</b> Arrastra la tarjeta <code>MedicoUrbano</code> al socket de IResponsable. El código se regenera y CiudadanoComun ahora sí tiene <code>responderEmergencia()</code>.<br>' +
      '<b>PASO 3.</b> Ejecuta otra vez. El ciudadano se registra y aparece en el mundo.',
    verificar: { tipo: 'contratoImplementado' },
    componentesDisponibles: ['medico'],
    presetConectados: [],
    codigoInicial:
      'interface IResponsable {\n  void responderEmergencia();\n}\n\nclass CiudadanoComun implements IResponsable {\n  texto nombre;\n}\n\nvar comun = new CiudadanoComun();\nregistrarResponsable(comun);',
    minBloques: 0, maxPasos: 400,
    solucionTexto:
      'class CiudadanoComun implements IResponsable {\n  texto nombre;\n  constructor(texto nombre) { this.nombre = nombre; }\n  void responderEmergencia() { registrarAccion("ciudadano responde"); }\n}',
    pistas: [
      'Firmar un contrato sin cumplirlo tiene consecuencias: el analizador no perdona.',
      'Enchufa CiudadanoComun a la interfaz y regenera: el método aparece solo.',
      'Arrastra la tarjeta MedicoUrbano hasta el recuadro de la interfaz y luego pulsa Ejecutar.',
    ],
  },

  {
    id: 'n5-sr2', nombre: '¿Abstracta o interfaz?', concepto: 'Clase abstracta vs interfaz',
    objetivo:
      '<b>META:</b> decidir, en 3 situaciones, si hace falta una clase abstracta o una interfaz.<br>' +
      'Son dos herramientas distintas:<br>' +
      '• <b>Clase abstracta</b> = «qué soy». Los hijos comparten estado y código, y se hereda de UNA sola.<br>' +
      '• <b>Interfaz</b> = «qué sé hacer». Es solo un contrato, y una clase puede firmar MUCHAS.<br><br>' +
      '<b>PASO 1.</b> Lee cada situación y pregunta: ¿comparten código y estado, o solo se exige una capacidad?<br>' +
      '<b>PASO 2.</b> Pulsa el botón de cada situación y luego «Comprobar». Si fallas, el mensaje te orienta y puedes reintentar.',
    verificar: { tipo: 'situaciones' },
    sinCodigo: true,
    situaciones: [
      { texto: 'Todos los vehículos comparten motor, ruedas y un comportamiento común; Coche y Camión derivan de ellos.',
        correcta: 'abstracta',
        explicacion: 'Hay estado y código compartido que reutilizar: clase ABSTRACTA (padre con herencia).' },
      { texto: 'El Gobierno exige que CUALQUIER entidad —vehículo, ciudadano o dron— responda a emergencias, aunque no compartan nada más.',
        correcta: 'interfaz',
        explicacion: 'Es un contrato puro, sin estado ni código compartido: INTERFAZ.' },
      { texto: 'VehiculoElectrico ya hereda de Vehiculo, y además debe firmar el contrato de emergencias.',
        correcta: 'interfaz',
        explicacion: 'La herencia ya está ocupada; el contrato adicional se IMPLEMENTA: interfaz.' },
    ],
    solucionTexto: 'Abstracta = «qué soy» (comparto esencia y código). Interfaz = «qué sé hacer» (cumplo un contrato). Se puede heredar de UNA clase y firmar MUCHAS interfaces.',
    pistas: [
      '¿Comparten código y estado? Abstracta. ¿Solo una capacidad exigida? Interfaz.',
      'extends se usa una vez; implements, las que hagan falta.',
    ],
  },

  {
    id: 'n5-sr3', nombre: 'Un bucle para gobernarlos', concepto: 'Polimorfismo',
    objetivo:
      '<b>META:</b> que Médico, Bombero y Comerciante resuelvan sus emergencias con UN solo bucle.<br>' +
      '<b>Polimorfismo</b> = el mismo mensaje, respuestas distintas. El coordinador no pregunta «¿qué eres?»: llama a <code>responderEmergencia()</code> y cada objeto lo hace a su manera.<br><br>' +
      '<b>PASO 1.</b> Arrastra las tres tarjetas (MedicoUrbano, BomberoMetropolitano, ComercianteNocturno) al socket de IResponsable.<br>' +
      '<b>PASO 2.</b> Lee el código generado: cada clase hace algo distinto dentro de <code>responderEmergencia()</code>, pero <code>coordinar</code> tiene una sola línea <code>equipo[i].responderEmergencia()</code>.<br>' +
      '<b>PASO 3.</b> Ejecuta. En el mundo, cada ciudadano camina a su estación y la baliza de esa emergencia pasa de pulsar a verde.',
    verificar: { tipo: 'polimorfismo' },
    componentesDisponibles: ['medico', 'bombero', 'comerciante'],
    presetConectados: [],
    minBloques: 0, maxPasos: 600,
    solucionTexto:
      'interface IResponsable { void responderEmergencia(); }\n// cada clase la implementa a su manera…\nvar equipo = [new MedicoUrbano("Sara"), new BomberoMetropolitano("Iván"), new ComercianteNocturno("Tomás")];\ncoordinar(equipo);\n// coordinar NO sabe qué hay dentro: solo llama al contrato.',
    pistas: [
      'El coordinador no pregunta QUÉ eres: llama a responderEmergencia() y confía.',
      'Mira la consola y el mundo: el mismo bucle produce tres acciones distintas.',
      'Si falla, revisa que las TRES tarjetas estén conectadas (se ven resaltadas) antes de ejecutar.',
    ],
  },

  {
    id: 'n5-sr4', nombre: 'El coordinador intocable', concepto: 'Desacoplamiento',
    objetivo:
      '<b>META:</b> sumar un tipo NUEVO (ComunicadorNodo) al equipo sin modificar la función <code>coordinar</code>.<br>' +
      '<b>Desacoplar</b> = programar hacia la interfaz, no hacia cada clase. Así el sistema se extiende añadiendo, sin tocar lo que ya funciona.<br><br>' +
      '<b>PASO 1.</b> Médico, Bombero y Comerciante ya vienen conectados. Arrastra además la tarjeta <code>ComunicadorNodo</code> al socket.<br>' +
      '<b>PASO 2.</b> Mira el código: aparece una clase nueva y una instancia nueva en la lista <code>equipo</code>, pero <code>coordinar</code> queda idéntica. No la edites.<br>' +
      '<b>PASO 3.</b> Ejecuta. El comunicador se suma al equipo y las balizas siguen igual.<br>' +
      '<b>Nota:</b> este reto compara tu coordinador con el del reto anterior; haz antes el reto 3 en esta sesión.',
    verificar: { tipo: 'desacoplado' },
    componentesDisponibles: ['medico', 'bombero', 'comerciante', 'comunicador'],
    presetConectados: ['medico', 'bombero', 'comerciante'],
    minBloques: 0, maxPasos: 600,
    solucionTexto:
      '// 1) ComunicadorNodo implements IResponsable (enchufado).\n// 2) equipo = [ …los tres anteriores, new ComunicadorNodo("Ada") ].\n// 3) coordinar(equipo) — idéntico, sin tocar.\n// El sistema se extiende sin modificarse: eso es desacoplamiento.',
    pistas: [
      'Si tocas coordinar, el detector de elegancia lo notará… y Aria también.',
      'Solo hay que añadir: la nueva clase al código y la nueva instancia a la lista.',
      'Arrastra la tarjeta ComunicadorNodo al socket; el código se regenera solo.',
    ],
  },

  {
    id: 'n5-jefe', nombre: 'Eclipse: la catástrofe final', concepto: 'Diseño polimórfico bajo fuego',
    objetivo:
      '<b>META:</b> resolver las 4 emergencias a la vez (incendio, heridos, desabasto y glitch) con el mismo coordinador.<br>' +
      'Eclipse lanza un GlitchDeEclipse inesperado. No hace falta cambiar el diseño: el glitch también cumple el contrato, así que entra como uno más.<br><br>' +
      '<b>PASO 1.</b> Conecta los 5 componentes al socket: los tres que ya están, más <code>ComunicadorNodo</code> y <code>GlitchDeEclipse</code>.<br>' +
      '<b>PASO 2.</b> No modifiques <code>coordinar</code>.<br>' +
      '<b>PASO 3.</b> Ejecuta. Las 4 balizas (incendio, heridos, desabasto y glitch) deben pasar a verde. Si queda alguna pulsando, falta un componente.',
    verificar: { tipo: 'catastrofe' },
    esJefe: true,
    componentesDisponibles: ['medico', 'bombero', 'comerciante', 'comunicador', 'glitch'],
    presetConectados: ['medico', 'bombero', 'comerciante'],
    minBloques: 0, maxPasos: 900,
    solucionTexto:
      '// El glitch de Eclipse también implementa IResponsable (ironía incluida).\nvar equipo = [\n  new MedicoUrbano("Sara"),\n  new BomberoMetropolitano("Iván"),\n  new ComercianteNocturno("Tomás"),\n  new ComunicadorNodo("Ada"),\n  new GlitchDeEclipse("Eco"),\n];\ncoordinar(equipo);\n// incendio, heridos, desabasto y glitch: resueltos por el mismo bucle.',
    pistas: [
      'No luches contra el glitch: conviértelo en uno más del equipo.',
      'Cuatro eventos, un solo mecanismo: eso es lo que Eclipse no puede corromper.',
      'Conecta GlitchDeEclipse y ComunicadorNodo; con los 5 conectados ejecuta sin tocar coordinar.',
    ],
  },
]);