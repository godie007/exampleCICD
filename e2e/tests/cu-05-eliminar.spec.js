/**
 * CU-05 · Eliminar un contacto.
 *
 * La papelera no borra: marca pendingDelete y abre un modal de confirmación.
 * Confirmar → DELETE → 204 → re-lista → toast.
 *
 * Regla fina del vault: si se estaba editando justo a esa persona, la edición
 * se cancela sola para no dejar el formulario apuntando a un registro muerto.
 */
import { expect, test } from "@playwright/test";
import { borrarPorApi, crearPorApi, limpiarRestos } from "../fixtures/datos.js";

test.describe("CU-05 · Eliminar un contacto", () => {
  let ficha;

  test.beforeEach(async ({ request }) => {
    test.info().annotations.push({ type: "CU", description: "CU-05" });
    ficha = await crearPorApi(request);
  });

  test.afterEach(async ({ request }) => {
    // Idempotente: si la prueba ya la borró, el 404 se ignora.
    await borrarPorApi(request, ficha?.id);
  });

  test.afterAll(async ({ request }) => {
    await limpiarRestos(request);
  });

  test("la papelera no borra: primero pide confirmación", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Eliminar ${ficha.nombre}` }).click();

    const modal = page.getByRole("dialog");

    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { name: "Eliminar ficha" })).toBeVisible();
    await expect(modal).toContainText(`¿Quitar a ${ficha.nombre} del directorio?`);
    await expect(modal).toContainText("Esta acción no se puede deshacer.");
    // La ficha sigue ahí mientras el modal está abierto.
    await expect(page.getByRole("article").filter({ hasText: ficha.nombre })).toBeVisible();
  });

  test("el modal se anuncia como diálogo modal a la tecnología asistiva", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Eliminar ${ficha.nombre}` }).click();

    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  test("cancelar cierra el modal y no borra nada", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Eliminar ${ficha.nombre}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("article").filter({ hasText: ficha.nombre })).toBeVisible();
  });

  test("confirmar borra la ficha y lo anuncia", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Eliminar ${ficha.nombre}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();

    await expect(page.getByRole("status")).toHaveText("Contacto eliminado");
    await expect(page.getByRole("article").filter({ hasText: ficha.nombre })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("el contador de la cabecera baja en uno tras borrar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();
    const antes = await page.getByRole("article").count();

    await page.getByRole("button", { name: `Eliminar ${ficha.nombre}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto eliminado");

    await expect(page.locator(".stat strong")).toHaveText(String(antes - 1));
  });

  test("la baja persiste: sigue sin estar tras recargar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Eliminar ${ficha.nombre}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto eliminado");

    await page.reload();

    await expect(page.getByRole("article").filter({ hasText: ficha.nombre })).toHaveCount(0);
  });

  test("borrar a quien se estaba editando cancela la edición sola", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await expect(page.getByRole("heading", { name: `Editar a ${ficha.nombre}` })).toBeVisible();

    await page.getByRole("button", { name: `Eliminar ${ficha.nombre}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto eliminado");

    // El formulario no puede quedar apuntando a un registro muerto.
    await expect(page.getByRole("heading", { name: "Nueva ficha" })).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("");
  });

  test("borrar a otra persona no saca del modo edición", async ({ page, request }) => {
    const otra = await crearPorApi(request);

    await page.goto("/");
    await page.getByRole("button", { name: `Editar ${ficha.nombre}` }).click();
    await page.getByRole("button", { name: `Eliminar ${otra.nombre}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByRole("status")).toHaveText("Contacto eliminado");

    await expect(page.getByRole("heading", { name: `Editar a ${ficha.nombre}` })).toBeVisible();

    await borrarPorApi(request, otra.id);
  });
});
