// datos/errores.js — narrativa de Aria por categoría de error.
export const ERRORES_NARRATIVA = Object.freeze({
  SYNTAX: { titulo: 'ERROR DE SINTAXIS', aria: 'Ese código no compila ni en sueños. Revisa los huecos vacíos y las piezas sueltas: el robot ni lo entiende.' },
  UNDECLARED_VARIABLE: { titulo: 'VARIABLE SIN DECLARAR', aria: 'Esa variable nunca fue declarada. En la red, lo que no se nombra no existe.' },
  INFINITE_LOOP: { titulo: 'BUCLE INFINITO', aria: '¡El sistema está atrapado en un bucle! La ciudad se está desestabilizando. Busca una condición de salida.' },
  MISSING_RETURN: { titulo: 'FALTA RETURN', aria: 'La función promete devolver algo y se va con las manos vacías. Añade un return.' },
  INVALID_INHERITANCE: { titulo: 'HERENCIA INVÁLIDA', aria: 'Esta clase no puede heredar de esa manera. Revisa la jerarquía.' },
  INTERFACE_NOT_IMPLEMENTED: { titulo: 'CONTRATO INCUMPLIDO', aria: 'Se firmó un contrato de conducta y falta cumplir alguno de sus métodos.' },
  TYPE_ERROR: { titulo: 'ERROR DE TIPO', aria: 'Mezclaste tipos que no se llevan bien. Cada fragmento de datos tiene su naturaleza.' },
  RUNTIME: { titulo: 'ERROR EN EJECUCIÓN', aria: 'El programa arrancó, pero algo falló por el camino. Mira la línea señalada y respira.' },
});