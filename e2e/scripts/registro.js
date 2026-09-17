/**
 * Genera `REGISTRO.md` a partir de `reportes/resultados.json`.
 *
 * El reporte HTML de Playwright sirve para depurar; este registro es el
 * entregable: una tabla trazable CASO DE USO → prueba → estado → evidencia,
 * legible por alguien que no va a abrir un navegador.
 *
 * La trazabilidad sale de la anotación `{ type: "CU" }` que cada prueba empuja
 * en `test.info().annotations`. Una prueba sin anotación aparece como "sin CU",
 * que es justamente la señal de que falta atarla a un caso de uso.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(__dirname, "..");
const ENTRADA = path.join(raiz, "reportes", "resultados.json");
const SALIDA = path.join(raiz, "REGISTRO.md");

/** Nombre humano de cada caso de uso, según 01-Negocio/Casos de uso.md. */
const CASOS = {
  "CU-01": "Consultar el directorio",
  "CU-02": "Buscar un contacto",
  "CU-03": "Crear un contacto",
  "CU-04": "Editar un contacto",
  "CU-05": "Eliminar un contacto",
  "CU-06": "Detectar que la API no responde",
};

const ICONO = { passed: "✅", failed: "❌", timedOut: "⏱️", skipped: "⏭️", interrupted: "⚠️" };

/** Recorre el árbol de suites de Playwright y aplana las pruebas. */
function aplanar(suites, archivo = "") {
  const filas = [];
  for (const suite of suites ?? []) {
    const actual = suite.file || archivo;
    for (const spec of suite.specs ?? []) {
      for (const prueba of spec.tests ?? []) {
        const ultimo = prueba.results?.at(-1) ?? {};
        const cu =
          (ultimo.annotations ?? prueba.annotations ?? []).find((a) => a.type === "CU")
            ?.description ?? "sin CU";
        filas.push({
          cu,
          titulo: spec.title,
          archivo: actual,
          estado: ultimo.status ?? prueba.status ?? "unknown",
          duracion: ultimo.duration ?? 0,
          error: ultimo.error?.message ?? "",
          adjuntos: (ultimo.attachments ?? []).map((a) => a.name),
        });
      }
    }
    filas.push(...aplanar(suite.suites, actual));
  }
  return filas;
}

function ms(valor) {
  return valor >= 1000 ? `${(valor / 1000).toFixed(1)} s` : `${valor} ms`;
}

function limpiar(texto) {
  // Los códigos ANSI del error de Playwright rompen la tabla Markdown.
  return texto
    .replace(/\[[0-9;]*m/g, "")
    .split("\n")[0]
    .slice(0, 160);
}

let informe;
try {
  informe = JSON.parse(readFileSync(ENTRADA, "utf8"));
} catch {
  console.error(`No se encontró ${ENTRADA}. Corre primero: npm test`);
  process.exit(1);
}

const filas = aplanar(informe.suites);
const total = filas.length;
const verdes = filas.filter((f) => f.estado === "passed").length;
const rojas = filas.filter((f) => f.estado === "failed" || f.estado === "timedOut");
const omitidas = filas.filter((f) => f.estado === "skipped").length;
const duracion = informe.stats?.duration ?? filas.reduce((a, f) => a + f.duracion, 0);
const fecha = new Date(informe.stats?.startTime ?? Date.now()).toLocaleString("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
});

const porCaso = new Map();
for (const fila of filas) {
  if (!porCaso.has(fila.cu)) porCaso.set(fila.cu, []);
  porCaso.get(fila.cu).push(fila);
}
const casosOrdenados = [...porCaso.keys()].sort();

const L = [];
L.push("# Registro de pruebas end-to-end");
L.push("");
L.push("> Generado automáticamente por `npm run reporte`. No editar a mano.");
L.push("");
L.push(`**Fecha:** ${fecha}  `);
L.push(`**Entorno:** frontend \`localhost:5173\` · API \`localhost:3001\` · Chromium  `);
L.push(`**Duración total:** ${ms(Math.round(duracion))}`);
L.push("");
L.push("## Resumen");
L.push("");
L.push("| Total | Pasaron | Fallaron | Omitidas | Cobertura de casos de uso |");
L.push("|---|---|---|---|---|");
const cubiertos = casosOrdenados.filter((c) => c !== "sin CU").length;
L.push(
  `| ${total} | ${verdes} | ${rojas.length} | ${omitidas} | ${cubiertos}/${Object.keys(CASOS).length} |`,
);
L.push("");

L.push("## Estado por caso de uso");
L.push("");
L.push("| Caso de uso | Descripción | Pruebas | Estado |");
L.push("|---|---|---|---|");
for (const cu of casosOrdenados) {
  const grupo = porCaso.get(cu);
  const fallos = grupo.filter((f) => f.estado !== "passed" && f.estado !== "skipped").length;
  L.push(
    `| **${cu}** | ${CASOS[cu] ?? "—"} | ${grupo.length} | ${fallos === 0 ? "✅ Conforme" : `❌ ${fallos} con fallo`} |`,
  );
}
const faltantes = Object.keys(CASOS).filter((c) => !porCaso.has(c));
if (faltantes.length) {
  L.push("");
  L.push(`> ⚠️ Casos de uso sin ninguna prueba: ${faltantes.join(", ")}.`);
}
L.push("");

L.push("## Detalle de cada prueba");
L.push("");
for (const cu of casosOrdenados) {
  L.push(`### ${cu} · ${CASOS[cu] ?? "Sin caso de uso asignado"}`);
  L.push("");
  L.push("| # | Garantía verificada | Estado | Duración |");
  L.push("|---|---|---|---|");
  porCaso.get(cu).forEach((fila, i) => {
    L.push(
      `| ${i + 1} | ${fila.titulo} | ${ICONO[fila.estado] ?? "❔"} ${fila.estado} | ${ms(fila.duracion)} |`,
    );
  });
  L.push("");
}

if (rojas.length) {
  L.push("## Fallos");
  L.push("");
  for (const fila of rojas) {
    L.push(`### ❌ ${fila.cu} · ${fila.titulo}`);
    L.push("");
    L.push(`- **Archivo:** \`${fila.archivo}\``);
    L.push(`- **Error:** ${limpiar(fila.error) || "sin mensaje"}`);
    if (fila.adjuntos.length) {
      L.push(`- **Evidencia:** ${fila.adjuntos.join(", ")} (en \`reportes/artefactos/\`)`);
    }
    L.push("");
  }
} else {
  L.push("## Fallos");
  L.push("");
  L.push("Ninguno. Todas las pruebas ejecutadas pasaron.");
  L.push("");
}

L.push("## Evidencia");
L.push("");
L.push("- Reporte navegable: `reportes/html/` (`npm run ver-reporte`)");
L.push("- Para CI: `reportes/junit.xml`");
L.push("- Capturas, vídeo y traza de los fallos: `reportes/artefactos/`");
L.push("- Traza paso a paso: `npx playwright show-trace <ruta de la traza>`");
L.push("");

writeFileSync(SALIDA, L.join("\n"));
console.log(`REGISTRO.md generado: ${verdes}/${total} pruebas en verde, ${cubiertos} casos de uso cubiertos.`);
