# Control de acceso de la API (SA-BACKEND-03)

Desde el commit que cierra SA-BACKEND-03, **toda la API exige autenticación
por omisión**: un guard global (`APP_GUARD`, `src/auth/api-auth.guard.ts`)
rechaza con `401` cualquier petición sin credenciales. Los servicios nuevos
quedan protegidos sin necesidad de acción alguna.

## Identidades aceptadas

| Identidad | Credencial | Quién |
|---|---|---|
| `staff` | `Authorization: Bearer <JWT Supabase>` (emitido por `POST /auth/login`) | Personal del panel de administración |
| `portal` · `athlete` | headers `x-portal-kind` / `x-portal-user` / `x-portal-session` | Atleta o usuario VIP con sesión única activa |
| `portal` · `driver` | ídem | Conductor (Flota propia o participante de proveedor) |
| `portal` · `staff` | ídem | Staff de proveedor (portal de control de acceso) |

La sesión única de portal se obtiene con `POST /m/auth/login` (código de
acceso → identidad) seguido de `POST /m/auth/session/claim`; `apiFetch`
adjunta los headers automáticamente. Una cuenta Supabase vinculada a un
conductor (`drivers.user_id`) se trata como conductor de portal, **no** como
staff.

`@StaffOnly()` restringe además un endpoint o controller al personal del
panel: gestión de usuarios (`/auth/register`, `/auth/users*`), SofIA,
purga de cuentas, destinatarios y prueba de push.

## Exclusiones explícitas (`@Public()`)

Cada exclusión lleva su justificación en el código. Inventario completo:

| Endpoint | Justificación |
|---|---|
| `GET /` | Health check de la plataforma (Railway) |
| `POST /auth/login`, `POST /auth/change-temporary-password` | Login del panel; la credencial es la contraseña |
| `POST /m/auth/*` (login, recover, session/claim·validate·release, account/delete, realtime-token) | Login y ciclo de sesión de los portales; cada uno valida su propia credencial (código de acceso o sessionId) |
| `POST /athletes/request-access`, `POST /drivers/request-access`, `POST /access-control/request-access` | Recuperación del código de acceso por correo |
| `POST /coupon-partners/auth/login`, `.../auth/logout`, `.../me/*` | Socios de cupones: autenticados por `PartnerAuthGuard` (token de socio `X-Partner-Token`) |
| `POST /vehicle-positions` | Ingesta GPS del shell nativo, en modo transicional (`VEHICLE_POSITIONS_INGEST_AUTH=log`); `VehiclePositionsGuard` decide. Con `enforce` exige la sesión del conductor |

## Campos que nunca salen en una respuesta

- `metadata.portalSessionId` / `portalSessionAt` — credencial de sesión de
  portal. Un interceptor global (`SensitiveFieldsInterceptor`) los elimina
  recursivamente de toda respuesta JSON.
- `credentialCode` (código de la credencial de acreditación) — fuera de los
  listados `GET /athletes` y `GET /drivers`; en el detalle sólo lo reciben el
  personal del panel o el propio titular.

## Verificación de cierre

```bash
for ep in /trips /athletes /drivers /support-chats /vehicle-positions; do
  printf "%-20s %s\n" "$ep" "$(curl -s -o /dev/null -w '%{http_code}' https://proyect-seven-production.up.railway.app$ep)"
done
```

Todos deben responder `401`.
