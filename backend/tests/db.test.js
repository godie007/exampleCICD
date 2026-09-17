/**
 * Pruebas unitarias de `src/db.js` — esquema, `mapContact` y la no-siembra.
 *
 * `db.js` hace su trabajo **al importarse**: crea `data/`, abre la base,
 * ejecuta el CREATE TABLE y cuenta las filas para decidir si siembra. Falsear
 * `node:sqlite` deja correr ese código real sin tocar disco; el doble responde
 * `{ total: 4 }` al conteo, así que aquí la siembra NO debe ejecutarse.
 * La rama contraria se prueba en `db.seed.test.js`.
 */
import { jest } from "@jest/globals";
import { createFakeSqlite } from "./helpers/fake-sqlite.js";

const sqlite = createFakeSqlite();

jest.unstable_mockModule("node:sqlite", () => ({
  DatabaseSync: sqlite.DatabaseSync,
  default: { DatabaseSync: sqlite.DatabaseSync },
}));

// Import dinámico: debe ocurrir DESPUÉS de registrar el mock.
const { db, mapContact } = await import("../src/db.js");

/** Fila cruda tal como la devuelve SQLite (snake_case, nulos posibles). */
function row(overrides = {}) {
  return {
    id: 1,
    nombre: "Camila Herrera",
    email: "camila.herrera@halcyn.co",
    telefono: "+57 310 482 1190",
    cargo: "Product Manager",
    notas: "Coordina el roadmap del directorio interno.",
    created_at: "2026-09-17T10:00:00.000Z",
    updated_at: "2026-09-17T10:00:00.000Z",
    ...overrides,
  };
}

describe("db.js · apertura de la base", () => {
  test("abre exactamente una conexión y la exporta", () => {
    expect(sqlite.DatabaseSync.instances).toHaveLength(1);
    expect(db).toBe(sqlite.DatabaseSync.instances[0]);
  });

  test("la base vive en backend/data/archivo.db, fuera de src/", () => {
    expect(db.location).toMatch(/[/\\]data[/\\]archivo\.db$/);
    expect(db.location).not.toMatch(/[/\\]src[/\\]/);
  });
});

describe("db.js · esquema", () => {
  const createSql = () =>
    sqlite.execCalls.find((sql) => /CREATE TABLE/i.test(sql)) ?? "";

  test("crea la tabla contacts de forma idempotente", () => {
    expect(createSql()).toMatch(/CREATE TABLE IF NOT EXISTS contacts/i);
  });

  test("el id es clave primaria autoincremental: no lo elige el cliente", () => {
    expect(createSql()).toMatch(/id INTEGER PRIMARY KEY AUTOINCREMENT/i);
  });

  test("nombre y email son obligatorios en la base, no solo en la validación", () => {
    expect(createSql()).toMatch(/nombre TEXT NOT NULL/i);
    expect(createSql()).toMatch(/email TEXT NOT NULL UNIQUE/i);
  });

  test("el email es UNIQUE: es la única garantía real de RN-01 (ADR-005)", () => {
    const uniques = createSql().match(/UNIQUE/gi) ?? [];

    // Una sola restricción única: por eso `includes("unique")` puede atribuir
    // el conflicto al campo email sin ambigüedad.
    expect(uniques).toHaveLength(1);
    expect(createSql()).toMatch(/email TEXT NOT NULL UNIQUE/i);
  });

  test("telefono, cargo y notas admiten nulos: por eso mapContact los normaliza", () => {
    expect(createSql()).toMatch(/telefono TEXT,/i);
    expect(createSql()).toMatch(/cargo TEXT,/i);
    expect(createSql()).toMatch(/notas TEXT,/i);
  });

  test("las marcas de tiempo son obligatorias", () => {
    expect(createSql()).toMatch(/created_at TEXT NOT NULL/i);
    expect(createSql()).toMatch(/updated_at TEXT NOT NULL/i);
  });
});

describe("db.js · siembra condicionada", () => {
  test("con la tabla no vacía no se siembra nada", () => {
    const inserts = sqlite.statements.filter((stmt) =>
      /INSERT INTO contacts/i.test(stmt.sql),
    );

    for (const stmt of inserts) {
      expect(stmt.run).not.toHaveBeenCalled();
    }
  });

  test("con la tabla no vacía no se abre ninguna transacción", () => {
    expect(sqlite.execCalls).not.toContain("BEGIN");
    expect(sqlite.execCalls).not.toContain("COMMIT");
  });

  test("el conteo de siembra se hace una sola vez, al cargar el módulo", () => {
    const conteos = sqlite.prepareCalls.filter((sql) => /COUNT\(\*\)/i.test(sql));

    expect(conteos).toHaveLength(1);
  });
});

describe("mapContact · normalización de la fila", () => {
  test("traduce snake_case a camelCase y expone las ocho claves del contrato", () => {
    expect(mapContact(row())).toEqual({
      id: 1,
      nombre: "Camila Herrera",
      email: "camila.herrera@halcyn.co",
      telefono: "+57 310 482 1190",
      cargo: "Product Manager",
      notas: "Coordina el roadmap del directorio interno.",
      createdAt: "2026-09-17T10:00:00.000Z",
      updatedAt: "2026-09-17T10:00:00.000Z",
    });
  });

  test("convierte los nulos de telefono, cargo y notas en cadena vacía", () => {
    const mapeado = mapContact(row({ telefono: null, cargo: null, notas: null }));

    expect(mapeado.telefono).toBe("");
    expect(mapeado.cargo).toBe("");
    expect(mapeado.notas).toBe("");
  });

  test("nombre y email salen tal cual: no recorta ni baja a minúscula", () => {
    const mapeado = mapContact(row({ nombre: "  Ana  ", email: "ANA@HALCYN.CO" }));

    expect(mapeado.nombre).toBe("  Ana  ");
    expect(mapeado.email).toBe("ANA@HALCYN.CO");
  });

  test("no muta la fila que entrega el driver", () => {
    const fila = row({ telefono: null, cargo: null, notas: null });

    mapContact(fila);

    expect(fila.telefono).toBeNull();
    expect(fila.cargo).toBeNull();
    expect(fila.notas).toBeNull();
    expect(fila.created_at).toBe("2026-09-17T10:00:00.000Z");
  });

  test("devuelve un objeto nuevo en cada llamada", () => {
    const fila = row();

    expect(mapContact(fila)).not.toBe(mapContact(fila));
  });

  test("una fila ausente devuelve null: es lo que convierte GET /:id en 404", () => {
    expect(mapContact(undefined)).toBeNull();
    expect(mapContact(null)).toBeNull();
  });

  test("no filtra columnas que no estén en el contrato", () => {
    const mapeado = mapContact({ ...row(), password_hash: "secreto", interno: 1 });

    expect(Object.keys(mapeado).sort()).toEqual([
      "cargo",
      "createdAt",
      "email",
      "id",
      "nombre",
      "notas",
      "telefono",
      "updatedAt",
    ]);
    expect(JSON.stringify(mapeado)).not.toMatch(/secreto/);
  });

  test("un 0 en telefono se conserva: solo null y undefined se vuelven vacío", () => {
    // `??` y no `||`: un valor falsy legítimo no debe desaparecer.
    expect(mapContact(row({ telefono: 0 })).telefono).toBe(0);
  });
});
