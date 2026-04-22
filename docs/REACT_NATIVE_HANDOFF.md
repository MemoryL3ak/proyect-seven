# Seven Arena — Documentación Técnica y Funcional de Portales Móviles

> Documento de referencia para el desarrollo de las aplicaciones móviles nativas de Seven Arena (plataforma de gestión operativa para los Juegos Panamericanos 2026) mediante React Native.

---

# PARTE I — DEFINICIÓN FUNCIONAL

Esta sección describe **qué hace cada portal desde la perspectiva del usuario y del negocio**, independiente de la implementación técnica.

---

## 1. Contexto del Negocio

Seven Arena es una plataforma integral de gestión operativa para eventos deportivos masivos. Administra toda la operación logística del evento: delegaciones, atletas, transportes, hotelería, alimentación, vuelos, acreditaciones, calendario deportivo, entre otros.

Dentro de esta plataforma existen **cuatro portales** orientados a usuarios finales (no administrativos) que actualmente funcionan como web apps y deben migrar a aplicaciones móviles nativas. Cada portal está dirigido a un perfil de usuario distinto, definido por atributos específicos del participante en el sistema.

### 1.1 Matriz de portales

| # | Portal | Criterio de acceso | Función central |
|---|--------|-------------------|----------------|
| 1 | **Portal Conductor** | Participante asociado a un proveedor de transporte con el flag `esChofer = sí` | Recibir viajes asignados, ejecutar operación de transporte y enviar ubicación en tiempo real |
| 2 | **Portal Solicitud de Vehículo** | Participante registrado con `tipoCliente = VIP` | Solicitar transporte de forma autónoma (flujo simplificado y enfocado) |
| 3 | **Portal Usuario — Jefe de Delegación** | Participante con `tipoCliente = TA` **Y** `jefeDelegacion = sí` | Gestión integral: itinerario completo, solicitud de vehículos, administración de su delegación, calendario deportivo, sedes, alimentación y credencial |
| 4 | **Portal Usuario — Atleta** | Participante con `tipoCliente = TA` **Y** `jefeDelegacion = no` | Consulta de su información: actividades, calendario deportivo, sedes, alimentación y credencial (sin gestión de delegación) |

### 1.2 Notas sobre la segmentación

- **Los portales 3 y 4 son el mismo portal base** con un set de vistas diferenciado. En la versión web actual corresponden ambos a `/portal/user` pero el contenido cambia dinámicamente según el flag `isDelegationLead` del atleta autenticado. En la app nativa pueden implementarse como una sola app con navegación condicional o como dos flujos distintos según decisión de implementación.
- **El Portal Solicitud de Vehículo (VIP)** es un portal completamente independiente y más ligero que el Portal Usuario, enfocado exclusivamente en el flujo de solicitud y seguimiento de viajes.
- **El Portal Conductor** es independiente del resto y usa un sistema de autenticación distinto (código corto en lugar de email/password).

Los portales móviles **consumen la misma plataforma central** (backend, base de datos, servicios). No reemplazan el sistema de administración web, que sigue usándose por operadores y coordinadores.

---

## 2. Portal Conductor — Definición Funcional

### 2.1 Propósito
Permitir a los conductores asignados a viajes ejecutar su operación diaria de forma autónoma: ver los viajes que tienen programados, iniciarlos, comunicarse con los pasajeros, enviar su ubicación en tiempo real y gestionar su documentación personal.

### 2.2 Criterio de acceso
Acceden al portal los **participantes asociados a un proveedor de transporte** cuyo flag `esChofer` está activado (en el modelo técnico: `provider_participant.metadata.isDriver = true`).

Todos los conductores del evento se registran bajo algún proveedor de transporte (ya sea propio o externo), por lo que este es el único criterio de acceso al Portal Conductor.

### 2.3 Flujo de uso diario

1. **Ingreso a la app**: el conductor accede con un **código único** (6 caracteres) que recibió al ser registrado. El código funciona como identificador de sesión.
2. **Visualización de viajes**: ve una lista de los viajes que tiene asignados, divididos en "Hoy", "En curso" y "Programados".
3. **Detalle de un viaje**: al tocar un viaje, ve el origen, destino, hora, pasajero(s) asignado(s), observaciones y botones de acción según el estado del viaje.
4. **Inicio de ruta**: cuando va a comenzar un viaje, cambia el estado a "En ruta". La app comienza a enviar su ubicación en tiempo real.
5. **Recoger al pasajero**: cuando llega al punto de recogida, indica que recogió al pasajero. El sistema valida mediante un código que el pasajero le entrega.
6. **Durante el viaje**: la ubicación se sigue enviando en tiempo real. Puede chatear con el pasajero si hay dudas.
7. **Dejar al pasajero**: al llegar al destino, marca "Dejado en hotel" o "Viaje completado".
8. **Calificación**: el pasajero puede calificar al conductor al finalizar el viaje.

### 2.4 Funcionalidades principales

#### 2.4.1 Gestión de viajes
- Lista de viajes asignados al conductor filtrable por estado (hoy, en curso, programados, historial).
- **Marcado visual de viajes no vistos** (estilo bandeja de correo): los viajes recién asignados aparecen destacados hasta que el conductor los revisa.
- Detalle completo del viaje: origen, destino, hora programada, pasajeros, tipo de servicio, observaciones, vehículo asignado.
- Acciones contextuales según el estado del viaje (iniciar ruta, recoger, dejar, completar).
- Validación por código de pickup: al recoger al pasajero, el conductor debe ingresar un código que valida el pasajero.

#### 2.4.2 Tracking de ubicación en tiempo real
- Envío automático de ubicación GPS mientras hay un viaje activo (cada 5 segundos).
- **Funciona con la app minimizada o la pantalla apagada** (requisito crítico — no es posible en web).
- Manejo de permisos "siempre" para ubicación.
- Mensajes de ayuda al usuario si los permisos no están concedidos.

#### 2.4.3 Comunicación
- **Chat con el pasajero** durante los viajes activos.
- Notificaciones push cuando:
  - Se le asigna un viaje nuevo
  - El pasajero envía un mensaje
  - Se modifica o cancela un viaje programado

#### 2.4.4 Gestión del perfil del conductor
- **Foto de perfil** (subida desde cámara o galería).
- **Documentación requerida**: carga de 12 documentos personales y del vehículo (cédula, licencia de conducir, antecedentes, SOAP, permiso de circulación, padrón, foto del vehículo, etc.).
- Cada documento puede visualizarse después de subirlo.
- **Credencial digital** con código QR para acreditación.

#### 2.4.5 Historial y reportes
- Historial de viajes realizados con filtros por fecha, tipo y calificación recibida.
- Estadísticas personales: total de viajes, calificación promedio.

#### 2.4.6 Mapa y ruta
- Mapa con la ruta sugerida desde el origen al destino.
- Marcador de la posición actual del conductor.
- Información del pasajero que será recogido.

---

## 3. Portal Solicitud de Vehículo (VIP) — Definición Funcional

### 3.1 Propósito
Brindar a los participantes clasificados como **VIP** una herramienta enfocada y simplificada para solicitar traslados en vehículo, hacer seguimiento de los viajes activos en tiempo real y comunicarse con el conductor asignado. No incluye información deportiva ni otras funcionalidades del evento.

### 3.2 Criterio de acceso
Acceden al portal los participantes cuyo campo `tipoCliente = VIP` (en el modelo técnico: `athlete.userType = "VIP"`). Corresponde a invitados especiales, autoridades, patrocinadores y clientes premium.

### 3.3 Flujo de uso típico

1. **Ingreso**: el usuario inicia sesión con su email y contraseña.
2. **Pantalla inicial**: aterriza directamente en el formulario de solicitud de vehículo.
3. **Solicitar transporte**: completa el formulario con tipo de vehículo, cantidad de personas, origen, sede destino, fecha y hora.
4. **Confirmación**: recibe un modal de éxito con el estado "Solicitado" y puede ir a la pestaña de actividades a verlo.
5. **Seguimiento**: mientras el viaje está en curso, ve en el mapa dónde está el conductor y el tiempo estimado de llegada.
6. **Comunicación**: puede chatear con el conductor durante el viaje activo.
7. **Calificación**: al finalizar el viaje, califica al conductor con estrellas y comentario opcional.

### 3.4 Pestañas / Secciones
El portal VIP se compone de las siguientes secciones:

1. **Solicitud** — formulario de creación de viaje (pantalla principal)
2. **Actividades** — viajes en curso, programados e historial
3. **Sedes** — directorio de sedes deportivas con fotos y direcciones
4. **Hoteles** — listado de hoteles / Villa Panamericana (solo consulta)
5. **Calendario** — calendario deportivo (si el VIP tiene asociado un evento deportivo)
6. **Cuenta** — perfil del usuario y credencial digital

### 3.5 Funcionalidades principales

#### 3.5.1 Solicitud de vehículo
- Selección de tipo de vehículo (Sedán 4 pax, SUV 6 pax, Van 10/15/19 pax, Minibús 33 pax, Bus 64 pax).
- **Validación de cantidad de pasajeros** vs capacidad del vehículo elegido (con alerta inline).
- Origen como dirección libre con **autocompletado Google Places**.
- Sede destino seleccionable desde el listado de venues del evento.
- Fecha y hora del viaje.
- Observaciones libres.
- Toggle **"Ida y vuelta"** con fecha/hora de regreso y destino distinto.
- Modificación o cancelación de solicitudes con más de **2 horas** de anticipación.
- Modal de éxito al enviar la solicitud.

#### 3.5.2 Seguimiento de viaje activo
- Mapa en tiempo real con la posición del conductor.
- Datos del conductor asignado (nombre, foto, patente, modelo de vehículo).
- Estado actual del viaje con indicadores visuales.
- Tiempo estimado de llegada.
- Notificación push automática cuando el conductor está en camino o llegó al punto de recogida.

#### 3.5.3 Chat con el conductor
- Mensajería en tiempo real durante los viajes activos (`En ruta` y `Recogido`).
- Notificaciones push de nuevos mensajes.
- Historial de conversación dentro del viaje.

#### 3.5.4 Cuenta y credencial
- Foto de perfil.
- Datos personales.
- **Credencial digital** con código QR descargable.
- Cerrar sesión.

#### 3.5.5 Calificación
- Al completarse un viaje, el usuario puede otorgar una calificación de 1 a 5 estrellas y un comentario opcional al conductor.

---

## 4. Portal Usuario — Definición Funcional

El **Portal Usuario** es una aplicación única con **dos vistas diferenciadas** según el rol del participante dentro de su delegación. Ambas vistas comparten la misma autenticación, estructura base y diseño, pero exponen un set distinto de secciones y funcionalidades.

### 4.1 Criterio de acceso
Acceden al portal los participantes cuyo `tipoCliente = TA` (en el modelo técnico: `athlete.userType = "TA"` u otro valor equivalente a atleta registrado). El contenido visible se determina por el flag `jefeDelegacion`.

| Vista | Criterio | Descripción |
|-------|---------|-------------|
| **4a. Vista Jefe de Delegación** | `tipoCliente = TA` **Y** `jefeDelegacion = sí` | Acceso completo: itinerario, gestión de delegación, solicitud de vehículos, información deportiva |
| **4b. Vista Atleta** | `tipoCliente = TA` **Y** `jefeDelegacion = no` | Acceso limitado: consulta de información deportiva y credencial (sin gestión) |

Técnicamente, en la web actual ambos corresponden a `/portal/user` y la diferencia se resuelve en tiempo de render leyendo `athlete.isDelegationLead`. En la app nativa debe respetarse la misma lógica condicional.

---

### 4a. Portal Usuario — Vista Jefe de Delegación

#### 4a.1 Propósito
Brindar al responsable de una delegación una herramienta integral para gestionar su operación dentro del evento: visualizar su itinerario completo, solicitar transportes para miembros de su delegación, consultar el calendario deportivo, los menús de alimentación, las sedes y administrar la información de su delegación.

#### 4a.2 Usuarios
Atletas marcados como jefes de delegación (`isDelegationLead = true`) en el sistema. Generalmente hay uno por país/delegación.

#### 4a.3 Pestañas / Secciones (7)

1. **Itinerario** — vista consolidada de todas las actividades del jefe de delegación en el día (viajes, comidas, actividades deportivas, eventos)
2. **Actividades** — gestión de viajes (crear nuevos, ver activos, historial)
3. **Calendario** — calendario deportivo con vista mensual y detalle por día
4. **Sedes** — directorio de sedes con fotos y ubicación en mapa
5. **Comida / Alimentación** — menús por fecha, tipo de comida y lugar de servicio
6. **Delegación** — listado completo de miembros de la delegación (atletas y staff) con sus datos
7. **Cuenta** — perfil, credencial digital, cerrar sesión

#### 4a.4 Funcionalidades principales

##### 4a.4.1 Itinerario personal
- Vista consolidada del día con todas las actividades programadas.
- Ordenadas cronológicamente.
- Incluye viajes, actividades deportivas propias o del delegado, comidas programadas.
- Permite tocar cada ítem para ver su detalle.

##### 4a.4.2 Solicitud y gestión de viajes
- Mismo formulario completo que el Portal VIP (tipo de vehículo, pasajeros, origen, destino, fecha, ida y vuelta).
- **Validación de capacidad de pasajeros** según tipo de vehículo.
- Modificar o cancelar con más de 2 horas de anticipación.
- Seguimiento en tiempo real de viajes activos con mapa.
- Chat con el conductor durante el viaje.
- Historial de viajes con bitácora de cambios.

##### 4a.4.3 Calendario deportivo
- Calendario mensual con actividades marcadas por día.
- Tap en un día para ver el detalle: disciplinas, pruebas, sedes, horarios.
- Filtros por disciplina o delegación.

##### 4a.4.4 Sedes
- Directorio de todas las sedes deportivas del evento.
- Foto, dirección, ubicación en mapa, información de contacto.

##### 4a.4.5 Alimentación
- Menús diarios por tipo (desayuno, almuerzo, cena, coffee break).
- Lugares de servicio con ubicación y capacidad.
- Filtros por tipo de cliente.

##### 4a.4.6 Administración de delegación
- Listado completo de los miembros de la delegación.
- Información de cada miembro (nombre, disciplina, rol, estado de acreditación).
- Posibilidad de ver datos agregados (total de atletas, disciplinas representadas).

##### 4a.4.7 Cuenta y credencial
- Foto de perfil.
- Datos personales y de delegación.
- **Credencial digital** con QR.
- Cerrar sesión.

#### 4a.5 Notificaciones
- Push notifications para:
  - Confirmación de solicitud de viaje
  - Asignación de conductor
  - Conductor en camino / llegó / completó
  - Mensajes del conductor
  - Cambios en el calendario deportivo de su delegación
  - Alertas de acreditación de miembros de la delegación

---

### 4b. Portal Usuario — Vista Atleta

#### 4b.1 Propósito
Brindar al atleta una herramienta de consulta para acceder a su información deportiva y del evento: su calendario de competencias, las sedes, los menús de alimentación y su credencial digital. **No permite gestionar la delegación** (eso lo hace el jefe) ni tiene vistas administrativas.

#### 4b.2 Usuarios
Atletas regulares del evento (`isDelegationLead = false`), es decir, todos los que no son jefes de delegación.

#### 4b.3 Pestañas / Secciones (5)

1. **Actividades** — sus viajes (consulta y seguimiento, no gestiona cantidades grupales)
2. **Calendario** — calendario deportivo personal
3. **Sedes** — directorio de sedes
4. **Comida / Alimentación** — menús diarios
5. **Cuenta** — perfil y credencial

> Nota: **no ve las pestañas** de Itinerario ni Delegación. La gestión consolidada y la administración de la delegación quedan reservadas al jefe de delegación.

#### 4b.4 Funcionalidades principales

##### 4b.4.1 Actividades (consulta)
- Listado de sus viajes programados, en curso y completados.
- Detalle de cada viaje con información del conductor asignado.
- **Seguimiento en tiempo real** de viajes activos con mapa y posición del conductor.
- **Chat** con el conductor durante el viaje.
- Calificación al finalizar el viaje.

> Nota: El atleta puede ser pasajero de viajes solicitados por su jefe de delegación. Los viajes aparecen en su bandeja cuando está vinculado como pasajero (`athleteIds` incluye su ID).

##### 4b.4.2 Calendario deportivo
- Vista mensual de actividades deportivas.
- Detalle diario con disciplinas, pruebas, sedes y horarios.
- Énfasis en las actividades en las que él participa.

##### 4b.4.3 Sedes
- Directorio de sedes deportivas con fotos, direcciones y mapas.

##### 4b.4.4 Alimentación
- Menús por fecha y tipo de comida.
- Lugares de servicio según su tipo de cliente.

##### 4b.4.5 Cuenta y credencial
- Foto de perfil.
- Datos personales.
- **Credencial digital** con QR para acreditación de ingreso a sedes, hoteles y alimentación.
- Cerrar sesión.

#### 4b.5 Notificaciones
- Push notifications para:
  - Viaje asignado donde él es pasajero
  - Conductor en camino / llegó
  - Mensajes del conductor
  - Cambios en el calendario de sus actividades deportivas
  - Actualizaciones en su acreditación

---

## 5. Requisitos Funcionales Comunes

Estos requisitos aplican a los cuatro portales:

### 5.1 Autenticación y sesión
- Inicio de sesión con credenciales (email/contraseña o código único en el caso del conductor).
- Sesión persistente entre cierres de la app.
- Cierre de sesión manual.
- Protección opcional con biometría (Face ID / Touch ID) como mejora de UX y seguridad.

### 5.2 Notificaciones push
- Recepción de notificaciones relevantes aunque la app esté cerrada.
- Apertura de la app en la pantalla adecuada al tocar una notificación (deep linking).

### 5.3 Mapas y ubicación
- Visualización de mapas con marcadores y rutas.
- Envío de ubicación GPS según el rol (continuo en conductor, durante viajes activos en usuario).
- Solicitud clara y amigable de permisos de ubicación.

### 5.4 Multimedia
- Acceso a cámara del dispositivo para tomar fotos de perfil y documentos.
- Acceso a galería para seleccionar archivos existentes.
- Compresión automática de imágenes antes de subirlas al servidor.

### 5.5 Conectividad
- Funcionamiento básico con red inestable (reintentos automáticos).
- Indicación visual del estado de conexión.

### 5.6 Experiencia de usuario
- Diseño consistente con la imagen de marca actual (colores, tipografía, estilo visual).
- Interfaz en español.
- Soporte para modo horizontal y vertical.
- Accesibilidad básica (tamaños de fuente, contraste).

---

## 6. Reglas de Negocio Relevantes

### 6.1 Viajes
- Un viaje se crea con estado `Solicitado`.
- Cuando un operador asigna conductor y vehículo, pasa a `Programado`.
- El conductor puede moverlo a `En ruta`, luego `Recogido`, `Dejado en hotel` y finalmente `Completado`.
- Un usuario solo puede modificar o cancelar un viaje si faltan **más de 2 horas** para su hora programada.
- Cada modificación, cancelación o asignación se registra en una **bitácora** del viaje (visible para operadores).
- Un viaje de "ida y vuelta" genera dos viajes enlazados (padre e hijo).

### 6.2 Conductores
- Un conductor puede ser un registro directo o un participante de proveedor marcado como chofer.
- El conductor debe tener un vehículo asociado con una capacidad máxima.
- Al asignar conductores a viajes, solo se pueden asignar conductores cuyo vehículo tenga capacidad suficiente para los pasajeros solicitados.
- Los tipos de vehículos estándar son: Sedán (4), SUV (6), Van 10, Van 15-17, Van 19, Minibús (33), Bus (64).

### 6.3 Ubicación
- El conductor debe enviar su ubicación cada 5 segundos mientras el viaje está en estado `En ruta` o `Recogido`.
- El pasajero puede enviar su ubicación durante el viaje activo para que el conductor lo encuentre si el punto de recogida es ambiguo.

### 6.4 Chat
- El chat solo está disponible durante viajes activos (estados `En ruta` y `Recogido`).
- Los mensajes se almacenan en el servidor y pueden revisarse en el historial.

### 6.5 Calificación
- Al finalizar un viaje, el pasajero puede calificar al conductor con 1 a 5 estrellas y dejar un comentario opcional.
- La calificación se muestra en el perfil del conductor y en el ranking operacional.

---

# PARTE II — DEFINICIÓN TÉCNICA

Esta sección describe **cómo está construido el backend actual y qué servicios consumirán las aplicaciones nativas**.

---

## 7. Arquitectura General

```
[Apps Móviles Nativas]  →  [Backend NestJS en Railway]  →  [Supabase PostgreSQL + Auth + Storage]
                                         ↓
                         [Integraciones externas: Google Maps, AviationStack, OpenAI, FCM/APNs]
```

- Las aplicaciones nativas **consumen el backend REST existente** vía HTTPS.
- No hay lógica de negocio que se ejecute solo en el cliente: toda la información y reglas están en el backend.
- La base de datos es Supabase PostgreSQL, gestionada desde el backend.
- Los archivos (fotos, documentos) se almacenan en Supabase Storage en buckets públicos.

### URL del backend en producción
```
https://proyect-seven-production.up.railway.app
```

---

## 8. Stack del Backend (no cambia)

- **NestJS** (Node.js + TypeScript)
- **TypeORM** con repositorio dirigido a Supabase PostgreSQL
- **Supabase Client** para Auth y Storage
- Despliegue en **Railway**

---

## 9. Autenticación

### 9.1 Portal Conductor
- **Sin Supabase Auth**. El conductor inicia sesión con los **últimos 6 caracteres de su ID** (`provider_participant.id` slice -6).
- El backend expone el listado de drivers y provider-participants a través de:
  - `GET /drivers`
  - `GET /provider-participants`
- La app filtra localmente los participantes con `metadata.isDriver = true` y hace match del código ingresado contra `id.slice(-6).toLowerCase()`.
- Al encontrar match, guarda el ID del participante en almacenamiento persistente (AsyncStorage) para auto-login en siguientes aperturas de la app.

### 9.2 Portales VIP, Jefe de Delegación y Atleta
Los tres portales de usuarios (VIP, Jefe Delegación y Atleta) usan el **mismo mecanismo de autenticación**: Supabase Auth vía email y contraseña.

- Endpoint: `POST /auth/login`
- Body:
```json
{ "email": "usuario@ejemplo.com", "password": "contraseña" }
```
- Response:
```json
{
  "user": { "id": "...", "email": "...", "user_metadata": { "name": "...", "role": "..." } },
  "requiresPasswordChange": false
}
```
- Headers de respuesta:
  - `Authorization: Bearer <access_token>`
  - `x-refresh-token: <refresh_token>`
- Todos los endpoints protegidos requieren `Authorization: Bearer <token>`.
- El token se refresca automáticamente con el `refresh_token`.

#### Determinación del portal a mostrar tras el login

Una vez autenticado, la app debe cargar el perfil del atleta asociado al usuario y evaluar sus atributos para decidir qué vista mostrar:

```typescript
if (athlete.userType === "VIP") {
  // → Portal Solicitud de Vehículo (Sección 3)
} else if (athlete.isDelegationLead === true) {
  // → Portal Usuario — Vista Jefe de Delegación (Sección 4a)
} else {
  // → Portal Usuario — Vista Atleta (Sección 4b)
}
```

En la implementación actual el portal VIP corresponde a una app web independiente (`/portal/vehicle-request`) mientras que Jefe de Delegación y Atleta comparten el portal `/portal/user` con render condicional. En la migración a React Native esto puede resolverse como:

- **Opción A**: Una sola app móvil que al iniciar sesión evalúa el perfil y renderiza el portal correspondiente.
- **Opción B**: Dos apps separadas (una para VIP, otra para Usuario TA), según criterio de distribución.

### 9.3 Recomendación para React Native
- Persistir tokens en `AsyncStorage`.
- Interceptor HTTP que agregue el `Authorization` automáticamente y maneje refresh automático al recibir 401.
- Opción de biometría como capa adicional.

---

## 10. APIs Disponibles

El backend expone 27 controladores REST. A continuación se listan los endpoints relevantes para los portales móviles.

### 10.1 Autenticación (`/auth`)
| Método | Endpoint | Uso |
|--------|----------|-----|
| POST | `/auth/login` | Login con email/password |
| POST | `/auth/change-temporary-password` | Cambiar contraseña temporal en primer acceso |

### 10.2 Atletas (`/athletes`)
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/athletes` | Listar atletas |
| GET | `/athletes/:id` | Detalle |
| POST | `/athletes/:id/photo` | Subir foto (body: `{ dataUrl }`) |

### 10.3 Conductores (`/drivers`)
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/drivers` | Listar conductores registrados |
| GET | `/drivers/:id` | Detalle |
| POST | `/drivers/:id/photo` | Subir foto |
| POST | `/drivers/:id/document` | Subir documento (body: `{ key, dataUrl }`) |

### 10.4 Conductores por Proveedor (`/provider-participants`)
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/provider-participants` | Listar participantes de proveedores (incluye choferes) |
| POST | `/provider-participants/:id/document` | Subir documento o foto |

### 10.5 Viajes (`/trips`)
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/trips` | Listar viajes (filtrado en cliente por driver o requester) |
| GET | `/trips/:id` | Detalle con bitácora |
| POST | `/trips` | Crear viaje (desde Portal Usuario) |
| PATCH | `/trips/:id` | Actualizar estado, asignación, notas, etc. |
| PATCH | `/trips/:id/passenger-position` | Enviar ubicación del pasajero `{ lat, lng }` |

### 10.6 Posiciones GPS (`/vehicle-positions`)
| Método | Endpoint | Uso |
|--------|----------|-----|
| POST | `/vehicle-positions` | Registrar posición del conductor |
| GET | `/vehicle-positions/driver/:driverId/latest` | Última posición conocida del conductor |

Ejemplo de body para `POST /vehicle-positions`:
```json
{
  "driverId": "uuid",
  "vehicleId": "uuid",
  "eventId": "uuid",
  "timestamp": "2026-04-14T15:30:00.000Z",
  "location": { "type": "Point", "coordinates": [-70.6536, -33.4521] },
  "speed": 45.5,
  "heading": 90
}
```

### 10.7 Chat del viaje (`/trips/:id/messages`)
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/trips/:id/messages` | Listar mensajes |
| POST | `/trips/:id/messages` | Enviar mensaje |

Body para crear mensaje:
```json
{
  "senderType": "DRIVER",
  "senderName": "Carlos Pérez",
  "content": "Estoy a 5 minutos"
}
```

### 10.8 Sedes y ubicaciones
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/venues` | Listado de sedes con direcciones, fotos, coordenadas |
| GET | `/accommodations` | Hoteles y Villa Panamericana |
| GET | `/delegations` | Delegaciones (países) |
| GET | `/events` | Eventos activos |
| GET | `/disciplines` | Disciplinas deportivas |

### 10.9 Calendario
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/sports-calendar/events?from=ISO&to=ISO` | Calendario deportivo por rango de fechas |

### 10.10 Alimentación
| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/food-menus` | Menús por fecha y tipo |
| GET | `/food-locations` | Lugares de comida |

---

## 11. Modelos de Datos Principales

### 11.1 Trip (Viaje)
```typescript
{
  id: string;
  eventId: string;
  driverId?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  requesterAthleteId?: string;
  destinationVenueId?: string;
  requestedVehicleType?: "SEDAN" | "SUV" | "VAN_10" | "VAN_15" | "VAN_19" | "MINIBUS" | "BUS";
  passengerCount?: number;
  notes?: string;
  origin?: string;
  destination?: string;
  tripType?: "VIAJE_IDA" | "VIAJE_IDA_REGRESO" | "TRANSFER_IN_OUT" | "DISPOSICION_12H";
  clientType?: "VIP" | "T1" | "ATHLETE";
  tripCost?: number;
  status: "REQUESTED" | "SCHEDULED" | "EN_ROUTE" | "PICKED_UP" | "DROPPED_OFF" | "COMPLETED" | "CANCELLED";
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  driverRating?: number;
  ratingComment?: string;
  passengerLat?: number;
  passengerLng?: number;
  isRoundTrip: boolean;
  parentTripId?: string;
  legType?: "OUTBOUND" | "RETURN";
  childTrips?: Trip[];
  athleteIds?: string[];
  metadata: {
    log?: Array<{
      action: string;
      by: string;
      at: string;
      detail?: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}
```

### 11.2 Driver (Conductor)
```typescript
{
  id: string;
  eventId: string;
  fullName: string;
  rut: string;
  email?: string;
  phone?: string;
  providerId?: string;
  userId?: string;
  licenseNumber?: string;
  vehicleId?: string;
  photoUrl?: string;
  accessTypes: string[];
  accreditationStatus: "PENDING" | "VALIDATED" | "REJECTED";
  credentialCode?: string;
  status: "ACTIVE" | "INACTIVE";
  metadata: {
    vehiclePatente?: string;
    vehicleMarca?: string;
    vehicleModelo?: string;
    vehicleTipo?: string;
    vehicleCapacity?: number;
    photoUrl?: string;
    doc_carnet?: string;
    doc_antecedentes?: string;
    doc_licencia?: string;
  };
}
```

### 11.3 Athlete (Atleta/Usuario)
```typescript
{
  id: string;
  eventId: string;
  delegationId?: string;
  fullName: string;
  rut?: string;
  passportNumber?: string;
  countryCode?: string;
  email?: string;
  phone?: string;
  userType: "ATHLETE" | "COACH" | "STAFF" | "VIP" | "T1" | "TA";  // determina qué portal usar
  userId?: string;               // vínculo con Supabase Auth
  flightNumber?: string;
  arrivalTime?: string;
  departureTime?: string;
  isDelegationLead: boolean;     // true = Portal Jefe Delegación, false = Portal Atleta
  metadata: {
    photoUrl?: string;
  };
}
```

**Campos clave para resolución del portal**:
- `userType === "VIP"` → **Portal Solicitud de Vehículo (Sección 3)**
- `userType === "TA"` + `isDelegationLead === true` → **Portal Usuario — Jefe de Delegación (Sección 4a)**
- `userType === "TA"` + `isDelegationLead === false` → **Portal Usuario — Atleta (Sección 4b)**

### 11.4 Vehicle Position (Tracking GPS)
```typescript
{
  id: string;
  driverId: string;
  vehicleId?: string;
  eventId?: string;
  timestamp: string;
  location: {
    type: "Point";
    coordinates: [number, number];  // [longitude, latitude]
  };
  speed?: number;
  heading?: number;
}
```

### 11.5 Trip Message (Chat)
```typescript
{
  id: string;
  tripId: string;
  senderType: "DRIVER" | "PASSENGER";
  senderName: string;
  content: string;
  read: boolean;
  createdAt: string;
}
```

---

## 12. Integraciones Externas

### 12.1 Supabase
- Autenticación (portal usuario)
- Base de datos PostgreSQL
- Storage para archivos
- Opcional: **Supabase Realtime** para websockets en chat y posiciones GPS

**Buckets de Storage existentes:**

| Bucket | Contenido |
|--------|-----------|
| `driver-documents` | Documentos de conductores (carnet, licencia, SOAP, etc.) |
| `driver-photos` | Fotos de perfil de conductores |
| `athlete-photos` | Fotos de atletas |
| `provider-documents` | Documentos de proveedores |
| `venue-photos` | Fotos de sedes |

Todos son buckets públicos con URLs accesibles directamente.

### 12.2 Google Maps Platform
- **Places Autocomplete**: para autocompletado de direcciones de origen cuando el usuario solicita un viaje.
- **Maps SDK**: para visualización de mapas con marcadores.
- **Directions API**: para cálculo de rutas entre origen y destino.
- API Key necesaria (actualmente existe para la web, se debe verificar si se puede reutilizar o si se requiere una nueva para las apps nativas).

### 12.3 Push Notifications
- **Firebase Cloud Messaging (FCM)** para Android.
- **Apple Push Notification Service (APNs)** para iOS.
- Actualmente **no están implementadas en el backend** — es un módulo a construir que se invocará desde los flujos de viajes y chat.
- Cada app registrará su token de dispositivo al iniciar sesión para que el backend pueda enviar notificaciones dirigidas.

---

## 13. Variables de Entorno (Backend)

El backend en Railway tiene configuradas estas variables. Se listan como referencia informativa:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_KEY=...
OPENAI_API_KEY=...
AVIATIONSTACK_API_KEY=...
SOFIA_MODEL=gpt-4o-mini
```

Las apps móviles necesitarán sus propias variables locales:

```env
API_BASE_URL=https://proyect-seven-production.up.railway.app
GOOGLE_MAPS_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

---

## 14. Identidad Visual y Branding

La plataforma web actual define la paleta de colores y el estilo visual que debe mantenerse en las apps móviles.

### Paleta de colores
```
Verde principal (acento):    #21D0B3
Verde secundario:            #14AE98
Azul info:                   #3b82f6
Ámbar warning:               #f59e0b
Rojo error:                  #ef4444
Morado:                      #a78bfa / #7c3aed
Índigo:                      #6366f1
Fondo claro:                 #f8fafc
Texto principal:             #0f172a
Texto muted:                 #64748b
Borde:                       #e2e8f0
```

### Gradientes característicos
- Botones primarios: `linear-gradient(135deg, #21D0B3, #14AE98)`
- Headers oscuros: `linear-gradient(135deg, #1e293b, #0f172a)`

### Iconografía
- Iconos lineales estilo outline con stroke de 2 puntos.
- Bordes redondeados entre 10 y 20 puntos.
- Sombras suaves.

### Tipografía
- Sistema (sin fuentes personalizadas actualmente).
- Pesos usados: 400, 600, 700, 800.

### Referencia visual
Las aplicaciones web actuales disponibles en los siguientes paths sirven como referencia visual directa de cada portal:

| Portal | Ruta web |
|--------|---------|
| **Portal Conductor** | `/portal/conductor` |
| **Portal Solicitud de Vehículo (VIP)** | `/portal/vehicle-request` |
| **Portal Usuario — Jefe de Delegación** | `/portal/user` (renderizado cuando `isDelegationLead = true`) |
| **Portal Usuario — Atleta** | `/portal/user` (renderizado cuando `isDelegationLead = false`) |

---

## 15. Consideraciones Técnicas Clave

### 15.1 Tracking GPS en segundo plano
Este es el motivo principal de migrar a aplicaciones nativas. Los portales web actuales **no pueden mantener GPS activo** cuando el navegador se minimiza o la pantalla se apaga, debido a limitaciones de los navegadores.

La app del conductor debe:
- Enviar posición cada 5 segundos mientras haya un viaje activo.
- Seguir funcionando con la app minimizada, la pantalla apagada o el dispositivo bloqueado.
- Solicitar permisos de ubicación "siempre" (always).
- Usar foreground service en Android para mantener el proceso vivo.

### 15.2 Notificaciones push
El backend actualmente no envía push notifications. Se requerirá agregar un módulo de notificaciones integrado con FCM/APNs. Los eventos que deberían generar notificaciones son:

**Para el conductor:**
- Asignación de un nuevo viaje
- Modificación o cancelación de un viaje asignado
- Nuevo mensaje del pasajero

**Para el usuario:**
- Conductor asignado al viaje
- Conductor en camino
- Conductor en el punto de recogida
- Viaje completado
- Nuevo mensaje del conductor
- Cambios en el calendario deportivo o actividades

### 15.3 Comunicación en tiempo real
El chat actualmente se implementa con polling cada 3 segundos en la web. Para las apps nativas se recomienda migrar a **Supabase Realtime** o **WebSockets** para comunicación bidireccional eficiente.

### 15.4 Gestión de sesión
- Los tokens de Supabase Auth expiran y deben refrescarse automáticamente.
- La sesión del conductor se basa en un código persistente, sin expiración.
- Ambos mecanismos deben sobrevivir al cierre de la app.

### 15.5 Subida de archivos
- Las fotos del dispositivo pueden pesar 5–15 MB.
- El backend acepta payloads de hasta 50 MB en formato base64 (dataUrl).
- Se recomienda comprimir imágenes en el cliente antes de subirlas (máximo 1600px de lado, calidad JPEG 70%).

### 15.6 Seguridad
- Todas las comunicaciones son HTTPS.
- Los tokens JWT se envían en el header Authorization.
- El backend tiene CORS configurado para dominios web; las apps móviles no necesitan CORS pero sí los headers correctos.
- Los buckets de Storage son públicos con URLs directas.

---

## 16. Funcionalidades del Backoffice Web (contexto adicional)

Las apps móviles **no reemplazan ni replican** el sistema administrativo. Para contexto, el backoffice web incluye:

- Gestión completa de eventos, delegaciones, participantes
- Registro de conductores y proveedores
- Gestión centralizada de viajes con asignación, bitácora, tarifas
- Monitor de vuelos en tiempo real
- Gestión hotelera (habitaciones, asignaciones, llaves, salones)
- Alimentación (menús, lugares, horarios)
- Calendario deportivo con detalle diario
- Acreditaciones y credenciales
- Dashboards comerciales y operacionales
- Panel de conductores con rankings y mapa de calor
- Agente IA conversacional para consultas operativas
- Gestión de usuarios y permisos por módulo

Las apps móviles son **consumidores** de la misma información que el backoffice web administra.

---

## 17. Repositorios y Recursos

- **Backend**: https://github.com/MemoryL3ak/proyect-seven (rama `main`)
- **Frontend Web actual**: mismo repositorio, subcarpeta `/frontend`
- **Backend producción**: https://proyect-seven-production.up.railway.app
- **Plataforma web (referencia visual)**: https://sevenarena.app

---

## 18. Glosario

| Término | Definición |
|---------|-----------|
| **Atleta** | Participante registrado de una delegación que compite en el evento |
| **Delegación** | Grupo de participantes de un mismo país |
| **Jefe de delegación** | Atleta marcado con `isDelegationLead = true`. Responsable operativo de su delegación, tiene acceso ampliado en el Portal Usuario |
| **tipoCliente** (userType) | Categoría del participante que determina qué portal puede usar. Valores relevantes: `VIP`, `TA`, `T1`, `ATHLETE`, `COACH`, `STAFF` |
| **esChofer** (isDriver) | Flag en el metadata de un participante de proveedor de transporte que indica que está habilitado como conductor y puede acceder al Portal Conductor |
| **Proveedor de transporte** | Empresa externa que aporta conductores y vehículos |
| **Participante de proveedor** | Personas registradas bajo un proveedor (choferes, coordinadores) |
| **Sede / Venue** | Recinto deportivo donde se realizan las competencias |
| **Villa Panamericana** | Alojamiento principal de los atletas |
| **Credencial** | Acreditación digital con QR para acceso a sedes y servicios |
| **Tipo de cliente** | Categoría del usuario para efectos de tarifas (VIP, T1, Athlete) |
| **Viaje de ida y vuelta** | Solicitud que genera dos viajes enlazados (padre e hijo) |
| **Bitácora del viaje** | Registro histórico de todas las acciones realizadas sobre un viaje |
| **Tracking GPS** | Envío periódico de la ubicación del vehículo al servidor |

---

**Fin del documento**
