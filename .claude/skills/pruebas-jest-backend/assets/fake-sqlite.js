import { jest } from "@jest/globals";

/**
 * Doble de `node:sqlite`.
 *
 * La frontera que aislamos es el **driver**, no `db.js`: así el código real de
 * `db.js` (incluido `mapContact`) y el de `contacts.js` se ejecutan de verdad,
 * pero sin tocar disco ni crear `data/archivo.db`.
 *
 * Detalle importante: `db.js` tiene efectos al importarse (CREATE TABLE, conteo
 * y siembra). El doble responde `{ total: 4 }` al conteo para que la siembra
 * nunca corra dentro de los tests.
 */
export function createFakeSqlite() {
  const prepareCalls = [];
  const execCalls = [];
  const statements = [];

  function makeStatement(sql) {
    const stmt = {
      sql,
      all: jest.fn(() => []),
      get: jest.fn(() => undefined),
      run: jest.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
    };

    // Conteo de siembra de db.js: tabla "no vacía" => no se siembra nada.
    if (/COUNT\(\*\)/i.test(sql)) {
      stmt.get = jest.fn(() => ({ total: 4 }));
    }

    statements.push(stmt);
    return stmt;
  }

  class DatabaseSync {
    constructor(location) {
      this.location = location;
      DatabaseSync.instances.push(this);
    }

    exec(sql) {
      execCalls.push(sql);
    }

    prepare(sql) {
      prepareCalls.push(sql);
      return makeStatement(sql);
    }

    close() {}
  }

  DatabaseSync.instances = [];

  return {
    DatabaseSync,
    prepareCalls,
    execCalls,
    statements,

    /** Devuelve el único statement cuyo SQL casa con el patrón; falla si hay 0 o >1. */
    stmtFor(pattern) {
      const found = statements.filter((stmt) => pattern.test(stmt.sql));
      if (found.length !== 1) {
        throw new Error(
          `Se esperaba exactamente 1 statement para ${pattern}, se encontraron ${found.length}`,
        );
      }
      return found[0];
    },
  };
}
