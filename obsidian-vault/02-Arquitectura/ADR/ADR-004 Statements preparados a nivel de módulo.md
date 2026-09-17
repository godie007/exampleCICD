---
aliases: [ADR-004]
tags: [adr, arquitectura, backend, datos]
type: adr
estado: aceptada
fecha: 2026-09-17
---

# ADR-004 · Statements SQL preparados una sola vez, a nivel de módulo

**Estado:** aceptada · **Afecta a:** [[Módulo contacts]], [[Backend API]]

## Contexto

`contacts.js` necesita cinco consultas: listar, obtener, insertar, actualizar, borrar. `db.prepare()` puede llamarse dentro de cada handler o una única vez al cargar el módulo.

## Decisión

**Preparar los cinco statements en el cuerpo del módulo**, fuera de los handlers, y reutilizarlos en cada petición.

```js
const listStmt   = db.prepare("SELECT * FROM contacts ORDER BY nombre COLLATE NOCASE ASC");
const getStmt    = db.prepare("SELECT * FROM contacts WHERE id = ?");
const insertStmt = db.prepare(`INSERT INTO contacts (…) VALUES (?, …)`);
const updateStmt = db.prepare(`UPDATE contacts SET … WHERE id = ?`);
const deleteStmt = db.prepare("DELETE FROM contacts WHERE id = ?");
```

## Razones

- **SQLite compila cada statement una vez** y reutiliza el plan. Preparar por petición repite ese trabajo sin motivo.
- **Todo el SQL del sistema está en veinte líneas contiguas**, arriba del archivo. Auditar las consultas de la app es leer un bloque.
- **Parámetros siempre vinculados (`?`)**: no hay interpolación de strings en ningún punto, así que la inyección SQL queda estructuralmente descartada. Ver [[Seguridad]].

## Consecuencias

**Buenas**
- Handlers cortos: cada ruta es validar, ejecutar, responder.
- Rendimiento predecible sin pensar en ello.

**Malas — asumidas**
- **Acoplamiento de orden de importación.** `contacts.js` ejecuta `db.prepare()` al ser importado, lo que exige que `db.js` ya haya creado la tabla. Funciona porque `db.js` hace su trabajo al importarse y `contacts.js` lo importa arriba — pero es una dependencia implícita: si alguien difiere la creación de la tabla, el módulo falla al cargar, no en runtime.
- **Consultas dinámicas imposibles.** Un filtro opcional o un `ORDER BY` configurable necesitaría construir SQL en caliente y romper este patrón. Relevante para #10 del [[Roadmap y backlog]].
- **El error de arranque es abrupto:** un SQL mal escrito tumba el proceso al iniciar en vez de fallar en una ruta. Discutible como ventaja.

Relacionado: [[ADR-001 node sqlite sin ORM]], [[Modelo de datos]].
