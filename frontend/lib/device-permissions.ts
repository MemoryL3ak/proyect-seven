import { isAvailable, request, send } from "./native-bridge";

export type PermissionKind = "notifications" | "location";
export type PermissionState = "granted" | "denied" | "undetermined" | "blocked";

export type PermissionsStatus = {
  notifications: PermissionState;
  location: PermissionState;
};

export function isNativeAvailable(): boolean {
  return isAvailable();
}

export async function getPermissionsStatus(): Promise<PermissionsStatus | null> {
  if (!isAvailable()) return null;
  try {
    return await request<PermissionsStatus>("permissions.status", undefined, {
      timeoutMs: 3000,
    });
  } catch {
    return null;
  }
}

export async function requestDevicePermission(
  kind: PermissionKind,
): Promise<PermissionState> {
  if (!isAvailable()) return "blocked";
  try {
    const res = await request<{ kind: PermissionKind; state: PermissionState }>(
      "permissions.request",
      { kind },
      { timeoutMs: 30_000 },
    );
    return res.state;
  } catch {
    return "denied";
  }
}

export function openDeviceSettings(): void {
  if (!isAvailable()) return;
  send("device.open-settings");
}
