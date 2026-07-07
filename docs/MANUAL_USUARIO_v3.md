# Manual de Usuario — Plataforma Seven Arena

**Versión:** 3.0
**Fecha:** Julio 2026
**Dirigido a:** Comité Organizador, Operaciones, Hotelería, Transporte, Alimentación, Acreditación, Prensa, Voluntariado, Directores de Delegación y personal técnico.

---

## Acerca de este manual

Este documento es una guía operativa completa de la plataforma **Seven Arena**. Su propósito es permitir que cualquier usuario —con conocimiento básico de navegadores web— pueda operar la plataforma de extremo a extremo: desde la creación del evento y la carga de participantes hasta la operación diaria del transporte, alojamiento, alimentación y acreditación.

La versión 2.0 incorporó los módulos liberados con posterioridad a la versión 1.0: **cupones y beneficios**, **personal operativo y voluntarios**, **centro de ayuda y documentación**, **inicio guiado al usuario administrador**, **operatividad diaria del transporte** y **registro de acciones del asistente de inteligencia artificial**. Adicionalmente, los portales del participante (VIP, jefe de delegación y atleta) incorporaron las pestañas de premiaciones, cupones y alimentación sin filtros, y la visualización de la credencial digital se realiza dentro de la propia aplicación.

Esta tercera versión (3.0) suma la **puesta en marcha de la aplicación móvil nativa** y su operación cotidiana: **inicio de sesión móvil por código** con recuperación por correo, **notificaciones push** con **bandeja de notificaciones (campana)**, **panel administrativo de envío de push**, **gestión de permisos del dispositivo** y **seguimiento GPS nativo del conductor en segundo plano**. Todo ello se documenta en la nueva **Parte XIII**.

El manual está organizado en **trece partes** y **tres anexos**. Cada parte agrupa módulos relacionados y describe:

- **Qué hace el módulo** (propósito).
- **Quién lo usa** (roles).
- **Cómo se opera, paso a paso** (flujo).
- **Reglas de negocio** (validaciones, estados, transiciones).
- **Errores frecuentes y cómo resolverlos**.

Los íconos utilizados a lo largo del manual son:

- 🟢 **Tip**: recomendación operativa.
- 🟡 **Atención**: punto sensible, requiere verificación.
- 🔴 **Crítico**: acción irreversible o con impacto en otros módulos.
- 📌 **Nota**: información complementaria.

---

# PARTE I — INTRODUCCIÓN

## 1. Acceso a la plataforma

### 1.1 URL y entornos

La plataforma Seven Arena se compone de dos grandes áreas:

| Área | URL base | Uso |
|------|----------|-----|
| **Administración web** | `https://app.seven-arena.com` | Operaciones, gestión, reportería |
| **Portales de participantes** | `https://app.seven-arena.com/portal/<rol>` | Conductor, VIP, Jefe de Delegación, Atleta, Control de Acceso |

Los portales son vistas simplificadas, optimizadas para uso móvil, destinadas a usuarios finales (no administrativos).

### 1.2 Requisitos técnicos

- **Navegador recomendado:** Google Chrome, Microsoft Edge o Safari, en su última versión.
- **Conexión:** internet estable. El portal del conductor y el scanner de acceso soportan operación con conectividad intermitente.
- **Permisos del dispositivo:** los portales que usan cámara (Conductor, Control de Acceso, Scanner de QR de credenciales) requieren **autorización de cámara**. Los que usan GPS (Conductor) requieren **autorización de ubicación**.

### 1.3 Ingreso al módulo administrativo

1. Abrir la URL principal en el navegador.
2. Ingresar correo y contraseña provistos por el Comité Organizador.
3. En el primer ingreso, la plataforma puede solicitar cambio de contraseña.
4. Al autenticarse, se muestra el **menú lateral** con los módulos habilitados según el rol del usuario.

🟡 **Atención:** el menú lateral se filtra automáticamente según los módulos asignados al usuario. Si un usuario no ve un módulo que necesita, debe solicitar al administrador que active el módulo en su perfil.

### 1.4 Ingreso a los portales

Los portales usan autenticación por **código personal de 6 caracteres** (derivado del ID del participante). El flujo típico es:

1. Usuario abre la URL del portal (por ejemplo `/portal/conductor`).
2. Ingresa su código de 6 caracteres.
3. Si no lo recuerda, presiona **"Solicitar código de acceso"**; ingresa correo y recibe el código por email.
4. Accede al portal con su código.

📌 **Nota:** los códigos se envían por email usando el servicio **Resend**. El usuario debe tener un correo válido registrado en su ficha.

---

## 2. Estructura de la plataforma

### 2.1 Organización del menú lateral

El menú lateral está agrupado por **áreas operativas**:

- **Inicio guiado** — recorrido personalizado por rol para nuevos usuarios.
- **Dashboard** — tablero de indicadores.
- **Eventos** — creación y configuración del evento.
- **Deportes** — disciplinas, pruebas y cupos.
- **Participantes** — atletas, delegaciones, VIPs, staff, conductores.
- **Personal operativo** — voluntarios, agentes, supervisores y entrega de productos.
- **Acreditación** — flujo de aprobación y emisión de credenciales.
- **Calendario Deportivo** — programación de pruebas.
- **Transporte** — tarifas, viajes, bitácora, monitoreo, mapa de calor, operatividad diaria.
- **Hotelería** — asignación de habitaciones, llaves, salones.
- **Alimentación** — menús, ubicaciones, control.
- **Cupones y beneficios** — catálogo de descuentos y comercios aliados.
- **Portales** — enlaces y gestión de portales de usuario final.
- **Asistencia** — centro de incidencias y chats de soporte.
- **Notificaciones push** — envío manual de avisos a los dispositivos móviles registrados.
- **Reportería** — generación de reportes descargables.
- **Acciones de SofIA** — auditoría de la inteligencia artificial.
- **Centro de Ayuda** — documentación operativa y cuaderno de cargo.
- **Configuración** — parámetros globales, usuarios, módulos.

### 2.2 Roles y permisos

| Rol | Alcance | Ejemplos de acciones |
|-----|---------|----------------------|
| **Administrador** | Acceso total | Configurar módulos, gestionar usuarios |
| **Operaciones** | Gestión operativa | Asignar viajes, activar pruebas, resolver incidencias |
| **Acreditación** | Revisión y emisión | Aprobar acreditaciones, imprimir credenciales |
| **Hotelería** | Gestión de hotel | Asignar habitaciones, llaves, salones |
| **Transporte** | Gestión de transporte | Tarifas, viajes, seguimiento GPS |
| **Alimentación** | Gestión de comidas | Crear menús, controlar consumo |
| **Reportería** | Lectura | Descargar reportes sin modificar datos |
| **Comité Organizador** | Lectura ejecutiva | Ver tableros y descargar reportes consolidados |

📌 Los permisos se configuran por **módulo** (activar/desactivar el acceso a un módulo entero por usuario).

### 2.3 Convenciones de la interfaz

- **Barra superior**: muestra el nombre del evento activo y el menú de usuario.
- **Panel principal**: listado + buscador + filtros en la parte superior; contenido en la mitad inferior.
- **Botón "Nuevo"**: arriba a la derecha de cada listado, abre un modal o formulario lateral.
- **Acciones por fila**: íconos de **editar** (lápiz), **ver detalle** (ojo), **eliminar** (basura).
- **Estados**: se muestran con colores. Verde = activo/aprobado; Amarillo = pendiente/en espera; Rojo = rechazado/cancelado; Gris = deshabilitado/archivado.

---

# PARTE II — CONFIGURACIÓN INICIAL DEL EVENTO

## 3. Crear el evento

### 3.1 Qué es un evento

Un **evento** es el contenedor superior de toda la información. Todo lo que ocurre en la plataforma (participantes, viajes, asignaciones, reportes) se asocia a un evento específico. Es común tener **un evento por certamen** (por ejemplo, "Juegos Panamericanos 2026").

### 3.2 Paso a paso

1. Ir a **Eventos** en el menú lateral.
2. Presionar **"Nuevo evento"**.
3. Completar los campos:
   - **Nombre**: identificador humano (ej. "Juegos Panamericanos Lima 2026").
   - **Fecha de inicio** y **fecha de término**.
   - **Venue principal** (opcional).
   - **Descripción**.
4. Guardar.

🟢 **Tip:** una vez creado, el evento aparece en la barra superior. Todos los módulos operan en el contexto del evento activo.

### 3.3 Configuración de módulos activos

En el detalle del evento se puede habilitar o deshabilitar módulos por evento (por ejemplo, un evento pequeño puede no usar Hotelería). Solo los módulos activos aparecen en el menú lateral para los usuarios vinculados a ese evento.

🔴 **Crítico:** desactivar un módulo oculta la información pero **no la elimina**. Se puede reactivar en cualquier momento.

---

## 4. Deportes — disciplinas, pruebas y cupos

### 4.1 Jerarquía

La estructura deportiva tiene tres niveles:

- **Deporte** (ej. Atletismo, Natación).
- **Disciplina** (ej. Atletismo → 100m planos).
- **Prueba** (ej. 100m planos → Masculino / Femenino / Relay 4x100).

Cada prueba es la unidad operativa donde se programa la competencia y se asocian **cupos por delegación**, **premiaciones** y horarios en el calendario deportivo.

### 4.2 Crear un deporte

1. Ir a **Deportes** en el menú lateral.
2. Presionar **"Nuevo deporte"**.
3. Completar nombre, sigla, ícono (opcional).
4. Guardar.

### 4.3 Crear una disciplina

1. Dentro de un deporte, presionar **"Nueva disciplina"**.
2. Completar nombre y descripción.
3. Guardar.

### 4.4 Crear una prueba (con premiación)

Este es el formulario más importante del módulo. En él se configura:

- Datos básicos de la prueba.
- Cupos por delegación.
- Datos de la **premiación asociada** (opcional).

**Datos básicos:**

1. Nombre de la prueba.
2. Categoría (masculino, femenino, mixto).
3. Modalidad (individual, por equipos, relay).
4. Cantidad mínima y máxima de atletas.

**Cupos por delegación:**

- Se define cuántos cupos tiene cada delegación para esa prueba.
- El sistema valida al momento de inscribir atletas que no se supere el cupo.

🟢 **Tip:** los cupos **solo se configuran desde este módulo**. Antes se configuraban también desde el formulario de eventos; eso fue removido para evitar duplicación y errores de datos.

**Premiación asociada (opcional):**

En el mismo formulario de prueba, se puede marcar la opción **"Habilitar premiación"**. Al activarla se muestran campos:

- Fecha y hora programada.
- Venue / lugar de la ceremonia.
- Detalle de ubicación (ej. "Tarima central").
- Lista de **autoridades VIP** asignadas como entregadores (roles: oro, plata, bronce, autoridad, entregador).

Al guardar la prueba:

- Si la premiación está habilitada y no existía, se crea.
- Si ya existía y sigue habilitada, se actualiza.
- Si se deshabilita, la premiación asociada se elimina.

📌 La premiación queda asociada a la disciplina (`discipline_id`) y reaparece automáticamente al editar la prueba.

### 4.5 Editar y eliminar

- **Editar**: modifica todos los campos incluyendo cupos y premiación.
- **Eliminar**: requiere confirmación. Si la prueba tiene atletas inscritos o aparece en el calendario, el sistema bloquea la eliminación.

---

## 5. Venues y ubicaciones

### 5.1 Qué es un venue

Un **venue** es un lugar físico donde ocurre alguna actividad del evento: estadios, piscinas, hoteles, salones, puntos de acreditación, etc. Los venues se utilizan como destino en viajes, sede de pruebas, ubicación de premiaciones, lugar de alojamiento y más.

### 5.2 Crear un venue

1. Ir a **Venues** (bajo Eventos o Configuración).
2. Presionar **"Nuevo venue"**.
3. Completar:
   - Nombre.
   - Dirección.
   - Coordenadas (lat/lng). Se puede buscar en el mapa integrado.
   - Tipo (estadio, hotel, salón, punto de acreditación, punto de comida).
   - Capacidad (opcional).
4. Guardar.

🟢 **Tip:** completar correctamente las coordenadas es crítico. El módulo de transporte las utiliza para calcular rutas y tarifas, y el mapa de calor depende de ellas.

### 5.3 Puntos internos del venue

Cada venue puede tener **puntos internos** (ejemplo: accesos de un estadio, zonas de embarque). Esto se usa sobre todo en transporte para marcar puntos de pickup/drop-off precisos.

---

## 6. Hoteles

### 6.1 Crear un hotel

1. Ir a **Hotelería → Hoteles**.
2. Presionar **"Nuevo hotel"**.
3. Completar:
   - Nombre comercial.
   - Dirección y coordenadas.
   - Número total de habitaciones.
   - Tipos de habitación (single, doble, triple, suite).
   - Salones disponibles (con capacidad).
4. Guardar.

### 6.2 Habitaciones

Cada hotel tiene un inventario de habitaciones. Se pueden cargar:

- Individualmente (habitación por habitación, con número y tipo).
- Por plantilla (ej. 50 dobles, 20 singles).

📌 Las habitaciones se muestran en el módulo de asignación con su estado: **Disponible**, **Asignada**, **Bloqueada**, **Mantenimiento**.

---

## 7. Proveedores

### 7.1 Qué es un proveedor

Un **proveedor** es una empresa o entidad externa que presta servicios al evento: transporte, seguridad, prensa, voluntariado, staff contratado, etc.

### 7.2 Tipos de proveedor

| Tipo | Ejemplos |
|------|----------|
| Transporte | Empresa de buses, taxis, vans |
| Staff | Personal de apoyo, acreditación |
| Seguridad | Guardias, coordinadores |
| Prensa | Medios acreditados |
| Voluntariado | Organizaciones civiles |
| Técnico | Árbitros, jueces, técnicos especializados |

### 7.3 Crear un proveedor

1. Ir a **Participantes → Proveedores**.
2. Presionar **"Nuevo proveedor"**.
3. Completar: nombre, tipo, contacto, RUT/ID tributario, descripción.
4. Guardar.

### 7.4 Participantes de proveedor

Cada proveedor tiene **participantes** (personas físicas asociadas). Por ejemplo, una empresa de transporte tiene como participantes a sus conductores.

Para agregar participantes:

1. Abrir el detalle del proveedor.
2. Presionar **"Agregar participante"**.
3. Completar: nombre, apellido, documento, email, teléfono, rol interno.
4. Guardar.

🟡 **Atención:** si el participante es un **conductor**, marcar `metadata.isDriver = true`. Si es **staff de control de acceso**, el proveedor debe ser de tipo **Staff** y el participante queda habilitado automáticamente para solicitar código del portal de acceso.

---

# PARTE III — REGISTRO DE PARTICIPANTES

## 8. Delegaciones

### 8.1 Qué es una delegación

Una **delegación** agrupa a los participantes (atletas, oficiales, prensa, VIPs) de un país, región o institución. Es la unidad administrativa principal para cupos, asignación de habitaciones y reportería.

### 8.2 Crear una delegación

1. Ir a **Participantes → Delegaciones**.
2. Presionar **"Nueva delegación"**.
3. Completar:
   - País / región.
   - Sigla (3 letras, ej. CHI, ARG, BRA).
   - Bandera (opcional).
   - Jefe de delegación (se selecciona después del registro de personas).
4. Guardar.

### 8.3 Asignar jefe de delegación

1. Abrir el detalle de la delegación.
2. Presionar **"Asignar jefe de delegación"**.
3. Buscar la persona ya registrada en el sistema (debe existir como VIP u oficial).
4. Confirmar.

🟢 **Tip:** el jefe de delegación recibe acceso al **Portal del Jefe de Delegación**, donde puede ver a todos sus atletas, gestionar solicitudes de transporte y comunicarse con soporte.

---

## 9. Atletas

### 9.1 Crear un atleta

1. Ir a **Participantes → Atletas**.
2. Presionar **"Nuevo atleta"**.
3. Completar los datos personales:
   - Nombres y apellidos.
   - Documento de identidad.
   - Fecha de nacimiento.
   - Género.
   - Nacionalidad.
   - Email y teléfono.
4. Asignar a una **delegación**.
5. Asignar a una o más **pruebas** (el sistema valida cupos).
6. Adjuntar foto (requerida para la credencial).
7. Guardar.

### 9.2 Inscripción masiva (CSV)

Para cargar muchos atletas de una vez:

1. Descargar la **plantilla CSV** desde el módulo.
2. Completar con los datos de todos los atletas.
3. Subir el archivo en **"Carga masiva"**.
4. Revisar los resultados (aceptados, rechazados, errores por fila).

🟡 **Atención:** la carga masiva valida cupos por delegación. Si se excede un cupo, las filas afectadas son rechazadas y se debe ajustar antes de reintentar.

### 9.3 Estados del atleta

| Estado | Significado |
|--------|-------------|
| Registrado | Datos cargados, pendiente de acreditación |
| En acreditación | Enviado al flujo de revisión |
| Aprobado | Acreditación aprobada |
| Rechazado | Acreditación rechazada |
| Credencial emitida | QR generado y credencial impresa |
| Deshabilitado | No puede ingresar a venues |

---

## 10. VIPs y autoridades

### 10.1 Qué es un VIP

Los **VIPs** son autoridades, personalidades, ex atletas y otras figuras destacadas invitadas al evento. Tienen tratamiento diferenciado: transporte preferencial, alojamiento premium, participación en ceremonias (premiaciones) y acceso a zonas exclusivas.

### 10.2 Crear un VIP

1. Ir a **Participantes → VIPs**.
2. Presionar **"Nuevo VIP"**.
3. Completar datos personales + cargo/institución.
4. Guardar.

### 10.3 Portal VIP

Los VIPs tienen acceso al **Portal VIP** donde pueden:

- Consultar su agenda personal.
- Solicitar transporte.
- Revisar las premiaciones en las que participarán.
- Confirmar/declinar participación en premiaciones.
- Comunicarse con soporte.

---

## 11. Participantes de proveedor (staff, prensa, voluntariado)

Ya explicado en **7.4**. Resumen:

- Los participantes de proveedor **no son atletas ni VIPs**.
- Se crean bajo su proveedor padre.
- Los conductores se marcan con `metadata.isDriver=true`.
- El staff de control de acceso debe pertenecer a un proveedor de tipo "Staff".

---

## 12. Vehículos

### 12.1 Crear un vehículo

1. Ir a **Transporte → Vehículos**.
2. Presionar **"Nuevo vehículo"**.
3. Completar:
   - Patente (placa).
   - Marca y modelo.
   - Capacidad (pasajeros).
   - Tipo (bus, van, sedán, SUV).
   - Proveedor asociado.
4. Guardar.

📌 **Nota importante:** los vehículos se **desacoplan** de los conductores. Es decir, un vehículo no tiene conductor asignado de forma fija. En cada viaje se asigna el conductor que corresponda. Esto es un cambio reciente de arquitectura que flexibiliza la operación diaria.

### 12.2 Estados del vehículo

| Estado | Significado |
|--------|-------------|
| Disponible | Listo para asignarse a un viaje |
| En viaje | Actualmente asignado a un viaje activo |
| Mantenimiento | Fuera de servicio |
| Deshabilitado | No operativo |

---

## 13. Vuelos

### 13.1 Qué son los vuelos

Los **vuelos** registran las llegadas y salidas aéreas de delegaciones y participantes. Permiten al área de transporte organizar recepciones en aeropuerto, y a hotelería preparar check-in/check-out.

### 13.2 Crear un vuelo

1. Ir a **Transporte → Vuelos**.
2. Presionar **"Nuevo vuelo"**.
3. Completar:
   - Número de vuelo y aerolínea.
   - Origen / destino.
   - Fecha y hora programada.
   - Tipo (llegada / salida).
   - Delegación asociada.
   - Cantidad de pasajeros esperados.
4. Guardar.

### 13.3 Asociar participantes al vuelo

Desde el detalle del vuelo se pueden agregar los participantes (atletas, VIPs, oficiales) que llegan o salen en él. Esto sirve para:

- Programar automáticamente un viaje de recepción/despedida.
- Alertar a hotelería del check-in/check-out asociado.

---

# PARTE IV — ACREDITACIÓN Y CONTROL DE ACCESO

## 14. Flujo de acreditación

### 14.1 Visión general

La acreditación es el proceso por el cual un participante (atleta, VIP, oficial, prensa, staff) es validado por el Comité y recibe una **credencial física con QR** que le permite ingresar a los venues autorizados.

### 14.2 Etapas

1. **Registro** — el participante se carga en el sistema con sus datos personales y foto.
2. **Envío a acreditación** — operador envía al flujo de revisión.
3. **Revisión** — acreditador verifica datos, foto, documento.
4. **Aprobación o rechazo** — con motivo documentado.
5. **Emisión** — se genera el QR único y se imprime la credencial.
6. **Entrega** — se marca como entregada en la plataforma.

### 14.3 Operar el flujo

1. Ir a **Acreditación → Cola de revisión**.
2. Seleccionar un participante pendiente.
3. Verificar datos y foto.
4. Presionar **"Aprobar"** o **"Rechazar"**.
5. Si rechaza, escribir el motivo (obligatorio). Se notifica automáticamente al operador que lo registró.
6. Si aprueba, se habilita la opción **"Emitir credencial"**.

### 14.4 Emisión de credenciales

Al emitir una credencial:

- Se genera un QR único con el ID del participante.
- Se imprime en formato PDF listo para impresión física.
- El estado del participante pasa a **"Credencial emitida"**.

🔴 **Crítico:** una vez emitida una credencial, modificar datos del participante **no** afecta el QR ya impreso. Si hay un cambio importante, se debe **reemitir** la credencial (el QR nuevo invalida la copia anterior).

---

## 15. Control de acceso y scanner QR

### 15.1 Qué es el portal de Control de Acceso

El portal **`/portal/access-control`** es la herramienta usada por el staff en los accesos de cada venue para validar las credenciales con QR. Funciona en cualquier dispositivo con cámara (tablet, celular) y se accede con código personal de 6 caracteres.

### 15.2 Solicitar código de acceso

1. Abrir `/portal/access-control` en el dispositivo.
2. Si no se tiene código, presionar **"Solicitar código de acceso"**.
3. Ingresar el correo electrónico registrado en el proveedor de tipo Staff.
4. Recibir el código en el correo.
5. Volver a la pantalla y ingresar el código.

📌 Solo los participantes asociados a un proveedor de tipo **Staff** pueden solicitar y recibir código.

### 15.3 Escanear credenciales

1. Al ingresar, el portal activa automáticamente la cámara.
2. Posicionar el QR dentro del marco de escaneo (las esquinas verdes lo guían).
3. El sistema responde:
   - **Verde (Acceso permitido)** — participante validado, accesso autorizado al venue.
   - **Rojo (Acceso denegado)** — credencial inválida, deshabilitada o no aprobada.
   - **Amarillo (No encontrado)** — QR no corresponde a ningún participante registrado.
4. Cada escaneo se registra automáticamente en la **bitácora de accesos** con: fecha, hora, staff que escaneó, participante (si aplica), resultado.

### 15.4 Bitácora de accesos

Desde el módulo administrativo **Acreditación → Bitácora de accesos** se puede consultar:

- Todos los escaneos realizados.
- Filtros por venue, fecha, staff, resultado.
- Exportar a CSV para auditoría.

🟡 **Atención:** los escaneos **NOT_FOUND** (credenciales no reconocidas) también se registran. Esto permite detectar intentos de acceso con credenciales falsas.

---

## 16. Credenciales — reimpresión y cancelación

### 16.1 Reimpresión

Si un participante pierde su credencial:

1. Ir a su ficha.
2. Presionar **"Reimprimir credencial"**.
3. Confirmar motivo (pérdida, daño, cambio).
4. El QR anterior queda **invalidado**; se genera uno nuevo.
5. Imprimir el PDF.

### 16.2 Cancelación / deshabilitación

Si un participante debe ser retirado del evento:

1. Ir a su ficha.
2. Presionar **"Deshabilitar"**.
3. Indicar motivo.
4. A partir de ese momento, el scanner muestra **"Acceso denegado"** para esa credencial.

---

# PARTE V — CALENDARIO DEPORTIVO Y PREMIACIONES

## 17. Calendario deportivo

### 17.1 Qué es

El **Calendario Deportivo** es la agenda completa de la competencia. En él se programa cada prueba: cuándo, dónde, en qué fase. Alimenta los portales (atletas y jefes de delegación lo ven) y genera demandas automáticas de transporte.

### 17.2 Crear una programación

1. Ir a **Calendario Deportivo**.
2. Presionar **"Nueva programación"**.
3. Seleccionar la prueba (busca por nombre de deporte/disciplina).
4. Seleccionar el venue.
5. Definir fecha y hora de inicio/término.
6. Definir fase (clasificación, semifinal, final).
7. Agregar atletas/participantes (por defecto toma los inscritos en la prueba).
8. Guardar.

### 17.3 Vista calendario

El módulo ofrece tres vistas:

- **Día**: todo lo que ocurre hoy, ordenado por hora.
- **Semana**: grilla de 7 días.
- **Mes**: vista mensual con puntos de colores por deporte.

Al hacer clic sobre un evento se abre el detalle con todos los atletas y el estado de la prueba.

### 17.4 Estados de la programación

| Estado | Significado |
|--------|-------------|
| SCHEDULED | Programada en la agenda |
| IN_PROGRESS | En curso |
| COMPLETED | Finalizada |
| CANCELLED | Cancelada |
| POSTPONED | Pospuesta, pendiente de reprogramación |

---

## 18. Premiaciones

### 18.1 Qué son

Las **premiaciones** son ceremonias donde se entregan medallas o reconocimientos. Cada prueba puede tener una premiación asociada. Las premiaciones se configuran **desde el formulario de prueba** (ver **4.4**), no como un módulo aparte.

### 18.2 Datos clave

Una premiación tiene:

- **Fecha y hora programada**.
- **Venue / ubicación**.
- **Detalle de ubicación** (ej. "Tarima central — frente a grada norte").
- **VIPs asignados** como entregadores, con rol:
  - `GOLD` — entrega medalla de oro.
  - `SILVER` — entrega medalla de plata.
  - `BRONZE` — entrega medalla de bronce.
  - `AUTHORITY` — autoridad presente.
  - `AWARDER` — entregador genérico.
- **Estado**: SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED.

### 18.3 Vista para VIPs

Cada VIP ve en su portal las premiaciones en las que fue asignado, con botones **"Confirmar"** o **"Declinar"**. El sistema registra la respuesta y el Comité puede replanificar asignaciones con rapidez.

### 18.4 Operar el día de la ceremonia

1. Verificar que todos los VIPs confirmaron.
2. En caso de declinación, buscar reemplazo.
3. Cambiar el estado de la premiación a **IN_PROGRESS** al comenzar.
4. Finalizar con **COMPLETED** al terminar.

🟢 **Tip:** las premiaciones aparecen también en reportes y en el mapa de calor como puntos de interés para transporte de VIPs.

---

# PARTE VI — TRANSPORTE

## 19. Tarifas

### 19.1 Qué es

Una **tarifa** es una plantilla de precio y condiciones para un tipo de servicio de transporte (por ejemplo, "Bus grande — aeropuerto ⇄ hotel sede" o "Van VIP — por hora").

### 19.2 Crear una tarifa

1. Ir a **Transporte → Tarifas**.
2. Presionar **"Nueva tarifa"**.
3. Completar:
   - Nombre descriptivo.
   - Tipo (por distancia, por hora, flat rate).
   - Valor unitario (CLP u otra moneda).
   - Tipo de vehículo aplicable.
   - Reglas de horario (ej. recargo nocturno).
4. Guardar.

### 19.3 Uso

Al crear un viaje, la plataforma sugiere la tarifa que mejor se ajusta al tipo de vehículo y ruta. El operador puede aceptar la sugerencia o elegir otra.

---

## 20. Solicitudes de viaje

### 20.1 Origen de una solicitud

Un viaje puede originarse desde:

- **Portal del VIP** — el VIP solicita traslado.
- **Portal del Jefe de Delegación** — solicita traslados para su delegación.
- **Portal del Atleta** — solicita traslado personal.
- **Calendario deportivo** — generado automáticamente cuando hay una prueba programada.
- **Módulo administrativo** — creado manualmente por operaciones.

### 20.2 Crear un viaje manualmente

1. Ir a **Transporte → Viajes**.
2. Presionar **"Nuevo viaje"**.
3. Completar:
   - Origen (venue u dirección libre).
   - Destino (venue u dirección libre).
   - Fecha y hora.
   - Pasajeros (buscar participantes registrados).
   - Tipo de vehículo requerido.
   - Solicitante.
   - Observaciones.
4. Guardar.

El viaje queda en estado **REQUESTED**.

### 20.3 Flujo de estados

```
REQUESTED → ASSIGNED → EN_ROUTE_TO_PICKUP → ARRIVED_AT_PICKUP →
  → PICKED_UP → EN_ROUTE_TO_DESTINATION → COMPLETED
```

Estado alternativo en cualquier momento: **CANCELLED**.

| Estado | Disparado por |
|--------|---------------|
| REQUESTED | Solicitante |
| ASSIGNED | Operaciones asigna vehículo + conductor |
| EN_ROUTE_TO_PICKUP | Conductor inicia el viaje desde su portal |
| ARRIVED_AT_PICKUP | GPS detecta llegada o conductor marca manualmente |
| PICKED_UP | Conductor ingresa **código de 6 caracteres** del pasajero |
| EN_ROUTE_TO_DESTINATION | Automático al pasar a PICKED_UP |
| COMPLETED | GPS detecta llegada al destino o conductor marca |
| CANCELLED | Operador o solicitante |

🟡 **Atención:** el paso a **PICKED_UP** exige el ingreso de un **código de 6 caracteres** proporcionado por el pasajero. Este código corresponde a los últimos 6 caracteres del ID del participante. Sin ese código el conductor no puede continuar. Esto garantiza que se recogió a la persona correcta.

### 20.4 Asignación de vehículo y conductor

Desde el detalle del viaje (estado REQUESTED):

1. Seleccionar vehículo disponible.
2. Seleccionar conductor disponible.
3. Confirmar asignación.
4. El viaje pasa a **ASSIGNED** y el conductor recibe la notificación en su portal.

🟢 **Tip:** la asignación respeta disponibilidad. Un conductor no puede tener dos viajes activos simultáneos. El sistema lo valida.

### 20.5 Cancelación

Un viaje puede cancelarse desde cualquier estado previo a COMPLETED. Requiere ingresar **motivo de cancelación**. Si ya tiene conductor asignado, se le notifica.

---

## 21. Bitácora de viajes

### 21.1 Qué es

La **bitácora** es el registro histórico de todos los viajes del evento. Incluye cambios de estado, timestamps, conductor asignado, pasajeros, ruta recorrida (si se capturó GPS) y costos.

### 21.2 Consultar la bitácora

1. Ir a **Transporte → Bitácora**.
2. Aplicar filtros: fecha, delegación, conductor, estado, tipo de vehículo.
3. Exportar a CSV para análisis externo.

### 21.3 Trazabilidad GPS

Cada viaje con seguimiento activado tiene asociada una **ruta GPS**. Al abrir el detalle del viaje se muestra la ruta dibujada en el mapa, con timestamps cada cierto intervalo.

---

## 22. Seguimiento GPS en tiempo real

### 22.1 Qué es

El **seguimiento GPS en tiempo real** permite ver la ubicación actual de todos los vehículos en viaje, sobre un mapa único. Actualizaciones cada pocos segundos.

### 22.2 Cómo funciona

1. El conductor activa el viaje desde su portal.
2. El navegador del conductor pide permisos de **GPS** y **Wake Lock** (mantener pantalla activa).
3. Cada pocos segundos, el portal envía la posición al backend.
4. El backend la publica en el canal de **Supabase Realtime**.
5. Los operadores suscritos al canal ven los vehículos moverse en el mapa en tiempo real.

📌 El sistema usa **Supabase Realtime** (conexión WebSocket estándar) con **Row Level Security**. Cada usuario autenticado solo recibe los vehículos que le corresponden.

### 22.3 Vista de operaciones

1. Ir a **Transporte → Seguimiento en vivo**.
2. El mapa muestra todos los vehículos activos con marcadores de colores por estado.
3. Hacer clic en un marcador para ver detalles: conductor, pasajero, destino, hora estimada de llegada.

### 22.4 Monitoreo de conductores

Complementa al seguimiento en vivo con una vista enfocada en el **estado de presencia de cada conductor**, independientemente de si está realizando un viaje:

1. Ir a **Transporte → Monitoreo de conductores**.
2. La pantalla muestra:
   - **Indicadores agregados (KPIs)**: conductores en línea, posiciones GPS recientes, viajes activos en curso.
   - **Tabla detallada** con el estado de cada conductor (en línea / fuera de línea, última posición reportada, viajes activos del día, plataforma utilizada).
   - **Mapa de presencia** con la posición actual de cada conductor, diferenciando visualmente a los conectados (marcador verde con iniciales) de los desconectados (marcador gris).
3. Al seleccionar un conductor en el mapa, se abre una tarjeta lateral con su nombre, estado, última hora de actualización del GPS, vehículo asignado y los viajes activos.

🟢 **Tip:** esta vista es clave durante el día de operación para detectar conductores que perdieron señal o que no iniciaron sesión, y reaccionar antes de que afecte la planificación.

### 22.5 Robustez ante conectividad intermitente

El portal del conductor:

- Guarda las posiciones en memoria local cuando pierde conexión.
- Las envía en lote cuando se restablece.
- Usa **Wake Lock** para evitar que el navegador duerma y pierda tracking.

---

## 23. Mapa de calor

### 23.1 Qué es

El **mapa de calor** muestra la densidad de actividad geográfica durante el evento: viajes, escaneos de QR, eventos deportivos. Permite al Comité visualizar dónde hay concentración de personas y operaciones en determinadas franjas horarias.

### 23.2 Consultar el mapa

1. Ir a **Transporte → Mapa de calor**.
2. Filtrar por tipo de actividad y franja horaria.
3. La intensidad del color muestra la cantidad de eventos en cada zona.

🟢 **Tip:** este reporte es especialmente útil para el Comité de Seguridad y para planificar despliegues futuros.

---

# PARTE VII — HOTELERÍA

## 24. Asignación de habitaciones

### 24.1 Flujo general

1. Cada delegación tiene un **bloque de habitaciones reservadas** en uno o más hoteles.
2. El jefe de delegación (o el operador de hotelería) asigna las habitaciones específicas a los participantes.
3. Al llegar el participante al hotel, se le entrega la llave (o tarjeta RFID).

### 24.2 Asignar una habitación

1. Ir a **Hotelería → Asignaciones**.
2. Buscar participante (atleta, VIP, oficial).
3. Seleccionar hotel y habitación disponible.
4. Definir fecha de check-in y check-out.
5. Confirmar.

El sistema marca la habitación como **Asignada** y muestra en el listado quién la ocupa.

### 24.3 Reglas

- Una habitación tiene un límite de ocupantes según su tipo (single = 1, doble = 2, triple = 3).
- No se permite sobreasignar.
- Se alerta si hay conflicto de fechas con otra asignación.

---

## 25. Entrega de llaves / tarjetas

### 25.1 Registrar entrega

1. Cuando el participante llega al hotel, operador de hotelería abre su asignación.
2. Presiona **"Registrar entrega"**.
3. Ingresa número de llave / código de tarjeta RFID.
4. El sistema marca check-in realizado con fecha/hora.

### 25.2 Devolución

Al check-out:

1. Abrir la asignación.
2. Presionar **"Registrar devolución"**.
3. Confirmar estado de la habitación (limpia, con daños, etc.).
4. El sistema libera la habitación a **Disponible**.

---

## 26. Salones y espacios comunes

### 26.1 Qué son

Los **salones** son espacios comunes del hotel (salas de reunión, salones de banquete, gimnasios) que pueden reservarse para actividades del evento.

### 26.2 Reservar un salón

1. Ir a **Hotelería → Salones**.
2. Seleccionar hotel y salón.
3. Presionar **"Nueva reserva"**.
4. Indicar fecha, horario, responsable, propósito.
5. Guardar.

### 26.3 Extras

Se pueden agregar **extras** al salón (coffee break, equipo audiovisual, decoración). Los extras se listan en la reserva y generan un reporte consolidado para el proveedor del hotel.

---

# PARTE VIII — ALIMENTACIÓN

## 27. Menús

### 27.1 Crear un menú

1. Ir a **Alimentación → Menús**.
2. Presionar **"Nuevo menú"**.
3. Completar:
   - Nombre (ej. "Desayuno estándar", "Almuerzo vegetariano").
   - Tipo de comida (desayuno, almuerzo, cena, snack).
   - Descripción y composición.
   - Restricciones dietarias cubiertas (vegetariano, vegano, sin gluten, halal, kosher).
4. Guardar.

### 27.2 Asignar menú a participantes

En la ficha de cada participante (atleta, VIP, etc.) se puede registrar su **restricción dietaria**. El sistema sugiere el menú adecuado y el operador de alimentación puede confirmar.

### 27.3 Visibilidad en los portales

🟢 **Cambio desde la versión 1.0:** los menús diarios y los lugares de alimentación se muestran ahora en los portales **sin filtrar por tipo de cliente**. Cualquier participante (atleta, jefe de delegación o VIP) ve la oferta completa de menús y locales del evento.

Esto facilita la consulta de información y elimina la mantención manual de la asociación menú ↔ tipo de cliente. Si por algún motivo operativo se necesita ocultar un menú o ubicación, simplemente se inactiva en la administración del módulo.

---

## 28. Ubicaciones de alimentación

### 28.1 Crear una ubicación

1. Ir a **Alimentación → Ubicaciones**.
2. Presionar **"Nueva ubicación"**.
3. Completar:
   - Nombre (ej. "Comedor principal", "Kiosko atletas").
   - Venue asociado.
   - Capacidad.
   - Horarios de servicio.
4. Guardar.

### 28.2 Control de consumo

El staff de alimentación puede usar el **scanner de QR** para validar que un participante tiene derecho al menú solicitado en esa ubicación y ese horario. Cada consumo se registra en bitácora.

🟡 **Atención:** un participante no puede consumir dos veces el mismo tipo de comida en el mismo día salvo autorización expresa.

---

## 29. Reportes de alimentación

Desde **Alimentación → Reportes** se puede consultar:

- Cantidad de menús servidos por día y por ubicación.
- Consumo por delegación.
- Restricciones dietarias cubiertas.
- Costos consolidados por proveedor de alimentación.

---

# PARTE IX — PORTALES DE USUARIO FINAL

## 30. Visión general de los portales

### 30.1 Qué son

Los **portales** son interfaces simplificadas, optimizadas para uso móvil, dirigidas a usuarios finales que **no administran** la plataforma pero que la usan para operar en el día a día del evento.

| Portal | URL | Rol objetivo |
|--------|-----|--------------|
| Conductor | `/portal/conductor` | Conductores de vehículos |
| VIP | `/portal/vip` | Autoridades y VIPs |
| Jefe de Delegación | `/portal/delegation` | Jefes de delegación |
| Atleta | `/portal/athlete` | Atletas |
| Control de Acceso | `/portal/access-control` | Staff de acceso |

Todos comparten una identidad visual común: pantalla de login dividida (izquierda: marca; derecha: formulario), autenticación por código de 6 caracteres y opción de "Solicitar código de acceso".

### 30.2 Componentes comunes

- **Notificaciones push** sobre acciones relevantes.
- **Chat de asistencia flotante** (botón circular abajo a la derecha) para comunicarse con soporte.
- **Modo oscuro** automático según preferencia del dispositivo.

---

## 31. Portal del Conductor

### 31.1 Acceso

1. Abrir `/portal/conductor`.
2. Ingresar código de 6 caracteres.
3. Autorizar cámara y GPS cuando el navegador lo solicite.

### 31.2 Pantalla principal

Muestra:

- **Viajes de hoy** ordenados por hora.
- **Viaje activo** (si hay uno en curso), en la parte superior.
- Botón de **chat de asistencia**.

### 31.3 Operar un viaje

1. Seleccionar el viaje.
2. Presionar **"Iniciar viaje"**. Estado pasa a `EN_ROUTE_TO_PICKUP`.
3. Navegar al punto de pickup. El GPS comienza a transmitir.
4. Al llegar, el sistema marca automáticamente `ARRIVED_AT_PICKUP`.
5. Contactar al pasajero, solicitar **código de 6 caracteres** y escribirlo.
6. Al ingresarlo correctamente, el viaje pasa a `PICKED_UP` y luego `EN_ROUTE_TO_DESTINATION`.
7. Al llegar al destino, presionar **"Finalizar viaje"**. Estado pasa a `COMPLETED`.

### 31.4 Chat con pasajero

Desde el viaje activo, el conductor puede abrir un **chat directo con el pasajero** para coordinar detalles (ubicación, llegada tardía, etc.).

### 31.5 Credencial digital del conductor

🟢 **Nuevo en la versión 2.0:** la credencial digital con código QR se visualiza ahora **dentro de la propia aplicación**, en una ventana modal con el QR escaneable y los datos del conductor. Ya no se abre una ventana adicional del navegador.

1. Abrir la sección **Mi credencial** del portal.
2. Se muestra el QR a pantalla completa con foto, datos personales y zonas de acceso.
3. Si se requiere imprimirla, se ofrece un botón opcional que abre la versión imprimible en una pestaña aparte.

📌 La fotografía del conductor se toma automáticamente del registro del participante. Si no hay foto cargada, la credencial muestra un marcador de "Sin foto"; el operador puede subirla desde el módulo administrativo de proveedores.

### 31.6 Reglas operativas

- 🔴 **Crítico:** el conductor no puede pasar a `PICKED_UP` sin el código del pasajero. Esta regla garantiza que no se transporte a personas no autorizadas.
- 🟡 **Atención:** si el GPS pierde señal, el viaje sigue operando; las posiciones se acumulan en el dispositivo y se sincronizan al recuperar conexión.
- 🟢 **Tip:** si la pantalla se apaga, Wake Lock la mantiene activa. Si no, el tracking se pausa.

---

## 32. Portal VIP

### 32.1 Pantallas

El portal VIP se organiza en **pestañas (tabs)**:

- **Solicitud** — formulario para pedir vehículo.
- **Actividades** — viajes en curso, programados e historial.
- **Premiaciones** — ceremonias asignadas con vista calendario y vista lista intercambiables, indicadores y filtros.
- **Cupones** — catálogo de beneficios del evento y mis cupones reclamados.
- **Sedes** — directorio de sedes del evento con fotos y mapa.
- **Hoteles** — Villa Panamericana y alojamientos del evento.
- **Comida** — menú de hoy, menú de mañana y lugares de alimentación.
- **Calendario** — calendario deportivo del evento.
- **Cuenta** — datos personales y credencial digital QR.

### 32.2 Solicitar transporte

1. Abrir la pestaña **Transporte**.
2. Presionar **"Solicitar viaje"**.
3. Completar origen, destino, horario deseado.
4. Confirmar.
5. El viaje queda en estado `REQUESTED`; el área de transporte lo gestiona.

### 32.3 Confirmar premiaciones

1. Abrir la pestaña **Premiaciones**.
2. La pantalla muestra un encabezado con indicadores agregados: programadas, realizadas, confirmadas y pendientes.
3. Alternar entre **vista calendario** (grilla mensual con marcadores por día) y **vista lista** (cards agrupadas por fecha con headers fijos al hacer scroll).
4. Filtrar por estado, rol asignado (oro / plata / bronce / autoridad / premiador), asistencia (confirmada / pendiente / declinada) o búsqueda libre.
5. Al abrir una ceremonia, presionar **"Confirmar"** o **"Declinar"**.

🟢 **Tip:** confirmar con antelación facilita al Comité organizar la ceremonia. Si hay conflicto, declinar y comunicar alternativa vía chat de asistencia.

### 32.4 Reclamar cupones

1. Abrir la pestaña **Cupones**.
2. Sub-pestaña **Disponibles**: catálogo de beneficios con foto, comercio aliado, categoría, descuento y vigencia.
3. Presionar **"Reclamar cupón"** sobre el beneficio deseado.
4. El sistema genera un **código único y un código QR** asociados al VIP.
5. Sub-pestaña **Mis cupones**: tarjetas con todos los cupones reclamados, su estado (activo, canjeado, expirado) y el tiempo restante para usarlos.
6. Al tocar un cupón activo, se abre la pantalla con el **QR escaneable** y el **código de respaldo** para presentar en el comercio.

📌 Cada cupón tiene un límite máximo de canjes por VIP. Si el cupón ya fue reclamado al tope, el botón aparece deshabilitado.

### 32.5 Consultar alimentación, sedes y hoteles

- **Comida** muestra el menú del día y del día siguiente (desayuno, almuerzo, cena) con su descripción y restricciones dietarias, además del listado de lugares de comida disponibles.
- **Sedes** y **Hoteles** ofrecen directorios con fotografía, dirección, mapa y datos de contacto.

🟢 **Cambio desde la versión 1.0:** estas secciones se muestran **sin filtros por tipo de cliente**. El VIP ve la oferta completa.

### 32.6 Visualizar la credencial digital

🟢 **Cambio desde la versión 1.0:** la credencial digital se abre como **modal dentro de la propia aplicación**, sin necesidad de abrir una nueva ventana del navegador.

1. Abrir la pestaña **Cuenta**.
2. Presionar **"Ver credencial digital"**.
3. El QR se muestra a pantalla completa, junto con la fotografía del VIP, su rol y los datos del evento.
4. Si se requiere imprimirla, un botón opcional abre la versión imprimible en una ventana aparte.

### 32.7 Calificar viajes

Al completarse un viaje, aparece un modal para calificar de 1 a 5 estrellas y dejar comentario opcional. Esto alimenta reportes de calidad del servicio.

---

## 33. Portal del Jefe de Delegación

### 33.1 Pantallas

El portal del jefe de delegación se organiza en las siguientes pestañas:

- **Itinerario** — vista consolidada del día con viajes, actividades, comidas y eventos programados.
- **Actividades** — solicitar y dar seguimiento a los viajes de los miembros de la delegación.
- **Calendario** — pruebas en las que compite la delegación, con vista mensual y filtros por disciplina.
- **Sedes** — directorio con fotos, direcciones y mapas.
- **Alimentación** — menú diario, menús futuros y lugares de comida (sin filtros por tipo de cliente).
- **Premiaciones** — ceremonias del evento con vista calendario y vista lista intercambiables.
- **Cupones** — catálogo de beneficios y cupones reclamados.
- **Delegación** — listado de miembros con su información individual y datos agregados.
- **Cuenta** — datos personales y credencial digital.

### 33.2 Solicitar transporte grupal

1. Abrir **Transporte → Nuevo viaje grupal**.
2. Completar origen, destino, fecha y hora.
3. Marcar los atletas/oficiales que viajan.
4. Confirmar.
5. El viaje queda como `REQUESTED` tipo grupal.

### 33.3 Ver estado de atletas

Desde **Delegación** se puede ver el estado de acreditación y próximas pruebas de cada atleta. Útil para coordinar presencia y traslados.

### 33.4 Consultar premiaciones y cupones

Las pestañas **Premiaciones** y **Cupones** funcionan exactamente igual que en el portal VIP (ver 32.3 y 32.4). El jefe de delegación accede a la misma información y catálogo, sin requerir un inicio de sesión adicional.

### 33.5 Itinerario consolidado

La pestaña **Itinerario** combina en una sola línea cronológica:

- Viajes propios y de los miembros de la delegación.
- Actividades deportivas de la delegación.
- Comidas programadas del día (desayuno, almuerzo, cena).
- Premiaciones asignadas.

🟢 **Tip:** esta vista es la pantalla más útil al comienzo del día para tener visibilidad inmediata de la agenda completa.

---

## 34. Portal del Atleta

### 34.1 Pantallas

El portal del atleta incorpora las siguientes pestañas:

- **Actividades** — viajes propios y participaciones.
- **Calendario** — pruebas deportivas del evento con énfasis en las del atleta.
- **Sedes** — directorio con fotos y mapas.
- **Alimentación** — menú del día y de mañana, lugares de comida (sin filtros por tipo de cliente).
- **Premiaciones** — ceremonias del evento con vista calendario y lista.
- **Cupones** — catálogo de beneficios y cupones reclamados.
- **Cuenta** — credencial digital QR y datos personales.

### 34.2 Credencial digital

🟢 **Cambio desde la versión 1.0:** la credencial digital se muestra **dentro de la propia aplicación**, en una ventana modal con el QR escaneable a pantalla completa.

El atleta puede mostrar su credencial QR desde el portal. Es válido como credencial en todos los puntos de acceso, equivalente a la credencial física impresa.

🟢 **Tip:** si un atleta pierde la credencial física, puede usar la digital mientras se reimprime la física.

### 34.3 Premiaciones y cupones

Las pestañas **Premiaciones** y **Cupones** son las mismas que en el portal del jefe de delegación. Aunque el atleta generalmente no es el entregador de medallas, puede consultar el calendario completo de premiaciones del evento. Para el reclamo de cupones, el flujo es idéntico al del VIP.

---

## 35. Portal de Control de Acceso (resumen)

Ya explicado en detalle en **15**. Resumen:

- URL: `/portal/access-control`.
- Login por código de 6 caracteres (solo staff tipo Staff).
- Cámara activa para escanear QR.
- Respuesta visual inmediata: verde/rojo/amarillo.
- Cada escaneo queda registrado en bitácora.

---

# PARTE X — COMUNICACIÓN

## 36. Chat por viaje (conductor ⇄ pasajero)

### 36.1 Qué es

Canal de mensajería privado asociado a un viaje específico. Se abre automáticamente al asignarse el viaje y se cierra cuando el viaje pasa a `COMPLETED` o `CANCELLED`.

### 36.2 Usos

- Coordinar ubicación precisa del pickup.
- Informar retrasos.
- Compartir observaciones puntuales.

### 36.3 Notificaciones

El pasajero y el conductor reciben notificación push cuando hay un mensaje nuevo, siempre que el portal esté abierto. Si no, el mensaje aparece la próxima vez que abren el portal.

---

## 37. Centro de Incidencias (Asistencia)

### 37.1 Qué es

El **Centro de Incidencias** centraliza todos los chats de soporte abiertos por usuarios finales desde cualquier portal. Permite al equipo de operaciones responder de manera ordenada y mantener trazabilidad de cada caso.

### 37.2 Origen de las incidencias

Una incidencia puede originarse desde:

| Origen | Ejemplo |
|--------|---------|
| Portal Conductor | "Mi GPS no funciona" |
| Portal VIP | "Necesito cambiar mi traslado" |
| Portal Jefe de Delegación | "Falta un atleta por acreditar" |
| Portal Atleta | "No encuentro mi credencial" |
| Portal Control de Acceso | "Scanner no lee este QR" |

Cada incidencia queda asociada a su origen, lo que permite filtrar por área.

### 37.3 Estados

| Estado | Significado |
|--------|-------------|
| OPEN | Creada, pendiente de atención |
| IN_ATTENTION | Un agente ya está respondiendo |
| WAITING_USER | Se espera respuesta del usuario |
| RESOLVED | Incidencia cerrada |

Al enviar un agente el primer mensaje, la incidencia pasa automáticamente de `OPEN` a `IN_ATTENTION`.

### 37.4 Operar el centro de incidencias

1. Ir a **Asistencia → Centro de Incidencias**.
2. Ver listado ordenado por prioridad y antigüedad.
3. Filtros: estado, tipo de origen, agente asignado.
4. Seleccionar una incidencia.
5. Leer el mensaje inicial y el historial.
6. Responder al usuario.
7. Agregar **notas internas** (no visibles al usuario) para coordinar con otros agentes.
8. Cerrar con estado **RESOLVED** al finalizar.

🟡 **Atención:** las notas internas (`is_internal_note=true`) no actualizan el **last_message_at** del chat. Esto asegura que el orden por antigüedad refleje siempre el último mensaje visible al usuario.

### 37.5 Widget de chat en portales

Desde cualquier portal, el usuario presiona el botón flotante **"Asistencia"** y puede:

- Ver sus chats previos.
- Crear un chat nuevo.
- Conversar en tiempo real.

El widget refresca cada 8 segundos para mostrar mensajes nuevos.

---

## 38. Notificaciones

### 38.1 Canales

- **Push en navegador** (portales).
- **Email** (Resend) para comunicaciones críticas.
- **SMS** (opcional, si está integrado el proveedor correspondiente).

### 38.2 Tipos de notificación automática

| Evento | Destinatario | Canal |
|--------|--------------|-------|
| Nuevo viaje asignado | Conductor | Push |
| Pasajero listo para recoger | Conductor | Push |
| Cambio de estado de viaje | Solicitante | Push |
| Acreditación aprobada | Participante | Email |
| Credencial emitida | Participante | Email |
| Premiación confirmada | Comité | Dashboard |
| Mensaje nuevo en chat | Ambas partes | Push |
| Incidencia nueva | Equipo de soporte | Push + Email |

### 38.3 Configurar notificaciones

Cada usuario puede, desde su perfil, activar o desactivar las notificaciones push en su dispositivo. Las notificaciones críticas (ej. asignación de viaje al conductor) no pueden desactivarse.

---

## 39. Asistente de IA — Sofia

### 39.1 Qué es

**Sofia** es el asistente conversacional de la plataforma. Permite a operadores consultar datos usando lenguaje natural, sin necesidad de ir manualmente a cada módulo.

### 39.2 Ejemplos de consultas

- "¿Cuántos viajes tenemos programados mañana?"
- "Muéstrame los atletas de Brasil pendientes de acreditar."
- "¿Qué conductor hizo más viajes esta semana?"
- "Listá las premiaciones de esta tarde."
- "Mostrame en el mapa los conductores activos del aeropuerto."

### 39.3 Cómo acceder

1. Presionar el ícono de SofIA (barra superior).
2. Escribir la consulta en lenguaje natural.
3. SofIA responde con texto y, cuando corresponde, con tablas o enlaces al módulo.

### 39.4 Mapa interactivo embebido

🟢 **Nuevo en la versión 2.0:** cuando la consulta involucra ubicaciones (conductores, viajes, sedes), SofIA incrusta directamente en la conversación un **mapa interactivo** con los marcadores correspondientes. Esto evita salir del chat para consultar el mapa operativo en otra pestaña.

### 39.5 Mensajes de progreso en español

Mientras SofIA ejecuta una operación interna (por ejemplo, buscar viajes, listar conductores o crear una premiación), muestra en pantalla un **mensaje en lenguaje natural** que describe la acción en curso ("Buscando conductores disponibles…", "Programando ceremonia…"), en lugar de etiquetas técnicas. Esto facilita seguir lo que está haciendo el asistente paso a paso.

### 39.6 Iniciar una nueva conversación

En el encabezado del widget aparece el botón **"Nueva conversación"**. Al presionarlo se limpian los mensajes anteriores, el contexto y los errores acumulados. Útil cuando se cambia de tema o se quiere arrancar desde cero.

### 39.7 Capacidades de SofIA

A diferencia de la versión inicial, SofIA puede ahora ejecutar **operaciones** sobre la plataforma (crear viajes, programar premiaciones, asignar cupones, enviar notificaciones), no solo consultar.

🟡 **Atención:** todas las operaciones ejecutadas por el asistente quedan registradas en el módulo **Acciones de SofIA** (capítulo 49) para auditoría posterior.

🟢 **Tip:** si querés que SofIA solo consulte sin modificar datos, basta con plantear la pregunta como tal (por ejemplo, "muéstrame…" en vez de "creá…").

---

## 40. Multilenguaje

La plataforma soporta múltiples idiomas en la interfaz. El idioma se determina por:

1. Preferencia explícita del usuario (configurada en su perfil).
2. Idioma del navegador.
3. Idioma por defecto del evento.

Idiomas soportados: Español, Inglés, Portugués. La lista puede ampliarse bajo demanda del Comité Organizador.

---

# PARTE XI — REPORTERÍA Y ADMINISTRACIÓN

## 41. Reportería

### 41.1 Qué es

El módulo de **Reportería** agrupa reportes consolidados, descargables en formato **CSV**, **Excel** o **PDF**, disponibles para el Comité Organizador y equipos operativos.

### 41.2 Reportes disponibles

| Área | Reporte | Contenido |
|------|---------|-----------|
| Participantes | Listado general | Todos los participantes con estado de acreditación |
| Participantes | Cupos por delegación | Cupos usados vs disponibles |
| Transporte | Viajes realizados | Todos los viajes con estado, horarios, costos |
| Transporte | Desempeño de conductores | Cantidad, duración, calificación promedio |
| Transporte | Mapa de calor | Actividad geográfica |
| Hotelería | Ocupación | Habitaciones usadas por noche |
| Hotelería | Salones reservados | Listado de reservas con extras |
| Alimentación | Consumo por día | Menús servidos |
| Acreditación | Bitácora de accesos | Escaneos de QR en venues |
| Asistencia | Incidencias | Cantidad, estado, tiempo promedio de resolución |

### 41.3 Descargar un reporte

1. Ir a **Reportería**.
2. Seleccionar el reporte.
3. Aplicar filtros (fechas, delegación, área).
4. Presionar **"Exportar"**.
5. Elegir formato (CSV, Excel, PDF).
6. El archivo se descarga automáticamente al navegador.

### 41.4 Acceso del Comité Organizador

Los miembros del Comité tienen un rol específico (**Comité**) que permite **solo lectura** del módulo de reportería. Pueden descargar todos los reportes pero no modificar datos.

---

## 42. Dashboard ejecutivo

### 42.1 Qué es

El **dashboard** es la vista de alto nivel que muestra el estado general del evento con indicadores visuales. Pensado para directivos y jefaturas.

### 42.2 Indicadores clave

- Total de participantes por estado de acreditación.
- Viajes en curso / completados / cancelados del día.
- Ocupación hotelera actual.
- Incidencias abiertas vs resueltas.
- Próximas pruebas y premiaciones.
- Alertas operativas (alertas de capacidad, conflictos de agenda).

### 42.3 Personalización

Cada usuario puede elegir qué tarjetas ve en su dashboard y en qué orden.

---

## 43. Configuración

### 43.1 Gestión de usuarios

1. Ir a **Configuración → Usuarios**.
2. Ver listado de usuarios administrativos.
3. Crear nuevo usuario: nombre, email, rol, módulos permitidos.
4. Editar/deshabilitar usuarios existentes.

🔴 **Crítico:** deshabilitar un usuario impide el acceso inmediato, pero no borra el histórico de acciones.

### 43.2 Módulos por usuario

Cada usuario tiene una lista de **módulos permitidos**. El menú lateral se filtra según esa lista. Los cambios surten efecto en el siguiente inicio de sesión del usuario.

### 43.3 Parámetros globales

- Nombre del evento activo.
- Zona horaria.
- Moneda por defecto.
- Idioma por defecto.
- Integraciones activas (Resend, Supabase Realtime, etc.).

### 43.4 Auditoría

Todas las operaciones sensibles (crear/editar/eliminar participantes, cambios de acreditación, emisión de credenciales, cancelación de viajes, etc.) quedan registradas en un **log de auditoría** con usuario, fecha y datos cambiados.

Acceso: **Configuración → Auditoría**.

---

# PARTE XII — FUNCIONALIDADES ADICIONALES (V2.0)

Esta parte agrupa los módulos incorporados a la plataforma con posterioridad a la versión 1.0 del manual. Su operación es independiente de los módulos previos pero se integra de forma transparente con ellos.

## 44. Cupones y beneficios

### 44.1 Qué es

El módulo de **cupones y beneficios** permite ofrecer a los participantes del evento un catálogo digital de descuentos en comercios aliados (restaurantes, tiendas, entretenimiento, transporte), gestionando el flujo completo desde la publicación del cupón hasta su canje en el local del comercio.

Cada participante puede reclamar los cupones que le interesen desde su portal móvil; cada reclamo genera un **código único y un código QR** que el comercio aliado valida en el momento del canje.

### 44.2 Quién lo usa

| Rol | Acción |
|-----|--------|
| **Administrador / Operaciones** | Crear el catálogo, definir vigencia y límites |
| **Atleta / Jefe de Delegación / VIP** | Reclamar y canjear cupones desde el portal |
| **Comercio aliado** | Escanear y validar el QR en el portal partner |

### 44.3 Crear un cupón

1. Ir a **Cupones y beneficios → Catálogo**.
2. Presionar **"Nuevo cupón"**.
3. Completar:
   - **Título** del beneficio (ej. "20% de descuento en pizzas").
   - **Categoría**: Comida, Entretenimiento, Tienda, Otros.
   - **Comercio aliado**: razón social, dirección, logotipo, contacto.
   - **Tipo de descuento**: porcentaje, monto fijo o gratuito.
   - **Valor del descuento**.
   - **Vigencia**: fecha de inicio y término.
   - **Límite por participante** (cantidad máxima de cupones que un mismo usuario puede reclamar).
   - **Términos y condiciones**.
   - **Imagen** del cupón (formato JPG o PNG).
4. Guardar.

🟢 **Tip:** elegir bien la imagen y el copy del título: estos son los elementos que el participante ve primero en el catálogo.

### 44.4 Reclamar un cupón (lado participante)

1. El participante abre la pestaña **Cupones** en su portal.
2. Sub-pestaña **Disponibles**: catálogo con foto, comercio, categoría, descuento y vigencia.
3. Presiona **"Reclamar cupón"**.
4. El sistema genera el código único y el QR, y lo agrega a su sub-pestaña **Mis cupones**.

📌 Si el participante ya reclamó el cupón al tope permitido, el botón aparece deshabilitado con la leyenda "Ya lo reclamaste".

### 44.5 Canjear un cupón (lado comercio aliado)

1. El comercio abre el **portal partner** (`/portal/partner`) e ingresa su código de acceso.
2. Selecciona **"Escanear cupón"**.
3. El participante muestra el QR de su cupón en el portal.
4. El comercio escanea con la cámara del dispositivo.
5. El sistema valida el cupón:
   - **Válido**: marca el cupón como `CANJEADO` y registra la operación con fecha y comercio.
   - **Ya canjeado / expirado / anulado**: respuesta visual roja, no se permite el canje.

🟡 **Atención:** un cupón solo se puede canjear una vez. Si el sistema indica "ya canjeado", el comercio debe explicar al participante la situación.

### 44.6 Estados del cupón reclamado

| Estado | Descripción |
|--------|-------------|
| `RECLAMADO` | El participante lo reclamó pero aún no lo canjeó |
| `CANJEADO` | El comercio aliado lo escaneó y validó |
| `EXPIRADO` | Pasó su fecha de vigencia sin canjearse |
| `ANULADO` | El administrador lo revocó manualmente |

### 44.7 Reportería

Acceso: **Cupones y beneficios → Reportes**.

Reportes disponibles:

- **Cupones más reclamados**.
- **Cupones canjeados por comercio**.
- **Tasa de canje** (canjeados / reclamados).
- **Cupones expirados sin uso**.

Exportable a XLSX y PDF.

---

## 45. Personal operativo y voluntarios

### 45.1 Qué es

El módulo de **personal operativo** administra al personal del evento que no es participante deportivo: voluntarios, supervisores, agentes de soporte, personal de servicio y otros roles operativos. Permite además gestionar el **inventario de productos y materiales** (uniformes, kits, credenciales físicas, materiales operativos) y registrar su entrega a cada persona.

### 45.2 Quién lo usa

| Rol | Acción |
|-----|--------|
| **Administrador / Operaciones** | Alta del personal, catálogo de productos |
| **Coordinador de Voluntariado** | Registrar entregas y devoluciones |
| **Operaciones de Acreditación** | Verificar entrega de credenciales físicas |

### 45.3 Registrar al personal

1. Ir a **Personal operativo → Personas**.
2. Presionar **"Nuevo registro"**.
3. Completar nombre, documento de identidad, categoría (voluntario, supervisor, agente, personal de servicio), área asignada, contacto y foto.
4. Guardar.

### 45.4 Cargar productos al catálogo

1. Ir a **Personal operativo → Productos**.
2. Presionar **"Nuevo producto"**.
3. Completar nombre del producto, categoría (uniforme, kit, credencial, material) y stock disponible.
4. El sistema genera un **código de barras único** por producto (estándar Code 128).
5. Guardar.

### 45.5 Registrar una entrega

1. Seleccionar la persona desde el listado.
2. Presionar **"Registrar entrega"**.
3. Escanear o ingresar el código de barras del producto a entregar.
4. Indicar cantidad y observaciones.
5. Confirmar. La entrega queda asociada a la persona, con fecha y usuario responsable.

🟢 **Tip:** durante la entrega masiva de uniformes el día de inicio del evento, conviene tener una notebook conectada a un lector de códigos de barras USB para acelerar el flujo.

### 45.6 Imprimir etiquetas con código de barras

1. Ir al detalle de un producto.
2. Presionar **"Imprimir etiquetas"**.
3. Indicar la cantidad de etiquetas a imprimir.
4. El sistema genera una hoja imprimible con los códigos de barras listos para pegar en el inventario físico.

📌 También se pueden imprimir etiquetas en lote desde el listado de productos seleccionando múltiples filas.

### 45.7 Reportes

- **Entregas por persona** y por categoría de producto.
- **Productos sin entregar / con stock faltante**.
- **Devoluciones** y estado de cada producto entregado.

---

## 46. Centro de Ayuda y Documentación

### 46.1 Qué es

El **Centro de Ayuda** es una base de conocimiento integrada en la plataforma que reúne la documentación operativa del evento: glosario de términos, roles, regiones, recintos, hoteles, coordinadores y procedimientos generales. Funciona como referencia rápida para cualquier usuario administrativo.

Incluye además el **Cuaderno de Cargo del evento** (≈97 entradas estructuradas) con soporte trilingüe español / inglés / portugués para las etiquetas.

### 46.2 Acceder

1. Presionar **Centro de Ayuda** en el menú principal.
2. La pantalla muestra las categorías disponibles como pestañas: general, buses, áreas, glosario, roles, regiones, recintos, hoteles, coordinadores.
3. Seleccionar una categoría para ver sus entradas.

### 46.3 Buscar contenido

- **Búsqueda libre** por término, descripción o etiqueta. La caja de búsqueda está en la parte superior y filtra resultados en tiempo real.
- **Filtros por categoría** desde las pestañas laterales.

### 46.4 Descargar el Cuaderno de Cargo en PDF

En la pestaña **Cuaderno de Cargo** hay un botón para abrir el documento original del Cuaderno de Cargo del evento en formato PDF, disponible para descarga.

🟢 **Tip:** mantener el PDF descargado en el dispositivo permite consultarlo aunque haya pérdida temporal de conexión.

### 46.5 Quién lo usa

El Centro de Ayuda está disponible para **todos los roles administrativos** sin requerir permisos especiales. Es especialmente útil para personal nuevo o roles que necesitan consultar terminología específica del evento (por ejemplo, coordinadores que se incorporan poco antes del inicio).

---

## 47. Inicio guiado al usuario administrador

### 47.1 Qué es

El **Inicio Guiado** es un recorrido interactivo personalizado por rol que acompaña al nuevo usuario administrador en sus primeros pasos dentro de la plataforma. Recomienda los módulos más relevantes según el perfil del usuario y los objetivos que declara.

### 47.2 Cuándo aparece

- **Primer ingreso**: la primera vez que un usuario administrador inicia sesión, la plataforma le sugiere realizar el inicio guiado.
- **Acceso manual**: en cualquier momento desde **Inicio guiado** en el menú principal.

### 47.3 Flujo del recorrido

El recorrido tiene **seis pasos**:

1. **Bienvenida**: presentación de la plataforma.
2. **Selección del rol**: el usuario elige su perfil entre los seis disponibles (Director, Coordinador de Operaciones, Coordinador de Transporte, Coordinador de Acreditación, Coordinador de Hospedaje, Coordinador de Alimentación).
3. **Selección de objetivos**: marca los objetivos personales que quiere cumplir en su jornada (por ejemplo, "supervisar viajes del día", "validar acreditaciones pendientes").
4. **Recomendación de tareas**: el sistema sugiere un listado de tareas con **enlaces directos** a los módulos correspondientes.
5. **Sugerencias y atajos**: tips operativos y atajos útiles según el rol.
6. **Pantalla de finalización**: confirmación con un efecto visual de celebración.

### 47.4 Persistencia del progreso

El estado del recorrido se guarda en el navegador del usuario, lo que permite **reanudar** donde se dejó si el usuario cierra la sesión a mitad de camino.

Si el usuario quiere repetir el recorrido, puede presionar el botón **"Reiniciar inicio guiado"** dentro de la misma pantalla.

### 47.5 Recomendación de uso

🟢 **Tip:** durante la capacitación del equipo operativo del Comité, recomendar a cada nuevo usuario completar el inicio guiado antes de su primera operación efectiva. Acelera la curva de aprendizaje y reduce el número de consultas básicas al equipo técnico.

---

## 48. Operatividad diaria del transporte

### 48.1 Qué es

La **Operatividad Diaria** es la pantalla de gestión diaria del módulo de transporte. Consolida en una sola vista la planificación, asignación y seguimiento de los viajes del día, e incorpora **asignación automática de conductores** y **carga masiva mediante plantilla XLSX**.

Reemplaza la operación día a día con múltiples filtros en la vista general de viajes (capítulo 20), aunque ambas vistas conviven.

### 48.2 Quién lo usa

| Rol | Acción |
|-----|--------|
| **Coordinador de Transporte** | Planificación y asignación |
| **Operaciones** | Seguimiento del cumplimiento del día |
| **Asistencia** | Reasignación ante incidencias |

### 48.3 Acceder

**Transporte → Operatividad diaria**.

### 48.4 Vista consolidada del día

La pantalla muestra:

- **Indicadores agregados**: total de viajes del día, asignados, sin asignar, porcentaje de cobertura.
- **Listado** de todos los viajes en estados activos (`SOLICITADO`, `PROGRAMADO`, `EN_RUTA`, `RECOGIDO`).
- **Filtros** por estado, conductor, vehículo, ruta y franja horaria.
- **Indicador visual** de viajes sin conductor asignado, destacados en amarillo.

### 48.5 Asignación automática de conductores

1. Seleccionar uno o más viajes sin conductor asignado.
2. Presionar **"Asignación automática"**.
3. El sistema evalúa cada viaje considerando:
   - **Capacidad** del vehículo del conductor versus pasajeros solicitados.
   - **Disponibilidad horaria** (sin solapamiento con otros viajes ya asignados).
   - **Carga acumulada** del conductor en el día (busca distribuir equitativamente).
4. Confirma la asignación. Los viajes pasan a `PROGRAMADO`.
5. Cada asignación queda registrada en la bitácora del viaje con el indicador "asignación automática".

🟡 **Atención:** la asignación automática puede ser reasignada manualmente en cualquier momento antes del inicio del viaje. El sistema no obliga a aceptar la asignación.

### 48.6 Descarga de plantilla XLSX

1. Presionar **"Descargar plantilla"**.
2. El sistema descarga un archivo XLSX con 25 columnas, filas de ejemplo y los campos vacíos que el sistema completará (conductor, teléfono, patente).
3. Completar la plantilla con los viajes del día.
4. Subirla mediante **"Cargar viajes desde XLSX"**.
5. El sistema valida cada fila, reporta errores antes de la confirmación y crea los viajes en lote.

🟢 **Tip:** el primer día de operación conviene preparar la plantilla con anticipación, validar con el coordinador de transporte y cargarla la noche anterior. Esto deja al equipo del día solo el seguimiento.

### 48.7 Edición masiva

1. Seleccionar múltiples viajes desde el listado.
2. Presionar **"Asignar conductor en lote"** o **"Cambiar vehículo en lote"**.
3. Confirmar.

Útil cuando un conductor falta y hay que reasignar varios de sus viajes a otro.

---

## 49. Acciones del asistente de inteligencia artificial

### 49.1 Qué es

El módulo **Acciones de SofIA** registra de forma completa cada operación que el asistente conversacional (SofIA, capítulo 39) ejecuta sobre la plataforma. Garantiza la trazabilidad, el control y la rendición de cuentas sobre el accionar de la inteligencia artificial.

### 49.2 Quién lo usa

| Rol | Acción |
|-----|--------|
| **Administrador** | Auditoría completa, configuración de límites |
| **Comité Organizador** | Revisión ejecutiva del uso |
| **Operaciones** | Verificar operaciones recientes ejecutadas por SofIA |

### 49.3 Acceder

**Acciones de SofIA** en el menú principal.

### 49.4 Contenido del registro

Por cada operación ejecutada por el asistente se guarda:

- **Tipo de operación**: viaje creado, viaje cancelado, premiación programada, cupón publicado, notificación enviada, etc.
- **Parámetros** entregados al asistente.
- **Respuesta** devuelta por la plataforma (exitosa o con error).
- **Conversación de origen**: el chat completo del usuario que solicitó la acción.
- **Usuario** que realizó la consulta y **fecha y hora** de ejecución.

### 49.5 Filtros disponibles

- Por **tipo de operación**.
- Por **fecha** o rango de fechas.
- Por **usuario** que originó la consulta.
- Por **estado**: exitosa o con error.

### 49.6 Detalle expandible

1. Hacer clic sobre una fila del listado.
2. Se expande el detalle con los parámetros, la respuesta y un enlace a la conversación original que generó la operación.

🟢 **Tip:** ante una operación inesperada o un error reportado por un usuario, abrir el detalle expandible es la forma más rápida de reconstruir qué hizo el asistente y por qué.

### 49.7 Indicadores agregados

En la parte superior de la pantalla se muestran indicadores ejecutivos del uso del asistente:

- **Operaciones por día** y **por tipo**.
- **Porcentaje de éxito** (operaciones exitosas / total).
- **Funciones más utilizadas**.

### 49.8 Exportación

El registro se exporta a XLSX desde el botón **"Exportar"**, para análisis offline o reportería ejecutiva.

🟡 **Atención:** dado que SofIA puede ejecutar operaciones sensibles, esta pantalla debería ser revisada periódicamente por el Administrador de la plataforma. Es la principal herramienta de control sobre el accionar de la inteligencia artificial.

---

# PARTE XIII — APLICACIÓN MÓVIL NATIVA Y NOTIFICACIONES (V3.0)

Esta parte documenta la operación de la **aplicación móvil nativa** de Seven Arena y su infraestructura de comunicación con el dispositivo. La aplicación reutiliza los portales web existentes dentro de un contenedor nativo (iOS/Android), lo que permite acceder a capacidades del dispositivo —notificaciones push, GPS en segundo plano, cámara— manteniendo una sola base de contenido. Los flujos de negocio (viajes, credenciales, calendario, chats) son los mismos ya descritos en las partes anteriores; aquí se cubre exclusivamente lo específico de la app.

## 50. Inicio de sesión móvil por código

### 50.1 Qué es

La aplicación móvil usa un **inicio de sesión por código personal de 6 caracteres** en lugar de correo y contraseña. El código corresponde a los últimos 6 caracteres del identificador del participante y no requiere que el usuario gestione una contraseña.

📌 La pantalla de inicio de sesión de la app es distinta de la del módulo administrativo web. En el dispositivo se accede desde la ruta de la app (`/m/login`), con casillas individuales para cada carácter del código.

### 50.2 Ingresar

1. Abrir la aplicación Seven Arena.
2. Ingresar el **código de 6 caracteres** en las casillas (se puede pegar el código completo de una vez).
3. Presionar **"Iniciar sesión"**.
4. La aplicación **resuelve automáticamente el portal** según el código:
   - Si corresponde a un **atleta** → abre el **portal de usuario**.
   - Si corresponde a un **conductor** → abre el **portal del conductor**.

🟢 **Tip:** la sesión queda **persistida** en el dispositivo. En las siguientes aperturas de la app, el usuario entra directamente a su portal sin volver a ingresar el código.

### 50.3 Recuperar el código

1. En la pantalla de inicio de sesión, presionar **"Recordarme mi código"**.
2. Ingresar el **correo electrónico** registrado.
3. Presionar **"Enviarme mi código"**.
4. La aplicación muestra un mensaje de confirmación y, si el correo está registrado, el usuario recibe su código.

🟡 **Atención (privacidad):** por seguridad, la pantalla **siempre** muestra el mismo mensaje de confirmación, exista o no el correo en el sistema. Esto evita que terceros puedan averiguar qué correos están registrados. Si el usuario no recibe el código, verificar que el correo de su ficha sea correcto desde el módulo administrativo.

### 50.4 Cerrar sesión

Al cerrar sesión desde la app, el usuario es devuelto a la **pantalla de inicio de sesión móvil** (no a la del módulo web). Se limpian todos los datos de sesión del dispositivo.

---

## 51. Notificaciones push

### 51.1 Qué es

Las **notificaciones push** son avisos que llegan al dispositivo del usuario aunque la aplicación esté cerrada (nueva asignación de viaje, mensaje del chat, recordatorio, alerta). Complementan a la campana dentro del portal (capítulo 52).

### 51.2 Cómo se activa en el dispositivo

1. Al iniciar sesión por primera vez, la app solicita permiso de **notificaciones** (ver capítulo 53).
2. Concedido el permiso, la app **registra el dispositivo** automáticamente contra la plataforma. No requiere acción del usuario.
3. A partir de ese momento, el usuario puede recibir push en ese dispositivo.

📌 Un mismo usuario puede tener **varios dispositivos** registrados; el aviso llega a todos ellos.

### 51.3 Abrir la pantalla correcta al tocar el aviso

Al **tocar** una notificación, la app abre directamente la pantalla asociada (por ejemplo, el viaje recién asignado). El usuario no tiene que navegar manualmente hasta encontrarla.

### 51.4 Envío manual desde administración (panel de push)

El equipo operativo puede enviar un aviso puntual a un usuario específico (útil para pruebas o comunicaciones dirigidas):

1. Ir a **Notificaciones push** en el menú lateral.
2. En la columna **Destinatarios** aparece la lista de usuarios con al menos un dispositivo registrado, con su nombre, tipo (atleta/conductor), plataformas (iOS/Android) y última actividad. Se puede **buscar** por nombre o tipo y **actualizar** la lista.
3. Seleccionar un destinatario.
4. En la columna de composición, elegir un **emoji**, escribir el **título** (máx. 80 caracteres) y el **mensaje** (máx. 300 caracteres).
5. Presionar **"Enviar push"**.
6. El sistema confirma el envío. El aviso aparece **tanto en el dispositivo como en la campana** del portal del usuario.

🟡 **Atención:** si la lista de destinatarios está vacía, significa que ningún usuario ha abierto aún la app móvil ni concedido permiso de notificaciones. Pedir al usuario que abra la aplicación y acepte el permiso.

📌 Los tokens de dispositivos desinstalados o caducados se **eliminan automáticamente** cuando el servicio de mensajería los reporta como inválidos, manteniendo la lista de destinatarios depurada.

---

## 52. Bandeja de notificaciones (campana)

### 52.1 Qué es

Además del push en el dispositivo, cada portal tiene una **campana** con el historial de avisos del usuario. Garantiza que ningún aviso se pierda: aunque el usuario no vea el push en el momento, la notificación queda guardada en su bandeja.

### 52.2 Usar la bandeja

1. Presionar el ícono de **campana** en el portal.
2. Se muestra el listado de notificaciones, de la más reciente a la más antigua, con su emoji, título, mensaje y hora.
3. La campana muestra un **contador de no leídas**.
4. Acciones disponibles:
   - **Marcar como leídas** (una o todas).
   - **Vaciar la bandeja**.

📌 Toda notificación push enviada al usuario aparece también aquí. La campana y el push comparten el mismo origen, por lo que siempre están sincronizados.

---

## 53. Permisos del dispositivo

### 53.1 Qué es

Para funcionar plenamente, la app necesita permisos del dispositivo: **notificaciones**, **ubicación**, **cámara** y **galería**. La app incluye un panel para que el usuario los consulte y active de forma clara.

### 53.2 Panel de permisos

1. En el portal, abrir la sección **Cuenta**.
2. Ubicar el bloque **Permisos del dispositivo**. Cada permiso muestra:
   - Un ícono, su nombre y una descripción en lenguaje claro.
   - Su **estado**: *Activado*, *Sin activar* o *Bloqueado en Ajustes*.
   - Un botón de acción.
3. Presionar **"Activar"** para que el sistema muestre el diálogo del permiso.
4. Si el permiso está **bloqueado a nivel de sistema**, el botón cambia a **"Abrir ajustes"** y lleva directamente a la pantalla de ajustes del dispositivo.

🟢 **Tip:** al volver a la app después de cambiar un permiso en los ajustes, el estado se actualiza solo; no hace falta reiniciar la aplicación.

### 53.3 Avisos contextuales

En las pantallas que requieren un permiso concreto (por ejemplo, tomar una foto de un documento), aparece un **aviso puntual** invitando a activar ese permiso, con la acción directa. Esto evita que el usuario tenga que ir hasta la sección Cuenta.

📌 Para qué se usa cada permiso:

| Permiso | Uso en la app |
|---------|---------------|
| Notificaciones | Avisos de cambios en traslados y viajes próximos |
| Ubicación | Rutas, traslados cercanos y seguimiento GPS del conductor |
| Cámara | Fotos de credenciales, documentos y evidencias |
| Galería | Subir fotos o documentos guardados en el dispositivo |

---

## 54. Seguimiento GPS del conductor (app nativa)

### 54.1 Qué es

En la app nativa, el conductor cuenta con un **interruptor de seguimiento GPS** que envía su posición al centro de control en tiempo real, con capacidad de funcionar **en segundo plano** (app minimizada o pantalla apagada). Reemplaza al mecanismo de navegador (Wake Lock) descrito en el capítulo 22.5, con mayor confiabilidad.

### 54.2 Activar el seguimiento

1. En el portal del conductor, ubicar el bloque **Tracking GPS**.
2. Presionar **"Activar GPS y enviar ubicación"**.
3. La app solicita el **permiso de ubicación** (incluido el de segundo plano cuando está disponible).
4. Si el **GPS del sistema está apagado**, la app guía al conductor para encenderlo sin salir de la aplicación.
5. Al activarse, el distintivo de estado cambia a **● Transmitiendo**.

### 54.3 Estados del tracking

| Distintivo | Significado |
|-----------|-------------|
| ● Transmitiendo | Activo y enviando posiciones al panel del admin |
| GPS apagado | El tracking está armado, pero el GPS del sistema está apagado; no se envían posiciones |
| Inactivo | El seguimiento no está activo |

### 54.4 Segundo plano

- Si el conductor concedió el permiso de **segundo plano**, la posición se sigue enviando con la app minimizada o la pantalla apagada.
- Si solo concedió el permiso básico, el envío ocurre **mientras la app permanece abierta**.

La app indica en cada activación si el seguimiento quedó "incluyendo segundo plano" o "solo con la app abierta".

### 54.5 Diagnóstico de red

El bloque de tracking muestra un **diagnóstico** para verificar que las posiciones están llegando:

- **Último intento** de envío.
- **Último envío OK**.
- **Error** de red (si lo hubo), con el código correspondiente.
- **En cola para reenviar**: cantidad de posiciones acumuladas mientras no hubo red.

🟢 **Tip:** ante dudas de un coordinador sobre por qué un conductor "no aparece en el mapa", pedirle que abra el bloque de tracking y lea el diagnóstico. Distingue rápidamente entre GPS apagado, permiso faltante y problema de red.

🟡 **Atención:** las posiciones capturadas sin conexión se **reenvían automáticamente** al recuperar la red. Un valor alto en "En cola para reenviar" indica conectividad intermitente, no pérdida de datos.

### 54.6 Detener el seguimiento

Presionar **"Detener tracking"**. El distintivo vuelve a **Inactivo** y se deja de enviar la posición.

---

# ANEXOS

## Anexo A — Atajos y trucos

### A.1 Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl + K` | Abrir buscador global |
| `Ctrl + /` | Abrir Sofia (asistente IA) |
| `Ctrl + N` | Nuevo registro en el módulo activo |
| `Esc` | Cerrar modal |
| `Ctrl + S` | Guardar formulario abierto |

### A.2 Trucos

- **Búsqueda global (`Ctrl + K`)** busca en todos los módulos: participantes, viajes, venues, hoteles.
- **Filtros persistentes**: la plataforma recuerda los últimos filtros aplicados en cada módulo hasta que el usuario los limpie.
- **Columnas personalizables**: en los listados grandes, presionar el ícono de engranaje para elegir qué columnas mostrar.
- **Exportaciones rápidas**: desde cualquier listado, botón "Exportar" en la esquina superior derecha.

---

## Anexo B — Estados y transiciones

### B.1 Viajes

```
REQUESTED → ASSIGNED → EN_ROUTE_TO_PICKUP → ARRIVED_AT_PICKUP →
  → PICKED_UP (requiere código) → EN_ROUTE_TO_DESTINATION → COMPLETED
                                                    ↘
                                                  CANCELLED (desde cualquier estado previo)
```

### B.2 Acreditación

```
REGISTRADO → EN_ACREDITACION → APROBADO → CREDENCIAL_EMITIDA → ENTREGADA
                            ↘
                         RECHAZADO
                            ↘
                        DESHABILITADO (en cualquier momento posterior)
```

### B.3 Premiaciones

```
SCHEDULED → IN_PROGRESS → COMPLETED
         ↘
        CANCELLED
```

### B.4 Incidencias (chats de asistencia)

```
OPEN → IN_ATTENTION → WAITING_USER → RESOLVED
                   ↘
                RESOLVED (directo si no requiere espera)
```

### B.5 Habitaciones

```
DISPONIBLE ↔ ASIGNADA ↔ OCUPADA → DISPONIBLE (tras checkout)
              ↕
           BLOQUEADA / MANTENIMIENTO
```

---

## Anexo C — Preguntas frecuentes

**¿Qué hago si un conductor no recuerda su código de 6 caracteres?**
Desde la pantalla de login del portal del conductor, presionar "Solicitar código de acceso", ingresar correo electrónico y recibir el código por email.

**¿Cómo sé cuál es el código de 6 caracteres de un pasajero?**
Corresponde a los últimos 6 caracteres del ID del participante. El pasajero lo recibe automáticamente en sus notificaciones del portal. Si lo olvidó, puede verlo en su portal (sección perfil) o solicitarlo por chat de asistencia.

**Un QR no se lee en el scanner de acceso. ¿Qué hago?**
1. Verificar iluminación y limpieza de la cámara.
2. Pedir al participante que muestre el QR digital desde su portal.
3. Si sigue sin leer, buscar al participante por nombre en el scanner (búsqueda manual).
4. Si es un QR desconocido, reportar por chat de asistencia (puede ser credencial falsa).

**¿Puedo modificar un viaje ya iniciado?**
No. Una vez que el viaje pasa a `EN_ROUTE_TO_PICKUP`, los datos quedan congelados. Si hay un cambio necesario, cancelar el viaje y crear uno nuevo.

**¿Cómo se maneja la privacidad de datos de atletas menores de edad?**
La plataforma aplica criterios reforzados: fotos y datos sensibles solo son visibles para roles con permisos específicos. En reportes, los datos de menores se anonimizan en exportaciones públicas.

**¿Qué ocurre si se cae internet durante un evento?**
Los portales con modo offline (conductor, scanner de acceso, scanner de QR) siguen operando en modo degradado: guardan datos localmente y los sincronizan al restablecerse la conexión. El módulo administrativo requiere conexión para operar.

**¿Cómo cambio el idioma de la plataforma?**
Perfil de usuario → Idioma. Al guardar, la interfaz se traduce inmediatamente.

**¿Puedo asignar a un mismo VIP a varias premiaciones?**
Sí. Un VIP puede ser entregador en cuantas premiaciones se le asigne. El sistema detecta solapamientos y avisa si hay conflicto de horario.

**¿Cómo se genera la credencial digital del atleta?**
Al emitir la credencial, se genera el QR y este queda disponible tanto en el PDF impreso como en el portal del atleta. El QR es el mismo en ambos soportes.

**¿Quién puede descargar reportes sensibles?**
Solo usuarios con rol Reportería, Administrador o Comité Organizador. Cada descarga queda registrada en la auditoría.

**En la app móvil, ¿por qué no me piden correo y contraseña?**
La aplicación móvil usa **inicio de sesión por código de 6 caracteres** (los últimos 6 caracteres del ID del participante), no correo y contraseña. Si no recuerdas tu código, usa "Recordarme mi código" e ingresa tu correo registrado (ver capítulo 50).

**Un usuario no aparece en el panel de Notificaciones push. ¿Por qué?**
Porque aún no ha registrado un dispositivo. Debe **abrir la app móvil, iniciar sesión y aceptar el permiso de notificaciones**. Recién entonces su dispositivo queda registrado y disponible como destinatario (ver capítulo 51).

**Un conductor "no aparece en el mapa" pese a estar en viaje. ¿Qué reviso?**
Pedirle que abra el bloque **Tracking GPS** de su portal y verifique el distintivo de estado y el **diagnóstico de red**: distingue entre GPS del sistema apagado, permiso de ubicación faltante y problema de conectividad (posiciones en cola). Ver capítulo 54.

**¿El seguimiento GPS funciona con la app cerrada o la pantalla apagada?**
Sí, siempre que el conductor haya concedido el permiso de **ubicación en segundo plano**. Si solo concedió el permiso básico, el envío ocurre mientras la app permanece abierta (ver capítulo 54.4).

---

*Fin del manual. Para consultas no cubiertas, utilizar el chat de asistencia integrado en el portal o escribir a soporte@seven-arena.com.*


