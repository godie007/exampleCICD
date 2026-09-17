const API = "/api/contacts";

async function parseError(res) {
  try {
    const data = await res.json();
    const error = new Error(data.error || "La petición falló");
    error.errors = data.errors || {};
    throw error;
  } catch (error) {
    if (error.errors) throw error;
    throw new Error("La petición falló");
  }
}

export async function listContacts() {
  const res = await fetch(API);
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function createContact(payload) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function updateContact(id, payload) {
  const res = await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function deleteContact(id) {
  const res = await fetch(`${API}/${id}`, { method: "DELETE" });
  if (!res.ok) return parseError(res);
}
