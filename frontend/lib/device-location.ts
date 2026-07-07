import { isAvailable, request } from "./native-bridge";

export type DeviceLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  ts: number;
};

export class LocationPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationPermissionError";
  }
}

export async function getDeviceLocation(): Promise<DeviceLocation> {
  if (!isAvailable()) {
    throw new LocationPermissionError(
      "La ubicación solo está disponible desde la app móvil.",
    );
  }
  try {
    return await request<DeviceLocation>("location.current", undefined, {
      timeoutMs: 10_000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de ubicación";
    if (
      message.includes("Permiso de ubicación") ||
      message.includes("PERMISSION_")
    ) {
      throw new LocationPermissionError(message);
    }
    throw err;
  }
}
