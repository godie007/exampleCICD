import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "archivo.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefono TEXT,
    cargo TEXT,
    notas TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

const count = db.prepare("SELECT COUNT(*) AS total FROM contacts").get();

if (count.total === 0) {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO contacts (nombre, email, telefono, cargo, notas, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const seed = [
    [
      "Camila Herrera",
      "camila.herrera@halcyn.co",
      "+57 310 482 1190",
      "Product Manager",
      "Coordina el roadmap del directorio interno.",
    ],
    [
      "Mateo Rivas",
      "mateo.rivas@halcyn.co",
      "+57 315 204 8871",
      "Backend Engineer",
      "Dueño de la API y de la base SQLite.",
    ],
    [
      "Lucía Andrade",
      "lucia.andrade@halcyn.co",
      "+57 301 778 4420",
      "Diseño de producto",
      "Revisa copy y estados vacíos del formulario.",
    ],
    [
      "Andrés Pineda",
      "andres.pineda@halcyn.co",
      "+57 320 611 0934",
      "Operaciones",
      "Contacto para altas y bajas del equipo.",
    ],
  ];

  db.exec("BEGIN");
  for (const row of seed) {
    insert.run(...row, now, now);
  }
  db.exec("COMMIT");
}

export function mapContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    telefono: row.telefono ?? "",
    cargo: row.cargo ?? "",
    notas: row.notas ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
