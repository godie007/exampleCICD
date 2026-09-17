---
name: pruebas-integracion-backend
description: Escribe y ejecuta pruebas de integración del backend de este repo contra SQLite real (Express 4 + node:sqlite, ESM nativo, español). Úsala cuando se pidan pruebas de integración, tests end-to-end de la API, "prueba esto contra la base de verdad", verificar el orden real del listado, la restricción UNIQUE, la siembra o la persistencia entre peticiones. Úsala también si alguien pregunta cómo probar sin mockear el driver, o por qué un test de integración ensucia la base de desarrollo. Para pruebas unitarias con el driver falseado, usa en cambio pruebas-jest-backend.
---

# Pruebas de integración del backend

Las pruebas unitarias de este repo falsean `node:sqlite` para que `db.js` y `contacts.js` corran sin tocar disco. Eso es correcto y rápido, pero deja **fuera todo lo que decide SQLite**: el orden real de `COLLATE NOCASE`, la restricción `UNIQUE`, los `NOT NULL`, el `AUTOINCREMENT`, la siembra y la persistencia de una petición a la siguiente. Nada de eso se prueba mockeando: se prueba ejecutándolo.

Esta skill cubre esa mitad. Convive con `pruebas-jest-backend`, no la sustituye.

| | Unitaria | Integración |
|---|---|---|
| Driver | falseado (`fake-sqlite.js`) | **real** |
| Qué demuestra | que el código llama bien a la base | que la base hace lo que el código espera |
| Afirma sobre | argumentos de `run`/`get`, SQL preparado | filas devueltas, códigos HTTP, estado tras varias peticiones |
| Coste | milisegundos | decenas de milisegundos |

Si una prueba puede escribirse unitaria, escríbela unitaria. La integración es para lo que **solo** la base puede demostrar.

## Antes de escribir

1. **Consulta el vault de Obsidian** (`mcp__obsidian__search_simple` / `vault_read`). La nota del componente y su ADR dicen qué garantiza el código y qué es deuda asumida. Para el listado: `03-Componentes/Módulo contacts.md`, `03-Componentes/Módulo db.md`, `02-Arquitectura/Modelo de datos.md`, `01-Negocio/Reglas de negocio.md`.
2. **Lee el código real** de `db.js` y de la ruta. En integración importa especialmente `db.js`, porque su esquema y su siembra son parte de lo que se ejecuta.

## La decisión de diseño: driver real, ubicación redirigida

`db.js` calcula su ruta desde `import.meta.url` y abre `backend/data/archivo.db`. No hay variable de entorno que lo mueva. Si importas `db.js` tal cual en un test, **escribes en la base de desarrollo de quien corre la suite** — datos reales borrados por un test es el peor resultado posible.

La solución no es mockear el driver (eso es la skill unitaria), sino **subclasar `DatabaseSync` para forzar la ubicación** y dejar todo lo demás intacto:

```js
class DatabaseSync extends RealDatabaseSync {
  constructor(_ignorada) {
    super(archivoTemporal);   // se ignora la ruta que pide db.js
  }
}
```

El SQL es real, el motor es real, los mensajes de error son los de Node, las restricciones se aplican de verdad. Lo único falso es **dónde** vive el archivo. El helper vive en `backend/tests/helpers/real-sqlite.js`; si no existe, cópialo de `assets/real-sqlite.js` de esta skill.

```js
import { jest } from "@jest/globals";
import { createTempSqlite } from "./helpers/real-sqlite.js";

const sqlite = createTempSqlite();

jest.unstable_mockModule("node:sqlite", () => ({
  DatabaseSync: sqlite.DatabaseSync,
  default: { DatabaseSync: sqlite.DatabaseSync },
}));

// El import dinámico va DESPUÉS del mock: con ESM, un `import` estático se
// resuelve antes de que corra cualquier línea del archivo. Al importar, db.js
// ya crea el esquema y siembra los 4 contactos en la base temporal.
const { contactsRouter } = await import("../src/contacts.js");
const { db } = await import("../src/db.js");
```

**Limpia siempre.** Sin esto, cada corrida deja un directorio en `/tmp`:

```js
afterAll(() => {
  db.close();          // primero cerrar, luego borrar
  sqlite.cleanup();
});
```

## La siembra es parte del contrato

Con una base vacía, `db.js` siembra **4 contactos**. En integración eso no se evita: es el estado inicial real. Aprovéchalo — el listado de una base recién creada debe devolver esos cuatro — pero **no dependas de sus nombres concretos** más allá de un test que fije la siembra a propósito. Si cambian los datos semilla, lo que debe ponerse rojo es ese test, no otros diez.

Para los tests que necesitan datos propios, créalos **por la API** (`POST /api/contacts`), no con SQL a mano. Insertar por debajo de la aplicación prueba tu SQL de prueba, no el de producción.

## Qué probar en integración

Solo lo que el mock no puede demostrar. Los cuatro frentes:

1. **Lo que decide la base, no JavaScript.** El orden del listado lo hace `ORDER BY nombre COLLATE NOCASE ASC` dentro de SQLite: insertar nombres en desorden y afirmar el orden devuelto. Ojo: `COLLATE NOCASE` **solo pliega ASCII** — `ana` va antes que `Andrés`, y `Zoe` va al final. Fija ese comportamiento con el que es, no con el que te gustaría.
2. **Restricciones del esquema.** `UNIQUE` en email produce un 409 de verdad; `NOT NULL` y `AUTOINCREMENT` se comportan como dice el `CREATE TABLE`. El 409 por email duplicado es la mitigación #1 de ADR-005 y solo aquí se prueba con el mensaje auténtico de Node.
3. **Flujos de varias peticiones.** `POST` y luego `GET` lo ve; `PUT` y el listado refleja el cambio; `DELETE` y desaparece. Ahí está el valor: el estado sobrevive entre peticiones porque es una base, no un mock.
4. **Coherencia de tipos entre ida y vuelta.** Lo que entra como `""` vuelve como `""` y no como `null`; el `id` vuelve como número; las marcas de tiempo son ISO-8601 legibles por `Date`.

No repitas aquí los frentes unitarios (forma exacta del cuerpo, contrato de errores, statements preparados una sola vez). Ya están cubiertos y cuestan cien veces menos.

## Estilo

- **Todo en español**: `describe`, `test`, comentarios y datos. Es el idioma del repo y de la API.
- El nombre dice **la garantía, no la mecánica**: `"el orden lo aplica SQLite, no JavaScript"` enseña; `"prueba de ordenamiento"` no.
- Sufijo `.int.test.js` para distinguirlos de los unitarios de un vistazo y poder correr cada grupo por separado.
- Agrupa con `describe` por frente. Un `describe` por flujo cuando pruebes varias peticiones encadenadas.
- **Cada test deja la base como la encontró**, o el archivo declara su orden explícitamente en un `describe` con nombre de flujo. Los tests de integración comparten estado: eso es lo que los hace valiosos y lo que los hace frágiles. Elige una de las dos disciplinas y decláralo en el comentario de cabecera.
- Comenta el **porqué** donde sorprenda: la subclase que redirige la ubicación, el `db.close()` antes del borrado, la siembra de 4.

## Correr y verificar

```bash
cd backend && npm run test:int          # solo integración
cd backend && npm run test:unit         # solo unitarias
cd backend && npm test                  # todo
```

Si los scripts no existen, añádelos a `package.json` filtrando por el sufijo:

```json
"test:int":  "node --experimental-vm-modules --experimental-sqlite node_modules/jest/bin/jest.js --testPathPattern='\\.int\\.test\\.js$'",
"test:unit": "node --experimental-vm-modules --experimental-sqlite node_modules/jest/bin/jest.js --testPathIgnorePatterns='\\.int\\.test\\.js$'"
```

**Antes de dar la suite por buena, comprueba dos cosas:**

1. **Que no es vacua.** Rompe una garantía en `src/` y mira que falle exactamente su test. Para el listado, la mutación reveladora es reordenar en JavaScript: si `listStmt.all().map(mapContact).sort(...)` en JS hace pasar los mismos tests, entonces no estabas probando el orden de SQLite. Restaura siempre y confirma con `git diff --stat src/`.
2. **Que no ensucia nada.** `git status` limpio y la base de desarrollo intacta:
   ```bash
   md5 backend/data/archivo.db    # antes y después: mismo hash
   ls /tmp | grep archivo-int     # sin restos
   ```

Al terminar, informa números reales (`Tests: N passed`), qué queda fuera y si algún hallazgo contradice el vault — un ADR cuyo supuesto ya no se cumple es más valioso que un test más.
