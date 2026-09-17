---
aliases: [ADR-002]
tags: [adr, arquitectura, operación]
type: adr
estado: aceptada
fecha: 2026-09-17
---

# ADR-002 · Dos proyectos npm independientes, sin workspace

**Estado:** aceptada · **Afecta a:** [[Arquitectura general]], [[Entorno de desarrollo]], [[CI-CD]]

## Contexto

`backend/` y `frontend/` conviven en un mismo repositorio. Las opciones eran un workspace npm en la raíz (o pnpm/turbo), o dos proyectos completamente separados que solo comparten carpeta.

## Decisión

**Dos `package.json` independientes, sin `package.json` en la raíz.** `npm install` se ejecuta en cada carpeta; no hay `node_modules` compartido ni scripts raíz.

## Razones

- **Ninguna dependencia compartida.** El backend usa `express` y `cors`; el frontend, `react` y `vite`. La superficie común de un workspace sería cero.
- **El acoplamiento debe doler si es indebido.** Al no haber forma de importar código entre proyectos, el único contrato posible es HTTP ([[Contrato de API]]). Un workspace haría tentador compartir un módulo de "tipos" y con él, lentamente, lógica.
- **Cada mitad es desplegable por separado** — y reescribible por separado.
- **Herramientas mínimas.** No hay que aprender ni mantener un orquestador de monorepo para dos carpetas.

## Consecuencias

**Buenas**
- Fronteras imposibles de cruzar por accidente.
- Un pipeline de CI puede tener dos jobs paralelos con caches independientes.

**Malas — asumidas**
- **Dos `npm install` y dos terminales.** Es la primera fricción que encuentra alguien nuevo; por eso [[Entorno de desarrollo]] lo explica como primer paso.
- **Ningún comando levanta todo.** Candidato a `docker compose`, ítem #7 del [[Roadmap y backlog]].
- **El contrato se mantiene a mano.** Si la API cambia un campo, nada avisa al frontend; lo detectaría un test de contrato, que hoy no existe.
- **Versiones desalineables.** `archivo-api` y `archivo-web` están ambos en 1.0.0 por convención, no por herramienta.

## Cuándo revisarla

Si aparece código genuinamente compartido (tipos generados desde un esquema, un cliente de API publicado) o una tercera aplicación.

Relacionado: [[ADR-001 node sqlite sin ORM]], [[Build y despliegue]].
