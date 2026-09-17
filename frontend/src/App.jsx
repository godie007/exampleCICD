import { useEffect, useMemo, useState } from "react";
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from "./api.js";
import ContactForm from "./components/ContactForm.jsx";
import ContactList from "./components/ContactList.jsx";

const EMPTY = {
  nombre: "",
  email: "",
  telefono: "",
  cargo: "",
  notas: "",
};

export default function App() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast, setToast] = useState(null);

  async function refresh() {
    const data = await listContacts();
    setContacts(data);
  }

  useEffect(() => {
    listContacts()
      .then(setContacts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((contact) =>
      [contact.nombre, contact.email, contact.cargo]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [contacts, query]);

  function showToast(message, tone = "ok") {
    setToast({ message, tone });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function startEdit(contact) {
    setEditing(contact);
    setValues({
      nombre: contact.nombre,
      email: contact.email,
      telefono: contact.telefono,
      cargo: contact.cargo,
      notas: contact.notas,
    });
    setErrors({});
  }

  function cancelEdit() {
    setEditing(null);
    setValues(EMPTY);
    setErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      if (editing) {
        await updateContact(editing.id, values);
        showToast("Contacto actualizado");
      } else {
        await createContact(values);
        showToast("Contacto creado");
      }
      await refresh();
      cancelEdit();
    } catch (err) {
      setErrors(err.errors || {});
      showToast(err.message, "err");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteContact(pendingDelete.id);
      if (editing?.id === pendingDelete.id) cancelEdit();
      await refresh();
      showToast("Contacto eliminado");
    } catch (err) {
      showToast(err.message, "err");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div className="app">
      <header className="topbar liquid-glass">
        <div className="brand">
          <span className="eyebrow">
            <span className="dot" />
            Archivo
          </span>
          <h1>Directorio de contactos</h1>
          <p className="lede">
            Alta, edición y baja de fichas sobre SQLite. Frontend y API viven
            en proyectos separados.
          </p>
        </div>
        <div className="stat">
          <strong>{contacts.length}</strong>
          <span>{contacts.length === 1 ? "ficha activa" : "fichas activas"}</span>
        </div>
      </header>

      {error ? (
        <div className="banner" role="alert">
          <span>{error}. ¿Está corriendo el backend en el puerto 3001?</span>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <main className="layout">
        <ContactList
          contacts={filtered}
          loading={loading}
          query={query}
          editingId={editing?.id}
          onQuery={setQuery}
          onEdit={startEdit}
          onAskDelete={setPendingDelete}
        />

        <section className="panel liquid-glass">
          <h2>{editing ? `Editar a ${editing.nombre}` : "Nueva ficha"}</h2>
          <p className="panel-copy">
            {editing
              ? "Los cambios se guardan en SQLite al confirmar."
              : "Completa los campos obligatorios para crear un contacto."}
          </p>
          <ContactForm
            values={values}
            errors={errors}
            editing={Boolean(editing)}
            submitting={submitting}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={cancelEdit}
          />
        </section>
      </main>

      {pendingDelete ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal liquid-glass" role="dialog" aria-modal="true">
            <h2>Eliminar ficha</h2>
            <p>
              ¿Quitar a {pendingDelete.nombre} del directorio? Esta acción no se
              puede deshacer.
            </p>
            <div className="form-actions">
              <button className="btn btn-primary" type="button" onClick={confirmDelete}>
                Eliminar
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setPendingDelete(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`toast liquid-glass ${toast.tone}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
