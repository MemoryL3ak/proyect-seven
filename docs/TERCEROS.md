# Inventario de terceros que reciben o procesan datos de usuarios

**SA-BACKEND-04 · 3** (cierra el Requisito 3 de SA-BACKEND-01) · 1 de septiembre de 2026

Inventario definitivo, verificado contra el código del repositorio (backend
`src/`, frontend `frontend/`). Para cada servicio: qué datos recibe, con qué
finalidad, y si actúa como encargado de tratamiento bajo contrato.

## 1 · Infraestructura (encargados de tratamiento)

| Servicio | Datos que recibe | Finalidad | ¿Encargado bajo contrato? |
|---|---|---|---|
| **Supabase** (AWS us-east) | Toda la base de datos: identificación, contacto, salud (fichas médicas), documentos, GPS, chats, credenciales | Base de datos, almacenamiento de archivos, autenticación y Realtime | Sí — DPA estándar de Supabase (suscrito con los términos del servicio) |
| **Railway** | Todo el tráfico de la API (los datos transitan por sus servidores); logs de aplicación | Alojamiento del backend NestJS | Sí — DPA estándar de Railway |
| **Vercel** | Direcciones IP y cabeceras de quienes visitan el panel y los portales | Alojamiento del frontend Next.js | Sí — DPA estándar de Vercel |

## 2 · Servicios funcionales

| Servicio | Datos que recibe | Finalidad | ¿Encargado bajo contrato? |
|---|---|---|---|
| **Resend** (api.resend.com) | Correo electrónico y nombre del destinatario; el código de acceso enviado | Envío de los correos de recuperación de código de acceso | Sí — DPA estándar de Resend |
| **OpenAI** (api.openai.com, modelo `gpt-4o-mini`) | El contenido de las consultas al asistente SofIA, que puede incluir datos operativos de participantes | Asistente SofIA del panel de administración | Sí — DPA de la API de OpenAI; los datos de la API no se usan para entrenamiento |
| **Google Maps Platform** (maps.googleapis.com) | Direcciones consultadas en el autocompletado; posición del mapa; dirección IP del navegador | Mapas de seguimiento de viajes y autocompletado de direcciones | Términos de Google Maps Platform (Google actúa según sus propios términos; **debe declararse en las tiendas** — hoy falta) |
| **Firebase Cloud Messaging** (Google, solo Android) | Token de push del dispositivo; título y cuerpo de las notificaciones | Notificaciones push | Sí — términos de Firebase / DPA de Google |
| **Apple Push Notification service** | Token de push del dispositivo; contenido de las notificaciones | Notificaciones push (iOS) | Sí — términos del Apple Developer Program |
| **Expo Application Services** | Artefactos de compilación de la app; credenciales de firma | Compilación y distribución de la app | Sí — términos/DPA de Expo |

## 3 · Servicios que reciben datos no personales o mínimos

| Servicio | Datos que recibe | Finalidad | Observación |
|---|---|---|---|
| **AviationStack** (api.aviationstack.com) | Números de vuelo consultados | Estado de vuelos de llegadas y salidas | No recibe datos personales (solo el número de vuelo); términos estándar, sin DPA |
| **MagicAPI / AeroDataBox** (api.magicapi.dev) | Números de vuelo consultados | Seguimiento de posición de vuelos | Ídem anterior |
| **Boostr** (api.boostr.cl) | Patentes de vehículos consultadas | Datos técnicos del vehículo al registrar la flota | La patente es del vehículo, no de la persona; términos estándar, sin DPA |
| **cdnjs (Cloudflare)** | Solo la petición HTTP del navegador (IP implícita) al descargar `pdfobject.min.js` | CDN de una librería estática | No recibe ningún dato de usuario; basta mencionarlo como CDN |

## 4 · Respuesta a la observación del documento

- **Google Maps: sí debe incorporarse a la lista declarada** en ambas tiendas.
  Recibe direcciones (incluidas las de la ficha de salud vía autocompletado) y
  la IP del navegador. Es el único faltante con datos personales efectivos.
- **cdnjs no requiere declaración como receptor de datos**: sirve un archivo
  JavaScript estático y no recibe información de usuarios.
- Además de Google Maps, la lista declarada hasta ahora omite **Resend**,
  **Vercel**, **AviationStack**, **MagicAPI/AeroDataBox** y **Boostr** (los
  tres últimos sin datos personales, pero conviene declararlos por
  completitud). **Recomendación**: declarar las secciones 1 y 2 completas; la
  sección 3 a criterio, indicando que no reciben datos personales.

## 5 · Servicios externos que NO se usan

No hay servicios de monitoreo/APM, analítica, publicidad ni mesa de ayuda
externa conectados a la plataforma. No hay SDKs de terceros en el frontend
fuera de los listados. *(Confirmado sobre el código del repositorio; cualquier
herramienta contratada fuera del repositorio debe agregarse a este inventario.)*
