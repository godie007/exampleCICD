/**
 * Pruebas de INTEGRACIÓN de `GET /api/contacts` — el listado, contra SQLite real.
 *
 * Aquí no hay mocks de comportamiento: el motor, el SQL, el esquema, la siembra
 * y las restricciones son los de verdad. Lo único redirigido es la **ubicación**
 * del archivo (ver tests/helpers/real-sqlite.js), para no escribir jamás en la
 * base de desarrollo de quien corra la suite.
 *
 * Complementa a `contacts.list.test.js` (unitaria); no repite sus frentes.
 * Aquí solo se prueba lo que únicamente la base puede demostrar: el orden que
 * aplica SQLite, el estado inicial sembrado, y la persistencia entre peticiones.
 *
 * Disciplina de estado: los tests COMPARTEN una base que evoluciona. El orden
 * de los `describe` es significativo y está declarado en sus nombres; los que
 * escriben lo hacen siempre a través de la API, nunca con SQL a mano.
 */
import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { createTempSqlite } from "./helpers/real-sqlite.js";

const sqlite = createTempSqlite();

jest.unstable_mockModule("node:sqlite", () => ({
  DatabaseSync: sqlite.DatabaseSync,
  default: { DatabaseSync: sqlite.DatabaseSync },
}));

// Import dinámico: debe ocurrir DESPUÉS de registrar el mock. Al importar,
// db.js crea el esquema real y siembra los 4 contactos en la base temporal.
const { contactsRouter } = await import("../src/contacts.js");
const { db } = await import("../src/db.js");

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

const app = createTestApp();

/** Cuerpo válido mínimo; cada test sobreescribe solo lo que le importa. */
function body(overrides = {}) {
  return {
    nombre: "Contacto de prueba",
    email: `prueba.${Math.random().toString(36).slice(2, 10)}@halcyn.co`,
    telefono: "+57 300 000 0000",
    cargo: "QA",
    notas: "Creado por la suite de integración.",
    ...overrides,
  };
}

const listar = () => request(app).get("/api/contacts");
const crear = (datos) => request(app).post("/api/contacts").send(datos);
const nombres = (res) => res.body.map((c) => c.nombre);

afterAll(() => {
  // Cerrar antes de borrar: el archivo está abierto por el proceso.
  db.close();
  sqlite.cleanup();
});

describe("GET /api/contacts · aislamiento de la base de desarrollo", () => {
  test("la suite trabaja en un archivo temporal, nunca en backend/data", () => {
    expect(sqlite.file).toMatch(/archivo-int-/);
    expect(sqlite.file).not.toMatch(/[/\\]backend[/\\]data[/\\]/);
  });
});

describe("GET /api/contacts · estado inicial: la base recién creada viene sembrada", () => {
  test("una base nueva devuelve los cuatro contactos semilla con 200", async () => {
    const res = await listar();

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toHaveLength(4);
  });

  test("los contactos sembrados salen con el contrato completo y un id real de la base", async () => {
    const res = await listar();

    for (const contacto of res.body) {
      expect(Object.keys(contacto).sort()).toEqual([
        "cargo",
        "createdAt",
        "email",
        "id",
        "nombre",
        "notas",
        "telefono",
        "updatedAt",
      ]);
      // AUTOINCREMENT real: enteros positivos, no cadenas.
      expect(Number.isInteger(contacto.id)).toBe(true);
      expect(contacto.id).toBeGreaterThan(0);
    }
  });

  test("las marcas de tiempo que guardó la base son ISO-8601 parseables", async () => {
    const [contacto] = (await listar()).body;

    expect(new Date(contacto.createdAt).toISOString()).toBe(contacto.createdAt);
    expect(contacto.createdAt).toBe(contacto.updatedAt);
  });

  test("los ids sembrados son consecutivos desde 1", async () => {
    const ids = (await listar()).body.map((c) => c.id).sort((a, b) => a - b);

    expect(ids).toEqual([1, 2, 3, 4]);
  });
});

describe("GET /api/contacts · el orden lo aplica SQLite, no JavaScript", () => {
  test("los contactos sembrados vuelven ordenados por nombre, no por id", async () => {
    const res = await listar();

    expect(nombres(res)).toEqual([
      "Andrés Pineda",
      "Camila Herrera",
      "Lucía Andrade",
      "Mateo Rivas",
    ]);
    // Si el orden fuera el de inserción, el primero sería "Camila Herrera".
    expect(res.body[0].id).not.toBe(1);
  });

  test("un alta se coloca en su posición alfabética, no al final", async () => {
    await crear(body({ nombre: "Ana Beltrán" }));

    const listado = nombres(await listar());

    expect(listado[0]).toBe("Ana Beltrán");
    expect(listado.at(-1)).toBe("Mateo Rivas");
  });

  test("COLLATE NOCASE ignora mayúsculas: un nombre en minúscula no se va al final", async () => {
    await crear(body({ nombre: "bruno díaz" }));

    const listado = nombres(await listar());

    // Sin NOCASE, SQLite ordenaría por byte y "bruno" iría tras todas las mayúsculas.
    expect(listado.indexOf("bruno díaz")).toBeLessThan(listado.indexOf("Camila Herrera"));
    expect(listado.indexOf("bruno díaz")).toBeGreaterThan(listado.indexOf("Ana Beltrán"));
  });

  test("NOCASE no pliega acentos: es solo ASCII y conviene saberlo", async () => {
    await crear(body({ nombre: "Zoe Ángel" }));
    await crear(body({ nombre: "Zulema Ortiz" }));

    const listado = nombres(await listar());

    // "Zoe Ángel" < "Zulema Ortiz" porque 'o' < 'u'; el acento del nombre de
    // pila no interviene. Fijado como es, no como nos gustaría que fuera.
    expect(listado.indexOf("Zoe Ángel")).toBeLessThan(listado.indexOf("Zulema Ortiz"));
  });

  test("un nombre con inicial acentuada va al FINAL, detrás de la Z", async () => {
    // Esta es la prueba de que el orden lo hace SQLite y no JavaScript.
    // `COLLATE NOCASE` compara bytes: 'Á' (U+00C1) va después de 'Z' (0x5A).
    // Un `sort()` en JS con `localeCompare` haría lo contrario —plegaría el
    // acento y pondría "Ángela" la primera—, así que este test se pone rojo
    // en cuanto alguien mueve el ordenamiento fuera de la base.
    await crear(body({ nombre: "Ángela Ruiz" }));

    const listado = nombres(await listar());

    expect(listado.at(-1)).toBe("Ángela Ruiz");
    expect(listado.indexOf("Ángela Ruiz")).toBeGreaterThan(
      listado.indexOf("Zulema Ortiz"),
    );
    // Y para que no quepa duda de cuál es el criterio contrario: ordenando en
    // JavaScript, "Ángela" adelantaría a "Zulema" en vez de quedar detrás.
    const enJavaScript = [...listado].sort((a, b) => a.localeCompare(b));
    expect(enJavaScript.indexOf("Ángela Ruiz")).toBeLessThan(
      enJavaScript.indexOf("Zulema Ortiz"),
    );
  });
});

describe("GET /api/contacts · el listado refleja lo que hacen las demás rutas", () => {
  test("lo que se crea por POST aparece en el listado con los mismos datos", async () => {
    const creado = await crear(
      body({ nombre: "Nuevo Contacto", email: "nuevo.contacto@halcyn.co" }),
    );
    expect(creado.status).toBe(201);

    const encontrado = (await listar()).body.find((c) => c.id === creado.body.id);

    expect(encontrado).toEqual(creado.body);
  });

  test("lo que se edita por PUT se ve actualizado en el listado", async () => {
    const creado = await crear(body({ nombre: "Antes de Editar" }));

    await request(app)
      .put(`/api/contacts/${creado.body.id}`)
      .send(body({ nombre: "Después de Editar", email: creado.body.email }));

    const listado = nombres(await listar());

    expect(listado).toContain("Después de Editar");
    expect(listado).not.toContain("Antes de Editar");
  });

  test("lo que se borra por DELETE desaparece del listado y baja el total", async () => {
    const creado = await crear(body({ nombre: "Efímero" }));
    const antes = (await listar()).body.length;

    const borrado = await request(app).delete(`/api/contacts/${creado.body.id}`);
    expect(borrado.status).toBe(204);

    const despues = await listar();

    expect(despues.body).toHaveLength(antes - 1);
    expect(nombres(despues)).not.toContain("Efímero");
  });

  test("un email duplicado es rechazado por la base y no llega al listado", async () => {
    // La restricción UNIQUE real: el 409 nace de SQLite, no de una comprobación
    // previa en JavaScript. Es la mitigación #1 de ADR-005.
    await crear(body({ nombre: "Original", email: "duplicado@halcyn.co" }));
    const antes = (await listar()).body.length;

    const repetido = await crear(body({ nombre: "Duplicado", email: "duplicado@halcyn.co" }));

    expect(repetido.status).toBe(409);
    expect(repetido.body).toEqual({
      error: "Ya existe un contacto con ese email",
      errors: { email: "Ese email ya está registrado" },
    });
    expect((await listar()).body).toHaveLength(antes);
    expect(nombres(await listar())).not.toContain("Duplicado");
  });

  test("el email se guarda normalizado: se lista en minúscula aunque se envíe en mayúscula", async () => {
    await crear(body({ nombre: "Mayúsculas", email: "MAYUSCULAS@HALCYN.CO" }));

    const encontrado = (await listar()).body.find((c) => c.nombre === "Mayúsculas");

    expect(encontrado.email).toBe("mayusculas@halcyn.co");
  });
});

describe("GET /api/contacts · coherencia de tipos en el viaje de ida y vuelta", () => {
  test("los campos opcionales omitidos vuelven como cadena vacía, no como null", async () => {
    await crear({ nombre: "Sin Opcionales", email: "sin.opcionales@halcyn.co" });

    const encontrado = (await listar()).body.find((c) => c.nombre === "Sin Opcionales");

    expect(encontrado.telefono).toBe("");
    expect(encontrado.cargo).toBe("");
    expect(encontrado.notas).toBe("");
  });

  test("ningún campo del listado vuelve como null: mapContact cubre toda la tabla", async () => {
    const res = await listar();

    for (const contacto of res.body) {
      for (const [campo, valor] of Object.entries(contacto)) {
        expect([campo, valor]).not.toEqual([campo, null]);
      }
    }
  });

  test("el listado no expone columnas crudas de la base", async () => {
    const res = await listar();
    const crudo = JSON.stringify(res.body);

    expect(crudo).not.toMatch(/created_at/);
    expect(crudo).not.toMatch(/updated_at/);
  });

  test("tras muchas altas el listado sigue completo y ordenado", async () => {
    const antes = (await listar()).body.length;

    for (let i = 0; i < 25; i += 1) {
      await crear(body({ nombre: `Masivo ${String(i).padStart(2, "0")}` }));
    }

    const res = await listar();
    const listado = nombres(res);

    expect(res.body).toHaveLength(antes + 25);

    const ordenado = [...listado].sort((a, b) =>
      a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0,
    );
    expect(listado).toEqual(ordenado);
  });
});
