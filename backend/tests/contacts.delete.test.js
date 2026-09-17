/**
 * Pruebas unitarias de `DELETE /api/contacts/:id` — la baja de un contacto.
 *
 * Unidad bajo prueba: el handler `contactsRouter.delete("/:id")` de
 * `src/contacts.js`. Lo único falseado es el driver `node:sqlite`.
 * Esta ruta no relee ni valida: decide por `result.changes`.
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

const DELETE_SQL = /DELETE FROM contacts/i;
const GET_SQL = /^SELECT \* FROM contacts WHERE id = \?/;

const deleteStmt = sqlite.stmtFor(DELETE_SQL);
const getStmt = sqlite.stmtFor(GET_SQL);

/** Cantidad de statements preparados al terminar la carga de los módulos. */
const PREPARES_AT_LOAD = sqlite.prepareCalls.length;

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/contacts", contactsRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: "Error interno del servidor" });
  });
  return app;
}

let app;

beforeEach(() => {
  deleteStmt.run.mockReset();
  deleteStmt.run.mockReturnValue({ changes: 1 });
  getStmt.get.mockReset();
  app = createTestApp();
});

describe("DELETE /api/contacts/:id · contrato SQL y statements preparados", () => {
  test("prepara el DELETE una sola vez, al cargar el módulo (ADR-004)", () => {
    const deletes = sqlite.prepareCalls.filter((sql) => DELETE_SQL.test(sql));
    expect(deletes).toHaveLength(1);
  });

  test("borrar no vuelve a preparar statements entre peticiones (ADR-004)", async () => {
    await request(app).delete("/api/contacts/2");
    await request(app).delete("/api/contacts/2");

    expect(sqlite.prepareCalls).toHaveLength(PREPARES_AT_LOAD);
  });

  test("el id viaja como parámetro vinculado y el DELETE siempre lleva WHERE", () => {
    expect(deleteStmt.sql).toBe("DELETE FROM contacts WHERE id = ?");
  });
});

describe("DELETE /api/contacts/:id · baja correcta", () => {
  test("changes === 1 devuelve 204 y el cuerpo va vacío", async () => {
    const res = await request(app).delete("/api/contacts/2");

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  test("el id del path se convierte a número antes de llegar al statement", async () => {
    await request(app).delete("/api/contacts/7");

    expect(deleteStmt.run).toHaveBeenCalledWith(7);
  });

  test("escribe una sola vez y no consulta la base antes de borrar", async () => {
    await request(app).delete("/api/contacts/2");

    expect(deleteStmt.run).toHaveBeenCalledTimes(1);
    // No hay comprobación previa de existencia: el 404 sale de `changes`.
    expect(getStmt.get).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/contacts/:id · contacto inexistente (404)", () => {
  test("changes === 0 devuelve 404 con el mensaje del contrato, sin errors", async () => {
    deleteStmt.run.mockReturnValue({ changes: 0 });

    const res = await request(app).delete("/api/contacts/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Contacto no encontrado" });
    expect(res.body.errors).toBeUndefined();
  });

  test("un id no numérico da 404 limpio: no hay 400 por id inválido", async () => {
    deleteStmt.run.mockReturnValue({ changes: 0 });

    const res = await request(app).delete("/api/contacts/abc");

    expect(res.status).toBe(404);
    expect(Number.isNaN(deleteStmt.run.mock.calls[0][0])).toBe(true);
  });
});

describe("DELETE /api/contacts/:id · errores del driver (500)", () => {
  test("un fallo del driver sale como 500 genérico, no como 404", async () => {
    deleteStmt.run.mockImplementation(() => {
      throw new Error("disk I/O error");
    });

    const res = await request(app).delete("/api/contacts/2");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
  });

  test("el 500 no filtra el mensaje del driver ni rutas de disco", async () => {
    deleteStmt.run.mockImplementation(() => {
      throw new Error("SQLITE_IOERR: /Users/alguien/backend/data/archivo.db");
    });

    const res = await request(app).delete("/api/contacts/2");

    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toMatch(/SQLITE_IOERR/);
    expect(cuerpo).not.toMatch(/archivo\.db/);
  });

  test("un fallo puntual no deja la ruta rota para la siguiente petición", async () => {
    deleteStmt.run.mockImplementationOnce(() => {
      throw new Error("disk I/O error");
    });

    const fallida = await request(app).delete("/api/contacts/2");
    const siguiente = await request(app).delete("/api/contacts/2");

    expect(fallida.status).toBe(500);
    expect(siguiente.status).toBe(204);
  });
});

describe("DELETE /api/contacts/:id · casos borde", () => {
  test("la query string se ignora: no altera el id borrado", async () => {
    await request(app).delete("/api/contacts/2?id=999&forzar=1");

    expect(deleteStmt.run).toHaveBeenCalledWith(2);
  });

  test("el cuerpo enviado en un DELETE se ignora por completo", async () => {
    await request(app).delete("/api/contacts/2").send({ id: 999, nombre: "x" });

    expect(deleteStmt.run).toHaveBeenCalledWith(2);
    expect(deleteStmt.run.mock.calls[0]).toHaveLength(1);
  });

  test("borrar dos veces el mismo id: la segunda ya no encuentra nada", async () => {
    deleteStmt.run
      .mockReturnValueOnce({ changes: 1 })
      .mockReturnValueOnce({ changes: 0 });

    const primera = await request(app).delete("/api/contacts/2");
    const segunda = await request(app).delete("/api/contacts/2");

    expect(primera.status).toBe(204);
    expect(segunda.status).toBe(404);
  });
});
