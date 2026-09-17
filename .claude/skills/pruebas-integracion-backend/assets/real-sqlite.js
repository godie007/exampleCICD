import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync as RealDatabaseSync } from "node:sqlite";

/**
 * Base SQLite **real** en un archivo temporal, para pruebas de integración.
 *
 * `db.js` calcula su ruta desde `import.meta.url` y abre
 * `backend/data/archivo.db`. No hay variable de entorno que lo mueva, así que
 * importarlo tal cual en un test escribiría en la base de desarrollo de quien
 * corre la suite.
 *
 * La solución no es falsear el driver —eso es la skill unitaria— sino
 * subclasar `DatabaseSync` para **ignorar la ruta que pide db.js** y abrir en
 * su lugar un archivo temporal. El motor, el SQL, las restricciones y los
 * mensajes de error son los de verdad; lo único falso es dónde vive el archivo.
 *
 * Al importarse `db.js` contra esta base recién creada, su siembra SÍ corre:
 * el estado inicial de cada archivo de test son los 4 contactos semilla.
 *
 * Uso:
 *   const sqlite = createTempSqlite();
 *   jest.unstable_mockModule("node:sqlite", () => ({
 *     DatabaseSync: sqlite.DatabaseSync,
 *     default: { DatabaseSync: sqlite.DatabaseSync },
 *   }));
 *   // ...y en afterAll: db.close(); sqlite.cleanup();
 */
export function createTempSqlite() {
  const dir = mkdtempSync(path.join(tmpdir(), "archivo-int-"));
  const file = path.join(dir, "archivo.db");

  class DatabaseSync extends RealDatabaseSync {
    constructor(_ubicacionIgnorada) {
      super(file);
    }
  }

  return {
    DatabaseSync,
    /** Ruta del archivo temporal; útil para afirmar que no es la de desarrollo. */
    file,
    /** Borra el directorio temporal. Cierra la base ANTES de llamarla. */
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
