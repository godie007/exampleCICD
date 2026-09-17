---
aliases: [ADR-001]
tags: [adr, arquitectura, backend, datos]
type: adr
estado: aceptada
fecha: 2026-09-17
---

# ADR-001 · `node:sqlite` síncrono, sin ORM

**Estado:** aceptada · **Afecta a:** [[Backend API]], [[Modelo de datos]], [[Módulo db]]

## Contexto

El backend necesita persistencia para una entidad, con un volumen de decenas a cientos de filas y un solo proceso escribiendo. Las opciones eran un ORM (Prisma, Sequelize, Drizzle), un driver externo (`better-sqlite3`) o el módulo integrado `node:sqlite` de Node 22.5+.

## Decisión

Usar **`node:sqlite` (`DatabaseSync`) con SQL literal en statements preparados**, sin ORM ni query builder.

## Razones

- **Cero dependencias de base de datos.** `backend/package.json` tiene exactamente dos dependencias: `express` y `cors`. Nada que compilar, nada que romperse al cambiar de versión de Node o de arquitectura de CPU.
- **El SQL cabe en la cabeza.** Cinco statements, todos visibles en un archivo de 110 líneas.
- **Síncrono elimina la asincronía del código de rutas.** Sin `await` en la capa de datos, los handlers se leen de arriba abajo.
- **Un ORM para una tabla es negativo:** añade un lenguaje intermedio, un paso de generación y un modelo mental, para modelar algo que ya es trivial.

## Consecuencias

**Buenas**
- Arranque instantáneo, `npm install` en segundos.
- El esquema real está a la vista en `db.js`, no repartido en artefactos generados.

**Malas — asumidas**
- **Node 22.5+ obligatorio.** En versiones menores la app no arranca. Declarado en `engines`.
- **Sin migraciones.** Cambiar el esquema exige borrar `backend/data/archivo.db`. Es el ítem #4 del [[Roadmap y backlog]] y el mayor límite práctico de esta decisión.
- **Sin tipos generados.** La forma del contacto vive en tres sitios (SQL, `mapContact`, validador) y se mantiene sincronizada a mano.
- **Bloqueo del event loop.** Cada consulta detiene el proceso. Aceptable con este volumen; ver [[Riesgos y deuda técnica]].
- **API experimental.** `--experimental-sqlite` puede cambiar entre versiones de Node.

## Cuándo revisarla

Si aparece una segunda tabla con relaciones, si hace falta concurrencia real de escritura, o si el dato debe sobrevivir a cambios de esquema en un entorno compartido.

Relacionado: [[ADR-004 Statements preparados a nivel de módulo]], [[ADR-005 Conflicto de email detectado por texto]].
