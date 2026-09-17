---
aliases: [ER, Entidad-relación]
tags: [diagrama, datos]
type: diagrama
---

# Modelo ER

Una entidad, sin relaciones. El detalle de columnas y reglas está en [[Modelo de datos]].

## Entidad

```mermaid
erDiagram
    CONTACTS {
        INTEGER id PK "AUTOINCREMENT"
        TEXT nombre "NOT NULL, <= 80"
        TEXT email UK "NOT NULL, UNIQUE, minúsculas, <= 120"
        TEXT telefono "opcional, patrón"
        TEXT cargo "opcional, <= 80"
        TEXT notas "opcional, <= 280"
        TEXT created_at "ISO-8601, servidor, inmutable"
        TEXT updated_at "ISO-8601, servidor"
    }
```

## Ciclo de vida de una fila

```mermaid
stateDiagram-v2
    [*] --> Semilla: tabla vacía al arrancar
    [*] --> Creada: POST /api/contacts
    Semilla --> Vigente
    Creada --> Vigente: created_at = updated_at
    Vigente --> Vigente: PUT (updated_at cambia)
    Vigente --> [*]: DELETE (irreversible)

    note right of Semilla
        4 contactos de ejemplo
        RN-10 · Módulo db
    end note
    note right of Vigente
        created_at nunca cambia
    end note
```

`DELETE` es definitivo: no hay borrado lógico ni papelera (RN-08 en [[Reglas de negocio]]). Por eso la UI exige confirmación explícita.

## Las tres representaciones del mismo contacto

```mermaid
graph LR
    A["<b>Base</b><br/>snake_case<br/>NULL permitido<br/>created_at"] -->|"mapContact()"| B["<b>API</b><br/>camelCase<br/>'' en vez de NULL<br/>createdAt"]
    B -->|"fetch"| C["<b>UI</b><br/>values: 5 campos<br/>sin marcas de tiempo"]
    C -->|"JSON.stringify"| D["<b>Payload</b><br/>5 campos"]
    D -->|"validateContact()"| A

    style A fill:#fef3c7,stroke:#d97706
    style B fill:#dcfce7,stroke:#16a34a
    style C fill:#dbeafe,stroke:#2563eb
```

El ciclo es asimétrico a propósito: el cliente envía cinco campos y recibe ocho. `id`, `createdAt` y `updatedAt` los pone el servidor y el cliente no puede alterarlos (RN-09).

## Restricciones e índices

| Restricción | Tipo | Efecto al violarse |
|---|---|---|
| `id` PRIMARY KEY | implícita | — |
| `email` UNIQUE | implícita | → **409** vía [[ADR-005 Conflicto de email detectado por texto]] |
| `nombre` NOT NULL | columna | nunca se alcanza: el validador lo bloquea antes |
| `email` NOT NULL | columna | igual |

No hay índices explícitos. El `ORDER BY nombre COLLATE NOCASE` hace scan + sort; irrelevante a esta escala ([[Riesgos y deuda técnica]]).

Relacionado: [[Modelo de datos]], [[Módulo db]], [[Reglas de negocio]].
