const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\s().-]{7,24}$/;

function trim(value) {
  return String(value ?? "").trim();
}

export function validateContact(body) {
  const errors = {};
  const nombre = trim(body.nombre);
  const email = trim(body.email).toLowerCase();
  const telefono = trim(body.telefono);
  const cargo = trim(body.cargo);
  const notas = trim(body.notas);

  if (!nombre) errors.nombre = "El nombre es obligatorio";
  else if (nombre.length > 80) errors.nombre = "Máximo 80 caracteres";

  if (!email) errors.email = "El email es obligatorio";
  else if (!EMAIL_RE.test(email)) errors.email = "Escribe un email válido";
  else if (email.length > 120) errors.email = "Máximo 120 caracteres";

  if (telefono && !PHONE_RE.test(telefono)) {
    errors.telefono = "Usa un teléfono con dígitos, espacios o +";
  }

  if (cargo.length > 80) errors.cargo = "Máximo 80 caracteres";
  if (notas.length > 280) errors.notas = "Máximo 280 caracteres";

  return {
    errors,
    value: { nombre, email, telefono, cargo, notas },
    ok: Object.keys(errors).length === 0,
  };
}
