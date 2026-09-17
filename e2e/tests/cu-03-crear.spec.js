/**
 * CU-03 · Crear un contacto.
 *
 * Flujo: enviar → POST → el backend valida y normaliza → 201 → la UI RE-LISTA
 * desde la API (ADR-003) → toast "Contacto creado" → formulario limpio.
 *
 * El toast vive 2,8 segundos y se va solo: se aférra con expect inmediatamente
 * después de la acción, nunca con un waitForTimeout.
 */
import { expect, test } from "@playwright/test";
import { borrarPorApi, contacto, crearPorApi, limpiarRestos } from "../fixtures/datos.js";

/** Rellena el formulario de alta con los cinco campos. */
async function rellenar(page, datos) {
  await page.getByLabel("Nombre").fill(datos.nombre);
  await page.getByLabel("Email").fill(datos.email);
  if (datos.telefono !== undefined) await page.getByLabel("Teléfono").fill(datos.telefono);
  if (datos.cargo !== undefined) await page.getByLabel("Cargo").fill(datos.cargo);
  if (datos.notas !== undefined) await page.getByLabel("Notas").fill(datos.notas);
}

test.describe("CU-03 · Crear un contacto", () => {
  const creados = [];

  test.beforeEach(async () => {
    test.info().annotations.push({ type: "CU", description: "CU-03" });
  });

  test.afterEach(async ({ request }) => {
    while (creados.length) await borrarPorApi(request, creados.pop());
  });

  test.afterAll(async ({ request }) => {
    await limpiarRestos(request);
  });

  test("el formulario arranca en modo creación, no en edición", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Nueva ficha" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear contacto" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0);
  });

  test("un alta válida aparece en el directorio y se anuncia con un toast", async ({ page, request }) => {
    const datos = contacto();
    await page.goto("/");
    await rellenar(page, datos);
    await page.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByRole("status")).toHaveText("Contacto creado");
    await expect(page.getByRole("article").filter({ hasText: datos.nombre })).toBeVisible();

    const lista = await (await request.get("http://localhost:3001/api/contacts")).json();
    creados.push(lista.find((c) => c.email === datos.email)?.id);
  });

  test("tras crear, el formulario queda limpio para la siguiente alta", async ({ page, request }) => {
    const datos = contacto();
    await page.goto("/");
    await rellenar(page, datos);
    await page.getByRole("button", { name: "Crear contacto" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto creado");

    await expect(page.getByLabel("Nombre")).toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByLabel("Teléfono")).toHaveValue("");
    await expect(page.getByLabel("Cargo")).toHaveValue("");
    await expect(page.getByLabel("Notas")).toHaveValue("");

    const lista = await (await request.get("http://localhost:3001/api/contacts")).json();
    creados.push(lista.find((c) => c.email === datos.email)?.id);
  });

  test("el contador de la cabecera sube en uno tras un alta", async ({ page, request }) => {
    const datos = contacto();
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();
    const antes = await page.getByRole("article").count();

    await rellenar(page, datos);
    await page.getByRole("button", { name: "Crear contacto" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto creado");

    await expect(page.locator(".stat strong")).toHaveText(String(antes + 1));

    const lista = await (await request.get("http://localhost:3001/api/contacts")).json();
    creados.push(lista.find((c) => c.email === datos.email)?.id);
  });

  test("enviar el formulario vacío pinta los errores bajo cada campo obligatorio", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByText("El nombre es obligatorio")).toBeVisible();
    await expect(page.getByText("El email es obligatorio")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Revisa los campos del formulario");
  });

  test("un email mal formado se señala bajo su campo y no crea nada", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();
    const antes = await page.getByRole("article").count();

    await rellenar(page, { nombre: "E2E Email Roto", email: "no-es-un-email" });
    await page.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByText("Escribe un email válido")).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(antes);
  });

  test("un teléfono inválido se señala sin bloquear el resto del formulario", async ({ page }) => {
    await page.goto("/");
    await rellenar(page, { ...contacto(), telefono: "llámame" });
    await page.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByText("Usa un teléfono con dígitos, espacios o +")).toBeVisible();
  });

  test("un email repetido devuelve el 409 bajo el campo email", async ({ page, request }) => {
    const existente = await crearPorApi(request);
    creados.push(existente.id);

    await page.goto("/");
    await rellenar(page, { nombre: "E2E Duplicado", email: existente.email.toUpperCase() });
    await page.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByText("Ese email ya está registrado")).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Ya existe un contacto con ese email");
  });

  test("corregir el campo borra su error sin tener que reenviar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Crear contacto" }).click();
    await expect(page.getByText("El nombre es obligatorio")).toBeVisible();

    await page.getByLabel("Nombre").fill("E2E Ya Corregido");

    await expect(page.getByText("El nombre es obligatorio")).toHaveCount(0);
  });

  test("los campos opcionales pueden quedar vacíos", async ({ page, request }) => {
    const datos = contacto();
    await page.goto("/");
    await page.getByLabel("Nombre").fill(datos.nombre);
    await page.getByLabel("Email").fill(datos.email);
    await page.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByRole("status")).toHaveText("Contacto creado");
    await expect(page.getByRole("article").filter({ hasText: datos.nombre })).toBeVisible();

    const lista = await (await request.get("http://localhost:3001/api/contacts")).json();
    creados.push(lista.find((c) => c.email === datos.email)?.id);
  });

  test("el email se guarda normalizado en minúsculas", async ({ page, request }) => {
    const datos = contacto();
    await page.goto("/");
    await rellenar(page, { ...datos, email: datos.email.toUpperCase() });
    await page.getByRole("button", { name: "Crear contacto" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto creado");

    await expect(
      page.getByRole("article").filter({ hasText: datos.email.toLowerCase() }),
    ).toBeVisible();

    const lista = await (await request.get("http://localhost:3001/api/contacts")).json();
    creados.push(lista.find((c) => c.email === datos.email)?.id);
  });
});
