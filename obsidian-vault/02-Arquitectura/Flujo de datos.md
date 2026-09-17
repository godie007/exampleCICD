---
aliases: [Flujo de datos, Data flow]
tags: [arquitectura, diagrama]
type: concepto
---

# Flujo de datos

El recorrido completo de un dato, de la tecla al disco y de vuelta.

## Escritura: de la tecla a SQLite

```mermaid
flowchart TD
    K["Persona escribe<br/>' Camila@Halcyn.CO '"] --> CF["ContactForm<br/>input controlado"]
    CF -->|"onChange"| ST["App estado<br/>values.email"]
    ST -->|"submit"| API["Cliente API<br/>JSON.stringify"]
    API -->|"POST /api/contacts"| EX["Servidor Express<br/>express.json, 32kb"]
    EX --> RT["Módulo contacts<br/>ruta POST"]
    RT --> VA["Módulo validate"]
    VA -->|"trim + minúsculas"| VAL["value.email =<br/>'camila@halcyn.co'"]
    VAL --> INS["insertStmt.run(value…)"]
    INS --> DB[("archivo.db")]
    DB -->|"lastInsertRowid"| SEL["getStmt.get(id)"]
    SEL --> MAP["mapContact()<br/>snake → camel, null → ''"]
    MAP -->|"201"| BACK["de vuelta al cliente"]

    VA -.->|"errores"| E400["400 + errors por campo"]
    INS -.->|"UNIQUE"| E409["409"]
```

Tres transformaciones que conviene tener presentes:

1. **`trim` + minúsculas** en el validador — el dato cambia de forma aquí, no antes.
2. **`value`, nunca `req.body`** — lo que entra no es lo que se guarda (RN-07).
3. **`mapContact`** — lo que sale de la base no es lo que ve el cliente.

## Lectura: de SQLite a la pantalla

```mermaid
flowchart LR
    DB[("archivo.db")] -->|"SELECT ORDER BY nombre"| ROWS["filas snake_case"]
    ROWS -->|"map(mapContact)"| JSON["Contacto[] camelCase"]
    JSON -->|"HTTP 200"| FE["Cliente API"]
    FE --> STATE["contacts<br/>(estado React)"]
    STATE -->|"useMemo + query"| FILT["filtered"]
    FILT --> UI["ContactList<br/>tarjetas"]
    STATE -->|"contacts.length"| CNT["contador de cabecera<br/><i>sin filtrar</i>"]
```

El orden lo decide **SQLite** (`ORDER BY nombre COLLATE NOCASE`), el filtro lo decide **el navegador**. El contador de la cabecera lee `contacts`, no `filtered`: buscar no cambia el número de fichas activas.

## El ciclo completo de una mutación

```mermaid
flowchart LR
    M["mutación<br/>POST / PUT / DELETE"] --> R["respuesta"]
    R --> RF["refresh()<br/>GET /api/contacts"]
    RF --> NEW["estado reemplazado<br/>por completo"]
    NEW --> T["toast"]
    NEW --> CE["cancelEdit()"]
```

La respuesta de la mutación **se descarta**: la app no la usa para actualizar el estado, vuelve a pedir la lista entera. Dos peticiones por cambio a cambio de cero divergencia entre lo que se ve y lo que hay en disco. Razonado en [[ADR-003 Refrescar la lista tras cada mutación]].

## Dónde puede romperse

| Punto | Fallo | Se ve como |
|---|---|---|
| `fetch` | backend caído | banner "¿Está corriendo el backend en el puerto 3001?" |
| `express.json` | body > 32 kB | 500 genérico |
| validador | dato inválido | 400 + error bajo el campo |
| `INSERT`/`UPDATE` | email duplicado | 409 bajo el campo email |
| `getStmt` | id inexistente | 404 |
| `refresh()` | falla tras mutar | el toast dice ok pero la lista queda vieja — ver [[Riesgos y deuda técnica]] |

Relacionado: [[Arquitectura general]], [[Diagrama de secuencia]], [[Contrato de errores]].
