"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAvailable, on } from "@/lib/native-bridge";
import {
  fetchNativePushToken,
  registerDeviceToken,
} from "@/lib/push-bridge";

type Props = {
  userKind: "athlete" | "driver" | "admin" | "provider_participant";
  userId: string | null | undefined;
};

/**
 * Mountable on portal pages once the user is authenticated. Two responsibilities:
 *   1) On mount (and whenever userId changes), pull the Expo push token from
 *      the native shell and register it with the backend so this user can
 *      receive remote pushes on this device.
 *   2) Listen for `push.tap` events emitted by the native shell when the user
 *      taps a notification, and route the WebView to data.url if present.
 *
 * Renders nothing. No-op outside of the WebView.
 */
export default function PushTokenSync({ userKind, userId }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!isAvailable() || !userId) return;
    let cancelled = false;
    (async () => {
      const info = await fetchNativePushToken();
      if (!info || cancelled) return;
      try {
        await registerDeviceToken(info, { userKind, userId });
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[push] register failed:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKind, userId]);

  useEffect(() => {
    if (!isAvailable()) return;
    const unsub = on("push.tap", (payload) => {
      const data = (payload as { url?: unknown } | undefined) ?? {};
      const url = typeof data.url === "string" ? data.url : null;
      if (!url) return;
      // Internal app routes only — never navigate to external URLs from a tap.
      if (url.startsWith("/")) {
        router.push(url);
      }
    });
    return unsub;
  }, [router]);

  return null;
}
