export default function ContactForm({
  values,
  errors,
  editing,
  submitting,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className={`field ${errors.nombre ? "has-error" : ""}`}>
        <label htmlFor="nombre">Nombre</label>
        <input
          id="nombre"
          name="nombre"
          value={values.nombre}
          onChange={onChange}
          placeholder="Camila Herrera"
          autoComplete="name"
          required
        />
        {errors.nombre ? <span className="error">{errors.nombre}</span> : null}
      </div>

      <div className={`field ${errors.email ? "has-error" : ""}`}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={onChange}
          placeholder="camila@halcyn.co"
          autoComplete="email"
          required
        />
        {errors.email ? <span className="error">{errors.email}</span> : null}
      </div>

      <div className={`field ${errors.telefono ? "has-error" : ""}`}>
        <label htmlFor="telefono">Teléfono</label>
        <input
          id="telefono"
          name="telefono"
          value={values.telefono}
          onChange={onChange}
          placeholder="+57 310 000 0000"
          autoComplete="tel"
        />
        {errors.telefono ? <span className="error">{errors.telefono}</span> : null}
      </div>

      <div className={`field ${errors.cargo ? "has-error" : ""}`}>
        <label htmlFor="cargo">Cargo</label>
        <input
          id="cargo"
          name="cargo"
          value={values.cargo}
          onChange={onChange}
          placeholder="Product Manager"
        />
        {errors.cargo ? <span className="error">{errors.cargo}</span> : null}
      </div>

      <div className={`field ${errors.notas ? "has-error" : ""}`}>
        <label htmlFor="notas">Notas</label>
        <textarea
          id="notas"
          name="notas"
          value={values.notas}
          onChange={onChange}
          placeholder="Contexto breve para el equipo"
        />
        {errors.notas ? <span className="error">{errors.notas}</span> : null}
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting
            ? "Guardando…"
            : editing
              ? "Guardar cambios"
              : "Crear contacto"}
        </button>
        {editing ? (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
