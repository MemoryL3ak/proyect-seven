# Tracking en Tiempo Real — Guía Técnica para Integración Móvil

Este documento describe el mecanismo de **tracking de posiciones GPS en tiempo real** de Seven Arena, orientado al proveedor que desarrollará las aplicaciones móviles nativas (React Native). Reemplaza la necesidad de implementar un canal WebSocket propio en el backend — la plataforma ya cuenta con un canal Realtime operativo basado en **Supabase Realtime** (WebSocket sobre logical replication de PostgreSQL).

---

## 1. Arquitectura

```
┌────────────────────┐     POST /vehicle-positions      ┌────────────────────┐
│  App Conductor     │ ────────────────────────────────▶│   Backend NestJS   │
│  (React Native)    │           cada 5 seg              │   (Railway)        │
└────────────────────┘                                   └──────────┬─────────┘
                                                                    │ INSERT
                                                                    ▼
                                                     ┌──────────────────────────┐
                                                     │ Supabase PostgreSQL      │
                                                     │ telemetry.vehicle_       │
                                                     │ positions                │
                                                     └──────────┬───────────────┘
                                                                │ logical replication
                                                                ▼
                                                     ┌──────────────────────────┐
                                                     │  Supabase Realtime       │
                                                     │  (WebSocket server)      │
                                                     └──────────┬───────────────┘
                                                                │ push en tiempo real
           ┌────────────────────────────────────────────────────┼────────────────────┐
           ▼                                                    ▼                    ▼
┌────────────────────┐                               ┌────────────────────┐ ┌────────────────────┐
│  App VIP           │                               │  App Jefe Deleg.   │ │  Panel Admin Web   │
│  (React Native)    │                               │  (React Native)    │ │  (ya operativo)    │
└────────────────────┘                               └────────────────────┘ └────────────────────┘
```

El flujo es **push nativo**: cada `INSERT` en la tabla `telemetry.vehicle_positions` se replica automáticamente a todos los clientes suscritos mediante WebSocket, sin polling.

---

## 2. Modelo de datos

Tabla: **`telemetry.vehicle_positions`**

| Columna        | Tipo                      | Descripción                                           |
|----------------|---------------------------|-------------------------------------------------------|
| `id`           | `uuid`                    | PK                                                    |
| `event_id`     | `uuid`                    | Evento deportivo asociado                             |
| `driver_id`    | `uuid`                    | ID del conductor (provider_participant o driver)      |
| `vehicle_id`   | `uuid` (nullable)         | ID del vehículo                                       |
| `timestamp`    | `timestamptz`             | Marca de tiempo de la posición (ISO 8601)             |
| `location`     | `geometry(Point, 4326)`   | Posición PostGIS (no consumir directamente)           |
| `lat`          | `double precision`        | **Latitud** (columna generada desde `location`)       |
| `lng`          | `double precision`        | **Longitud** (columna generada desde `location`)      |
| `speed`        | `float` (nullable)        | Velocidad en m/s                                      |
| `heading`      | `float` (nullable)        | Rumbo en grados                                       |
| `created_at`   | `timestamptz`             | Insertado por el backend                              |

**Para la integración móvil usar siempre `lat` y `lng`**, ignorar `location` (serializa como PostGIS hex).

---

## 3. Envío de posiciones (lado del conductor)

El conductor envía su posición cada 5 segundos vía REST al backend existente:

```
POST https://proyect-seven-production.up.railway.app/vehicle-positions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "eventId": "…",
  "driverId": "…",
  "vehicleId": "…",
  "timestamp": "2026-04-18T14:32:05.123Z",
  "location": { "type": "Point", "coordinates": [-70.6506, -33.4372] },
  "speed": 12.3,
  "heading": 45
}
```

**No se requiere modificación al backend** — este endpoint ya está en producción.

---

## 4. Consumo en tiempo real (lado del pasajero / admin)

### 4.1 Credenciales Supabase

El cliente móvil debe instanciar el Supabase JS Client con los siguientes valores (Seven Arena entregará las credenciales finales):

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://<project>.supabase.co',
  '<anon_public_key>'
)
```

La autenticación se hereda de la sesión de Supabase Auth del usuario (email + password). No hay configuración adicional.

### 4.2 Suscripción por conductor

Ejemplo en React Native para mover el pin del mapa conforme llega cada posición:

```typescript
useEffect(() => {
  const channel = supabase
    .channel(`driver-${driverId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'telemetry',
        table: 'vehicle_positions',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        const { lat, lng, timestamp, speed, heading } = payload.new
        updateMarker({ lat, lng, timestamp, speed, heading })
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [driverId])
```

### 4.3 Suscripción por viaje (recomendada)

Si se conoce el `driverId` o el `vehicleId` del viaje activo, es preferible filtrar por ese campo en vez de suscribirse a toda la tabla, para reducir tráfico.

---

## 5. Seguridad (Row Level Security)

La tabla tiene RLS habilitado. La política actual permite **lectura a cualquier usuario autenticado** (`authenticated` role de Supabase Auth). Es suficiente para la operación inicial.

Para el modelo futuro de producción se puede restringir a participantes del viaje (cada usuario solo ve las posiciones de los viajes en los que participa como conductor, pasajero o administrador). La restricción se aplica únicamente a nivel de política SQL, sin cambios en el cliente.

---

## 6. Inicialización — histórico reciente

Al abrir la pantalla del mapa, el cliente móvil debe:

1. Cargar **la última posición conocida** del conductor mediante el endpoint REST existente:
   - `GET /vehicle-positions/by-driver/:driverId` → retorna la última posición del conductor.
2. Pintar el pin inicial con ese dato.
3. Suscribirse al canal Realtime para las siguientes posiciones.

Este patrón evita que el mapa quede vacío mientras espera el primer push.

---

## 7. Manejo de desconexión

El Supabase JS Client gestiona automáticamente:

- **Reconexión automática** ante pérdidas de red.
- **Reenvío de eventos** al reconectar (siempre que estén dentro de la ventana de retención del WAL).
- **Heartbeats** para mantener la conexión viva en background.

En caso de desconexión prolongada, el cliente debe ejecutar nuevamente `GET /vehicle-positions/by-driver/:driverId` para sincronizar antes de reanudar la suscripción.

---

## 8. Equivalencia con WebSocket

Supabase Realtime usa **WebSocket estándar** por debajo (protocolo `phoenix-websocket`). Técnicamente cumple cualquier requerimiento que exija WebSocket para tracking en tiempo real. Para el proveedor de la aplicación móvil, el consumo es transparente — el Supabase JS Client abstrae el WebSocket completamente.

---

## 9. Rendimiento esperado

- **Latencia de entrega**: 50–200 ms entre `INSERT` en la tabla y evento recibido por el cliente.
- **Throughput**: la configuración actual permite hasta 10 eventos por segundo por canal; suficiente para una flota completa de conductores.
- **Consumo de batería móvil**: comparable al de una conexión HTTP persistente, significativamente menor que polling cada 3–5 segundos.

---

## 10. Checklist de integración

- [ ] El proveedor instala `@supabase/supabase-js` en el proyecto React Native.
- [ ] Seven Arena entrega `SUPABASE_URL` y `SUPABASE_ANON_KEY` del ambiente correspondiente (staging / producción).
- [ ] El proveedor usa el mismo cliente Supabase para autenticación (login email/password) y para Realtime.
- [ ] Antes de suscribirse al canal, se obtiene el `driverId` del viaje activo vía la API REST (`GET /trips/:id`).
- [ ] Al cerrar la pantalla se ejecuta `supabase.removeChannel(channel)` para liberar la suscripción.

---

**Referencia de ejemplo funcional**: el panel de administración web de Seven Arena ya consume este canal Realtime en la vista de tracking (`/operations/vehicle-positions`), reemplazando el polling HTTP que usaba anteriormente. El código de esa pantalla puede servir como referencia de implementación.
