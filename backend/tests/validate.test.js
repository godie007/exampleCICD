/**
 * Pruebas unitarias de `validateContact` — `src/validate.js`.
 *
 * Es una función pura, sin dependencias ni efectos: se importa directamente,
 * sin mocks, sin supertest y sin app. Nada del montaje de las rutas aplica aquí.
 *
 * Dos responsabilidades que se prueban por separado: **decidir** si el cuerpo
 * es válido (`ok`, `errors`) y **normalizar** lo que se va a persistir (`value`).
 */
import { validateContact } from "../src/validate.js";

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

describe("validateContact · forma del retorno", () => {
  test("devuelve siempre las tres claves ok, errors y value", () => {
    expect(Object.keys(validateContact(body())).sort()).toEqual([
      "errors",
      "ok",
      "value",
    ]);
  });

  test("value expone exactamente los cinco campos del recurso, sin extras del cliente", () => {
    const { value } = validateContact(body({ id: 99, rol: "admin" }));

    expect(Object.keys(value).sort()).toEqual([
      "cargo",
      "email",
      "nombre",
      "notas",
      "telefono",
    ]);
  });

  test("ok es true exactamente cuando errors está vacío", () => {
    const valido = validateContact(body());
    const invalido = validateContact(body({ nombre: "" }));

    expect(valido.ok).toBe(true);
    expect(valido.errors).toEqual({});
    expect(invalido.ok).toBe(false);
    expect(Object.keys(invalido.errors).length).toBeGreaterThan(0);
  });

  test("devuelve value normalizado incluso cuando la validación falla", () => {
    // Las rutas descartan `value` si `ok` es false, pero la función lo produce
    // igual: fijarlo evita que un refactor lo deje undefined y reviente.
    const { ok, value } = validateContact({ nombre: "  Ana  ", email: "" });

    expect(ok).toBe(false);
    expect(value.nombre).toBe("Ana");
  });
});

describe("validateContact · normalización", () => {
  test("recorta los espacios de los cinco campos", () => {
    const { value } = validateContact({
      nombre: "  Ana Ruiz  ",
      email: "  ana@halcyn.co  ",
      telefono: "  +57 310 482 1190  ",
      cargo: "  Diseño  ",
      notas: "  Nota con espacios  ",
    });

    expect(value).toEqual({
      nombre: "Ana Ruiz",
      email: "ana@halcyn.co",
      telefono: "+57 310 482 1190",
      cargo: "Diseño",
      notas: "Nota con espacios",
    });
  });

  test("el email baja a minúsculas; el nombre conserva sus mayúsculas", () => {
    const { value } = validateContact(body({ nombre: "Ana RUIZ", email: "ANA@Halcyn.CO" }));

    expect(value.email).toBe("ana@halcyn.co");
    expect(value.nombre).toBe("Ana RUIZ");
  });

  test("los campos ausentes se normalizan a cadena vacía, nunca undefined ni null", () => {
    const { value } = validateContact({ nombre: "Ana", email: "ana@halcyn.co" });

    expect(value.telefono).toBe("");
    expect(value.cargo).toBe("");
    expect(value.notas).toBe("");
  });

  test("null y undefined explícitos también se vuelven cadena vacía, no la cadena \"null\"", () => {
    const { value } = validateContact({
      nombre: "Ana",
      email: "ana@halcyn.co",
      telefono: null,
      cargo: undefined,
      notas: null,
    });

    expect(value.telefono).toBe("");
    expect(value.cargo).toBe("");
    expect(value.notas).toBe("");
  });

  test("los valores no textuales se convierten a texto antes de validar", () => {
    const { value } = validateContact({ nombre: 123, email: "ana@halcyn.co", cargo: 7 });

    expect(value.nombre).toBe("123");
    expect(value.cargo).toBe("7");
  });

  test("no muta el objeto recibido", () => {
    const entrada = body({ nombre: "  Ana  ", email: "ANA@HALCYN.CO" });
    const copia = { ...entrada };

    validateContact(entrada);

    expect(entrada).toEqual(copia);
  });
});

describe("validateContact · nombre", () => {
  test("el nombre es obligatorio", () => {
    expect(validateContact(body({ nombre: "" })).errors.nombre).toBe(
      "El nombre es obligatorio",
    );
  });

  test("un nombre de solo espacios cuenta como ausente", () => {
    expect(validateContact(body({ nombre: "     " })).errors.nombre).toBe(
      "El nombre es obligatorio",
    );
  });

  test("80 caracteres se acepta y 81 se rechaza", () => {
    expect(validateContact(body({ nombre: "a".repeat(80) })).ok).toBe(true);
    expect(validateContact(body({ nombre: "a".repeat(81) })).errors.nombre).toBe(
      "Máximo 80 caracteres",
    );
  });

  test("la longitud se mide después de recortar: espacios de sobra no cuentan", () => {
    const { ok } = validateContact(body({ nombre: `  ${"a".repeat(80)}  ` }));

    expect(ok).toBe(true);
  });

  test("un nombre ausente da el error de obligatorio, no el de longitud", () => {
    // Las ramas son excluyentes: un campo produce un único mensaje.
    expect(validateContact(body({ nombre: "" })).errors.nombre).toBe(
      "El nombre es obligatorio",
    );
  });
});

describe("validateContact · email", () => {
  test("el email es obligatorio", () => {
    expect(validateContact(body({ email: "" })).errors.email).toBe(
      "El email es obligatorio",
    );
  });

  test.each([
    ["ana@halcyn.co"],
    ["ana.ruiz@sub.halcyn.com.co"],
    ["ana+etiqueta@halcyn.co"],
    ["a@b.cd"],
  ])("acepta el email válido %s", (email) => {
    expect(validateContact(body({ email })).ok).toBe(true);
  });

  test.each([
    ["sin-arroba.co"],
    ["ana@sin-punto"],
    ["ana@@halcyn.co"],
    ["ana ruiz@halcyn.co"],
    ["@halcyn.co"],
    ["ana@.co"],
  ])("rechaza el email inválido %s", (email) => {
    expect(validateContact(body({ email })).errors.email).toBe(
      "Escribe un email válido",
    );
  });

  test("un email inválido da el error de formato, no el de longitud", () => {
    const { errors } = validateContact(body({ email: "a".repeat(130) }));

    expect(errors.email).toBe("Escribe un email válido");
  });

  test("un email válido de más de 120 caracteres se rechaza por longitud", () => {
    const largo = `${"a".repeat(115)}@halcyn.co`;

    expect(largo.length).toBeGreaterThan(120);
    expect(validateContact(body({ email: largo })).errors.email).toBe(
      "Máximo 120 caracteres",
    );
  });

  test("la unicidad NO se valida aquí: es cosa de la base (ADR-005)", () => {
    // validate.js no consulta nada; el 409 nace de la restricción UNIQUE.
    expect(validateContact(body({ email: "camila.herrera@halcyn.co" })).ok).toBe(true);
  });
});

describe("validateContact · teléfono", () => {
  test("el teléfono es opcional: vacío no produce error", () => {
    expect(validateContact(body({ telefono: "" })).ok).toBe(true);
  });

  test.each([
    ["+57 310 482 1190"],
    ["3104821190"],
    ["(601) 742-1190"],
    ["601.742.1190"],
  ])("acepta el teléfono válido %s", (telefono) => {
    expect(validateContact(body({ telefono })).ok).toBe(true);
  });

  test.each([
    ["llámame"],
    ["123456"],
    ["+57 310 482 1190 ext. 22"],
    ["3104821190310482119031048"],
  ])("rechaza el teléfono inválido %s", (telefono) => {
    expect(validateContact(body({ telefono })).errors.telefono).toBe(
      "Usa un teléfono con dígitos, espacios o +",
    );
  });

  test("los límites de longitud del teléfono son 7 y 24 caracteres", () => {
    expect(validateContact(body({ telefono: "1234567" })).ok).toBe(true);
    expect(validateContact(body({ telefono: "1".repeat(24) })).ok).toBe(true);
    expect(validateContact(body({ telefono: "123456" })).ok).toBe(false);
    expect(validateContact(body({ telefono: "1".repeat(25) })).ok).toBe(false);
  });
});

describe("validateContact · cargo y notas", () => {
  test("ambos son opcionales", () => {
    expect(validateContact(body({ cargo: "", notas: "" })).ok).toBe(true);
  });

  test("el cargo admite 80 caracteres y rechaza 81", () => {
    expect(validateContact(body({ cargo: "c".repeat(80) })).ok).toBe(true);
    expect(validateContact(body({ cargo: "c".repeat(81) })).errors.cargo).toBe(
      "Máximo 80 caracteres",
    );
  });

  test("las notas admiten 280 caracteres y rechazan 281", () => {
    expect(validateContact(body({ notas: "n".repeat(280) })).ok).toBe(true);
    expect(validateContact(body({ notas: "n".repeat(281) })).errors.notas).toBe(
      "Máximo 280 caracteres",
    );
  });
});

describe("validateContact · errores acumulados", () => {
  test("informa de todos los campos inválidos a la vez, no solo del primero", () => {
    const { ok, errors } = validateContact({
      nombre: "",
      email: "roto",
      telefono: "llámame",
      cargo: "c".repeat(81),
      notas: "n".repeat(281),
    });

    expect(ok).toBe(false);
    expect(errors).toEqual({
      nombre: "El nombre es obligatorio",
      email: "Escribe un email válido",
      telefono: "Usa un teléfono con dígitos, espacios o +",
      cargo: "Máximo 80 caracteres",
      notas: "Máximo 280 caracteres",
    });
  });

  test("un cuerpo vacío falla solo por los dos campos obligatorios", () => {
    const { errors } = validateContact({});

    expect(errors).toEqual({
      nombre: "El nombre es obligatorio",
      email: "El email es obligatorio",
    });
  });

  test("las claves de errors son nombres de campo: el frontend los pinta bajo el input", () => {
    const { errors } = validateContact({ nombre: "", email: "roto" });

    for (const campo of Object.keys(errors)) {
      expect(["nombre", "email", "telefono", "cargo", "notas"]).toContain(campo);
    }
  });
});
