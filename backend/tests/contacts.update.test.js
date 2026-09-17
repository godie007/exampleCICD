/**
 * Pruebas unitarias de `PUT /api/contacts/:id` — la edición de un contacto.
 *
 * Unidad bajo prueba: el handler `contactsRouter.put("/:id")` de
 * `src/contacts.js` con el `validateContact` real y el `mapContact` real.
 * Lo único falseado es el driver `node:sqlite`.
 *
 * Ojo con `getStmt`: esta ruta lo usa DOS veces por petición (comprobar
 * existencia y releer tras escribir), así que los tests encadenan
 * `mockReturnValueOnce` en ese orden.
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

const UPDATE_SQL = /UPDATE contacts/i;
const GET_SQL = /^SELECT \* FROM contacts WHERE id = \?/;

const updateStmt = sqlite.stmtFor(UPDATE_SQL);
const getStmt = sqlite.stmtFor(GET_SQL);

/** Cantidad de statements preparados al terminar la carga de los módulos. */
const PREPARES_AT_LOAD = sqlite.prepareCalls.length;

/** Instante fijo: `updated_at` debe ser comprobable. */
const AHORA = "2026-09-17T10:00:00.000Z";
/** Marca anterior, para demostrar que `created_at` no se toca. */
const ANTES = "2026-01-02T08:30:00.000Z";

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
    id: 2,
    nombre: "Mateo Rivas",
    email: "mateo.rivas@halcyn.co",
    telefono: "+57 315 204 8871",
    cargo: "Backend Engineer",
    notas: "Dueño de la API y de la base SQLite.",
    created_at: ANTES,
    updated_at: ANTES,
    ...overrides,
  };
}

/** Cuerpo válido mínimo; cada test sobreescribe solo lo que le importa. */
function body(overrides = {}) {
  return {
    nombre: "Mateo Rivas",
    email: "mateo.rivas@halcyn.co",
    telefono: "+57 315 204 8871",
    cargo: "Staff Engineer",
    notas: "Dueño de la API y de la base SQLite.",
    ...overrides,
  };
}

/** Existencia OK y relectura con la fila ya actualizada. */
function baseEncontrado(actualizada = row({ updated_at: AHORA })) {
  getStmt.get.mockReturnValueOnce(row()).mockReturnValueOnce(actualizada);
}

let app;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(AHORA));

  updateStmt.run.mockReset();
  updateStmt.run.mockReturnValue({ changes: 1 });
  getStmt.get.mockReset();

  app = createTestApp();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("PUT /api/contacts/:id · contrato SQL y statements preparados", () => {
  test("prepara el UPDATE una sola vez, al cargar el módulo (ADR-004)", () => {
    const updates = sqlite.prepareCalls.filter((sql) => UPDATE_SQL.test(sql));
    expect(updates).toHaveLength(1);
  });

  test("editar no vuelve a preparar statements entre peticiones (ADR-004)", async () => {
    baseEncontrado();
    await request(app).put("/api/contacts/2").send(body());
    baseEncontrado();
    await request(app).put("/api/contacts/2").send(body());

    expect(sqlite.prepareCalls).toHaveLength(PREPARES_AT_LOAD);
  });

  test("el UPDATE no toca created_at: no aparece en su SQL", () => {
    expect(updateStmt.sql).toMatch(/SET nombre = \?, email = \?, telefono = \?, cargo = \?, notas = \?, updated_at = \?/i);
    expect(updateStmt.sql).not.toMatch(/created_at/i);
  });

  test("el UPDATE filtra por id con parámetro vinculado, sin interpolar", () => {
    expect(updateStmt.sql).toMatch(/WHERE id = \?/);
    expect(updateStmt.sql).not.toMatch(/\$\{|\+\s*id/);
  });
});

describe("PUT /api/contacts/:id · orden de comprobaciones", () => {
  test("un contacto inexistente da 404 aunque el cuerpo sea inválido: existencia antes que validación", async () => {
    getStmt.get.mockReturnValue(undefined);

    const res = await request(app).put("/api/contacts/999").send({ nombre: "", email: "" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Contacto no encontrado" });
    // Preguntar por algo que no existe no devuelve errores de formulario.
    expect(res.body.errors).toBeUndefined();
  });

  test("no se comprueba la validación antes de saber si el contacto existe", async () => {
    getStmt.get.mockReturnValue(undefined);

    await request(app).put("/api/contacts/999").send({ nombre: "", email: "" });

    expect(getStmt.get).toHaveBeenCalledTimes(1);
    expect(updateStmt.run).not.toHaveBeenCalled();
  });

  test("un contacto existente con cuerpo inválido sí da 400, no 404", async () => {
    getStmt.get.mockReturnValue(row());

    const res = await request(app).put("/api/contacts/2").send({ nombre: "", email: "" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Revisa los campos del formulario",
      errors: {
        nombre: "El nombre es obligatorio",
        email: "El email es obligatorio",
      },
    });
    expect(updateStmt.run).not.toHaveBeenCalled();
  });
});

describe("PUT /api/contacts/:id · edición correcta", () => {
  test("devuelve 200 con JSON y el contacto releído de la base", async () => {
    baseEncontrado(row({ cargo: "Staff Engineer", updated_at: AHORA }));

    const res = await request(app).put("/api/contacts/2").send(body());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      id: 2,
      nombre: "Mateo Rivas",
      email: "mateo.rivas@halcyn.co",
      telefono: "+57 315 204 8871",
      cargo: "Staff Engineer",
      notas: "Dueño de la API y de la base SQLite.",
      createdAt: ANTES,
      updatedAt: AHORA,
    });
  });

  test("el cuerpo expone exactamente las ocho claves del contrato", async () => {
    baseEncontrado();

    const res = await request(app).put("/api/contacts/2").send(body());

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

  test("la respuesta viene de la relectura, no del cuerpo enviado", async () => {
    baseEncontrado(row({ nombre: "Nombre en base" }));

    const res = await request(app)
      .put("/api/contacts/2")
      .send(body({ nombre: "Nombre enviado" }));

    expect(res.body.nombre).toBe("Nombre en base");
    expect(getStmt.get).toHaveBeenCalledTimes(2);
  });

  test("escribe una sola vez y con el id convertido a número", async () => {
    baseEncontrado();

    await request(app).put("/api/contacts/2").send(body());

    expect(updateStmt.run).toHaveBeenCalledTimes(1);
    expect(updateStmt.run.mock.calls[0].at(-1)).toBe(2);
  });

  test("updated_at avanza al instante actual y queda distinto de created_at", async () => {
    baseEncontrado();

    await request(app).put("/api/contacts/2").send(body());

    const marca = updateStmt.run.mock.calls[0][5];
    expect(marca).toBe(AHORA);
    expect(marca).not.toBe(ANTES);
    expect(new Date(marca).toISOString()).toBe(marca);
  });
});

describe("PUT /api/contacts/:id · normalización y reemplazo completo", () => {
  test("persiste el valor normalizado, nunca el req.body crudo (RN-07)", async () => {
    baseEncontrado();

    await request(app)
      .put("/api/contacts/2")
      .send(body({ nombre: "  Mateo Rivas  ", email: "  MATEO@HALCYN.CO  " }));

    const [nombre, email] = updateStmt.run.mock.calls[0];
    expect(nombre).toBe("Mateo Rivas");
    expect(email).toBe("mateo@halcyn.co");
  });

  test("es un reemplazo completo: lo que no se envía se vacía", async () => {
    baseEncontrado();

    await request(app)
      .put("/api/contacts/2")
      .send({ nombre: "Mateo Rivas", email: "mateo.rivas@halcyn.co" });

    const [, , telefono, cargo, notas] = updateStmt.run.mock.calls[0];
    expect(telefono).toBe("");
    expect(cargo).toBe("");
    expect(notas).toBe("");
  });

  test("los campos extra del cliente se descartan: siempre siete argumentos en el orden del SQL", async () => {
    baseEncontrado();

    await request(app)
      .put("/api/contacts/2")
      .send(body({ id: 999, createdAt: "1999-01-01T00:00:00.000Z", rol: "admin" }));

    expect(updateStmt.run).toHaveBeenCalledWith(
      "Mateo Rivas",
      "mateo.rivas@halcyn.co",
      "+57 315 204 8871",
      "Staff Engineer",
      "Dueño de la API y de la base SQLite.",
      AHORA,
      2,
    );
  });

  test("mapContact convierte los nulos de la relectura en cadenas vacías", async () => {
    baseEncontrado(row({ telefono: null, cargo: null, notas: null }));

    const res = await request(app).put("/api/contacts/2").send(body());

    expect(res.body.telefono).toBe("");
    expect(res.body.cargo).toBe("");
    expect(res.body.notas).toBe("");
  });
});

describe("PUT /api/contacts/:id · validación (400)", () => {
  test("email con formato inválido señala solo ese campo", async () => {
    getStmt.get.mockReturnValue(row());

    const res = await request(app)
      .put("/api/contacts/2")
      .send(body({ email: "mateo(arroba)halcyn.co" }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ email: "Escribe un email válido" });
  });

  test("los límites de longitud se aplican por campo", async () => {
    getStmt.get.mockReturnValue(row());

    const res = await request(app)
      .put("/api/contacts/2")
      .send(body({ nombre: "a".repeat(81), notas: "n".repeat(281) }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      nombre: "Máximo 80 caracteres",
      notas: "Máximo 280 caracteres",
    });
  });
});

describe("PUT /api/contacts/:id · email duplicado (409)", () => {
  test("una violación de UNIQUE se traduce a 409 con el mensaje del campo email", async () => {
    getStmt.get.mockReturnValue(row());
    updateStmt.run.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed: contacts.email");
    });

    const res = await request(app).put("/api/contacts/2").send(body());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "Ya existe un contacto con ese email",
      errors: { email: "Ese email ya está registrado" },
    });
  });

  test("la detección no distingue mayúsculas (ADR-005)", async () => {
    getStmt.get.mockReturnValue(row());
    updateStmt.run.mockImplementation(() => {
      throw new Error("unique constraint failed: contacts.email");
    });

    const res = await request(app).put("/api/contacts/2").send(body());

    expect(res.status).toBe(409);
  });

  test("tras un 409 no hay relectura: solo la consulta de existencia", async () => {
    getStmt.get.mockReturnValue(row());
    updateStmt.run.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed: contacts.email");
    });

    await request(app).put("/api/contacts/2").send(body());

    expect(getStmt.get).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/contacts/:id · errores del driver (500)", () => {
  test("un error ajeno al UNIQUE se relanza y sale como 500, no como 409", async () => {
    getStmt.get.mockReturnValue(row());
    updateStmt.run.mockImplementation(() => {
      throw new Error("disk I/O error");
    });

    const res = await request(app).put("/api/contacts/2").send(body());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
  });

  test("el 500 no filtra el mensaje del driver ni rutas de disco", async () => {
    getStmt.get.mockReturnValue(row());
    updateStmt.run.mockImplementation(() => {
      throw new Error("SQLITE_IOERR: /Users/alguien/backend/data/archivo.db");
    });

    const res = await request(app).put("/api/contacts/2").send(body());

    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toMatch(/SQLITE_IOERR/);
    expect(cuerpo).not.toMatch(/archivo\.db/);
  });

  test("un fallo puntual no deja la ruta rota para la siguiente petición", async () => {
    getStmt.get.mockReturnValue(row());
    updateStmt.run.mockImplementationOnce(() => {
      throw new Error("disk I/O error");
    });

    const fallida = await request(app).put("/api/contacts/2").send(body());
    const siguiente = await request(app).put("/api/contacts/2").send(body());

    expect(fallida.status).toBe(500);
    expect(siguiente.status).toBe(200);
  });
});

describe("PUT /api/contacts/:id · casos borde", () => {
  test("un id no numérico da 404 limpio: no hay 400 por id inválido", async () => {
    getStmt.get.mockReturnValue(undefined);

    const res = await request(app).put("/api/contacts/abc").send(body());

    expect(res.status).toBe(404);
    expect(Number.isNaN(getStmt.get.mock.calls[0][0])).toBe(true);
  });

  test("un cuerpo ausente sobre un contacto existente da 400, no un 500", async () => {
    getStmt.get.mockReturnValue(row());

    const res = await request(app).put("/api/contacts/2").send();

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Revisa los campos del formulario");
  });

  test("la query string se ignora: no altera el id editado", async () => {
    baseEncontrado();

    await request(app).put("/api/contacts/2?id=999").send(body());

    expect(updateStmt.run.mock.calls[0].at(-1)).toBe(2);
  });
});
