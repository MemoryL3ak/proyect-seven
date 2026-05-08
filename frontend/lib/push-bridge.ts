// Web → Native helpers for the Expo push token. Pulls the token from the
// native shell via the bridge and registers it against the API so the backend
// can deliver remote pushes to this device.

import { isAvailable, request } from "@/lib/native-bridge";
import { apiFetch } from "@/lib/api";

export type PushTokenInfo = {
  token: string;
  platform: "ios" | "android";
};

export async function fetchNativePushToken(): Promise<PushTokenInfo | null> {
  if (!isAvailable()) return null;
  try {
    return await request<PushTokenInfo>("push.token", undefined, {
      timeoutMs: 8000,
    });
  } catch {
    // No permission, no projectId, or simulator — non-fatal.
    return null;
  }
}

export type RegisterDeviceTokenInput = {
  userKind: "athlete" | "driver" | "admin" | "provider_participant";
  userId: string;
  appVersion?: string;
  deviceName?: string;
};

export async function registerDeviceToken(
  info: PushTokenInfo,
  input: RegisterDeviceTokenInput,
): Promise<void> {
  await apiFetch("/push-notifications/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userKind: input.userKind,
      userId: input.userId,
      platform: info.platform,
      expoToken: info.token,
      appVersion: input.appVersion,
      deviceName: input.deviceName,
    }),
  });
}
