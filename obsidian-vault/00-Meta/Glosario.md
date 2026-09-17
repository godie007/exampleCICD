---
aliases: [Términos, Vocabulario]
tags: [meta, negocio]
type: concepto
---

# Glosario

Vocabulario compartido entre negocio e ingeniería. Cuando un término aparece en la UI, se anota entre comillas tal como lo ve la persona usuaria.

| Término | Significado | Dónde vive |
|---|---|---|
| **Archivo** | Nombre del producto. También el nombre de la base (`archivo.db`) y de los paquetes (`archivo-api`, `archivo-web`). | Todo el repo |
| **Contacto** | La única entidad del dominio: una persona del directorio. Ver [[Modelo de datos]]. | Tabla `contacts` |
| **Ficha** | Cómo la UI llama a un contacto ("fichas activas", "Nueva ficha", "Eliminar ficha"). Sinónimo de *contacto* de cara al usuario. | [[App estado]] |
| **Directorio** | El conjunto completo de contactos. Es el panel izquierdo de la UI. | [[ContactList]] |
| **Modo edición** | Estado en que el formulario apunta a un contacto existente en vez de crear uno nuevo. Lo determina `editing`. Ver [[Estados de la UI]]. | [[App estado]] |
| **Borrado pendiente** | Contacto seleccionado para eliminar, esperando confirmación en el modal. `pendingDelete`. | [[App estado]] |
| **Toast** | Aviso efímero (2.8 s) tras una mutación, con tono `ok` o `err`. | [[Sistema visual]] |
| **Semilla / seed** | Los 4 contactos que se insertan si la tabla está vacía al arrancar. Ver [[Módulo db]]. | `backend/src/db.js` |
| **Normalización** | Recorte de espacios y paso del email a minúsculas antes de persistir. Ver [[Validación y normalización]]. | `backend/src/validate.js` |
| **`value` vs `req.body`** | El backend **nunca** persiste el body crudo: guarda el `value` normalizado que devuelve el validador. Es una regla, no una casualidad. | [[Módulo contacts]] |
| **Conflicto único** | Intento de guardar un email que ya existe → HTTP 409. Ver [[ADR-005 Conflicto de email detectado por texto]]. | [[Contrato de errores]] |
| **`liquid-glass`** | Clase CSS del sistema visual (superficie translúcida). Reutilizarla antes de inventar estilos nuevos. | [[Sistema visual]] |

Relacionado: [[Reglas de negocio]], [[Contrato de API]].
