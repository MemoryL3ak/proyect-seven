# Retención y eliminación de datos — Seven Arena

Inventario de datos personales: qué se recolecta, dónde vive, qué pasa al
eliminar la cuenta y cuánto tiempo se conserva. Es la fuente para completar el
formulario de **Data safety** de Google Play y la sección de conservación de la
**política de privacidad**. Refleja el comportamiento real del backend
(`proyect-seven`); cada plazo citado tiene su implementación referenciada.

Última actualización: 2026-08-27.

---

## 1. Ciclo de vida de una cuenta

1. **Baja** (desde la app o el portal): `POST /m/auth/account/delete` marca la
   cuenta `DELETED` (`src/mobile-auth/mobile-auth.service.ts`). En el mismo
   flujo se eliminan de inmediato los **tokens de dispositivo** y todos los
   **datos de ubicación** del usuario (ver §2).
2. **Período de gracia — 30 días**: la cuenta puede reactivarse desde el
   portal de administración (`POST /athletes/:id/reactivate` y equivalentes).
   Los datos personales restantes se conservan solo para permitir esa
   reactivación.
3. **Purga definitiva**: un job diario (`src/account-purge/account-purge.service.ts`,
   08:00 UTC) toma las cuentas `DELETED` con más de 30 días y:
   - anonimiza los campos identificatorios de la fila (nombre → "Usuario
     eliminado", correo/teléfono/pasaporte/RUT/fecha de nacimiento → nulos);
   - elimina la ficha de salud, fotografías y documentos de Storage;
   - elimina sus notificaciones, tokens y telemetría remanente;
   - marca `metadata.purgedAt`. Desde ese momento **la reactivación queda
     bloqueada** con un mensaje explícito.

   La fila anonimizada se conserva para que el historial operacional (viajes,
   asignaciones, cupones) siga siendo consistente, pero ya no identifica a la
   persona.

## 2. Datos de ubicación

| Dato | Tabla | Retención | Al eliminar la cuenta |
|---|---|---|---|
| GPS de conductores (trazas crudas, ~1 fix cada 3–5 s) | `telemetry.vehicle_positions` | **90 días** rodantes | Borrado **inmediato** por `driver_id` |
| GPS de usuarios VIP (tracking del portal) | `telemetry.user_positions` | **90 días** rodantes | Borrado **inmediato** por `athlete_id` |
| Última posición del pasajero durante un viaje | `transport.trips.passenger_lat/lng` | Vive con el viaje | Se **anula de inmediato** en todos sus viajes |

La purga de 90 días la ejecuta pg_cron a diario
(`scripts/20260827_telemetry_purge.sql`, job `telemetry-purge-daily`, función
`telemetry.purge_old_positions()`).

Los **datos derivados** de los viajes (origen, destino, horarios, conductor
asignado, costo) viven en `transport.trips` y **no** contienen el rastro punto
a punto; son los que cubren auditoría y facturación (ver §4).

## 3. Inventario por categoría

| Categoría | Dónde vive | ¿Se conserva tras la baja? | Plazo | Motivo |
|---|---|---|---|---|
| Identificativos: nombre, correo, teléfono, pasaporte, RUT, fecha de nacimiento | `core.athletes`, `transport.drivers`, `core.provider_participants` | Sí, solo durante la gracia | 30 días → anonimización | Permitir reactivación |
| Ficha de salud (datos + documento médico) | `metadata.healthRecord` + bucket `athlete-health-docs` | Sí, solo durante la gracia | 30 días → eliminación | Permitir reactivación |
| Fotografías (perfil, fotos de jornada del conductor) | buckets `athlete-photos`, `driver-photos` | Sí, solo durante la gracia | 30 días → eliminación | Permitir reactivación |
| Documentos personales (licencias, credenciales) | bucket `driver-documents` | Sí, solo durante la gracia | 30 días → eliminación | Permitir reactivación |
| Ubicación GPS cruda | `telemetry.*` (ver §2) | **No** | Inmediato (y 90 días rodantes en operación) | — |
| Historial de viajes (sin trazas GPS) | `transport.trips`, `transport.trip_athletes` | Sí, vinculado a la fila anonimizada | Pendiente Tarea 6 — propuesta: duración del contrato + 12 meses | Auditoría y facturación B2B |
| Notificaciones (bandeja de la campanita) | `core.notifications` | Sí, solo durante la gracia | 30 días → eliminación | Continuidad si se reactiva |
| Tokens de dispositivo (push) | `core.device_tokens` | **No** | Inmediato con la baja | — |
| Sesión de portal | `metadata.portalSessionId/At` | **No** | Se limpia con la baja | — |
| Mensajes de chat (viaje y soporte) | `transport.trip_messages`, chats de soporte | Sí, vinculados a la cuenta anonimizada | Sin purga propia (decisión pendiente) | Registro operacional del evento |
| Rastro de auditoría de la baja | `metadata.deletedAt/deletedBy/purgedAt` | Sí (no identifica a la persona) | Indefinido | Evidencia de cumplimiento |

Cuentas marcadas `DELETED` manualmente sin `metadata.deletedAt` no entran al
ciclo de purga (no hay fecha desde la cual contar la gracia); la baja
self-service siempre lo registra.

## 4. Obligaciones contractuales (Tarea 6 — pendiente de negocio)

Si algún contrato con clientes exige retención mayor a 90 días, aplica a los
**datos derivados** de `transport.trips` (que ya se conservan), no a las trazas
GPS crudas. Propuesta: duración del contrato + 12 meses. Confirmar contra los
contratos vigentes antes de fijar el número en la política.

## 5. Respaldos

Confirmado el 2026-08-27 en el panel de Supabase (Database → Backups):

- Respaldos **diarios** automáticos (alrededor de medianoche de la región del
  proyecto), con ventana de retención de **7 días** (7 respaldos físicos en
  rotación; PITR no habilitado).
- Un dato borrado de la base persiste por lo tanto **hasta 7 días
  adicionales** en los respaldos antes de desaparecer por rotación. En la
  práctica: trazas GPS ≤ 97 días en el peor caso; datos personales de una
  cuenta purgada ≤ 37 días desde la baja.
- **Storage no se incluye en los respaldos** (solo guardan metadatos de los
  archivos): las fotografías, fichas de salud y documentos eliminados no
  persisten en ninguna copia.

Redacción sugerida para la política: "los datos eliminados de la base de
datos pueden persistir en copias de seguridad hasta 7 días adicionales". Si
más adelante se habilita PITR, actualizar este número con la nueva ventana.

## 6. Vía de eliminación sin la aplicación (Tarea 7)

La baja no requiere tener la app instalada: la API es pública y el código de
acceso es la credencial. Para la página en `sevenarenaapp.com`:

1. `POST /m/auth/login` con `{ "code": "<código de acceso>" }` → devuelve
   `kind` (`athlete`/`driver`) y el `athleteId`/`driverId`.
2. `POST /m/auth/account/delete` con `{ "kind", "userId", "code" }` → baja
   inmediata (mismo flujo del §1, incluida la eliminación inmediata de
   ubicación y tokens).

Quien no recuerde su código puede recuperarlo con `POST /m/auth/recover`
(por correo) o escribir al soporte; en ese caso un operador ejecuta la baja
desde el portal de administración. Plazo máximo de respuesta comprometido:
**30 días** (RGPD art. 12.3 / Ley 21.719).

## 7. Resumen para el formulario de Data safety

- ¿El usuario puede solicitar la eliminación de sus datos? **Sí** (en la app y
  vía web, §6).
- ¿Qué se elimina de inmediato con la baja? Ubicación (todas las fuentes),
  tokens de dispositivo, sesión.
- ¿Qué se elimina a los 30 días? Identificativos, ficha de salud, fotos,
  documentos, notificaciones.
- ¿Qué se retiene después? Historial de viajes y registros operacionales
  **anonimizados** (sin nombre, contacto ni ubicación), y el rastro de
  auditoría de la propia baja.
- Retención de ubicación en operación normal: **90 días** (+ hasta 7 días en
  respaldos, §5).
