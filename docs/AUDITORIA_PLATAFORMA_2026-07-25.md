# Auditoría integral — Seven Arena (25 de julio de 2026)

Revisión completa del proyecto (backend NestJS, frontend admin, portales web, app móvil Expo, scripts SQL y configuración) realizada por 5 auditores independientes: backend, frontend admin, portales/móvil, seguridad transversal y producto/coherencia. Todos los hallazgos fueron verificados leyendo el código; nada es especulativo. **No se modificó ningún archivo.**

**Balance: ~120 hallazgos → consolidados aquí en 78 únicos** (12 críticos, 24 altos, 28 medios, 14 bajos).

---

## Resumen ejecutivo

1. **El problema nº 1 es seguridad, no funcionalidad.** De 259 endpoints HTTP del backend, solo 5 tienen autenticación (los de partners de cupones). Todo lo demás — usuarios, deportistas, viajes, hoteles, GPS, acreditaciones — es de lectura Y escritura pública para cualquiera que conozca la URL de la API. Con dos peticiones anónimas se puede tomar la cuenta de administrador.
2. **El problema nº 2 es la zona horaria.** Hay un bug sistémico de UTC vs. America/Santiago repetido en al menos 12 archivos (backend y frontend): desde las ~21:00 hora de Chile, "hoy" se convierte en "mañana" en calendarios, filtros del conductor, planillas y KPIs. Los 4 auditores técnicos lo encontraron por separado.
3. **El problema nº 3 es la duplicación.** 3 fuentes de "conductor", 3 versiones del portal de atleta, 2 módulos de salud, 2 de acreditación, 8 copias divergentes de los labels de estado de viaje, 5 términos para "participante". Cada duplicado ya tiene drift funcional visible.
4. **Lo positivo:** no hay secretos commiteados (verificado en todo el historial git), no hay inyección SQL (los ~120 `dataSource.query` usan placeholders), las contraseñas van por Supabase Auth y bcrypt, `lib/api.ts` y `driver-monitoring` son patrones de referencia bien hechos, y el módulo `coupon-partners` tiene la autenticación correcta que el resto debería copiar.

---

## PARTE 1 — SEGURIDAD (acción inmediata)

### Críticos

**S1. API completamente abierta (259 rutas públicas).**
`src/main.ts` no registra `APP_GUARD` ni `ValidationPipe`; `@UseGuards` solo existe en `src/coupons/coupon-partners.controller.ts`. `SupabaseStrategy` está definida pero nunca se usa; `RolesGuard` es código muerto (lee `request.user`, que nada puebla).
→ **Fix:** guard global JWT de Supabase en `app.module.ts` + decorador `@Public()` solo para `auth/login`, `auth/change-temporary-password`, `m/auth/*`, `*/request-access`. ~40 líneas que eliminan la mayor parte de los hallazgos de esta sección.

**S2. Toma de la cuenta admin sin credenciales.**
`src/auth/auth.controller.ts:10-43` sin guard: `GET /auth/users` vuelca todos los usuarios; `PUT /auth/users/:id` con `{password}` cambia la contraseña de cualquiera (usa `supabase.auth.admin.updateUserById` con service_role). También `POST /auth/register` con rol arbitrario, `DELETE`, `disable/enable`.
→ Guard + rol admin en todo `AuthController` salvo login; nunca cambiar password de terceros sin verificar la actual.

**S3. "Código de acceso" = últimos 6 caracteres del UUID, derivable públicamente.**
`src/mobile-auth/mobile-auth.service.ts:42-55`, `src/access-control/access-control.service.ts:37-88`, `src/athletes/athletes.service.ts:433`. Como `GET /athletes`, `/drivers`, `/provider-participants` son públicos y devuelven los UUID, **una sola petición entrega todos los códigos válidos del evento** — incluidos los del control de acceso físico a sedes. Además hay colisiones que bloquean logins legítimos (`mobile-auth.service.ts:167-172`).
→ Credenciales aleatorias (≥128 bits) o firmadas con expiración, hash en BD, desligadas del ID de fila. Rate limiting en el escáner.

**S4. `/m/auth/login` no emite token → todo el flujo de portales es IDOR estructural.**
El login devuelve `{athleteId, profile}` y nada más; las llamadas posteriores no pueden probar identidad. Consecuencias verificadas:
- `?athleteId=<uuid>` por query string inicia sesión como ese atleta (`portal/vehicle-request/page.tsx:571-608`); el propio portal user genera ese deep link (fuga por historial/Referer).
- "Sesión" = ID en `sessionStorage`/`localStorage`, editable con DevTools (5 portales + `lib/mobile-auth.ts:81-88`).
- Escrituras sin prueba de posesión desde móvil: `DELETE /trips/{id}` de cualquier viaje (`mobile/app/vehiculo.tsx:241`), `PATCH /trips/{id}`, `PATCH /athletes/{id}`, inyección de GPS falso vía `POST /vehicle-positions`.
- La validación del código de pickup del pasajero es 100% cliente (`conductor/page.tsx:453-469`, `mobile/app/conductor.tsx:197-206`) — se salta llamando al PATCH directo.
→ Emitir token de sesión opaco con expiración (copiar el patrón de `coupon-partners.service.ts:135-179`, que ya lo hace bien) y derivar identidad SIEMPRE de `req.user`, nunca de un parámetro.

**S5. Fuga masiva de PII y datos de salud.**
Los portales descargan datasets completos sin auth (`portal/conductor/page.tsx:241-278` baja TODOS los trips, drivers, athletes, providers con emails, RUT, teléfonos; `portal/user/page.tsx:445`). El backend devuelve la entidad completa: pasaporte, fecha de nacimiento, necesidades dietéticas, silla de ruedas, **número de habitación de hotel** (riesgo físico) y `metadata.healthRecord` (ficha médica).
→ Endpoints de portal `me`-scoped con proyección explícita de campos.

**S6. Documentos médicos en bucket público.**
`src/athletes/athletes.service.ts:485-529` sube a `athlete-health-docs` con `getPublicUrl()` y guarda la URL en metadata que `GET /athletes` (público) devuelve íntegra: cualquiera descarga certificados médicos de toda la delegación.
→ Bucket privado + URLs firmadas de corta vida.

**S7. Políticas de Storage permiten escritura al rol `anon`.**
`scripts/20260326_provider_documents_bucket.sql:14-16`, `20260409_driver_documents_policies.sql:6-12`, `20260129_schema_updates.sql:69-80`: las policies de INSERT/UPDATE no llevan `TO service_role`, aplican a `public` (incluye `anon`, cuya key está en el bundle del frontend). Cualquiera puede subir o **sobrescribir** pasaportes/licencias.
→ `TO service_role` en todas las policies de escritura; buckets de documentos privados.

**S8. QR de acreditación decorativo.**
`frontend/app/scan/accreditation/scan-client.tsx:27-31` renderiza `?name=&delegation=&...` tal cual llegan por URL, sin consultar al backend: se puede fabricar un QR con datos inventados que muestra una "credencial válida" con timestamp real.
→ El QR debe llevar solo un token; la página lo resuelve con `GET /accreditations/verify/:token`.

### Altos

**S9. `ValidationPipe` global ausente → los ~60 DTOs con class-validator son inertes.** `class-transformer` ni siquiera está en `package.json`. Mass assignment verificado: `PATCH /athletes/:id` acepta `accreditationStatus`, `credentialCode`, `status`, `metadata` arbitrarios → auto-acreditación anónima.
→ `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`.

**S10. SofIA pública con herramientas de escritura.** `POST /sofia/ask` sin guard despacha `create_trip`, `cancel_trip`, `update_accreditation_status`, `undo_last_action`, etc. con SQL de escritura; además quema la `OPENAI_API_KEY` sin límite y `GET /sofia/live?feed=gps` expone el feed GPS en vivo.
→ Guard + rol admin, límite de gasto, confirmación humana para herramientas mutantes.

**S11. CORS demasiado laxo con `credentials: true`.** `src/main.ts:48-61` acepta cualquier `*.vercel.app` (de cualquier cuenta del mundo), cualquier IP de red privada y peticiones sin Origin.
→ Lista blanca exacta por entorno.

**S12. Sin rate limiting, sin helmet, payload de 50 MB.** Fuerza bruta libre sobre logins y `/access-control/scan`.
→ `@nestjs/throttler` + `helmet` + bajar el límite de payload.

**S13. Uploads con Content-Type del atacante.** `athletes.service.ts:532-541` (y equivalentes en drivers): el MIME y la extensión salen del `dataUrl` del cliente → subir `text/html` servido desde Storage = XSS almacenado.
→ Lista blanca de MIME + validación de magic bytes.

**S14. Tokens en `localStorage` y cookie sin HttpOnly/Secure.** `frontend/lib/api.ts:29-31,218`: access y refresh token en localStorage; la cookie `seven.auth` se escribe sin `Secure` ni `HttpOnly`. El `refreshToken` se guarda pero **nunca se usa** (no hay flujo de refresh), y `apiFetch` no maneja 401/403: al expirar la sesión el usuario ve errores crudos.

**S15. Middleware del frontend cosmético.** `frontend/middleware.ts:12-18` solo comprueba que la cookie exista (`document.cookie="seven.auth=x"` da acceso a /admin); el gating de módulos del SideNav es fail-open y lee de localStorage editable (`SideNav.tsx:267-277`).

**S16. Fuga de credenciales en logs.** `mobile-auth.service.ts:66-76` escribe el código de acceso + email en texto claro en los logs.

**S17. RLS casi inexistente y `GRANT ALL ... TO anon`.** `scripts/20260327_provider_participants.sql:26` otorga todo a `anon` sin RLS; en todo `scripts/` solo 2 tablas activan RLS y con policies `USING (true)`.
→ Revocar grants a anon, activar RLS por defecto, confirmar en Supabase qué esquemas expone PostgREST.

**S18. Otros:** enumeración de usuarios en `request-access` (mensajes distintos si el correo existe); chats de soporte públicos incluidas notas internas (`support-chats.controller.ts:26-51`); `POST /push-notifications/test` público (spam de notificaciones); 13 endpoints de workforce abiertos; `ssl: { rejectUnauthorized: false }` y `synchronize` activable por env en `app.module.ts:61-63`; API key de Google Maps sin restricción por referrer; `mobile/lib/api.ts:1` cae a `http://localhost:3000` en producción si falta la variable.

> **Antes de desplegar los fixes: rotar `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` y contraseñas de admin**, asumiendo que la exposición pudo haberse explotado.

---

## PARTE 2 — BUGS FUNCIONALES

### Zona horaria (sistémico — el mismo bug en 12+ lugares)

Patrón: usar `toISOString().slice(0,10)` (día UTC) o `new Date()` del servidor (UTC en Railway) donde corresponde el día/hora de Chile. Desde las ~21:00 hora chilena todo se corre un día.

| Dónde | Efecto |
|---|---|
| `src/trips/trips-schedule.service.ts:148-157` (`mergeDateTime`) | "09:00" de la planilla se guarda como 09:00 UTC = **06:00 en Chile** en producción |
| `frontend/.../trips/page.tsx:50-64` (`toIsoDateTime`) | Filas sin hora → medianoche UTC (día anterior en Chile); filas con hora → hora local. La misma planilla mezcla ambos |
| `sports-calendar/page.tsx:161-164` + `deportes/page.tsx:1013+` | Actividades después de las 21:00 aparecen en la celda del día siguiente |
| `sports-calendar/day/[dayKey]/page.tsx:176-185` | Mezcla bounds locales con comparación UTC → registros que desaparecen del detalle del día |
| `daily-transport/page.tsx:354` + `commercial:81` + `flights:165` | La "vista del día" arranca en mañana por la noche |
| `daily-transport/page.tsx:1135` | Muestra la hora UTC cruda (`slice(11,16)`) — el mismo viaje muestra 09:00 en Viajes y 06:00 aquí |
| `portal/conductor/page.tsx:768-778` | El filtro "hoy" del conductor usa día UTC |
| `portal/user/page.tsx:1902,2370,2423` | Premiaciones agrupadas en el día equivocado; "menú de hoy/mañana" corrido |
| `src/driver-presence/driver-presence.service.ts:245-254` (`stats`) | KPIs "de hoy" en UTC mientras `list()` usa Chile — desalineados entre sí |
| `src/fleet` (90s) vs `driver-presence` (100s) | Dos umbrales distintos de "online" para el mismo conductor |

→ **Fix único:** helper compartido (`lib/format.ts` en frontend, `shared/dates.ts` en backend) con `timeZone: "America/Santiago"` para clave-de-día, hora mostrada y construcción de timestamps. `driver-monitoring/page.tsx:49-60` ya tiene la implementación correcta — centralizarla.

### Backend

- **B1 (ALTO). Límite de 1000 filas de PostgREST ignorado** en `fetchPendingTrips`, `fetchExistingWindows`, `fetchDriverProfiles` (`trips-schedule.service.ts`) y en los escaneos de tabla de mobile-auth/access-control. Con >1000 pendientes, los excedentes no se asignan **silenciosamente**; con >1000 ventanas ocupadas, **doble reserva de conductor**. → Paginar con `.range()` en bucle.
- **B2 (ALTO). `fleet.availability` lee de `transport.drivers` (tabla vacía)** (`fleet.service.ts:75`) cuando los conductores reales viven en `provider_participants`. El monitor de flota muestra lista vacía/incompleta. Misma fuente errada en mobile-auth, access-control y push.
- **B3 (MEDIO). Cero transacciones en todo el backend** (grep de `transaction`/`queryRunner` = 0). Creación de viaje ida+vuelta+atletas, alta de conductor con vehículo+user, asignaciones masivas de hotel: cualquier fallo intermedio deja registros huérfanos.
- **B4 (MEDIO). El tramo de vuelta siempre queda `SCHEDULED`** aunque la ida sea `REQUESTED` (`trips.service.ts:584` pasa un DTO vacío a `inferStatus`).
- **B5 (MEDIO). `auth login` recorta la contraseña** con `.trim()` (`auth.service.ts:152`) — contraseñas con espacios fallan silenciosamente.
- **B6 (MEDIO). Filtro PostgREST interpolado** en `trips.service.ts:440` (`.or(\`id.eq.${driverId}...\`)`): valores con comas/paréntesis rompen el filtro.
- **B7 (BAJO). `normalizeClientType` no filtra nada**: `return VALID.includes(v) ? v : v;` — ambas ramas devuelven `v` (`trips-schedule.service.ts:168-172`).

### Frontend admin

- **F1 (CRÍTICO). El polling de Viajes revierte el filtro "Todos los eventos" cada 8 s** (`trips/page.tsx:465-535`): el interval captura el closure inicial y re-selecciona el primer evento con el estado stale. → Efecto de auto-default separado con ref `didInit`.
- **F2 (ALTO). El dashboard falla en silencio y muestra ceros como datos reales** (`(main)/page.tsx:133-134`): `catch {}` sobre un `Promise.all` de 7 fetches todo-o-nada. → Estado de error visible + fetches independientes.
- **F3 (ALTO). Mutación directa del estado React**: `viewTrips.sort(...)` en render (`daily-transport:1131`).
- **F4 (MEDIO). Estado `ASSIGNED` no contemplado en Solicitudes T1/VIP** (`trip-requests/page.tsx:41-49`): chip crudo en inglés, timeline null, y `canManage` impide reasignar/cancelar esas solicitudes. *(Relacionado: la raíz reconoce "SCHEDULED", "PROGRAMADO", "PROGRAMADA", "PROGRAMMED" a la vez — los estados llegan sin normalizar desde el backend.)*
- **F5 (MEDIO). Borrado ida+vuelta e importación fila-por-fila sin atomicidad** en trips (`:497-501`, `:341-376`); además si la celda de evento viene vacía la fila se cuelga del primer evento del catálogo sin aviso. → Usar endpoints bulk como ya hace daily-transport.
- **F6 (MEDIO). Catálogos con `catch` vacío** → dropdowns vacíos sin explicación (trip-requests:188, participantes:56, support-chats:97).
- **F7 (MEDIO). Polling sin pausa por visibilidad en 8 páginas** (trips cada 8 s con 8 endpoints, driver-monitoring cada 2,5 s…) — sigue bombardeando con la pestaña en background. → Hook `usePolling` compartido.
- **F8 (BAJO). KPIs "camas" y "habitaciones" son la misma colección** (`(main)/page.tsx:153-165`) — siempre coinciden.

### Portales y móvil

- **P1 (ALTO). La posición del pasajero nunca se envía**: el watcher de geolocalización depende solo de `[athlete?.id]` y lee `trip` de un closure viejo (`portal/user/page.tsx:846-884`).
- **P2 (ALTO). GPS offline se pierde sin cola ni reintento** (`conductor/page.tsx:494-497`, `mobile/conductor.tsx:91`): un conductor sin señal pierde todo el tramo. No hay manifest PWA ni service worker. → Buffer local + envío batch.
- **P3 (ALTO). La app Expo es invisible para el monitoreo**: no envía heartbeat ni `driverId`, y `if (!trip.eventId) return;` bloquea la transmisión de viajes sin evento (`mobile/conductor.tsx:78-92`). Un conductor en la app nativa aparece desconectado en el panel.
- **P4 (MEDIO). Wake Lock no se re-adquiere** tras minimizar (`conductor/page.tsx:523-551`): falta `wakeLock = null` en el listener de release — tras la primera minimización la pantalla vuelve a apagarse durante el tracking.
- **P5 (MEDIO). Polling agresivo**: ratings cada 8 s con un fetch por viaje para siempre; DistanceMatrix de Google en cada ciclo de 5 s (costo real de API).
- **P6 (MEDIO). Check-ins con doble escritura sin atomicidad** y error tragado (`user/page.tsx:569-587`).
- **P7 (MEDIO). Zoom bloqueado** (`portal/layout.tsx:6-12`, viola WCAG) y touch targets de 28px en el calendario nuevo (mínimo recomendado 44px).
- **P8 (BAJO).** Notification.requestPermission sin gesto del usuario; clasificación de actividades por regex del nombre (todo lo no reconocido = "COMPETENCIA"); el input de código del Expo no normaliza mayúsculas (el web sí); `conductor_seen_trips` en localStorage sin scoping por conductor.

---

## PARTE 3 — CALIDAD DE CÓDIGO Y ARQUITECTURA

- **A1. Tres fuentes de "conductor"** (`transport.drivers`, `provider_participants.metadata.isDriver`, y fleet/presence consultando una u otra según el archivo) con la lógica "quién es chofer" copiada en 5 servicios con reglas distintas. → Fuente única de verdad.
- **A2. Monolitos**: `ResourceScreen.tsx` 3.686 líneas, `vehicle-request` 3.588, `portal/user` 3.463 (60+ useState, 9 tabs inline en IIFEs), `conductor` 2.185, `SofiaService` ~2.000, `deportes` 1.955, `trips` 1.802 + 8 páginas más de >1.000. → Descomponer por tabs/componentes + hooks compartidos (`usePortalSession`, `useTripPolling`).
- **A3. Labels/colores de estado duplicados en 8 archivos y divergentes**: `REQUESTED` = "Solicitado"/"Pendiente", `DROPPED_OFF` = 3 traducciones, el chip T1 es azul en una pantalla y rojo en otra. → `lib/tripStatus.ts` + colores en `lib/clientTypes.ts` + componentes `StatusChip`/`ClientTypeChip`.
- **A4. Formateo de fechas duplicado 39 veces en 15 páginas**; `initials()` y `ago()` copiados 3 veces. → `lib/format.ts`.
- **A5. Duplicación total portal web ↔ app Expo** con drift ya visible (sin heartbeat, sin chat, sin persistencia de sesión, fallback a localhost). Además hay un **tercer** portal de atleta legacy (`portal/athlete`, `(portal)/athlete`) y un backup commiteado en el árbol de rutas (`portal/conductor/respaldo.tsx`, 2.185 líneas). → Decidir un solo cliente móvil (la evidencia apunta al WebView con native-bridge); eliminar los legacy.
- **A6. Código muerto**: bloque `display:none` "dummy" y tab "portal" inalcanzable en trips (`:1343-1381`, `:1557-1614`); `components/PageHeader.tsx` **ignora `title` y `description`** y lo usan 6 pantallas (los títulos que le pasan nunca se pintan); `StatCard.tsx` huérfano del tema oscuro viejo; `users/athletes` y `users/drivers` duplicados legacy.
- **A7. Acceso a datos por tres vías** (Supabase client, Repository TypeORM, `dataSource.query` crudo) incluso dentro del mismo servicio (`trips.service.ts`), con parches de "columna inexistente" que delatan drift entidad↔tabla. → Estandarizar y crear las migraciones pendientes.
- **A8. 73 usos de `any` en 15 páginas**; tipos `Trip` con doble convención `scheduledAt`/`scheduled_at`. → Adaptador de API que normalice el shape una vez.
- **A9. i18n a medias**: solo 21 de 78 páginas usan `useI18n`; el selector ES/EN/PT del sidebar es cosmético. → O completarlo o retirarlo del admin.
- **A10. `trips` vs `trip-requests` vs `transports`**: `trip_requests` replica casi todos los campos de `trips`; `src/transports` en realidad gestiona **vehículos**. Nombres que no describen su contenido.

---

## PARTE 4 — PRODUCTO, NAVEGACIÓN Y PULIDO

### Navegación (SideNav)

Problemas: doble árbol `operacion/` vs `operations/`; los ítems "Dashboard Comercial/Operacional" son solo redirects (3 rutas para 2 páginas); "Clientes" es analítica de participantes dentro de "Registro"; **12 páginas de maestros de las que solo 2 están en el menú** (sedes, delegaciones, disciplinas, conductores, vuelos y eventos existen pero son inalcanzables); grupos de un solo ítem que repiten su nombre ("Sede → Sede"); permisos que no reflejan el árbol visual (Workforce cuelga de `operacion.viajes`).

Propuesta de menú:

```
Inicio · Dashboards (Operacional/Comercial) · Registro (Eventos/Participantes/Proveedores)
Transporte (Solicitudes → Operatividad Diaria → Viajes → Monitoreo unificado · Flota)
Arribos AND · Hotelería · Alimentación · Deportes (Planificación/Calendario/Premiaciones)
Personas (Participantes/Salud/Workforce) · Acreditación (+Control de Acceso)
Maestros (hoy huérfanos) · Portales · Administración (Usuarios/Push/SofIA/Beneficios)
```

### Flujo operativo roto en islas

De las 7 páginas de transporte, **el único enlace entre etapas es trips → vehicle-positions**. No hay CTA "planificar" desde una solicitud, ni "ver en monitoreo" desde un viaje despachado. Y hay **4 páginas para monitorear casi lo mismo** (Tracking de Viajes, Monitoreo de Conductores, Panel Conductores, Flota) — deberían converger en una vista con pestañas. La asignación de conductor existe en 3 UIs distintas.

### Terminología (elegir canon y aplicarlo)

Canon sugerido: **conductor** (no chofer), **viaje** para la entidad / **servicio** para el trabajo del día, **participante** (no cliente/atleta/deportista/pasajero según la página), **sede**. Hoy: 5 nombres para participante, "chofer" y "conductor" en la misma frase (`inicio-guiado:184`), el código TA con 4 formatos distintos, y el portal llamado de 3 formas.

### Módulos muertos / mocks

- `/incidents` — guarda notas **solo en useState** (se pierden al recargar); duplica al Centro de Incidencias real. **Borrar.**
- `/reports` — KPIs inventados hardcodeados ("1.248 pasajeros"). **Borrar o conectar.**
- `operations/accreditations` (966 líneas) y `operations/health` (1.512) duplican `/accreditations` y `/health` del menú.
- `portal/athlete`, `(portal)/athlete`, `respaldo.tsx` — legacy. **Borrar.**
- Login page dice "2,400+ Atletas" con separador anglosajón.

### Detalles que restan profesionalismo

- **"Hoteles/Villa Panamerica"** (sin la sílaba final) en el menú principal.
- ~15 tildes faltantes en textos visibles: "Codigo", "Direccion", "Telefono", "Gestion manual", "Descripcion", "Asignacion", "Planificacion AND", "Cierre de operacion" — incluida la **ficha médica imprimible** (`operations/health:954-970`).
- `README.md` = boilerplate de NestJS intacto (con links de donación de su autor); `docs/` con versionado por nombre de archivo (`FUNCIONALIDADES_v1..v10.docx`).
- 5 `alert()` como UX; `window.confirm` nativo en trip-requests y fleet vs `ConfirmDialog` en el resto; mensajes de éxito que nunca se auto-limpian; console.log visibles en el portal conductor.
- Dos sistemas visuales conviviendo: daily-transport/fleet/trip-requests usan el design system (`surface`, `badge-*`, KpiCard) mientras trips reconstruye todo con ~200 style objects inline. Sin skeletons de carga en ninguna página; modales sin `role="dialog"`/Escape/focus-trap.

---

## PLAN DE ACCIÓN PROPUESTO

**Fase 0 — Emergencia de seguridad (1-3 días).**
Guard global JWT + `@Public()` (S1, S2) · ValidationPipe global con whitelist (S9) · CORS con lista blanca (S11) · helmet + throttler (S12) · rotar service_role, OpenAI key y contraseñas admin · buckets privados + policies `TO service_role` (S6, S7) · sacar el código de acceso de los logs (S16).

**Fase 1 — Sesiones de portal reales (1 semana).**
Token opaco desde `/m/auth/login` copiando el patrón de coupon-partners (S4) · endpoints `me`-scoped con proyección de campos (S5) · códigos aleatorios en vez de `slice(-6)` (S3) · validación de pickup server-side · QR de acreditación con token verificado (S8) · manejo de 401 + refresh en `apiFetch` (S14).

**Fase 2 — Bugs de datos (3-5 días).**
Helper único de fecha/hora America/Santiago en backend y frontend (mata ~12 bugs de un golpe) · paginación `.range()` en auto-asignación (B1) · fleet leyendo provider_participants (B2) · fix del filtro de eventos en Viajes (F1) · dashboard con errores visibles (F2) · estado ASSIGNED en solicitudes (F4) · transacciones en escrituras múltiples (B3) · GPS con cola offline y wake lock (P2, P4) · paridad o retiro de la app Expo (P3, A5).

**Fase 3 — Consolidación de código (1-2 semanas).**
`lib/format.ts` + `lib/tripStatus.ts` + colores en `clientTypes.ts` · componentes compartidos (StatusChip, ClientTypeChip, Avatar, Toast, skeletons, usePolling) · descomponer trips y portal/user · borrar código muerto (dummy divs, PageHeader stub, StatCard, portales legacy, respaldo.tsx, /incidents, /reports, users/*) · unificar fuente de conductores en backend.

**Fase 4 — Producto y pulido (1 semana).**
Reorganizar el SideNav según la propuesta · aplanar `operacion/`↔`operations/` y los redirects de dashboard · CTAs entre etapas del flujo de transporte · fusionar las 4 vistas de monitoreo · canon de terminología (conductor/viaje/participante) · corregir "Villa Panamerica" y las tildes · README propio del proyecto · decisión sobre i18n.
