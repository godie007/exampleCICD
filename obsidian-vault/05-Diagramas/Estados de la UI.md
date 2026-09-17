---
aliases: [Máquina de estados, Estados]
tags: [diagrama, frontend]
type: diagrama
---

# Estados de la UI

## El formulario: un modo, una variable

`editing` (el contacto o `null`) es lo único que distingue crear de editar. No hay dos pantallas ni dos componentes.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Creando

    Creando --> Enviando: submit
    Enviando --> Creando: 201 · toast ok · cancelEdit()
    Enviando --> CreandoConErrores: 400/409
    CreandoConErrores --> Enviando: reintenta
    CreandoConErrores --> Creando: corrige (handleChange borra el error)

    Creando --> Editando: startEdit(contact)
    Editando --> GuardandoEdicion: submit
    GuardandoEdicion --> Creando: 200 · toast ok · cancelEdit()
    GuardandoEdicion --> EdicionConErrores: 400/409/404
    EdicionConErrores --> GuardandoEdicion: reintenta
    Editando --> Creando: Cancelar
    Editando --> Creando: se elimina ese mismo contacto

    note right of Creando
        editing = null
        botón "Crear contacto"
        sin botón Cancelar
    end note
    note right of Editando
        editing = contacto
        título "Editar a X"
        tarjeta con is-active
    end note
```

Todo camino de salida termina en **Creando**, y todos pasan por el mismo `cancelEdit()`. Un solo reset, imposible que queden estados a medias.

## La lista: tres estados excluyentes

```mermaid
stateDiagram-v2
    [*] --> Cargando
    Cargando --> ConDatos: llegan contactos
    Cargando --> VacíoInicial: lista vacía
    Cargando --> Error: falla el fetch

    ConDatos --> SinCoincidencias: query sin resultados
    SinCoincidencias --> ConDatos: se borra la query
    Error --> [*]: Reintentar (recarga)

    note right of Cargando
        3 esqueletos
    end note
    note right of VacíoInicial
        "Aún no hay contactos.
        Crea el primero…"
    end note
    note right of SinCoincidencias
        "Nadie coincide
        con esa búsqueda."
    end note
    note right of Error
        banner + "¿Está corriendo
        el backend en el puerto 3001?"
    end note
```

Distinguir *vacío inicial* de *sin coincidencias* importa: la acción que resuelve cada uno es distinta.

## El borrado: confirmación obligatoria

```mermaid
stateDiagram-v2
    [*] --> Inactivo
    Inactivo --> Confirmando: clic en 🗑️ (pendingDelete = contacto)
    Confirmando --> Inactivo: Cancelar
    Confirmando --> Borrando: Eliminar
    Borrando --> Inactivo: 204 · refresh · toast
    Borrando --> Inactivo: error · toast rojo

    note right of Confirmando
        modal bloqueante
        "no se puede deshacer"
    end note
```

`pendingDelete` se limpia en un `finally`: el modal nunca se queda abierto, pase lo que pase.

## El toast

```mermaid
stateDiagram-v2
    [*] --> Oculto
    Oculto --> Visible: showToast(mensaje, tono)
    Visible --> Oculto: 2800 ms
    Visible --> Visible: nuevo toast (reinicia el timer)
```

El `useEffect` limpia el `setTimeout` anterior al cambiar de toast, así que un aviso viejo nunca apaga a uno nuevo. Tonos `ok` (verde) y `err` (rojo), clases del [[Sistema visual]].

## Estados combinados posibles

| `loading` | `editing` | `pendingDelete` | Pantalla |
|---|---|---|---|
| sí | null | null | esqueletos + formulario vacío |
| no | null | null | reposo |
| no | contacto | null | edición, tarjeta resaltada |
| no | contacto | contacto | edición + modal (si se borra, sale de edición) |
| no | null | contacto | modal sobre reposo |

Relacionado: [[App estado]], [[ContactForm]], [[ContactList]], [[Casos de uso]].
