# Archivo — CRUD React + Node + SQLite

Formulario de contactos con **frontend y backend separados**.

| Carpeta | Stack |
|---------|--------|
| `frontend/` | React 19 + Vite |
| `backend/` | Node.js + Express + SQLite (`node:sqlite`) |

## API

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` | `/api/health` | Estado del servidor |
| `GET` | `/api/contacts` | Listar |
| `GET` | `/api/contacts/:id` | Obtener uno |
| `POST` | `/api/contacts` | Crear |
| `PUT` | `/api/contacts/:id` | Actualizar |
| `DELETE` | `/api/contacts/:id` | Eliminar |

Campos: `nombre`, `email`, `telefono`, `cargo`, `notas`. El email es único.

## Cómo correrlo

Necesitas **Node.js 22.5+**. Abre dos terminales.

```bash
# terminal 1 — API en http://localhost:3001
cd backend
npm install
npm run dev
```

```bash
# terminal 2 — UI en http://localhost:5173
cd frontend
npm install
npm run dev
```

Vite reenvía `/api` al backend, así que el navegador solo habla con el puerto 5173.

La base queda en `backend/data/archivo.db` y se crea sola (con 4 contactos de ejemplo) la primera vez.

## Pruebas

251 pruebas en tres capas. Desde la raíz del repo:

```bash
npm run instalar     # dependencias de los tres proyectos
npm test             # las tres capas en orden: unitarias → integración → e2e
```

| Capa | Dónde | Qué prueba | Comando |
|---|---|---|---|
| **Unitarias** (183) | `backend/tests/*.test.js` | que el código llama bien a la base, con el driver `node:sqlite` falseado | `npm run test:unit` |
| **Integración** (19) | `backend/tests/*.int.test.js` | que la base hace lo que el código espera: orden real, `UNIQUE`, siembra | `npm run test:int` |
| **E2E** (49) | `e2e/tests/cu-0X-*.spec.js` | que la persona usuaria puede hacer su trabajo, en Chromium | `npm run test:e2e` |

Cobertura del backend: 100 % de `contacts.js`, `validate.js` y `db.js`. `index.js` queda sin cubrir porque llama a `app.listen()` al importarse.

Las e2e usan **un archivo por caso de uso** (CU-01 a CU-06) y localizan por rol y etiqueta accesible, nunca por clases CSS: el frontend no tiene ni necesita `data-testid`. `npm run reporte` genera `e2e/REGISTRO.md`, la tabla trazable *caso de uso → prueba → estado → evidencia*.

> Dos avisos sobre el aislamiento. Las pruebas de **integración** nunca tocan `backend/data/archivo.db`: abren una base real en un archivo temporal. Las **e2e** sí escriben en ella, así que cada prueba crea sus datos con email único y los borra al terminar.

## CI

`.github/workflows/ci.yml` corre en cada push y en cada PR contra `main`:

- **Job `backend`** — unitarias, integración y cobertura.
- **Job `e2e`** — solo si el anterior pasa: levanta las dos apps y corre Playwright sobre Chromium.

Ambos publican sus reportes como artefactos, y el registro de pruebas se vuelca en el resumen de la corrida.
