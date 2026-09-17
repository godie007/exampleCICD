import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de las pruebas end-to-end del directorio Archivo.
 *
 * Levanta las DOS apps por su cuenta (`webServer`): sin backend no hay datos y
 * sin frontend no hay UI. Si ya están corriendo, las reutiliza en local.
 *
 * Tres salidas en `reportes/`: html/ para depurar, junit.xml para CI y
 * resultados.json, del que `npm run reporte` genera REGISTRO.md.
 */
export default defineConfig({
  testDir: "./tests",
  outputDir: "./reportes/artefactos",

  // Las e2e escriben en la base de desarrollo compartida: en paralelo se
  // pisarían entre ellas. Serie, y una sola réplica.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "reportes/html", open: "never" }],
    ["junit", { outputFile: "reportes/junit.xml" }],
    ["json", { outputFile: "reportes/resultados.json" }],
  ],

  use: {
    baseURL: "http://localhost:5173",
    // Evidencia solo cuando hace falta: verde no deja basura, rojo deja todo.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "npm start",
      cwd: "../backend",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      cwd: "../frontend",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
