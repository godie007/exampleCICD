/**
 * Datos y utilidades compartidas por las pruebas e2e.
 *
 * No hay base de pruebas: la app escribe en `backend/data/archivo.db`, la misma
 * que usa quien desarrolla. Por eso cada prueba crea sus propios contactos con
 * un email único y los borra al terminar, y ninguna afirma sobre el total
 * absoluto del directorio.
 */
export const API = "http://localhost:3001/api/contacts";

/** Prefijo reconocible: permite detectar (y limpiar) restos de una corrida. */
export const PREFIJO = "E2E";

let contador = 0;

/**
 * Contacto único por llamada. El email lleva marca de tiempo y contador para
 * que dos corridas simultáneas no choquen contra la restricción UNIQUE.
 */
export function contacto(overrides = {}) {
  contador += 1;
  const marca = `${Date.now()}-${contador}`;
  return {
    nombre: `${PREFIJO} Persona ${marca}`,
    email: `e2e.${marca}@halcyn.co`,
    telefono: "+57 300 111 2233",
    cargo: "Ingeniería de pruebas",
    notas: "Creado por la suite e2e. Si ves esto, algo no limpió.",
    ...overrides,
  };
}

/** Alta por API: sembrar por HTTP es mucho más rápido que por formulario. */
export async function crearPorApi(request, datos = contacto()) {
  const res = await request.post(API, { data: datos });
  if (!res.ok()) {
    throw new Error(`No se pudo sembrar el contacto: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Baja por API. Se usa en el teardown: es rápida y no depende de que la UI
 * funcione — una prueba que falla debe limpiar igual.
 */
export async function borrarPorApi(request, id) {
  if (id == null) return;
  await request.delete(`${API}/${id}`);
}

/** Borra todo lo que haya quedado con el prefijo E2E. Red de seguridad. */
export async function limpiarRestos(request) {
  const res = await request.get(API);
  if (!res.ok()) return 0;
  const contactos = await res.json();
  const restos = contactos.filter((c) => c.nombre.startsWith(PREFIJO));
  for (const resto of restos) {
    await request.delete(`${API}/${resto.id}`);
  }
  return restos.length;
}

/** Cuántas fichas hay ahora mismo. Para afirmar deltas, nunca totales. */
export async function totalContactos(request) {
  const res = await request.get(API);
  return (await res.json()).length;
}
