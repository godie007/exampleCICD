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
- **`node:sqlite` es experimental** y no expone hoy un código estable equivalente a `SQLITE_CONSTRAINT_UNIQUE` con una forma documentada sobre la que apoyarse.
- **Es la única restricción única de la tabla.** Cualquier error con "unique" en el texto es, inequívocamente, este caso.

## Consecuencias

**Buenas**
- Sin carrera: la base decide, el código solo interpreta.
- Cinco líneas, sin dependencias.

**Malas — reconocidas**
- **Frágil ante cambios de Node.** Si el mensaje de `node:sqlite` cambia de redacción, el 409 se degrada a 500 y la UI pasa de "Ese email ya está registrado" a "Error interno del servidor". **No hay ningún test que lo detecte.**
- **No escala a más restricciones.** Con una segunda columna `UNIQUE`, el `includes("unique")` no podría decir cuál se violó y atribuiría el error al campo equivocado.
- **La lógica está duplicada** en `POST` y `PUT` (mismo bloque `catch`, mismos literales).

## Mitigación pendiente

1. Un test de integración que inserte un email duplicado y afirme **409** — barato y ancla el comportamiento ante cambios de Node. Ítem #1 del [[Roadmap y backlog]].
2. Si aparece una segunda restricción única, mover a inspección del código de error o mapear por nombre de restricción.

Relacionado: [[Riesgos y deuda técnica]], [[Contrato de API]].
