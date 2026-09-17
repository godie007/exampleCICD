---
aliases: [C4, Contexto]
tags: [diagrama, arquitectura]
type: diagrama
---

# Diagrama de contexto

Modelo C4, niveles 1 y 2.

## Nivel 1 — Contexto del sistema

```mermaid
graph TB
    U(("Persona usuaria<br/><i>consulta y mantiene<br/>el directorio</i>"))
    S["<b>Archivo</b><br/>Directorio de contactos<br/><i>CRUD sobre SQLite</i>"]
    D(("Otra herramienta<br/><i>consumidor de la API</i>"))

    U -->|"usa en el navegador<br/>HTTP :5173"| S
    D -.->|"consume<br/>/api/contacts"| S

    style S fill:#1f2937,stroke:#111827,color:#fff
```

Archivo no se integra con ningún sistema externo: no envía correos, no consulta directorios corporativos, no sincroniza con nada. Es deliberado ([[Visión de producto]]).

## Nivel 2 — Contenedores

```mermaid
graph TB
    U(("Persona<br/>usuaria"))

    subgraph "Archivo"
        FE["<b>archivo-web</b><br/>React 19 + Vite · :5173<br/><i>UI de una pantalla</i>"]
        BE["<b>archivo-api</b><br/>Express 4 · :3001<br/><i>CRUD y reglas de negocio</i>"]
        DB[("<b>archivo.db</b><br/>SQLite en disco<br/><i>tabla contacts</i>")]
    end

    U -->|"HTTPS/HTTP"| FE
    FE -->|"JSON sobre HTTP<br/>/api/contacts"| BE
    BE -->|"node:sqlite<br/>síncrono"| DB

    style FE fill:#dbeafe,stroke:#2563eb
    style BE fill:#dcfce7,stroke:#16a34a
    style DB fill:#fef3c7,stroke:#d97706
```

| Contenedor | Responsabilidad | Nota |
|---|---|---|
| `archivo-web` | Presentar, buscar en cliente, capturar entrada | [[Frontend Web]] |
| `archivo-api` | Validar, aplicar reglas, persistir | [[Backend API]] |
| `archivo.db` | Guardar los contactos | [[Modelo de datos]] |

## Nivel 3 — Componentes

```mermaid
graph TB
    subgraph "archivo-web"
        MA["main.jsx"] --> AP["App.jsx<br/><i>estado</i>"]
        AP --> CL["ContactList"]
        AP --> CF["ContactForm"]
        AP --> AC["api.js<br/><i>único fetch</i>"]
    end

    subgraph "archivo-api"
        IX["index.js<br/><i>servidor</i>"] --> CT["contacts.js<br/><i>rutas + SQL</i>"]
        CT --> VD["validate.js<br/><i>reglas</i>"]
        CT --> DBM["db.js<br/><i>conexión</i>"]
        IX -.->|"import con efecto"| DBM
    end

    AC -->|"HTTP"| IX
    DBM --> SQL[("archivo.db")]
```

Notas por componente: [[App estado]] · [[ContactList]] · [[ContactForm]] · [[Cliente API]] · [[Servidor Express]] · [[Módulo contacts]] · [[Módulo validate]] · [[Módulo db]].

Relacionado: [[Arquitectura general]], [[Flujo de datos]], [[Mapa del grafo]].
