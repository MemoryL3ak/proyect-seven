/**
 * Base de conocimiento completa de la plataforma Seven Arena.
 * Extraída de la sección Ayuda + Manual de Usuario de la plataforma.
 * Sofia la usa para responder preguntas sobre cómo usar la plataforma.
 */
export const PLATFORM_KNOWLEDGE = `
=== SEVEN ARENA — MANUAL COMPLETO DE LA PLATAFORMA ===

## 1. INTRODUCCIÓN A SEVEN ARENA
Seven Arena es una plataforma integral de gestión de eventos deportivos. Centraliza en un único sistema todas las operaciones logísticas de un evento: inscripción de participantes, transporte, hotelería, alimentación, salud, acreditación y seguimiento comercial.
Diseñada para equipos de organización de eventos de mediano y gran escala, con soporte multiusuario, roles diferenciados y acceso desde cualquier dispositivo (desktop y móvil).

### Módulos principales
Dashboard (Comercial y Operacional), Registro (Eventos, Participantes, Proveedores), Operación (Transporte, Hotelería, Alimentación, Salud, Vuelos), Acreditación, Calendario Operacional, Portales y Administración.

### Requisitos de acceso
Navegador moderno (Chrome, Firefox, Safari o Edge actualizados). No se requiere instalar aplicaciones adicionales. Sistema completamente optimizado para pantallas táctiles y móviles.

---

## 2. INICIO DE SESIÓN Y ACCESO
Accede desde la URL provista por tu organización. El sistema admite dos modalidades de login:
- Con correo electrónico y contraseña.
- Con nombre de usuario y contraseña (para usuarios sin email corporativo).

### Recuperar contraseña
En la pantalla de login haz clic en "¿Olvidaste tu contraseña?". Ingresa tu email y recibirás un enlace de recuperación. Si tu cuenta usa nombre de usuario sin email, contacta al administrador para que restablezca tu contraseña manualmente.

### Roles de usuario
- Administrador: acceso total a todos los módulos y configuración.
- Supervisor: acceso de lectura y escritura a módulos operativos.
- Operador: acceso a módulos específicos asignados por el administrador.
- Coordinador: acceso a coordinación de equipos y reportes.
- Visualizador: acceso de solo lectura.

---

## 3. DASHBOARD
La sección Dashboard ofrece dos vistas ejecutivas de la operación del evento.

### Dashboard Comercial
Muestra el presupuesto adjudicado, consumido y el forecast por área operativa (Transporte, Hotelería, Alimentación, Producción). Las tarjetas con badge "Real" están alimentadas por datos reales de la plataforma; las tarjetas "Ficticio" son datos de referencia que se actualizarán a medida que se ingresen montos reales. El total adjudicado de Transporte corresponde a la suma de los montos licitados de todos los conductores registrados.

### Dashboard Operacional
Ofrece métricas en tiempo real: viajes activos, asignaciones de hotel, alertas de salud y estado de acreditación. Se recomienda revisar este dashboard al inicio de cada jornada operativa.

---

## 4. REGISTRO

### 4.1 Registro de Evento
Antes de operar cualquier otro módulo, crea el evento principal en Registro → Registro Evento. Configura: nombre del evento, fechas de inicio y término, sede principal, disciplinas deportivas y categorías. Solo debe existir un evento activo a la vez. El evento es el contenedor de todos los datos de la plataforma.

### 4.2 Inscripción de Participantes
Gestiona el registro de atletas, técnicos y delegaciones.
- Alta individual: haz clic en "+ Nuevo" y completa el formulario con nombre completo, RUT, delegación, disciplina, categoría, datos de contacto y documentos de salud.
- Importación masiva: usa el botón "Importar", descarga la plantilla Excel, completa los datos y carga el archivo. El sistema validará cada fila antes de importar y mostrará un resumen de errores si los hay.
Cada participante tiene un código QR único generado automáticamente que sirve como credencial de acceso al evento.

### 4.3 Proveedores
Registra y clasifica a todos los proveedores externos del evento.
Tipos disponibles: Transporte, Logística, Hotelería, Alimentación, Productora, Voluntarios, Seguridad, Staff, Infraestructura, Control Técnico, Salud, Broadcast y Medios, Merchandising, Tecnología, Recursos Humanos, Aseo y Mantención, Acreditación.

Tipos con subtipos:
- Staff → Recursos Humanos, Dpto de Compras, Sport Manager, Comité Organizador
- Infraestructura → Recintos
- Control Técnico → Jueces, Mesa de Control
- Salud → Antidopaje
- Merchandising → Marketing, Equipamiento Deportivo

Cada proveedor registra: nombre, tipo, subtipo, RUT y email de contacto.

Participantes de proveedor: cada proveedor puede tener participantes asociados. Los proveedores de tipo TRANSPORTE requieren documentos por cada participante (persona y vehículo):
Documentos de persona: Fotocopia Carnet, Antecedentes, Cert. Inhabilidades menores, Licencia de conducir, Foto tipo Carnet.
Documentos de vehículo: Permiso de circulación, SOAP, Decreto 80, Gases, Padrón, Seguros adicionales, Foto del vehículo.

---

## 5. OPERACIÓN — TRANSPORTE
Gestiona todo el ciclo de vida de los traslados: conductores, vehículos, viajes y seguimiento en tiempo real.

### Registro de conductores
En Operación → Transporte → Conductores registra cada conductor con: nombre completo, RUT, número de licencia, teléfono, tipo y marca de vehículo, placa patente, capacidad y monto licitado/presupuesto (CLP). El campo "Monto licitado" alimenta directamente el Dashboard Comercial.

### Gestión de viajes
En Operación → Transporte → Viajes crea los traslados. Cada viaje requiere: conductor asignado, origen, destino, fecha y hora, lista de pasajeros y estado (Pendiente / En curso / Completado). Los viajes pueden asignarse desde el panel de administración o solicitarse a través del Portal de Solicitud de Vehículo.

### Vuelos
Gestión de vuelos de llegada y salida de los participantes. Se registra: número de vuelo, aerolínea, origen, hora de llegada o salida y terminal.

### Tracking en tiempo real
El mapa de tracking (Tracking de Viajes) muestra la posición en tiempo real de los vehículos activos. Las posiciones se actualizan desde la app del conductor a través del Portal Conductor.

### Escáner QR
Permite validar credenciales de participantes en puntos de acceso. Accede desde Operación → Transporte → Escáner QR, activa la cámara y apunta al código QR. El sistema mostrará nombre, delegación, tipo de acceso permitido y estado de acreditación.

---

## 6. OPERACIÓN — HOTELERÍA
Gestiona el alojamiento de todos los participantes: configuración de hoteles, asignación de habitaciones, llaves y servicios extra.

### Configuración inicial
Configura la estructura en este orden:
1. Hoteles/Villa Panamericana: crea cada establecimiento con nombre, dirección y capacidad total.
2. Habitaciones: agrega habitaciones de cada hotel con tipo (simple, doble, triple, suite), piso y número.
3. Camas: opcionalmente registra las camas individuales dentro de cada habitación.

### Asignaciones de hotel
En Asignaciones Hotel busca al participante por nombre o delegación y selecciona la habitación disponible. La asignación automática por tipo de habitación distribuye a los atletas según el tipo de alojamiento acordado por delegación. Puedes ver el estado de ocupación en el Tracking de Hotelería.

### Gestión de llaves
Registra la entrega y devolución de llaves o tarjetas de acceso. Cada transacción queda registrada con fecha, hora y el operador que realizó la gestión.

### Salones y extras
- Reserva de Salones: gestiona salas de reuniones del hotel para delegaciones y comités.
- Reserva de Extras: gestiona servicios adicionales como lavandería, gimnasio, sala de prensa y catering especial.

---

## 7. OPERACIÓN — ALIMENTACIÓN
Gestiona todos los servicios de alimentación del evento: comedores, menús y servicios por tipo.

### Configuración
Define primero:
- Tipos de Alimentación: categorías de menú especial (vegetariano, sin gluten, alérgenos, etc.).
- Lugares de Comida: comedores y puntos de servicio con su ubicación y capacidad.

### Servicios de alimentación
Registra los menús por servicio (Desayuno, Almuerzo, Cena) con la descripción del menú del día y los grupos o delegaciones que lo reciben. Permite planificar la cantidad de raciones por servicio y llevar control de restricciones alimentarias.

---

## 8. OPERACIÓN — SALUD
Módulo de control sanitario y médico del evento, incluyendo la gestión del programa antidopaje (AND).

### Atenciones médicas
Registra cada atención médica: participante atendido, fecha, tipo de atención, diagnóstico y derivaciones. Genera el historial médico del evento para efectos de reportería.

### Control AND
Gestiona el listado de sustancias prohibidas y el seguimiento de atletas sujetos a controles antidopaje. El submódulo Cumplimiento AND permite registrar la entrega de formularios de declaración y el estado de cumplimiento por atleta.

### Ficha de Salud (Portal Atleta)
Los atletas pueden completar su ficha de salud desde el portal, incluyendo: datos personales de salud, alergias, enfermedades crónicas, medicamentos, tratamientos psiquiátricos, dietas especiales, contacto de emergencia y firma digital.

---

## 9. ACREDITACIÓN
Sistema de control de acceso basado en credenciales QR para todos los participantes y personal del evento.

### Tipos de acceso
Cada credencial puede tener uno o más tipos de acceso:
- C — Campo de juego
- TR — Tribunas
- H — Hotel / Villa
- R — Salas de reuniones
- A — Áreas restringidas (técnicas, médicas)
- RD — Acceso dirección / VIP

### Estados de acreditación
- Pendiente: la solicitud está en revisión.
- En revisión: en proceso de aprobación.
- Aprobada: la credencial es válida y puede usarse.
- Rechazada: la credencial no fue aprobada.
- Credencial Emitida: la credencial física fue generada y entregada.

El estado se puede actualizar manualmente desde el perfil del participante o de forma masiva desde el listado de acreditaciones.

### Validación con escáner
Usa el escáner QR en cada punto de control. Muestra en tiempo real si el acceso está permitido, el nombre del participante y sus tipos de acceso activos. Si la credencial es inválida, vencida o no tiene permisos para esa zona, muestra un mensaje de alerta en rojo.

---

## 10. PORTALES DE USUARIO
La plataforma ofrece portales simplificados para usuarios finales que no necesitan acceso al sistema completo.

### Portal de Usuario / Atleta
Vista personalizada para atletas y técnicos. Muestra: datos del participante, habitación asignada, credencial QR, viajes programados e información del evento. Accesible desde dispositivos móviles.

### Portal Conductor
Vista optimizada para conductores. Muestra los viajes asignados del día con origen, destino, pasajeros y estado. El conductor puede actualizar el estado del viaje (En curso / Completado) y su posición se transmite al mapa de tracking.

### Solicitud de Vehículo
Portal para que los responsables de delegación o coordinadores soliciten traslados. La solicitud queda en estado Pendiente hasta que un operador la aprueba y asigna un conductor.

---

## 11. ADMINISTRACIÓN DE USUARIOS
Módulo exclusivo para administradores. Gestiona los accesos y permisos de todos los usuarios de la plataforma.

### Crear un usuario
En Administración → Gestión de Usuarios haz clic en "+ Nuevo usuario". Completa: nombre completo, email (o nombre de usuario para cuentas sin email), rol y módulos a los que tendrá acceso. El sistema enviará un email de bienvenida. Si el usuario no tiene email, el administrador establece la contraseña inicial.

### Modificar permisos
Abre el usuario y edita su rol o los módulos asignados. Los cambios toman efecto inmediatamente; el usuario deberá refrescar su sesión.

### Resetear contraseña
Desde el perfil del usuario usa "Resetear contraseña". Para cuentas con email se envía un enlace de recuperación automáticamente. Para cuentas con nombre de usuario, el administrador puede establecer una nueva contraseña directamente.

### Desactivar un usuario
Para revocar el acceso sin eliminar al usuario, cambia su estado a "Inactivo". El usuario no podrá iniciar sesión pero sus datos históricos se conservan.

---

## 12. CALENDARIO OPERACIONAL
Vista de planificación de disciplinas, competencias y actividades del evento organizadas por día.
Navega por días usando las flechas de navegación o haciendo clic en una fecha específica. Cada día muestra las disciplinas programadas con su venue, hora de inicio, categoría y estado. El calendario está vinculado a los datos del Registro de Eventos; cualquier modificación en las disciplinas se refleja automáticamente.

---

## 13. INTERFAZ Y PERSONALIZACIÓN

### Temas visuales
La plataforma soporta 4 temas: Light (claro), Dark (oscuro con dorado), Obsidian (oscuro con cyan futurista) y Atlas (azul marino corporativo). Se configuran desde el botón de tema en la barra superior.

### Idiomas disponibles
Español (ES), English (EN) y Português (PT). El selector está en la parte inferior del menú lateral.

### Uso móvil
En pantallas pequeñas el menú lateral se convierte en un cajón deslizable que se abre con el botón ☰. Los portales de conductor y usuario están especialmente optimizados para uso móvil.

---

## 14. PREGUNTAS FRECUENTES (FAQ)

¿Cómo creo un nuevo conductor?
Ve a Operación → Transporte → Conductores. Haz clic en "+ Nuevo" e ingresa el nombre, RUT, vehículo y monto licitado. El monto licitado aparecerá automáticamente en el Dashboard Comercial.

¿Cómo importo participantes de forma masiva?
En Registro → Inscripción Participantes, usa el botón "Importar". Descarga la plantilla Excel, completa los datos y sube el archivo. El sistema validará el formato antes de importar y mostrará un resumen de registros exitosos y errores.

¿Por qué algunas tarjetas del Dashboard muestran "Ficticio"?
Las tarjetas marcadas como "Ficticio" contienen datos de ejemplo. Para ver datos reales en Transporte, ingresa el "Monto licitado/presupuesto" en el registro de cada conductor. Las otras áreas se actualizarán a medida que se integre su seguimiento presupuestario.

¿Cómo asigno una habitación a un atleta?
En Operación → Hotelería → Asignaciones Hotel, busca al atleta por nombre o delegación y selecciona la habitación disponible. También puedes usar la asignación automática por tipo de habitación; asegúrate de que las habitaciones estén creadas antes de ejecutarla.

¿Cómo funciona el escáner QR?
Accede a Operación → Transporte → Escáner QR desde cualquier dispositivo con cámara. El sistema validará la credencial y mostrará nombre, delegación, tipo de acceso permitido y estado en tiempo real. Si la credencial es inválida muestra alerta en rojo.

¿Puedo acceder desde el celular?
Sí. La plataforma es completamente responsiva. El menú lateral se convierte en un cajón deslizable en pantallas pequeñas. Los portales de conductor y usuario están optimizados para uso móvil.

¿Cómo cambio el idioma de la interfaz?
En la parte inferior del menú lateral encontrarás el selector de idioma. Actualmente disponible en Español, English y Português.

¿Qué diferencia hay entre los temas visuales?
Light (claro), Dark (oscuro con dorado), Obsidian (oscuro con cyan futurista) y Atlas (azul marino corporativo). Se configuran desde el botón de tema en la barra superior.

¿Cómo creo un proveedor y le asigno un subtipo?
En Registro → Proveedores, haz clic en "+ Nuevo". Selecciona el tipo (ej. "Staff") y el subtipo disponible para ese tipo (ej. "Recursos Humanos") se habilitará automáticamente en el siguiente selector.

¿Cómo reseteo la contraseña de un usuario?
En Administración → Gestión de Usuarios, abre el usuario y usa la opción "Resetear contraseña". Se enviará un email de recuperación a la dirección registrada. Para usuarios sin email, el administrador puede establecer una contraseña directamente.

¿Cómo crear un usuario sin correo electrónico?
En Administración → Gestión de Usuarios, al crear un nuevo usuario desmarca la opción de email y usa el campo "Nombre de usuario". El administrador establecerá la contraseña inicial.

¿Cómo funciona la asignación automática de hotel?
En Asignaciones Hotel hay un botón de asignación automática. El sistema distribuye a los atletas en las habitaciones disponibles según el tipo de habitación (simple, doble, triple) asignado a cada delegación.

¿Qué pasa si escaneo una credencial inválida o vencida?
El escáner mostrará un mensaje de alerta en rojo indicando el motivo del rechazo. El acceso debe ser denegado en ese caso.

---

## 15. PASOS PARA EMPEZAR (INICIO RÁPIDO)
1. Configura el evento: ve a Registro → Registro Evento y crea el evento principal con fechas, sede y disciplinas.
2. Inscribe participantes: en Registro → Inscripción Participantes agrega atletas manualmente o importa desde Excel.
3. Registra conductores: en Operación → Transporte ingresa conductores con su vehículo y monto licitado.
4. Asigna hoteles: en Operación → Hotelería → Asignaciones Hotel distribuye atletas en las habitaciones disponibles.
5. Monitorea el dashboard: el Dashboard Comercial y Operacional muestran el estado en tiempo real de toda la operación.
6. Gestiona accesos: en Administración → Gestión de Usuarios crea cuentas para tu equipo con los roles adecuados.

---

## 16. CONSEJOS Y TIPS
- Cambia el tema desde el botón en la barra superior (Light, Dark, Obsidian, Atlas).
- La interfaz está disponible en Español, English y Português. Cambia el idioma al final del menú lateral.
- En móvil, el menú lateral se abre con el botón ☰ en la esquina superior izquierda.
- Los datos del Dashboard Comercial se actualizan cada vez que modificas el monto licitado de un conductor.
- Para importar participantes masivamente usa el botón "Importar" en la sección de Inscripción. Descarga la plantilla primero.
- Cada usuario puede tener acceso solo a los módulos que necesita. Configura esto en Administración → Gestión de Usuarios.

=== FIN DEL MANUAL ===
`;
