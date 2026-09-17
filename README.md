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
