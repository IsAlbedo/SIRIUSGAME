# Diccionario de datos — Arquitectos del Código
Telemetría de investigación (H1: habilidades de programación · H2: motivación).
Todos los registros llevan `participante` (id anónimo, p. ej. `P-x7k2m9ab`) y `sesion`.
NUNCA se recoge nombre, correo ni dato personal. Datos solo en el dispositivo del participante.

## Tabla `sesiones` (patrones de uso)
| Campo | Tipo | Descripción |
|---|---|---|
| participante | texto | Id anónimo del participante (constante entre sesiones) |
| sesion | texto | Id único de la sesión |
| inicio_iso / fin_iso | fecha | Marcas ISO de inicio/fin |
| duracion_min | num | Duración total de la sesión en minutos |
| hora_local | num (0–23) | Hora local de inicio → patrones horarios |
| pantalla | texto | Resolución (ancho×alto) |
| idioma | texto | Idioma del navegador |

## Tabla `niveles` (rendimiento por nivel)
| Campo | Tipo | Descripción |
|---|---|---|
| nivel | texto | `nivel-1` … `nivel-5` |
| inicio | ms | Timestamp de carga del nivel |
| segundos | num | Tiempo hasta completar el nivel |
| intentos | num | Nº de sub-retos intentados (contador del mundo) |
| pistas | num | Pistas de Aria pedidas en el nivel |
| fallos | num | Nº de LEVEL_FAILED en el nivel |
| puntuacion | num | Puntuación final (reglas declarativas del LevelConfig) |
| completado | bool | true si se completó |

## Tabla `intentos` (micro-análisis de cada ejecución de código)
| Campo | Tipo | Descripción |
|---|---|---|
| nivel / subreto | texto | Contexto del intento |
| editor | texto | `bloques` · `clases` · `herencia` · `gobierno` |
| duracion_ms | num | Duración de la ejecución en el motor |
| ok | bool | Éxito del intento |
| categoria_error | texto | SYNTAX · UNDECLARED_VARIABLE · INFINITE_LOOP · MISSING_RETURN · INVALID_INHERITANCE · INTERFACE_NOT_IMPLEMENTED · TYPE_ERROR · RUNTIME (null si ok) |
| num_lineas | num | Líneas de código (editor de texto) |
| num_bloques | num | Bloques usados (editor de bloques) |

## Registros adicionales
- `habilidades`: {id, momento} — herramienta desbloqueada (escaner-datos, ensamblador-modulos, moldeador-ciudadanos, camara-jerarquias, nucleo-polimorfico).
- `logros`: {id, momento} — id según datos/logros.js.
- `eventos`: log bruto {t, sesion, tipo, datos} (tope 2000). Tipos relevantes: `sesion_inicio/fin`, `fase`, `ejecucion_codigo`, `intento_subreto`, `pista_pedida`, `prediccion`, `calidad_codigo`, `error_codigo`, `dialogo_abierto`, `registro_recogido`.

## Variables derivadas sugeridas para el análisis
- H1 (habilidades): tendencia de `intentos.ok`, descenso de `categoria_error` por categoría, `num_lineas/num_bloques` decreciente (eficiencia), `pistas` decreciente.
- H2 (motivación): `duracion_min` y `hora_local` (adherencia voluntaria), reintentos tras fallo (persistencia), logros obtenidos.