/**
 * Pruebas unitarias de `GET /api/contacts/:id` — el detalle de un contacto.
 *
 * Unidad bajo prueba: el handler `contactsRouter.get("/:id")` de
 * `src/contacts.js` junto con el `mapContact` real de `src/db.js`.
 * Lo único falseado es el driver `node:sqlite` (ver tests/helpers/fake-sqlite.js).
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

// `getStmt` y `updateStmt` comparten "WHERE id = ?": anclar al SELECT es lo que
// hace que `stmtFor` encuentre exactamente uno.
const GET_SQL = /^SELECT \* FROM contacts WHERE id = \?/;
const getStmt = sqlite.stmtFor(GET_SQL);

/** Cantidad de statements preparados al terminar la carga de los módulos. */
const PREPARES_AT_LOAD = sqlite.prepareCalls.length;

/**
 * App mínima que reproduce el contrato de `src/index.js`. No se usa `index.js`
 * directamente porque hace `app.listen()` al importarse.
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
    id: 3,
    nombre: "Lucía Andrade",
    email: "lucia.andrade@halcyn.co",
    telefono: "+57 301 778 4420",
    cargo: "Diseño de producto",
    notas: "Revisa copy y estados vacíos del formulario.",
    created_at: "2026-09-17T10:00:00.000Z",
    updated_at: "2026-09-17T10:00:00.000Z",
    ...overrides,
  };
}

let app;

beforeEach(() => {
  getStmt.get.mockReset();
  getStmt.get.mockReturnValue(row());
  app = createTestApp();
});

describe("GET /api/contacts/:id · contrato SQL y statements preparados", () => {
  test("prepara el SELECT por id una sola vez, al cargar el módulo (ADR-004)", () => {
    const gets = sqlite.prepareCalls.filter((sql) => GET_SQL.test(sql));
    expect(gets).toHaveLength(1);
  });

  test("consultar el detalle no vuelve a preparar statements entre peticiones (ADR-004)", async () => {
    await request(app).get("/api/contacts/3");
    await request(app).get("/api/contacts/3");

    expect(sqlite.prepareCalls).toHaveLength(PREPARES_AT_LOAD);
  });

  test("el id viaja como parámetro vinculado, nunca interpolado en el SQL", () => {
    expect(getStmt.sql).toBe("SELECT * FROM contacts WHERE id = ?");
  });
});

describe("GET /api/contacts/:id · contacto encontrado", () => {
  test("devuelve 200 con JSON y el contacto mapeado a camelCase", async () => {
    const res = await request(app).get("/api/contacts/3");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      id: 3,
      nombre: "Lucía Andrade",
      email: "lucia.andrade@halcyn.co",
      telefono: "+57 301 778 4420",
      cargo: "Diseño de producto",
      notas: "Revisa copy y estados vacíos del formulario.",
      createdAt: "2026-09-17T10:00:00.000Z",
      updatedAt: "2026-09-17T10:00:00.000Z",
    });
  });

  test("el cuerpo expone exactamente las ocho claves del contrato, sin columnas crudas", async () => {
    const res = await request(app).get("/api/contacts/3");

    expect(Object.keys(res.body).sort()).toEqual([
      "cargo",
      "createdAt",
      "email",
      "id",
      "nombre",
      "notas",
      "telefono",
      "updatedAt",
    ]);
  });

  test("el id del path se convierte a número antes de llegar al statement", async () => {
    await request(app).get("/api/contacts/7");

    expect(getStmt.get).toHaveBeenCalledTimes(1);
    expect(getStmt.get).toHaveBeenCalledWith(7);
  });

  test("consulta la base una sola vez por petición", async () => {
    await request(app).get("/api/contacts/3");

    expect(getStmt.get).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/contacts/:id · normalización", () => {
  test("mapContact convierte los nulos en cadenas vacías sin mutar la fila del driver", async () => {
    const fila = row({ telefono: null, cargo: null, notas: null });
    getStmt.get.mockReturnValue(fila);

    const res = await request(app).get("/api/contacts/3");

    expect(res.body.telefono).toBe("");
    expect(res.body.cargo).toBe("");
    expect(res.body.notas).toBe("");
    expect(fila.telefono).toBeNull();
    expect(fila.cargo).toBeNull();
    expect(fila.notas).toBeNull();
  });

  test("nombre y email salen tal cual vienen de la base, sin recortar ni bajar a minúscula", async () => {
    getStmt.get.mockReturnValue(row({ nombre: "  Lucía  ", email: "LUCIA@HALCYN.CO" }));

    const res = await request(app).get("/api/contacts/3");

    expect(res.body.nombre).toBe("  Lucía  ");
    expect(res.body.email).toBe("LUCIA@HALCYN.CO");
  });
});

describe("GET /api/contacts/:id · contacto inexistente (404)", () => {
  test("una fila ausente devuelve 404 con el mensaje del contrato, sin errors", async () => {
    getStmt.get.mockReturnValue(undefined);

    const res = await request(app).get("/api/contacts/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Contacto no encontrado" });
    expect(res.body.errors).toBeUndefined();
  });

  test("un id no numérico da 404 limpio, no 400: Number(\"abc\") es NaN y no encuentra fila", async () => {
    getStmt.get.mockReturnValue(undefined);

    const res = await request(app).get("/api/contacts/abc");

    expect(res.status).toBe(404);
    expect(Number.isNaN(getStmt.get.mock.calls[0][0])).toBe(true);
  });

  test("un id negativo o cero se consulta igual y devuelve 404 si no hay fila", async () => {
    getStmt.get.mockReturnValue(undefined);

    const res = await request(app).get("/api/contacts/-1");

    expect(res.status).toBe(404);
    expect(getStmt.get).toHaveBeenCalledWith(-1);
  });
});

describe("GET /api/contacts/:id · errores del driver (500)", () => {
  test("un fallo del driver sale como 500 genérico del contrato", async () => {
    getStmt.get.mockImplementation(() => {
      throw new Error("disk I/O error");
    });

    const res = await request(app).get("/api/contacts/3");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
  });

  test("el 500 no filtra el mensaje del driver ni rutas de disco", async () => {
    getStmt.get.mockImplementation(() => {
      throw new Error("SQLITE_IOERR: /Users/alguien/backend/data/archivo.db");
    });

    const res = await request(app).get("/api/contacts/3");

    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toMatch(/SQLITE_IOERR/);
    expect(cuerpo).not.toMatch(/archivo\.db/);
  });

  test("un fallo puntual no deja la ruta rota para la siguiente petición", async () => {
    getStmt.get.mockImplementationOnce(() => {
      throw new Error("disk I/O error");
    });

    const fallida = await request(app).get("/api/contacts/3");
    const siguiente = await request(app).get("/api/contacts/3");

    expect(fallida.status).toBe(500);
    expect(siguiente.status).toBe(200);
  });
});

describe("GET /api/contacts/:id · casos borde", () => {
  test("la query string se ignora: no altera el id consultado", async () => {
    await request(app).get("/api/contacts/3?incluir=todo&id=999");

    expect(getStmt.get).toHaveBeenCalledWith(3);
  });

  test("un id decimal llega al statement como el número que es, sin redondear", async () => {
    getStmt.get.mockReturnValue(undefined);

    await request(app).get("/api/contacts/3.7");

    expect(getStmt.get).toHaveBeenCalledWith(3.7);
  });
});
