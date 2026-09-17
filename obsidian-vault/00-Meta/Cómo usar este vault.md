---
aliases: [Guía del vault]
tags: [meta]
type: guía
---

# Cómo usar este vault

Carpeta autocontenida: ábrela directamente en Obsidian (**Abrir carpeta como vault** → `obsidian-vault/`). No requiere plugins de comunidad; los diagramas usan **Mermaid**, que Obsidian renderiza de fábrica.

## Convenciones

| Convención | Regla |
|---|---|
| Enlaces | Siempre `[[Nombre de la nota]]`, sin ruta. Los nombres son únicos en todo el vault. |
| Frontmatter | Toda nota lleva `tags` y `type`. Las técnicas añaden `archivos` con las rutas reales del repo. |
| Numeración de carpetas | `00` meta → `05` diagramas. Ordena el explorador, no es jerarquía estricta. |
| Idioma | Español, igual que la UI y los mensajes de la API del producto. |
| Código fuente | Las notas **apuntan** al código (`backend/src/db.js:11`), no lo duplican. Si el código cambia, la nota describe el *porqué*, que suele sobrevivir. |

## Tags principales

`#negocio` `#arquitectura` `#backend` `#frontend` `#datos` `#api` `#adr` `#operación` `#riesgo` `#diagrama` `#pendiente`

Busca `tag:#pendiente` para ver todo lo que aún no existe en el repo (tests, CI, auth, paginación).

## Tipos de nota

- **moc** — índice de navegación ([[Archivo MOC]])
- **concepto** — negocio y dominio
- **componente** — una unidad de código concreta
- **contrato** — algo que dos partes acuerdan (API, errores, esquema)
- **adr** — decisión de arquitectura, con contexto y consecuencias
- **diagrama** — la nota es principalmente visual

## Por dónde empezar

1. ¿Vienes de negocio? → [[Visión de producto]] → [[Casos de uso]] → [[Reglas de negocio]]
2. ¿Vienes de ingeniería? → [[Arquitectura general]] → [[Flujo de datos]] → [[Contrato de API]]
3. ¿Vas a tocar código hoy? → [[Entorno de desarrollo]] → [[Riesgos y deuda técnica]]

Ver también: [[Glosario]], [[Mapa del grafo]].
