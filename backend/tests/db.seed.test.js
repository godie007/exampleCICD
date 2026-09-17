/**
 * Pruebas unitarias de la **siembra** de `src/db.js`.
 *
 * Es la única rama de `db.js` que no corre en el resto de la suite: el doble de
 * `node:sqlite` responde `{ total: 4 }` por defecto para que no se siembre nada.
 * Aquí se fuerza `{ total: 0 }` — tabla vacía — para ejercitarla.
 *
 * Va en su propio archivo porque `db.js` solo se evalúa una vez por módulo:
 * dentro de un mismo archivo no se pueden probar las dos ramas.
 */
import { jest } from "@jest/globals";
import { createFakeSqlite } from "./helpers/fake-sqlite.js";

const sqlite = createFakeSqlite({ total: 0 });

jest.unstable_mockModule("node:sqlite", () => ({
  DatabaseSync: sqlite.DatabaseSync,
  default: { DatabaseSync: sqlite.DatabaseSync },
}));

// Import dinámico: debe ocurrir DESPUÉS de registrar el mock. Al importar,
// db.js ya cuenta las filas y siembra; los tests solo observan el resultado.
await import("../src/db.js");

const insertStmt = sqlite.stmtFor(/INSERT INTO contacts/i);

/** Argumentos de cada `run` de la siembra, uno por contacto. */
const altas = () => insertStmt.run.mock.calls;

describe("db.js · siembra con la tabla vacía", () => {
  test("siembra exactamente cuatro contactos", () => {
    expect(altas()).toHaveLength(4);
  });

  test("cada alta escribe las siete columnas con parámetros vinculados", () => {
    expect(insertStmt.sql).toMatch(
      /INSERT INTO contacts \(nombre, email, telefono, cargo, notas, created_at, updated_at\)/i,
    );

    for (const args of altas()) {
      expect(args).toHaveLength(7);
    }
  });

  test("los cuatro emails son distintos: la siembra no puede violar el UNIQUE", () => {
    const emails = altas().map(([, email]) => email);

    expect(new Set(emails).size).toBe(4);
  });

  test("todas las altas comparten el mismo instante en created_at y updated_at", () => {
    const marcas = altas().flatMap((args) => args.slice(5));

    expect(new Set(marcas).size).toBe(1);
    const [marca] = marcas;
    expect(new Date(marca).toISOString()).toBe(marca);
  });

  test("ningún contacto sembrado deja nombre o email vacíos", () => {
    for (const [nombre, email] of altas()) {
      expect(nombre.trim()).not.toBe("");
      expect(email.trim()).not.toBe("");
    }
  });

  test("los datos sembrados pasarían la validación de la API", () => {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const [nombre, email, telefono, cargo, notas] of altas()) {
      expect(nombre.length).toBeLessThanOrEqual(80);
      expect(EMAIL_RE.test(email)).toBe(true);
      expect(email.length).toBeLessThanOrEqual(120);
      expect(/^[0-9+\s().-]{7,24}$/.test(telefono)).toBe(true);
      expect(cargo.length).toBeLessThanOrEqual(80);
      expect(notas.length).toBeLessThanOrEqual(280);
    }
  });
});

describe("db.js · la siembra es atómica", () => {
  test("se envuelve en una transacción BEGIN/COMMIT", () => {
    expect(sqlite.execCalls).toContain("BEGIN");
    expect(sqlite.execCalls).toContain("COMMIT");
  });

  test("el BEGIN va antes del COMMIT y solo hay una transacción", () => {
    const begins = sqlite.execCalls.filter((sql) => sql === "BEGIN");
    const commits = sqlite.execCalls.filter((sql) => sql === "COMMIT");

    expect(begins).toHaveLength(1);
    expect(commits).toHaveLength(1);
    expect(sqlite.execCalls.indexOf("BEGIN")).toBeLessThan(
      sqlite.execCalls.indexOf("COMMIT"),
    );
  });

  test("la tabla se crea antes de abrir la transacción", () => {
    const creacion = sqlite.execCalls.findIndex((sql) => /CREATE TABLE/i.test(sql));

    expect(creacion).toBeGreaterThanOrEqual(0);
    expect(creacion).toBeLessThan(sqlite.execCalls.indexOf("BEGIN"));
  });
});
