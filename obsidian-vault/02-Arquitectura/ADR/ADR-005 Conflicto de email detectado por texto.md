---
aliases: [ADR-005]
tags: [adr, arquitectura, backend, riesgo]
type: adr
estado: aceptada-con-reservas
fecha: 2026-09-17
---

# ADR-005 · El conflicto de email único se detecta por el texto del error

**Estado:** aceptada con reservas · **Afecta a:** [[Módulo contacts]], [[Contrato de errores]], [[Reglas de negocio]]

## Contexto

RN-01 exige que el email sea único y lo garantiza la restricción `UNIQUE` de SQLite. Cuando se viola, hay que devolver **409** con un mensaje dirigido al campo email, no un 500 genérico.

Las alternativas para detectar esa violación:

1. `SELECT` previo para comprobar si el email existe.
2. Inspeccionar un **código** de error del driver.
3. Inspeccionar el **mensaje** de la excepción.

## Decisión

La opción 3:

```js
function isUniqueConflict(error) {
  return typeof error?.message === "string" &&
         error.message.toLowerCase().includes("unique");
}
```

## Razones

- **El `SELECT` previo tiene una carrera.** Entre comprobar y escribir, otra petición puede insertar el mismo email. La restricción de la base es la única garantía real, así que el camino correcto es intentar y reaccionar.
- **`node:sqlite` es experimental** y no expone hoy un código estable equivalente a `SQLITE_CONSTRAINT_UNIQUE` con una forma documentada sobre la que apoyarse. → **Este supuesto ya no se cumple: ver la revisión al final de la nota.**
- **Es la única restricción única de la tabla.** Cualquier error con "unique" en el texto es, inequívocamente, este caso.

## Consecuencias

**Buenas**
- Sin carrera: la base decide, el código solo interpreta.
- Cinco líneas, sin dependencias.

**Malas — reconocidas**
- **Frágil ante cambios de Node.** Si el mensaje de `node:sqlite` cambia de redacción, el 409 se degrada a 500 y la UI pasa de "Ese email ya está registrado" a "Error interno del servidor". ~~No hay ningún test que lo detecte.~~ → **Ya lo hay:** ver la revisión.
- **No escala a más restricciones.** Con una segunda columna `UNIQUE`, el `includes("unique")` no podría decir cuál se violó y atribuiría el error al campo equivocado.
- **La lógica está duplicada** en `POST` y `PUT` (mismo bloque `catch`, mismos literales).

## Revisión · 2026-09-17

Al escribir las pruebas ([[Estrategia de pruebas]]) se comprobó el comportamiento real del driver, y **el supuesto central de esta decisión ha caducado**.

**1. El mensaje sigue siendo el esperado.** Una violación de `UNIQUE` produce hoy `"UNIQUE constraint failed: contacts.email"`, así que `isUniqueConflict` funciona y el 409 se emite correctamente.

**2. Pero ya existe el código estable que se dio por inexistente.** El error trae, además del mensaje:

```
code:    ERR_SQLITE_ERROR
errcode: 2067          // SQLITE_CONSTRAINT_UNIQUE
```

La **opción 2** que se descartó —inspeccionar un código de error— está disponible y es estrictamente más robusta que buscar una palabra en un texto en inglés. La razón que justificó la opción 3 ya no aplica.

**3. La mitigación #1 está hecha.** Hay pruebas que anclan el 409 en dos capas: una de integración que provoca la violación contra SQLite real, y una unitaria que cubre además la variante en minúsculas del mensaje. Si Node cambia la redacción, la suite se pone roja en vez de degradar el 409 a un 500 silencioso.

### Qué hacer con esto

Esta ADR debería **revisarse hacia la opción 2**: cambiar `isUniqueConflict` a `error?.errcode === 2067` es un cambio de una línea, ya respaldado por pruebas, y resolvería de paso la segunda consecuencia mala (no escalar a más restricciones únicas). Queda como propuesta, no como hecho: el cambio no se ha aplicado.

## Mitigación pendiente

1. ~~Un test de integración que inserte un email duplicado y afirme **409**.~~ ✅ **Hecho.**
2. Si aparece una segunda restricción única, mover a inspección del código de error o mapear por nombre de restricción. → **Ya es posible hoy**, ver la revisión.

Relacionado: [[Riesgos y deuda técnica]], [[Contrato de API]].
