/**
 * Pruebas unitarias de `POST /api/contacts` — el alta de un contacto.
 *
 * Unidad bajo prueba: el handler `contactsRouter.post("/")` de `src/contacts.js`
 * junto con el `validateContact` real de `src/validate.js` y el `mapContact`
 * real de `src/db.js`. Lo único falseado es el driver `node:sqlite`
 * (ver tests/helpers/fake-sqlite.js): así corre el código de producción tal cual,
 * sin tocar disco y sin depender de la siembra.
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

// Import dinámico: debe ocurrir DESPUÉS de registrar el mock. Con ESM, un
// `import` estático se resolvería antes de que corra cualquier línea de aquí.
const { contactsRouter } = await import("../src/contacts.js");

const INSERT_SQL = /INSERT INTO contacts/i;
// `getStmt` y `updateStmt` comparten "WHERE id = ?": el ancla al SELECT es la
// que hace que `stmtFor` encuentre exactamente uno.
const GET_SQL = /^SELECT \* FROM contacts WHERE id = \?/;

const insertStmt = sqlite.stmtFor(INSERT_SQL);
const getStmt = sqlite.stmtFor(GET_SQL);

/** Cantidad de statements preparados al terminar la carga de los módulos. */
const PREPARES_AT_LOAD = sqlite.prepareCalls.length;

/** Instante fijo para que `created_at`/`updated_at` sean comprobables. */
const AHORA = "2026-09-17T10:00:00.000Z";

/**
 * App mínima que reproduce el contrato de `src/index.js`: el router montado en
 * /api/contacts y el handler final que traduce cualquier error a un 500.
 * No se usa `index.js` directamente porque hace `app.listen()` al importarse;
 * y sin el handler final un fallo del driver devolvería el HTML de Express en
 * vez del 500 del contrato de errores.
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
    id: 42,
    nombre: "Camila Herrera",
    email: "camila.herrera@halcyn.co",
    telefono: "+57 310 482 1190",
    cargo: "Product Manager",
    notas: "Coordina el roadmap del directorio interno.",
    created_at: AHORA,
    updated_at: AHORA,
    ...overrides,
  };
}

/** Cuerpo válido mínimo; cada test sobreescribe solo lo que le importa. */
function body(overrides = {}) {
  return {
    nombre: "Camila Herrera",
    email: "camila.herrera@halcyn.co",
    telefono: "+57 310 482 1190",
    cargo: "Product Manager",
    notas: "Coordina el roadmap del directorio interno.",
    ...overrides,
  };
}

let app;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(AHORA));

  insertStmt.run.mockReset();
  insertStmt.run.mockReturnValue({ changes: 1, lastInsertRowid: 42 });
  getStmt.get.mockReset();
  getStmt.get.mockReturnValue(row());

  app = createTestApp();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("POST /api/contacts · contrato SQL y statements preparados", () => {
  test("prepara el INSERT una sola vez, al cargar el módulo (ADR-004)", () => {
    const inserts = sqlite.prepareCalls.filter((sql) => INSERT_SQL.test(sql));
    expect(inserts).toHaveLength(1);
  });

  test("dar de alta no vuelve a preparar statements entre peticiones (ADR-004)", async () => {
    await request(app).post("/api/contacts").send(body());
    await request(app).post("/api/contacts").send(body());

    expect(sqlite.prepareCalls).toHaveLength(PREPARES_AT_LOAD);
  });

  test("el INSERT escribe las siete columnas con parámetros vinculados, sin interpolar", () => {
    expect(insertStmt.sql).toMatch(
      /INSERT INTO contacts \(nombre, email, telefono, cargo, notas, created_at, updated_at\)/i,
    );
    expect(insertStmt.sql).toMatch(/VALUES \(\?, \?, \?, \?, \?, \?, \?\)/);
    // El id lo pone AUTOINCREMENT: la ruta nunca lo escribe.
    expect(insertStmt.sql).not.toMatch(/\bid\b\s*,/i);
  });
});

describe("POST /api/contacts · alta correcta", () => {
  test("devuelve 201 con JSON y el contacto releído de la base", async () => {
    const res = await request(app).post("/api/contacts").send(body());

    expect(res.status).toBe(201);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      id: 42,
      nombre: "Camila Herrera",
      email: "camila.herrera@halcyn.co",
      telefono: "+57 310 482 1190",
      cargo: "Product Manager",
      notas: "Coordina el roadmap del directorio interno.",
      createdAt: AHORA,
      updatedAt: AHORA,
    });
  });

  test("el cuerpo expone exactamente las ocho claves del contrato, sin columnas crudas", async () => {
    const res = await request(app).post("/api/contacts").send(body());

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

  test("la respuesta viene de la base, no de lo que envió el cliente", async () => {
    // La fila en base difiere del cuerpo enviado: el 201 debe reflejar la base.
    getStmt.get.mockReturnValue(row({ id: 7, nombre: "Nombre en base" }));

    const res = await request(app)
      .post("/api/contacts")
      .send(body({ nombre: "Nombre enviado" }));

    expect(res.body.id).toBe(7);
    expect(res.body.nombre).toBe("Nombre en base");
  });

  test("relee por el lastInsertRowid, convertido a número", async () => {
    insertStmt.run.mockReturnValue({ changes: 1, lastInsertRowid: "42" });

    await request(app).post("/api/contacts").send(body());

    expect(getStmt.get).toHaveBeenCalledTimes(1);
    expect(getStmt.get).toHaveBeenCalledWith(42);
  });

  test("escribe una sola vez por petición", async () => {
    await request(app).post("/api/contacts").send(body());

    expect(insertStmt.run).toHaveBeenCalledTimes(1);
  });

  test("created_at y updated_at son el mismo instante ISO-8601 en el alta", async () => {
    await request(app).post("/api/contacts").send(body());

    const args = insertStmt.run.mock.calls[0];
    const [creado, actualizado] = args.slice(5);

    expect(creado).toBe(actualizado);
    expect(creado).toBe(AHORA);
    expect(new Date(creado).toISOString()).toBe(creado);
  });
});

describe("POST /api/contacts · normalización antes de persistir", () => {
  test("persiste el valor normalizado, nunca el req.body crudo (RN-07)", async () => {
    await request(app)
      .post("/api/contacts")
      .send(body({ nombre: "  Ana Ruiz  ", email: "  ANA@HALCYN.CO  " }));

    const [nombre, email] = insertStmt.run.mock.calls[0];
    expect(nombre).toBe("Ana Ruiz");
    expect(email).toBe("ana@halcyn.co");
  });

  test("los campos opcionales ausentes se guardan como cadena vacía, no como undefined", async () => {
    await request(app)
      .post("/api/contacts")
      .send({ nombre: "Ana Ruiz", email: "ana@halcyn.co" });

    const [, , telefono, cargo, notas] = insertStmt.run.mock.calls[0];
    expect(telefono).toBe("");
    expect(cargo).toBe("");
    expect(notas).toBe("");
  });

  test("los campos extra del cliente se descartan: siempre siete argumentos en el orden del SQL", async () => {
    await request(app)
      .post("/api/contacts")
      .send(body({ id: 999, createdAt: "1999-01-01T00:00:00.000Z", rol: "admin" }));

    expect(insertStmt.run).toHaveBeenCalledWith(
      "Camila Herrera",
      "camila.herrera@halcyn.co",
      "+57 310 482 1190",
      "Product Manager",
      "Coordina el roadmap del directorio interno.",
      AHORA,
      AHORA,
    );
  });

  test("mapContact convierte los nulos de la base en cadenas vacías sin mutar la fila", async () => {
    const fila = row({ telefono: null, cargo: null, notas: null });
    getStmt.get.mockReturnValue(fila);

    const res = await request(app).post("/api/contacts").send(body());

    expect(res.body.telefono).toBe("");
    expect(res.body.cargo).toBe("");
    expect(res.body.notas).toBe("");
    // La fila que entregó el driver sigue intacta.
    expect(fila.telefono).toBeNull();
    expect(fila.cargo).toBeNull();
    expect(fila.notas).toBeNull();
  });
});

describe("POST /api/contacts · validación (400)", () => {
  test("cuerpo vacío devuelve 400 con un error por cada campo obligatorio", async () => {
    const res = await request(app).post("/api/contacts").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Revisa los campos del formulario",
      errors: {
        nombre: "El nombre es obligatorio",
        email: "El email es obligatorio",
      },
    });
  });

  test("un cuerpo inválido no toca la base", async () => {
    await request(app).post("/api/contacts").send({ nombre: "", email: "" });

    expect(insertStmt.run).not.toHaveBeenCalled();
    expect(getStmt.get).not.toHaveBeenCalled();
  });

  test("email con formato inválido devuelve 400 señalando solo ese campo", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .send(body({ email: "ana(arroba)halcyn.co" }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ email: "Escribe un email válido" });
  });

  test("teléfono con letras devuelve 400 aunque nombre y email sean válidos", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .send(body({ telefono: "llámame" }));

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      telefono: "Usa un teléfono con dígitos, espacios o +",
    });
  });

  test("los límites de longitud se aplican por campo", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .send(
        body({
          nombre: "a".repeat(81),
          cargo: "c".repeat(81),
          notas: "n".repeat(281),
        }),
      );

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      nombre: "Máximo 80 caracteres",
      cargo: "Máximo 80 caracteres",
      notas: "Máximo 280 caracteres",
    });
  });

  test("el nombre en el límite exacto de 80 caracteres se acepta", async () => {
    const res = await request(app)
      .post("/api/contacts")
      .send(body({ nombre: "a".repeat(80) }));

    expect(res.status).toBe(201);
    expect(insertStmt.run).toHaveBeenCalledTimes(1);
  });

  test("un nombre que solo tiene espacios se considera ausente", async () => {
    const res = await request(app).post("/api/contacts").send(body({ nombre: "     " }));

    expect(res.status).toBe(400);
    expect(res.body.errors.nombre).toBe("El nombre es obligatorio");
  });
});

describe("POST /api/contacts · email duplicado (409)", () => {
  test("una violación de UNIQUE se traduce a 409 con el mensaje del campo email", async () => {
    insertStmt.run.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed: contacts.email");
    });

    const res = await request(app).post("/api/contacts").send(body());

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "Ya existe un contacto con ese email",
      errors: { email: "Ese email ya está registrado" },
    });
  });

  test("la detección no distingue mayúsculas: el mensaje en minúscula también da 409 (ADR-005)", async () => {
    insertStmt.run.mockImplementation(() => {
      throw new Error("unique constraint failed: contacts.email");
    });

    const res = await request(app).post("/api/contacts").send(body());

    expect(res.status).toBe(409);
  });

  test("tras un 409 no se relee la base: no hay contacto que devolver", async () => {
    insertStmt.run.mockImplementation(() => {
      throw new Error("UNIQUE constraint failed: contacts.email");
    });

    await request(app).post("/api/contacts").send(body());

    expect(getStmt.get).not.toHaveBeenCalled();
  });
});

describe("POST /api/contacts · errores del driver (500)", () => {
  test("un error ajeno al UNIQUE se relanza y sale como 500 genérico, no como 409", async () => {
    insertStmt.run.mockImplementation(() => {
      throw new Error("disk I/O error");
    });

    const res = await request(app).post("/api/contacts").send(body());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
  });

  test("el 500 no filtra el mensaje del driver ni rutas de disco", async () => {
    insertStmt.run.mockImplementation(() => {
      throw new Error("SQLITE_IOERR: /Users/alguien/backend/data/archivo.db");
    });

    const res = await request(app).post("/api/contacts").send(body());

    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toMatch(/SQLITE_IOERR/);
    expect(cuerpo).not.toMatch(/archivo\.db/);
    expect(cuerpo).not.toMatch(/\/Users\//);
  });

  test("un fallo puntual no deja la ruta rota para la siguiente petición", async () => {
    insertStmt.run.mockImplementationOnce(() => {
      throw new Error("disk I/O error");
    });

    const fallida = await request(app).post("/api/contacts").send(body());
    const siguiente = await request(app).post("/api/contacts").send(body());

    expect(fallida.status).toBe(500);
    expect(siguiente.status).toBe(201);
  });
});

describe("POST /api/contacts · casos borde", () => {
  test("la barra final apunta a la misma ruta de alta", async () => {
    const res = await request(app).post("/api/contacts/").send(body());

    expect(res.status).toBe(201);
  });

  test("la query string se ignora por completo", async () => {
    const res = await request(app)
      .post("/api/contacts?forzar=1&id=999")
      .send(body());

    expect(res.status).toBe(201);
    expect(insertStmt.run.mock.calls[0]).toHaveLength(7);
  });

  test("un cuerpo ausente devuelve 400, no un 500 por leer campos de undefined", async () => {
    const res = await request(app).post("/api/contacts").send();

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Revisa los campos del formulario");
  });
});
