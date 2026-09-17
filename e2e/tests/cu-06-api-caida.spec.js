/**
 * CU-06 · Detectar que la API no responde.
 *
 * Es el fallo más frecuente en desarrollo: levantar solo una de las dos apps.
 * La UI debe explicarlo, no quedarse en blanco.
 *
 * La caída se simula interceptando la red con page.route(), NUNCA apagando el
 * backend de verdad: apagarlo rompería las demás pruebas de la corrida.
 */
import { expect, test } from "@playwright/test";
import { borrarPorApi, contacto, crearPorApi, limpiarRestos } from "../fixtures/datos.js";

test.describe("CU-06 · Detectar que la API no responde", () => {
  test.beforeEach(async () => {
    test.info().annotations.push({ type: "CU", description: "CU-06" });
  });

  test.afterAll(async ({ request }) => {
    await limpiarRestos(request);
  });

  test("si el primer GET falla se explica el problema en un banner", async ({ page }) => {
    await page.route("**/api/contacts", (route) => route.abort("failed"));
    await page.goto("/");

    const banner = page.getByRole("alert");

    await expect(banner).toBeVisible();
    await expect(banner).toContainText("¿Está corriendo el backend en el puerto 3001?");
  });

  test("el banner ofrece reintentar", async ({ page }) => {
    await page.route("**/api/contacts", (route) => route.abort("failed"));
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  test("con la API caída no se queda cargando para siempre", async ({ page }) => {
    await page.route("**/api/contacts", (route) => route.abort("failed"));
    await page.goto("/");

    await expect(page.getByRole("alert")).toBeVisible();
    // El esqueleto de carga desaparece aunque la petición haya fallado.
    await expect(page.locator(".skeleton")).toHaveCount(0);
  });

  test("Reintentar recarga y, con la API de vuelta, el directorio se pinta", async ({
    page,
    request,
  }) => {
    const ficha = await crearPorApi(request);

    // Solo la primera carga falla; al recargar, la ruta ya no está interceptada.
    await page.route("**/api/contacts", (route) => route.abort("failed"));
    await page.goto("/");
    await expect(page.getByRole("alert")).toBeVisible();

    await page.unroute("**/api/contacts");
    await page.getByRole("button", { name: "Reintentar" }).click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("article").filter({ hasText: ficha.nombre })).toBeVisible();

    await borrarPorApi(request, ficha.id);
  });

  test("si la API cae al enviar el formulario, se avisa sin perder lo escrito", async ({ page }) => {
    const datos = contacto();
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();

    // La carga inicial funcionó; se corta la red justo antes de enviar.
    await page.route("**/api/contacts", (route) => route.abort("failed"));
    await page.getByLabel("Nombre").fill(datos.nombre);
    await page.getByLabel("Email").fill(datos.email);
    await page.getByRole("button", { name: "Crear contacto" }).click();

    await expect(page.getByRole("status")).toBeVisible();
    // Lo tecleado sigue en el formulario: no se pierde el trabajo.
    await expect(page.getByLabel("Nombre")).toHaveValue(datos.nombre);
    await expect(page.getByLabel("Email")).toHaveValue(datos.email);
  });

  test("un 500 del servidor se comunica con el mensaje del contrato de errores", async ({ page }) => {
    await page.route("**/api/contacts", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Error interno del servidor" }),
      }),
    );
    await page.goto("/");

    await expect(page.getByRole("alert")).toContainText("Error interno del servidor");
  });
});
