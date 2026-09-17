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

No hay tests, linter ni pipeline de CI configurados en el repo.

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
