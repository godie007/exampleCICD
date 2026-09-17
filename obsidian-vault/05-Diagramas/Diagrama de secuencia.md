---
aliases: [Secuencias, Flujos técnicos]
tags: [diagrama, api, frontend, backend]
type: diagrama
---

# Diagrama de secuencia

Los cuatro recorridos que importan, de la interacción al disco.

## Carga inicial

```mermaid
sequenceDiagram
    autonumber
    actor P as Persona
    participant A as App.jsx
    participant C as api.js
    participant E as Express
    participant D as SQLite

    P->>A: abre :5173
    A->>A: loading = true (esqueletos)
    A->>C: listContacts()
    C->>E: GET /api/contacts
    E->>D: SELECT … ORDER BY nombre COLLATE NOCASE
    D-->>E: filas
    E->>E: map(mapContact)
    E-->>C: 200 Contacto[]
    C-->>A: datos
    A->>A: setContacts · loading = false
    A-->>P: tarjetas + contador
```

Si el `fetch` rechaza (backend caído), `setError` y se pinta el banner con *"¿Está corriendo el backend en el puerto 3001?"*.

## Crear un contacto

```mermaid
sequenceDiagram
    autonumber
    actor P as Persona
    participant F as ContactForm
    participant A as App.jsx
    participant C as api.js
    participant R as contacts.js
    participant V as validate.js
    participant D as SQLite

    P->>F: rellena y envía
    F->>A: handleSubmit
    A->>A: submitting = true
    A->>C: createContact(values)
    C->>R: POST /api/contacts
    R->>V: validateContact(body)

    alt inválido
        V-->>R: ok=false, errors
        R-->>C: 400 {error, errors}
        C-->>A: throw Error(.errors)
        A->>F: errores bajo cada campo
        A-->>P: toast rojo
    else válido
        V-->>R: ok=true, value (trim + minúsculas)
        R->>D: INSERT
        alt email duplicado
            D-->>R: UNIQUE constraint failed
            R->>R: isUniqueConflict → sí
            R-->>C: 409 {errors.email}
            C-->>A: throw
            A->>F: "Ese email ya está registrado"
        else ok
            D-->>R: lastInsertRowid
            R->>D: SELECT por id
            R-->>C: 201 Contacto
            C-->>A: contacto
            A-->>P: toast "Contacto creado"
            A->>C: refresh() → GET /api/contacts
            A->>A: cancelEdit()
        end
    end
    A->>A: submitting = false
```

La respuesta del `POST` **se descarta**: la lista se vuelve a leer entera ([[ADR-003 Refrescar la lista tras cada mutación]]).

## Editar un contacto

```mermaid
sequenceDiagram
    autonumber
    actor P as Persona
    participant L as ContactList
    participant A as App.jsx
    participant R as contacts.js
    participant D as SQLite

    P->>L: clic en ✏️
    L->>A: onEdit(contact)
    A->>A: startEdit → editing = contact, values copiados
    A-->>P: panel "Editar a Camila Herrera" · tarjeta is-active

    P->>A: guarda cambios
    A->>R: PUT /api/contacts/:id
    R->>D: SELECT por id
    alt no existe
        D-->>R: null
        R-->>A: 404 "Contacto no encontrado"
    else existe
        R->>R: validateContact
        R->>D: UPDATE … updated_at = ahora
        R->>D: SELECT por id
        R-->>A: 200 Contacto
        A-->>P: toast "Contacto actualizado"
        A->>A: refresh() + cancelEdit()
    end
```

Orden deliberado: **existencia → validación → escritura** ([[Módulo contacts]]).

## Eliminar un contacto

```mermaid
sequenceDiagram
    autonumber
    actor P as Persona
    participant L as ContactList
    participant A as App.jsx
    participant M as Modal
    participant R as contacts.js
    participant D as SQLite

    P->>L: clic en 🗑️
    L->>A: onAskDelete(contact)
    A->>A: pendingDelete = contact
    A->>M: "¿Quitar a X? No se puede deshacer."

    alt cancela
        P->>M: Cancelar
        M->>A: pendingDelete = null
    else confirma
        P->>M: Eliminar
        M->>A: confirmDelete()
        A->>R: DELETE /api/contacts/:id
        R->>D: DELETE
        alt changes = 0
            R-->>A: 404
            A-->>P: toast rojo
        else borrado
            R-->>A: 204
            A->>A: si editing.id === borrado → cancelEdit()
            A->>A: refresh()
            A-->>P: toast "Contacto eliminado"
        end
        A->>A: pendingDelete = null
    end
```

Relacionado: [[Casos de uso]], [[Flujo de datos]], [[Contrato de API]], [[Estados de la UI]].
