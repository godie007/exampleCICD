/**
 * CU-04 · Editar un contacto.
 *
 * El lápiz copia el contacto al formulario, el panel pasa a "Editar a X" y la
 * tarjeta se marca activa. Guardar → PUT → re-lista → toast → sale del modo
 * edición. Cancelar descarta.
 *
 * Detalle del vault: el PUT es un reemplazo completo; los campos omitidos se
 * guardan vacíos. Hay un test que lo fija.
 */
import { expect, test } from "@playwright/test";
import { borrarPorApi, crearPorApi, limpiarRestos } from "../fixtures/datos.js";

test.describe("CU-04 · Editar un contacto", () => {
  let ficha;

  test.beforeEach(async ({ request }) => {
    test.info().annotations.push({ type: "CU", description: "CU-04" });
    ficha = await crearPorApi(request);
  });

  test.afterEach(async ({ request }) => {
    await borrarPorApi(request, ficha?.id);
  });

  test.afterAll(async ({ request }) => {
    await limpiarRestos(request);
  });

  test("el lápiz carga los valores del contacto en el formulario", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();

    await expect(page.getByLabel("Nombre")).toHaveValue(ficha.nombre);
    await expect(page.getByLabel("Email")).toHaveValue(ficha.email);
    await expect(page.getByLabel("Teléfono")).toHaveValue(ficha.telefono);
    await expect(page.getByLabel("Cargo")).toHaveValue(ficha.cargo);
    await expect(page.getByLabel("Notas")).toHaveValue(ficha.notas);
  });

  test("el panel anuncia a quién se está editando", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();

    await expect(page.getByRole("heading", { name: `Editar a ${ficha.nombre}` })).toBeVisible();
    await expect(page.getByText("Los cambios se guardan en SQLite al confirmar.")).toBeVisible();
  });

  test("en modo edición el botón cambia y aparece Cancelar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();

    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear contacto" })).toHaveCount(0);
  });

  test("la tarjeta que se edita queda marcada como activa", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();

    const tarjeta = page.getByRole("article").filter({ hasText: ficha.nombre });

    await expect(tarjeta).toHaveClass(/is-active/);
  });

  test("guardar los cambios los refleja en el directorio y avisa", async ({ page }) => {
    const nuevoCargo = "Cargo Editado E2E";
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await page.getByLabel("Cargo").fill(nuevoCargo);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByRole("status")).toHaveText("Contacto actualizado");
    await expect(page.getByRole("article").filter({ hasText: ficha.nombre })).toContainText(
      nuevoCargo,
    );
  });

  test("tras guardar se sale del modo edición", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await page.getByLabel("Cargo").fill("Otro cargo E2E");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto actualizado");

    await expect(page.getByRole("heading", { name: "Nueva ficha" })).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("");
  });

  test("cancelar descarta los cambios sin tocar la ficha", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await page.getByLabel("Cargo").fill("Este cargo no debe guardarse");
    await page.getByRole("button", { name: "Cancelar" }).click();

    await expect(page.getByRole("heading", { name: "Nueva ficha" })).toBeVisible();
    await expect(page.getByLabel("Cargo")).toHaveValue("");
    await expect(page.getByRole("article").filter({ hasText: ficha.nombre })).toContainText(
      ficha.cargo,
    );
  });

  test("editar valida igual que crear: un email roto se señala bajo su campo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await page.getByLabel("Email").fill("esto-no-es-un-email");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Escribe un email válido")).toBeVisible();
    // Sigue en modo edición: el fallo no expulsa del formulario.
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
  });

  test("usar el email de otra persona devuelve el 409 bajo el campo", async ({ page, request }) => {
    const otra = await crearPorApi(request);

    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await page.getByLabel("Email").fill(otra.email);
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("Ese email ya está registrado")).toBeVisible();

    await borrarPorApi(request, otra.id);
  });

  test("el PUT es un reemplazo completo: vaciar un campo lo deja vacío", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await page.getByLabel("Cargo").fill("");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto actualizado");

    const tarjeta = page.getByRole("article").filter({ hasText: ficha.nombre });

    await expect(tarjeta).not.toContainText(ficha.cargo);
  });
});
