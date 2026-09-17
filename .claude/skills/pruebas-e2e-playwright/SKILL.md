---
name: pruebas-e2e-playwright
description: Escribe y ejecuta pruebas end-to-end con Playwright contra la app real del directorio Archivo (React 19 + Vite en localhost:5173 sobre la API en localhost:3001), y registra cada prueba de forma profesional contra los casos de uso del vault. Úsala cuando se pidan pruebas e2e, de UI, de navegador, Playwright, "prueba la interfaz", "valida el formulario en el navegador", "detecta los selectores", "prueba el flujo de crear/editar/eliminar contacto", cuando se toque frontend/src/ y convenga respaldarlo, o cuando alguien pregunte por el reporte de pruebas, la trazabilidad CU→prueba o por qué falla un test de UI. Para backend usa en cambio pruebas-jest-backend (unitarias) o pruebas-integracion-backend (integración).
---

# Pruebas end-to-end con Playwright

Las suites de backend prueban la API. Esta prueba **lo que ve y toca la persona usuaria**: el formulario, la lista, el modal, los toasts, el filtro en cliente. Corre las dos apps de verdad y un navegador de verdad.

Lo que solo esta capa demuestra: que el `label` está enlazado al input correcto, que el toast aparece y se va solo, que el modal bloquea antes de borrar, que la lista se re-lista tras cada mutación (ADR-003), y que el filtro de búsqueda no llama a la red.

## Antes de escribir

1. **Consulta el vault de Obsidian.** `01-Negocio/Casos de uso.md` es el índice maestro: define **CU-01 a CU-06** con su disparador, flujo, alternos y textos exactos. Cada prueba e2e se ancla a un CU — esa es la trazabilidad que hace el registro profesional. Complementan: `03-Componentes/ContactForm.md`, `03-Componentes/ContactList.md`, `03-Componentes/App estado.md`, `05-Diagramas/Estados de la UI.md`.
2. **Lee el código real** de `frontend/src/App.jsx` y sus componentes. Los textos visibles son parte del contrato: *"Contacto creado"*, *"Nadie coincide con esa búsqueda."*, *"¿Quitar a X del directorio?"*.
3. **Detecta los selectores en el navegador, no de memoria.** Levanta la app y toma una instantánea de accesibilidad antes de escribir un solo `locator`.

## Detectar selectores: el paso que no se salta

```bash
# ambas apps deben estar corriendo
cd backend && npm start &
cd frontend && npm run dev &
```

Con el navegador (servidor MCP de Playwright o `npx playwright codegen http://localhost:5173`), toma la instantánea del árbol de accesibilidad. Eso te da **el nombre accesible real** de cada control, que es lo que debes usar como locator.

Esta app ya es localizable por rol y **no necesita `data-testid`**:

| Elemento | Locator |
|---|---|
| Campos del formulario | `getByLabel("Nombre" \| "Email" \| "Teléfono" \| "Cargo" \| "Notas")` |
| Buscador | `getByLabel("Buscar contactos")` |
| Botón de alta / guardado | `getByRole("button", { name: "Crear contacto" \| "Guardar cambios" })` |
| Iconos de una tarjeta | `getByRole("button", { name: "Editar <nombre>" \| "Eliminar <nombre>" })` |
| Tarjetas del directorio | `getByRole("article")` |
| Modal de borrado | `getByRole("dialog")` |
| Toast | `getByRole("status")` |
| Banner de API caída | `getByRole("alert")` |

**No añadas `data-testid` al frontend para hacer pasar una prueba.** Si algo no es localizable por rol o etiqueta, eso es un **hallazgo de accesibilidad** que se reporta, no un atributo que se inventa. Prohibido también localizar por clases CSS (`.card`, `.toast`): son el sistema visual y cambian; los roles no.

## Aislamiento: la app corre contra la base de desarrollo

No hay base de pruebas. Las e2e escriben en `backend/data/archivo.db`, **la misma que usa quien desarrolla**. Dos reglas no negociables:

1. **Cada prueba crea sus propios datos y los borra al terminar**, con un email único por corrida (`fixtures/datos.js`). Nunca dependas de los contactos que ya estén.
2. **Nunca afirmes sobre el total absoluto** del directorio ("hay 4 fichas"). Afirma sobre *tu* contacto y sobre *deltas* (uno más, uno menos). Un total absoluto convierte tu prueba en rehén del estado ajeno.

La limpieza va por API (`request.delete`), no por la UI: es más rápida y no falla si la UI está rota — y una prueba que no limpia envenena a las siguientes.

## Qué probar: un archivo por caso de uso

Un `spec` por CU, nombrado `cu-0X-<slug>.spec.js`. Así el reporte se lee como la lista de casos de uso del vault, y una regresión señala el flujo de negocio afectado, no un archivo técnico.

- **CU-01 Consultar** — carga, tarjetas con nombre/email/cargo, contador de la cabecera, estado vacío.
- **CU-02 Buscar** — filtra por nombre, email y cargo sin distinguir mayúsculas; *"Nadie coincide con esa búsqueda."*; **cero peticiones de red** (es filtrado en cliente: pruébalo interceptando la red, no suponiéndolo).
- **CU-03 Crear** — alta feliz con toast y formulario limpio; 400 con errores bajo cada campo; 409 por email duplicado.
- **CU-04 Editar** — el lápiz carga los valores, el panel cambia a *"Editar a X"*, guardar re-lista, *Cancelar* descarta.
- **CU-05 Eliminar** — el modal aparece antes de borrar, cancelar no borra, confirmar borra y avisa.
- **CU-06 API caída** — banner *"¿Está corriendo el backend en el puerto 3001?"*. Se simula abortando `**/api/**` con `page.route`, nunca apagando el backend de verdad.

Cada `test()` lleva su anotación de trazabilidad:

```js
test("crea un contacto y lo anuncia con un toast", async ({ page }) => {
  test.info().annotations.push({ type: "CU", description: "CU-03" });
  ...
});
```

De ahí sale el registro. Sin anotación, la prueba no aparece trazada en el informe.

## Espera por estado, nunca por tiempo

`await page.waitForTimeout(...)` es una bomba de relojería: pasa en tu máquina y falla en CI. Espera por lo que la prueba afirma.

```js
await expect(page.getByRole("status")).toHaveText("Contacto creado");   // bien
await page.waitForTimeout(3000);                                       // nunca
```

Cuidado con el toast: vive **2,8 segundos** y se va solo. Aférralo con `expect` inmediatamente después de la acción; si necesitas comprobar que desaparece, usa `toBeHidden()` con su propio timeout, no un sleep.

## Registro profesional

`playwright.config.js` deja tres salidas en `e2e/reportes/`: `html/` (navegable, con traza y vídeo de los fallos), `junit.xml` (para CI) y `resultados.json` (crudo).

```bash
cd e2e && npm test          # corre todo
npm run reporte             # genera REGISTRO.md desde resultados.json
npm run ver-reporte         # abre el HTML
```

`npm run reporte` produce `e2e/REGISTRO.md`: una tabla **CU → prueba → estado → duración → evidencia**, con el resumen por caso de uso y los fallos detallados. Ese archivo es el entregable que se comparte; el HTML es para depurar.

En fallos se guarda automáticamente captura, vídeo y traza. La traza se abre con `npx playwright show-trace <ruta>` y permite recorrer la prueba paso a paso — antes de conjeturar por qué falló algo, ábrela.

## Estilo

- **Todo en español**: `describe`, `test`, comentarios y datos.
- El nombre dice **la garantía desde la persona usuaria**: `"cancelar en el modal no borra la ficha"` enseña; `"test del modal"` no.
- `describe` por caso de uso, con el código CU en el título.
- Datos de prueba reconocibles y únicos: prefijo `E2E` en el nombre y email con marca de tiempo.
- Comenta el **porqué** donde sorprenda: el toast efímero, la limpieza por API, el conteo de peticiones en CU-02.

## Antes de dar la suite por buena

1. **Que no es vacua.** Rompe algo en `frontend/src/` —por ejemplo, quita el `aria-label` del botón de borrar, o cambia el texto del toast— y comprueba que falla exactamente la prueba de esa garantía. Restaura y confirma con `git diff --stat frontend/src/`.
2. **Que no deja basura.** Tras la corrida, el directorio no debe tener contactos con prefijo `E2E`:
   ```bash
   curl -s http://localhost:3001/api/contacts | grep -c '"nombre":"E2E' || echo "limpio"
   ```
3. **Que es estable.** `npx playwright test --repeat-each=3`. Una prueba que falla una de cada tres veces es peor que no tenerla: enseña al equipo a ignorar el rojo.

Al terminar, informa números reales, el estado de cada CU, qué queda fuera y si algún texto de la UI ya no coincide con el vault — una nota desactualizada es un hallazgo tan válido como un bug.
