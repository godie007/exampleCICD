# Registro de pruebas end-to-end

> Generado automáticamente por `npm run reporte`. No editar a mano.

**Fecha:** 17 de septiembre de 2026, 6:08 p. m.  
**Entorno:** frontend `localhost:5173` · API `localhost:3001` · Chromium  
**Duración total:** 54.3 s

## Resumen

| Total | Pasaron | Fallaron | Omitidas | Cobertura de casos de uso |
|---|---|---|---|---|
| 49 | 49 | 0 | 0 | 6/6 |

## Estado por caso de uso

| Caso de uso | Descripción | Pruebas | Estado |
|---|---|---|---|
| **CU-01** | Consultar el directorio | 6 | ✅ Conforme |
| **CU-02** | Buscar un contacto | 8 | ✅ Conforme |
| **CU-03** | Crear un contacto | 11 | ✅ Conforme |
| **CU-04** | Editar un contacto | 10 | ✅ Conforme |
| **CU-05** | Eliminar un contacto | 8 | ✅ Conforme |
| **CU-06** | Detectar que la API no responde | 6 | ✅ Conforme |

## Detalle de cada prueba

### CU-01 · Consultar el directorio

| # | Garantía verificada | Estado | Duración |
|---|---|---|---|
| 1 | al abrir la app se ve el directorio con sus fichas | ✅ passed | 1.0 s |
| 2 | cada ficha muestra nombre, email y cargo | ✅ passed | 741 ms |
| 3 | cada ficha ofrece los botones de editar y eliminar | ✅ passed | 728 ms |
| 4 | el contador de la cabecera coincide con el número de fichas visibles | ✅ passed | 793 ms |
| 5 | el contador usa singular o plural según corresponda | ✅ passed | 744 ms |
| 6 | las fichas llegan ordenadas por nombre, como las sirve la API | ✅ passed | 836 ms |

### CU-02 · Buscar un contacto

| # | Garantía verificada | Estado | Duración |
|---|---|---|---|
| 1 | buscar por nombre deja solo las fichas que coinciden | ✅ passed | 798 ms |
| 2 | buscar por email también filtra | ✅ passed | 785 ms |
| 3 | buscar por cargo también filtra | ✅ passed | 760 ms |
| 4 | la búsqueda no distingue mayúsculas | ✅ passed | 761 ms |
| 5 | sin coincidencias se explica, no se deja la lista en blanco | ✅ passed | 792 ms |
| 6 | borrar la búsqueda restaura el directorio completo | ✅ passed | 795 ms |
| 7 | el filtrado no dispara ni una sola petición a la API | ✅ passed | 761 ms |
| 8 | el buscador no mira las notas: es un límite conocido, no un bug | ✅ passed | 754 ms |

### CU-03 · Crear un contacto

| # | Garantía verificada | Estado | Duración |
|---|---|---|---|
| 1 | el formulario arranca en modo creación, no en edición | ✅ passed | 729 ms |
| 2 | un alta válida aparece en el directorio y se anuncia con un toast | ✅ passed | 833 ms |
| 3 | tras crear, el formulario queda limpio para la siguiente alta | ✅ passed | 767 ms |
| 4 | el contador de la cabecera sube en uno tras un alta | ✅ passed | 745 ms |
| 5 | enviar el formulario vacío pinta los errores bajo cada campo obligatorio | ✅ passed | 822 ms |
| 6 | un email mal formado se señala bajo su campo y no crea nada | ✅ passed | 800 ms |
| 7 | un teléfono inválido se señala sin bloquear el resto del formulario | ✅ passed | 774 ms |
| 8 | un email repetido devuelve el 409 bajo el campo email | ✅ passed | 759 ms |
| 9 | corregir el campo borra su error sin tener que reenviar | ✅ passed | 734 ms |
| 10 | los campos opcionales pueden quedar vacíos | ✅ passed | 812 ms |
| 11 | el email se guarda normalizado en minúsculas | ✅ passed | 835 ms |

### CU-04 · Editar un contacto

| # | Garantía verificada | Estado | Duración |
|---|---|---|---|
| 1 | el lápiz carga los valores del contacto en el formulario | ✅ passed | 1.5 s |
| 2 | el panel anuncia a quién se está editando | ✅ passed | 1.5 s |
| 3 | en modo edición el botón cambia y aparece Cancelar | ✅ passed | 1.2 s |
| 4 | la tarjeta que se edita queda marcada como activa | ✅ passed | 1.2 s |
| 5 | guardar los cambios los refleja en el directorio y avisa | ✅ passed | 1.3 s |
| 6 | tras guardar se sale del modo edición | ✅ passed | 1.6 s |
| 7 | cancelar descarta los cambios sin tocar la ficha | ✅ passed | 1.5 s |
| 8 | editar valida igual que crear: un email roto se señala bajo su campo | ✅ passed | 849 ms |
| 9 | usar el email de otra persona devuelve el 409 bajo el campo | ✅ passed | 807 ms |
| 10 | el PUT es un reemplazo completo: vaciar un campo lo deja vacío | ✅ passed | 789 ms |

### CU-05 · Eliminar un contacto

| # | Garantía verificada | Estado | Duración |
|---|---|---|---|
| 1 | la papelera no borra: primero pide confirmación | ✅ passed | 1.2 s |
| 2 | el modal se anuncia como diálogo modal a la tecnología asistiva | ✅ passed | 1.6 s |
| 3 | cancelar cierra el modal y no borra nada | ✅ passed | 1.7 s |
| 4 | confirmar borra la ficha y lo anuncia | ✅ passed | 714 ms |
| 5 | el contador de la cabecera baja en uno tras borrar | ✅ passed | 766 ms |
| 6 | la baja persiste: sigue sin estar tras recargar | ✅ passed | 1.9 s |
| 7 | borrar a quien se estaba editando cancela la edición sola | ✅ passed | 6.5 s |
| 8 | borrar a otra persona no saca del modo edición | ✅ passed | 1.3 s |

### CU-06 · Detectar que la API no responde

| # | Garantía verificada | Estado | Duración |
|---|---|---|---|
| 1 | si el primer GET falla se explica el problema en un banner | ✅ passed | 965 ms |
| 2 | el banner ofrece reintentar | ✅ passed | 763 ms |
| 3 | con la API caída no se queda cargando para siempre | ✅ passed | 1.0 s |
| 4 | Reintentar recarga y, con la API de vuelta, el directorio se pinta | ✅ passed | 1.1 s |
| 5 | si la API cae al enviar el formulario, se avisa sin perder lo escrito | ✅ passed | 824 ms |
| 6 | un 500 del servidor se comunica con el mensaje del contrato de errores | ✅ passed | 926 ms |

## Fallos

Ninguno. Todas las pruebas ejecutadas pasaron.

## Evidencia

- Reporte navegable: `reportes/html/` (`npm run ver-reporte`)
- Para CI: `reportes/junit.xml`
- Capturas, vídeo y traza de los fallos: `reportes/artefactos/`
- Traza paso a paso: `npx playwright show-trace <ruta de la traza>`
