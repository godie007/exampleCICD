---
name: pruebas-jest-backend
description: Escribe y ejecuta pruebas unitarias Jest para el backend de este repo (Express 4 + node:sqlite, ESM nativo, español). Úsala siempre que se pidan tests, pruebas unitarias, cobertura, "testea esta ruta", "agrega pruebas a contacts.js / validate.js / db.js", o cuando se modifique código en backend/src/ y convenga respaldarlo con tests. Úsala también si alguien pregunta cómo correr los tests del backend, por qué fallan, o cómo mockear la base de datos — aunque no diga la palabra "Jest".
---

# Pruebas Jest del backend

Este backend tiene una particularidad que rompe el testing ingenuo: **`db.js` hace su trabajo al importarse** (crea `data/`, abre SQLite, `CREATE TABLE`, siembra 4 contactos) y **`contacts.js` prepara sus cinco statements al importarse** (ADR-004). Importar cualquier módulo de `src/` toca disco. Esta skill existe para resolver eso de una vez y no reinventarlo en cada test.

## Antes de escribir

1. **Consulta el vault de Obsidian** (`mcp__obsidian__search_simple` / `vault_read`). La nota del componente y su ADR dicen qué garantiza el código y qué es deuda técnica asumida — de ahí salen los mejores casos de prueba. Para el router: `03-Componentes/Módulo contacts.md`, `02-Arquitectura/ADR/ADR-004…`, `02-Arquitectura/Contrato de errores.md`.
2. **Lee el código real** de la unidad bajo prueba. No pruebes lo que crees que hace.

## La decisión de diseño: falsear el driver, no `db.js`

Mockear `../src/db.js` entero obliga a reimplementar `mapContact` dentro del test — y un test que copia la lógica de producción no prueba nada. En cambio, falsear `node:sqlite` deja correr el **código real** de `db.js` y `contacts.js` sin tocar disco:

```js
import { jest } from "@jest/globals";
import { createFakeSqlite } from "./helpers/fake-sqlite.js";

const sqlite = createFakeSqlite();

jest.unstable_mockModule("node:sqlite", () => ({
  DatabaseSync: sqlite.DatabaseSync,
  default: { DatabaseSync: sqlite.DatabaseSync },
}));

// El import dinámico va DESPUÉS del mock: con ESM, un `import` estático
// se resuelve antes de que corra cualquier línea del archivo.
const { contactsRouter } = await import("../src/contacts.js");
```

El helper vive en `backend/tests/helpers/fake-sqlite.js`. Si no existe, cópialo de `assets/fake-sqlite.js` de esta skill. Responde `{ total: 4 }` al conteo de siembra para que la siembra nunca corra en tests, y registra cada `prepare()` para poder afirmar sobre el SQL.

Toma el statement por su SQL, no por posición — el orden de preparación cambia si alguien reordena el módulo:

```js
const LIST_SQL = /ORDER BY nombre COLLATE NOCASE ASC/i;
const listStmt = sqlite.stmtFor(LIST_SQL);   // falla ruidosamente si hay 0 o >1
```

## La app de prueba

`src/index.js` llama a `app.listen()` al importarse, así que no se usa. Reprodúcela mínima, **con el handler de error final**: sin él, un fallo del driver devuelve el HTML de error de Express en vez del 500 del [[Contrato de errores]], y el test de errores miente.

```js
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/contacts", contactsRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: "Error interno del servidor" });
  });
  return app;
}
```

Las peticiones se hacen con `supertest` sobre esa app; nunca se levanta un puerto.

## Qué probar en una ruta

Recorre estos cinco frentes. No todos aplican siempre, pero saltarse uno debe ser una decisión, no un olvido:

1. **Contrato SQL y statements** — que el SQL diga lo que la nota promete (`ORDER BY nombre COLLATE NOCASE`, `WHERE id = ?`), que se prepare **una sola vez** al cargar el módulo y no se re-prepare entre peticiones (ADR-004), y que los parámetros vayan vinculados con `?` sin interpolación (Seguridad).
2. **Respuesta feliz** — código, `content-type`, forma exacta del cuerpo. Afirma las **claves exactas** con `Object.keys(...).sort()`: así el test detecta si un día se filtra `created_at` crudo o una columna nueva que no debía salir.
3. **Normalización** — `mapContact` convierte `null` en `""` en telefono/cargo/notas; nombre y email salen tal cual. Comprueba además que no muta la fila que entrega el driver.
4. **Casos borde** — vacío (¿`[]` con 200 o 404?), volumen grande, entradas que la ruta debe ignorar (query string, body de más), barra final, y cuántas veces exactamente se consulta la base.
5. **Errores** — el contrato `{ error, errors? }` con su código (400/404/409/500), y que un 500 **no filtre** el mensaje del driver ni rutas de disco. Verifica también que un fallo puntual no deja la ruta rota para la siguiente petición.

Para los detalles propios de `POST` / `PUT` / `DELETE` (el 409 por email duplicado, releer después de escribir, existencia antes que validación), lee `references/rutas-de-escritura.md`.

## Estilo

- **Todo en español**: nombres de `describe`/`test`, comentarios y datos de ejemplo. Es el idioma del repo y de la API.
- El nombre del test dice **la garantía, no la mecánica**: `"tabla vacía devuelve [] con 200, no 404"` enseña más que `"debería funcionar con array vacío"`.
- Agrupa con `describe` por frente (contrato SQL / respuesta / normalización / borde / errores). El reporte de Jest se vuelve documentación legible de la ruta.
- Una fábrica `row(overrides)` para las filas crudas en snake_case: los tests declaran solo lo que les importa.
- En `beforeEach`: `mockReset()` del statement, valor por defecto, y app nueva. Ningún test debe depender del anterior.
- Comenta el **porqué** donde el código sorprende (el import dinámico, el `{ total: 4 }`, por qué no se usa `index.js`). Lo obvio no se comenta.

## Correr y verificar

```bash
cd backend && npm test              # suite completa
npm test -- contacts.list           # un archivo
npm run test:coverage               # reporte de cobertura
```

Si el proyecto aún no tiene Jest: `npm install --save-dev jest supertest`, `jest.config.js` con `transform: {}` y `testEnvironment: "node"`, y los scripts con `node --experimental-vm-modules --experimental-sqlite node_modules/jest/bin/jest.js`. El flag de VM Modules no es opcional: sin él, `jest.unstable_mockModule` no funciona. El `ExperimentalWarning` que imprime Node es esperado.

**Antes de dar la suite por buena, prueba que no es vacua.** Una suite verde solo demuestra algo si también sabe ponerse roja:

```bash
cp src/contacts.js /tmp/contacts.bak.js
# rompe algo que la suite debería ver, p. ej. reordenar en JS:
sed -i '' 's|listStmt.all().map(mapContact)|listStmt.all().map(mapContact).sort((a, b) => a.nombre.localeCompare(b.nombre))|' src/contacts.js
npm test 2>&1 | grep -E "✕|Tests:"
cp /tmp/contacts.bak.js src/contacts.js && git diff --stat src/   # debe salir vacío
```

Lo que buscas es que falle **exactamente** el test que cubre esa garantía y ninguno más. Si no falla ninguno, ese frente no está cubierto; si fallan diez, los tests están acoplados entre sí. Restaura siempre el código y confirma con `git diff` antes de reportar.

Al terminar, informa números reales (`Tests: N passed`) y qué queda fuera de cobertura. Si el vault tiene una nota afectada —`01-Negocio/Roadmap y backlog.md` registra "no hay tests" como pendiente #1— menciónalo y ofrece actualizarla.
