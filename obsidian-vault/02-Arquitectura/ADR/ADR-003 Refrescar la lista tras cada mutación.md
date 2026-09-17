---
aliases: [ADR-003]
tags: [adr, arquitectura, frontend]
type: adr
estado: aceptada
fecha: 2026-09-17
---

# ADR-003 · Refrescar la lista completa tras cada mutación

**Estado:** aceptada · **Afecta a:** [[App estado]], [[Frontend Web]], [[Flujo de datos]]

## Contexto

Tras crear, editar o borrar un contacto hay dos formas de dejar la UI al día:

- **Actualización optimista / local:** parchear el array en memoria con la respuesta de la mutación.
- **Refetch:** volver a pedir `GET /api/contacts` y reemplazar el estado entero.

## Decisión

**Refetch.** `refresh()` se llama después de cada mutación exitosa y la respuesta de la mutación se descarta.

```js
await createContact(values);
showToast("Contacto creado");
await refresh();      // ← la lista se vuelve a leer completa
cancelEdit();
```

## Razones

- **El servidor decide el orden.** La lista viene ordenada por `nombre COLLATE NOCASE` desde SQLite. Insertar en el sitio correcto localmente significaría reimplementar esa colación en JavaScript — y equivocarse con acentos y mayúsculas.
- **El dato guardado no es el enviado.** El backend recorta y pasa el email a minúsculas ([[Validación y normalización]]). Un parche local mostraría lo que se escribió, no lo que se guardó.
- **Divergencia imposible.** Lo que se ve es siempre lo que hay en disco, incluso si otra pestaña o un `curl` modificó algo entre medias.
- **El costo es nulo a esta escala.** SQLite local, decenas de filas, misma máquina.

## Consecuencias

**Buenas**
- Toda una clase de bugs de sincronización desaparece.
- El código de mutación es plano: mutar → refrescar → avisar.

**Malas — asumidas**
- **Dos peticiones por cambio.** Se vuelve caro con paginación o latencia de red real.
- **`refresh()` no captura su propio error.** Si el `GET` posterior falla, el `catch` del handler muestra un toast de error aunque la mutación sí se guardó — mensaje confuso. Anotado en [[Riesgos y deuda técnica]].
- **Sin feedback optimista.** La lista no cambia hasta que ambas peticiones terminan. A esta velocidad no se percibe.

## Cuándo revisarla

Si se añade paginación (#10 del [[Roadmap y backlog]]), si el backend deja de estar en localhost, o si la lista supera unos cientos de filas.

Relacionado: [[ADR-002 Dos proyectos sin monorepo]], [[Casos de uso]].
