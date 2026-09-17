# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

Requiere **Node.js 22.5+** (por `node:sqlite`). Son dos proyectos npm independientes; no hay workspace raíz, así que `npm install` se corre en cada carpeta.

```bash
# API en http://localhost:3001
cd backend && npm install && npm run dev    # node --watch; npm start para sin watch

# UI en http://localhost:5173
cd frontend && npm install && npm run dev   # npm run build / npm run preview
```

Ambos deben estar corriendo: Vite proxea `/api` → `localhost:3001`.

No hay linter configurado en el repo.

### Pruebas

Tres capas, todas en español. Desde la raíz:

```bash
npm run instalar     # dependencias de los tres proyectos
npm test             # las tres capas en orden: unitarias → integración → e2e
npm run test:unit    # backend con el driver node:sqlite falseado
npm run test:int     # backend contra SQLite real en archivo temporal
npm run test:e2e     # Playwright sobre la app viva (levanta backend y frontend solo)
npm run reporte      # e2e/REGISTRO.md: trazabilidad caso de uso → prueba → estado
```

- **Unitarias** (`backend/tests/*.test.js`) — falsean `node:sqlite` (`tests/helpers/fake-sqlite.js`) para que `db.js` y `contacts.js` corran sin tocar disco. Cobertura 100% de `contacts.js`, `validate.js` y `db.js`; `index.js` queda a 0% porque llama a `app.listen()` al importarse.
- **Integración** (`backend/tests/*.int.test.js`) — driver real, ubicación redirigida a un archivo temporal subclasando `DatabaseSync` (`tests/helpers/real-sqlite.js`). **Nunca deben tocar `backend/data/archivo.db`.**
- **E2E** (`e2e/`, Playwright) — un spec por caso de uso del vault (CU-01…CU-06). Locators **por rol y etiqueta**, nunca por clases CSS; el frontend no tiene ni necesita `data-testid`. Estas sí escriben en la base de desarrollo, así que cada prueba crea sus datos con email único y los borra por API.

CI en `.github/workflows/ci.yml`: un job de backend (unitarias, integración y cobertura) y otro de e2e que solo corre si el primero pasa. Ambos publican sus reportes como artefactos.

## Arquitectura

Dos apps separadas (`backend/`, `frontend/`) que solo se comunican por la API REST `/api/contacts` (+ `/api/health`). El recurso único es *contacto*: `nombre`, `email` (único), `telefono`, `cargo`, `notas`.

**Backend** — Express 4 + `node:sqlite` (`DatabaseSync`, síncrono, sin driver externo):
- `src/db.js` es un módulo con efectos secundarios al importarse: crea `backend/data/`, abre la DB, ejecuta el `CREATE TABLE IF NOT EXISTS` y siembra 4 contactos si la tabla está vacía. Exporta `db` y `mapContact` (row snake_case → JSON camelCase, nulls → `""`). Cualquier cambio de esquema se hace aquí; no hay sistema de migraciones, así que para reconstruir hay que borrar `backend/data/archivo.db` (está en `.gitignore`).
- `src/contacts.js` prepara los statements **una sola vez a nivel de módulo** y los reutiliza. Conflictos de email único se detectan por texto del mensaje de error (`isUniqueConflict`) y devuelven 409.
- `src/validate.js` centraliza toda la validación y además normaliza (trim, email a minúsculas). Devuelve `{ ok, errors, value }`; las rutas siempre persisten `value`, nunca `req.body` crudo.
- Contrato de error: `{ error: "mensaje", errors: { campo: "mensaje" } }`. 400 validación, 404 no encontrado, 409 email duplicado, 500 genérico desde el handler final de `src/index.js`.
- CORS está restringido a `localhost:5173` / `127.0.0.1:5173`.

**Frontend** — React 19 + Vite, sin router ni librería de estado:
- `src/api.js` es la única capa que hace `fetch`; traduce las respuestas de error en un `Error` con la propiedad `.errors` (mapa campo→mensaje) para que la UI la ponga directo en el formulario.
- `src/App.jsx` concentra todo el estado (lista, formulario, edición, borrado pendiente, toast). `ContactForm` y `ContactList` son componentes presentacionales controlados por props.
- El mismo formulario sirve para crear y editar: `editing` (el contacto o `null`) decide el modo, y `cancelEdit()` es el reset. Tras cada mutación se hace `refresh()` (relista desde la API) en vez de actualizar el estado local.
- La búsqueda filtra en cliente sobre nombre/email/cargo.
- Los estilos son CSS plano en `src/index.css`; las clases `liquid-glass`, `panel`, `card`, `toast` son el sistema visual existente — reutilizarlas antes de inventar nuevas.

Los mensajes de UI y de la API están en español; mantener ese idioma al agregar texto visible.
