/**
 * CU-01 · Consultar el directorio.
 *
 * Disparador: abrir la app. Al montar, App.jsx llama a listContacts() y pinta
 * las tarjetas ordenadas por nombre. El contador de la cabecera muestra el
 * total SIN filtrar.
 *
 * Los locators salen del árbol de accesibilidad real de la app: roles y
 * etiquetas, nunca clases CSS.
 */
import { expect, test } from "@playwright/test";
import { borrarPorApi, crearPorApi, limpiarRestos } from "../fixtures/datos.js";

test.describe("CU-01 · Consultar el directorio", () => {
  let creado;

  test.beforeEach(async ({ request }) => {
    test.info().annotations.push({ type: "CU", description: "CU-01" });
    creado = await crearPorApi(request);
  });

  test.afterEach(async ({ request }) => {
    await borrarPorApi(request, creado?.id);
  });

  test.afterAll(async ({ request }) => {
    await limpiarRestos(request);
  });

  test("al abrir la app se ve el directorio con sus fichas", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Directorio de contactos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Directorio", exact: true })).toBeVisible();
    // Hay al menos la ficha que sembró esta prueba.
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("cada ficha muestra nombre, email y cargo", async ({ page }) => {
    await page.goto("/");

    const ficha = page.getByRole("article").filter({ hasText: creado.nombre });

    await expect(ficha).toBeVisible();
    await expect(ficha).toContainText(creado.email);
    await expect(ficha).toContainText(creado.cargo);
  });

  test("cada ficha ofrece los botones de editar y eliminar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: `Editar ${creado.nombre}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Eliminar ${creado.nombre}` })).toBeVisible();
  });

  test("el contador de la cabecera coincide con el número de fichas visibles", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();

    const fichas = await page.getByRole("article").count();
    const cabecera = page.locator(".stat strong");

    await expect(cabecera).toHaveText(String(fichas));
  });

  test("el contador usa singular o plural según corresponda", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();

    const fichas = await page.getByRole("article").count();
    const etiqueta = fichas === 1 ? "ficha activa" : "fichas activas";

    await expect(page.locator(".stat")).toContainText(etiqueta);
  });

  test("las fichas llegan ordenadas por nombre, como las sirve la API", async ({ page, request }) => {
    const respuesta = await request.get("http://localhost:3001/api/contacts");
    const esperado = (await respuesta.json()).map((c) => c.nombre);

    await page.goto("/");
    await expect(page.getByRole("article").first()).toBeVisible();

    const enPantalla = await page
      .getByRole("article")
      .locator(".card-body strong")
      .allTextContents();

    expect(enPantalla).toEqual(esperado);
  });
});
