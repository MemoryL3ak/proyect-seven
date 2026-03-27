# Seven Mobile

App móvil para iOS y Android con los 3 portales de la plataforma Seven.

## Portales incluidos

| Portal | Descripción |
|---|---|
| **Portal de Usuario** | Atletas consultan su itinerario (vuelo, hotel, transporte) y marcan check-ins |
| **Portal Conductor** | Conductores ven viajes asignados, reportan etapas y envían posición GPS cada 5 seg |
| **Solicitud de Vehículo** | Participantes piden traslados, siguen el estado y ven la posición del vehículo en vivo |

---

## Requisitos

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`

---

## Setup inicial

```bash
cd mobile

# 1. Instalar dependencias
npm install

# 2. Configurar URL del backend
cp .env.example .env
# Edita .env y pon la URL de tu API:
# EXPO_PUBLIC_API_URL=https://tu-api-url.com

# 3. Iniciar en modo desarrollo
npm start
```

Escanea el QR con la app **Expo Go** (iOS/Android) para probar en tu teléfono real.

---

## Publicar en App Store y Google Play

### 1. Configurar EAS

```bash
# Login en tu cuenta Expo
eas login

# Vincular proyecto (crea el projectId)
eas init

# Actualiza app.json con el projectId generado
```

### 2. Configurar app.json

Reemplaza los valores en `app.json`:
- `ios.bundleIdentifier` → ej: `com.tuempresa.seven`
- `android.package` → ej: `com.tuempresa.seven`
- `extra.eas.projectId` → el ID que te dio `eas init`

### 3. Configurar eas.json para publicación

En `eas.json`, sección `submit.production`:
- **iOS**: pon tu `appleId`, `ascAppId` (App Store Connect) y `appleTeamId`
- **Android**: sube el archivo `google-service-account.json` (se crea en Google Play Console)

### 4. Build de producción

```bash
# Construir para iOS (requiere cuenta Apple Developer - $99/año)
npm run build:ios

# Construir para Android
npm run build:android

# Ambas plataformas a la vez
npm run build:all
```

Los builds se hacen en la nube de Expo (EAS Build). No necesitas Mac para iOS.

### 5. Enviar a las tiendas

```bash
# Enviar a App Store (TestFlight primero)
npm run submit:ios

# Enviar a Google Play
npm run submit:android
```

---

## Estructura del proyecto

```
mobile/
├── app/
│   ├── _layout.tsx      # Navegación raíz
│   ├── index.tsx        # Pantalla home (selector de portal)
│   ├── usuario.tsx      # Portal de Usuario
│   ├── conductor.tsx    # Portal Conductor (incluye GPS)
│   └── vehiculo.tsx     # Solicitud de Vehículo
├── lib/
│   ├── api.ts           # Cliente HTTP (usa EXPO_PUBLIC_API_URL)
│   └── types.ts         # Tipos compartidos y helpers
├── app.json             # Config de la app (nombre, íconos, permisos)
├── eas.json             # Config de EAS Build y Submit
└── .env                 # Variables de entorno (no commitear)
```

---

## Agregar íconos

Reemplaza los archivos en `assets/`:
- `icon.png` — 1024×1024 px (ícono de la app)
- `splash.png` — 1242×2436 px (pantalla de carga)
- `adaptive-icon.png` — 1024×1024 px (Android adaptive icon)

---

## Notas técnicas

- **GPS (Portal Conductor)**: usa `expo-location` con permiso en primer plano. Envía posición al endpoint `/vehicle-positions` cada 5 segundos mientras el viaje está en estado `EN_ROUTE` o `PICKED_UP`.
- **Posición en tiempo real (Portal Vehículo)**: hace polling a `/vehicle-positions` cada 10 segundos y muestra coordenadas con botón para abrir Google Maps.
- **Autenticación**: código de 6 dígitos (últimas 6 cifras del ID). Sin JWT por diseño del backend.
