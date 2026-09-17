/**
 * Pruebas unitarias de `GET /api/contacts` — el listado de contactos.
 *
 * Unidad bajo prueba: el handler `contactsRouter.get("/")` de
 * `src/contacts.js` junto con el `mapContact` real de `src/db.js`.
 * Lo único falseado es el driver `node:sqlite` (ver tests/helpers/fake-sqlite.js),
 * así que las pruebas son deterministas, no tocan disco y no dependen de la
 * siembra de datos.
 */
import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { createFakeSqlite } from "./helpers/fake-sqlite.js";

const sqlite = createFakeSqlite();

jest.unstable_mockModule("node:sqlite", () => ({
  DatabaseSync: sqlite.DatabaseSync,
  default: { DatabaseSync: sqlite.DatabaseSync },
}));

// Import dinámico: debe ocurrir DESPUÉS de registrar el mock.
const { contactsRouter } = await import("../src/contacts.js");

const LIST_SQL = /ORDER BY nombre COLLATE NOCASE ASC/i;
const listStmt = sqlite.stmtFor(LIST_SQL);

/** Cantidad de statements preparados al terminar la carga de los módulos. */
const PREPARES_AT_LOAD = sqlite.prepareCalls.length;

/**
 * App mínima que reproduce el contrato de `src/index.js`: el router montado en
 * /api/contacts y el handler final que traduce cualquier error a un 500.
 * No se usa `index.js` directamente porque hace `app.listen()` al importarse.
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/contacts", contactsRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: "Error interno del servidor" });
  });
  return app;
}

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

let app;

beforeEach(() => {
  listStmt.all.mockReset();
  listStmt.all.mockReturnValue([]);
  app = createTestApp();
});

describe("GET /api/contacts · contrato SQL y statements preparados", () => {
  test("prepara el statement de listado una sola vez, al cargar el módulo (ADR-004)", () => {
    const listPrepares = sqlite.prepareCalls.filter((sql) => LIST_SQL.test(sql));
    expect(listPrepares).toHaveLength(1);
  });

  test("el SQL lee de contacts y ordena por nombre sin distinguir mayúsculas", () => {
    expect(listStmt.sql).toMatch(/SELECT \* FROM contacts/i);
    expect(listStmt.sql).toMatch(/ORDER BY nombre COLLATE NOCASE ASC/i);
  });

  test("el SQL no interpola nada: no admite parámetros ni concatenación", () => {
    expect(listStmt.sql).not.toContain("?");
    expect(listStmt.sql).not.toContain("${");
  });

  test("no vuelve a preparar statements en cada petición: reutiliza el mismo", async () => {
    await request(app).get("/api/contacts").expect(200);
    await request(app).get("/api/contacts").expect(200);

    expect(sqlite.prepareCalls).toHaveLength(PREPARES_AT_LOAD);
    expect(sqlite.stmtFor(LIST_SQL)).toBe(listStmt);
  });
});

describe("GET /api/contacts · respuesta correcta", () => {
  test("responde 200 con JSON", async () => {
    listStmt.all.mockReturnValue([row()]);

    const res = await request(app).get("/api/contacts");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  test("devuelve un array con un elemento por fila", async () => {
    listStmt.all.mockReturnValue([
      row({ id: 1 }),
      row({ id: 2, email: "mateo.rivas@halcyn.co" }),
      row({ id: 3, email: "lucia.andrade@halcyn.co" }),
    ]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
  });

  test("mapea snake_case de la base a camelCase del contrato de API", async () => {
    listStmt.all.mockReturnValue([row()]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(body[0]).toEqual({
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

  test("no filtra columnas crudas ni campos extra de la fila", async () => {
    listStmt.all.mockReturnValue([row({ password_hash: "no-debe-salir" })]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(Object.keys(body[0]).sort()).toEqual([
      "cargo",
      "createdAt",
      "email",
      "id",
      "nombre",
      "notas",
      "telefono",
      "updatedAt",
    ]);
    expect(body[0]).not.toHaveProperty("created_at");
    expect(body[0]).not.toHaveProperty("updated_at");
    expect(body[0]).not.toHaveProperty("password_hash");
  });

  test("respeta el orden que entrega SQLite: no reordena en JavaScript", async () => {
    listStmt.all.mockReturnValue([
      row({ id: 9, nombre: "Zulema", email: "z@halcyn.co" }),
      row({ id: 3, nombre: "ana", email: "a@halcyn.co" }),
      row({ id: 7, nombre: "Bruno", email: "b@halcyn.co" }),
    ]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(body.map((c) => c.id)).toEqual([9, 3, 7]);
  });

  test("la respuesta es el array desnudo, sin envoltorio { data: … }", async () => {
    listStmt.all.mockReturnValue([row()]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(body).not.toHaveProperty("data");
    expect(body).not.toHaveProperty("contacts");
  });
});

describe("GET /api/contacts · normalización de nulos (mapContact)", () => {
  test("telefono, cargo y notas nulos se devuelven como cadena vacía", async () => {
    listStmt.all.mockReturnValue([
      row({ telefono: null, cargo: null, notas: null }),
    ]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(body[0].telefono).toBe("");
    expect(body[0].cargo).toBe("");
    expect(body[0].notas).toBe("");
  });

  test("una cadena vacía guardada se conserva como cadena vacía", async () => {
    listStmt.all.mockReturnValue([row({ telefono: "", cargo: "", notas: "" })]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(body[0]).toMatchObject({ telefono: "", cargo: "", notas: "" });
  });

  test("nombre y email nunca se sustituyen: se devuelven tal cual", async () => {
    listStmt.all.mockReturnValue([
      row({ nombre: "  Ana  ", email: "ANA@halcyn.co" }),
    ]);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(body[0].nombre).toBe("  Ana  ");
    expect(body[0].email).toBe("ANA@halcyn.co");
  });

  test("no muta las filas que entrega el driver", async () => {
    const original = row({ telefono: null });
    const copia = { ...original };
    listStmt.all.mockReturnValue([original]);

    await request(app).get("/api/contacts").expect(200);

    expect(original).toEqual(copia);
  });
});

describe("GET /api/contacts · casos borde", () => {
  test("tabla vacía devuelve [] con 200, no 404", async () => {
    listStmt.all.mockReturnValue([]);

    const res = await request(app).get("/api/contacts");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("un volumen grande se mapea completo y en orden", async () => {
    const filas = Array.from({ length: 500 }, (_, i) =>
      row({ id: i + 1, email: `contacto${i + 1}@halcyn.co` }),
    );
    listStmt.all.mockReturnValue(filas);

    const { body } = await request(app).get("/api/contacts").expect(200);

    expect(body).toHaveLength(500);
    expect(body[0].id).toBe(1);
    expect(body[499].id).toBe(500);
  });

  test("consulta la base una sola vez por petición y sin argumentos", async () => {
    listStmt.all.mockReturnValue([row()]);

    await request(app).get("/api/contacts").expect(200);

    expect(listStmt.all).toHaveBeenCalledTimes(1);
    expect(listStmt.all).toHaveBeenCalledWith();
  });

  test("cada petición relee la base: no hay caché en memoria", async () => {
    listStmt.all.mockReturnValueOnce([row({ id: 1 })]);
    listStmt.all.mockReturnValueOnce([row({ id: 1 }), row({ id: 2 })]);

    const primera = await request(app).get("/api/contacts").expect(200);
    const segunda = await request(app).get("/api/contacts").expect(200);

    expect(primera.body).toHaveLength(1);
    expect(segunda.body).toHaveLength(2);
    expect(listStmt.all).toHaveBeenCalledTimes(2);
  });

  test("ignora la query string: el listado no admite filtros en servidor", async () => {
    listStmt.all.mockReturnValue([row(), row({ id: 2 })]);

    const { body } = await request(app)
      .get("/api/contacts?nombre=camila&limit=1&order=desc")
      .expect(200);

    expect(body).toHaveLength(2);
    expect(listStmt.all).toHaveBeenCalledWith();
  });

  test("responde igual con barra final: /api/contacts y /api/contacts/", async () => {
    listStmt.all.mockReturnValue([row()]);

    const sinBarra = await request(app).get("/api/contacts").expect(200);
    const conBarra = await request(app).get("/api/contacts/").expect(200);

    expect(conBarra.body).toEqual(sinBarra.body);
  });
});

describe("GET /api/contacts · errores", () => {
  test("si el driver falla responde 500 con el contrato de error", async () => {
    listStmt.all.mockImplementation(() => {
      throw new Error("SQLITE_BUSY: database is locked");
    });

    const res = await request(app).get("/api/contacts");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
  });

  test("el 500 no filtra el mensaje interno del driver", async () => {
    listStmt.all.mockImplementation(() => {
      throw new Error("SQLITE_BUSY: /ruta/secreta/archivo.db");
    });

    const res = await request(app).get("/api/contacts");

    expect(JSON.stringify(res.body)).not.toMatch(/SQLITE_BUSY|ruta\/secreta/);
  });

  test("un fallo puntual no deja el listado roto para la siguiente petición", async () => {
    listStmt.all.mockImplementationOnce(() => {
      throw new Error("SQLITE_BUSY");
    });
    listStmt.all.mockReturnValue([row()]);

    await request(app).get("/api/contacts").expect(500);
    const res = await request(app).get("/api/contacts").expect(200);

    expect(res.body).toHaveLength(1);
  });
});
