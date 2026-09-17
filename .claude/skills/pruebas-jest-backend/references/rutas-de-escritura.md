# Rutas de escritura: POST, PUT, DELETE

Léelo cuando vayas a probar algo distinto de `GET /`. El montaje (falsear `node:sqlite`, `createTestApp`, `stmtFor`) es el mismo que describe SKILL.md; aquí solo están las garantías propias de cada ruta y las trampas de cada una.

## Statements que necesitarás

```js
const getStmt    = sqlite.stmtFor(/WHERE id = \?/);
const insertStmt = sqlite.stmtFor(/INSERT INTO contacts/i);
const updateStmt = sqlite.stmtFor(/UPDATE contacts/i);
const deleteStmt = sqlite.stmtFor(/DELETE FROM contacts/i);
```

Ojo: `getStmt` y `updateStmt` comparten el fragmento `WHERE id = ?`. Usa patrones que distingan (`/^SELECT \* FROM contacts WHERE id = \?/`) o `stmtFor` fallará avisando de que hay más de uno — que es justo lo que debe hacer.

## POST /api/contacts

Garantías a cubrir:

- **Persiste `value`, nunca `req.body`** (RN-07). El test que lo demuestra: enviar `{ nombre: "  Ana  ", email: "ANA@HALCYN.co" }` y afirmar sobre los **argumentos con que se llamó** `insertStmt.run` — deben ir ya recortados y en minúscula. Es la única forma de ver la normalización desde fuera, porque la respuesta se relee de la base.
- **Campos extra del cliente se descartan**: mandar `{ id: 999, createdAt: "…", rol: "admin" }` y comprobar que `insertStmt.run` recibe exactamente 7 argumentos en el orden del SQL.
- **`created_at` y `updated_at` son el mismo instante** en el alta: los argumentos 6 y 7 de `run` deben ser idénticos y parsear como ISO-8601. Congela el reloj con `jest.useFakeTimers().setSystemTime(new Date("2026-09-17T10:00:00Z"))` y restaura en `afterEach`; si no, el test es una carrera contra el cambio de milisegundo.
- **Relee después de escribir**: la respuesta 201 debe venir de `getStmt.get(lastInsertRowid)`, no del body del cliente. Haz que `insertStmt.run` devuelva `{ lastInsertRowid: 42 }` y que `getStmt.get` devuelva una fila distinta de lo enviado; el 201 debe reflejar la fila de la base. Y afirma `getStmt.get` llamado con el número `42`, no con el string.
- **400 de validación**: cuerpo inválido no debe tocar la base — `expect(insertStmt.run).not.toHaveBeenCalled()`. El cuerpo es `{ error: "Revisa los campos del formulario", errors: { campo: "…" } }`.
- **409 por email duplicado**: haz que `insertStmt.run` lance `new Error("UNIQUE constraint failed: contacts.email")`. Espera 409 con `errors.email`. Prueba además la variante en minúscula (`"unique constraint failed"`) porque la detección es por texto — ver ADR-005.
- **Un error ajeno se relanza**: `insertStmt.run` lanzando `new Error("disk I/O error")` debe dar 500 con el contrato genérico, no un 409. Esta es la prueba que protege de convertir todo en conflicto de email.

## PUT /api/contacts/:id

Todo lo de POST, más el orden de comprobaciones, que es deliberado:

- **Existencia antes que validación.** Con `getStmt.get` devolviendo `undefined` y un cuerpo inválido, la respuesta debe ser **404**, no 400: preguntar por un contacto inexistente no devuelve errores de formulario. Este test es el que más fácil se rompe en un refactor, y por eso vale.
- **Reemplazo completo**: los campos no enviados se vacían. Enviar solo `nombre` y `email` y afirmar que `updateStmt.run` recibe `""` en telefono, cargo y notas.
- **`created_at` no se toca**: `updateStmt` no lo incluye en su SQL. Afírmalo sobre el texto del statement.
- **`updated_at` avanza**: con reloj congelado, el argumento de fecha debe ser el instante actual, distinto del `created_at` de la fila existente.
- **Id no numérico**: `/api/contacts/abc` → `Number("abc")` es `NaN`; el `getStmt.get(NaN)` no encuentra fila y debe responder 404 limpio. Vale la pena fijarlo: documenta que no hay un 400 por id inválido, y si alguien lo cambia el test avisa.

## DELETE /api/contacts/:id

Corta pero con dos garantías reales:

- **`changes === 0` → 404** con `{ error: "Contacto no encontrado" }`.
- **`changes === 1` → 204 sin cuerpo**: afirma `res.status === 204` y `res.text === ""`. Un 204 con cuerpo es un bug silencioso que solo un test así detecta.
- **El id se convierte a número** antes de llegar al statement: `expect(deleteStmt.run).toHaveBeenCalledWith(7)`, no `"7"`.

## `validate.js` — la excepción

Es una función pura, sin dependencias ni efectos: pruébala **importándola directamente**, sin mocks, sin supertest, sin app. Nada de este documento aplica ahí. Es también el mejor retorno por línea de test del repo, según el backlog del vault.
