/**
 * CU-02 · Buscar un contacto.
 *
 * El filtrado es EN CLIENTE (useMemo sobre nombre + email + cargo), sin
 * distinguir mayúsculas y sin ninguna petición de red. Esa última garantía es
 * la que más fácil se rompe en un refactor —basta con mover el filtro al
 * backend— y aquí se prueba interceptando la red, no suponiéndola.
 *
 * Límite conocido del vault: no busca en telefono ni en notas.
 */
import { expect, test } from "@playwright/test";
import { borrarPorApi, crearPorApi, limpiarRestos } from "../fixtures/datos.js";

test.describe("CU-02 · Buscar un contacto", () => {
  let ana;
  let beto;

  test.beforeEach(async ({ request }) => {
    test.info().annotations.push({ type: "CU", description: "CU-02" });
    ana = await crearPorApi(request, {
      nombre: `E2E Ana Buscadora ${Date.now()}`,
      email: `e2e.ana.${Date.now()}@halcyn.co`,
      telefono: "+57 300 555 1111",
      cargo: "Arquitecta de datos",
      notas: "Nota exclusiva de Ana",
    });
    beto = await crearPorApi(request, {
      nombre: `E2E Beto Filtrado ${Date.now()}`,
      email: `e2e.beto.${Date.now()}@otrodominio.co`,
      telefono: "+57 300 555 2222",
      cargo: "Soporte",
      notas: "Nota exclusiva de Beto",
    });
  });

  test.afterEach(async ({ request }) => {
    await borrarPorApi(request, ana?.id);
    await borrarPorApi(request, beto?.id);
  });

  test.afterAll(async ({ request }) => {
    await limpiarRestos(request);
  });

  test("buscar por nombre deja solo las fichas que coinciden", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar contactos").fill("Ana Buscadora");

    await expect(page.getByRole("article").filter({ hasText: ana.nombre })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: beto.nombre })).toHaveCount(0);
  });

  test("buscar por email también filtra", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar contactos").fill("otrodominio.co");

    await expect(page.getByRole("article").filter({ hasText: beto.nombre })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: ana.nombre })).toHaveCount(0);
  });

  test("buscar por cargo también filtra", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar contactos").fill("Arquitecta de datos");

    await expect(page.getByRole("article").filter({ hasText: ana.nombre })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: beto.nombre })).toHaveCount(0);
  });

  test("la búsqueda no distingue mayúsculas", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar contactos").fill("ARQUITECTA DE DATOS");

    await expect(page.getByRole("article").filter({ hasText: ana.nombre })).toBeVisible();
  });

  test("sin coincidencias se explica, no se deja la lista en blanco", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar contactos").fill("zzzz-no-existe-nadie-zzzz");

    await expect(page.getByText("Nadie coincide con esa búsqueda.")).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test("borrar la búsqueda restaura el directorio completo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();
    const total = await page.getByRole("article").count();

    const buscador = page.getByLabel("Buscar contactos");
    await buscador.fill("Ana Buscadora");
    await expect(page.getByRole("article")).toHaveCount(1);

    await buscador.fill("");
    await expect(page.getByRole("article")).toHaveCount(total);
  });

  test("el filtrado no dispara ni una sola petición a la API", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();

    // Se cuenta a partir de aquí: la carga inicial ya ocurrió.
    const peticiones = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/")) peticiones.push(req.url());
    });

    const buscador = page.getByLabel("Buscar contactos");
    await buscador.fill("Ana");
    await buscador.fill("Ana Busc");
    await buscador.fill("Ana Buscadora");
    await expect(page.getByRole("article").filter({ hasText: ana.nombre })).toBeVisible();

    expect(peticiones).toEqual([]);
  });

  test("el buscador no mira las notas: es un límite conocido, no un bug", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Buscar contactos").fill("Nota exclusiva de Ana");

    // Documentado en Casos de uso (CU-02): filtra nombre + email + cargo.
    await expect(page.getByText("Nadie coincide con esa búsqueda.")).toBeVisible();
  });
});
