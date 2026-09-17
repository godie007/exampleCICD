import { Router } from "express";
import { db, mapContact } from "./db.js";
import { validateContact } from "./validate.js";

export const contactsRouter = Router();

const listStmt = db.prepare(
  "SELECT * FROM contacts ORDER BY nombre COLLATE NOCASE ASC",
);
const getStmt = db.prepare("SELECT * FROM contacts WHERE id = ?");
const insertStmt = db.prepare(`
  INSERT INTO contacts (nombre, email, telefono, cargo, notas, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateStmt = db.prepare(`
  UPDATE contacts
  SET nombre = ?, email = ?, telefono = ?, cargo = ?, notas = ?, updated_at = ?
  WHERE id = ?
`);
const deleteStmt = db.prepare("DELETE FROM contacts WHERE id = ?");

function sendValidation(res, errors) {
  return res.status(400).json({ error: "Revisa los campos del formulario", errors });
}

function isUniqueConflict(error) {
  return (
    typeof error?.message === "string" &&
    error.message.toLowerCase().includes("unique")
  );
}

contactsRouter.get("/", (_req, res) => {
  res.json(listStmt.all().map(mapContact));
});

contactsRouter.get("/:id", (req, res) => {
  const contact = mapContact(getStmt.get(Number(req.params.id)));
  if (!contact) {
    return res.status(404).json({ error: "Contacto no encontrado" });
  }
  res.json(contact);
});

contactsRouter.post("/", (req, res) => {
  const { ok, errors, value } = validateContact(req.body);
  if (!ok) return sendValidation(res, errors);

  const now = new Date().toISOString();

  try {
    const result = insertStmt.run(
      value.nombre,
      value.email,
      value.telefono,
      value.cargo,
      value.notas,
      now,
      now,
    );
    const created = mapContact(getStmt.get(Number(result.lastInsertRowid)));
    res.status(201).json(created);
  } catch (error) {
    if (isUniqueConflict(error)) {
      return res.status(409).json({
        error: "Ya existe un contacto con ese email",
        errors: { email: "Ese email ya está registrado" },
      });
    }
    throw error;
  }
});

contactsRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = getStmt.get(id);
  if (!existing) {
    return res.status(404).json({ error: "Contacto no encontrado" });
  }

  const { ok, errors, value } = validateContact(req.body);
  if (!ok) return sendValidation(res, errors);

  try {
    updateStmt.run(
      value.nombre,
      value.email,
      value.telefono,
      value.cargo,
      value.notas,
      new Date().toISOString(),
      id,
    );
    res.json(mapContact(getStmt.get(id)));
  } catch (error) {
    if (isUniqueConflict(error)) {
      return res.status(409).json({
        error: "Ya existe un contacto con ese email",
        errors: { email: "Ese email ya está registrado" },
      });
    }
    throw error;
  }
});

contactsRouter.delete("/:id", (req, res) => {
  const result = deleteStmt.run(Number(req.params.id));
  if (result.changes === 0) {
    return res.status(404).json({ error: "Contacto no encontrado" });
  }
  res.status(204).end();
});
