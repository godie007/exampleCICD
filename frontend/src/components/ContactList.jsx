function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ContactList({
  contacts,
  loading,
  query,
  editingId,
  onQuery,
  onEdit,
  onAskDelete,
}) {
  return (
    <section className="panel liquid-glass">
      <h2>Directorio</h2>
      <p className="panel-copy">Busca, edita o elimina fichas existentes.</p>

      <div className="toolbar">
        <input
          className="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar por nombre, email o cargo"
          aria-label="Buscar contactos"
        />
      </div>

      {loading ? (
        <div className="skeletons" aria-hidden="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="empty">
          {query
            ? "Nadie coincide con esa búsqueda."
            : "Aún no hay contactos. Crea el primero en el formulario."}
        </div>
      ) : (
        <div className="list">
          {contacts.map((contact, index) => (
            <article
              key={contact.id}
              className={`card ${editingId === contact.id ? "is-active" : ""}`}
              style={{ "--i": index }}
            >
              <div className="avatar" aria-hidden="true">
                {initials(contact.nombre)}
              </div>
              <div className="card-body">
                <strong>{contact.nombre}</strong>
                <p>{contact.email}</p>
                {contact.cargo ? (
                  <div className="card-meta">{contact.cargo}</div>
                ) : null}
              </div>
              <div className="actions">
                <button
                  className="icon-btn"
                  type="button"
                  aria-label={`Editar ${contact.nombre}`}
                  onClick={() => onEdit(contact)}
                >
                  <PencilIcon />
                </button>
                <button
                  className="icon-btn danger"
                  type="button"
                  aria-label={`Eliminar ${contact.nombre}`}
                  onClick={() => onAskDelete(contact)}
                >
                  <TrashIcon />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4.2L19.5 8.7a1.8 1.8 0 0 0 0-2.5l-1.7-1.7a1.8 1.8 0 0 0-2.5 0L4 15.8V20Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
