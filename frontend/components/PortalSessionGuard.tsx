"use client";

import { useEffect, useRef } from "react";
import { ensurePortalSession, type PortalSessionKind } from "@/lib/portal-session";

/**
 * Vigila que este dispositivo siga siendo la sesión activa del usuario
 * (sesión única). Valida al montar, cada minuto y al volver a primer plano;
 * cada validación además "late" para mantener viva la sesión. Sólo si esta
 * sesión expiró (dejó de latir) y otro dispositivo la reclamó, dispara
 * onInvalid (el portal cierra sesión con un mensaje).
 */
export default function PortalSessionGuard({
  kind,
  userId,
  onInvalid,
}: {
  kind: PortalSessionKind;
  userId: string | null;
  onInvalid: () => void;
}) {
  const invalidatedRef = useRef(false);
  const onInvalidRef = useRef(onInvalid);
  onInvalidRef.current = onInvalid;

  useEffect(() => {
    if (!userId) return;
    invalidatedRef.current = false;
    let cancelled = false;

    const check = async () => {
      if (cancelled || invalidatedRef.current || document.visibilityState !== "visible") return;
      const ok = await ensurePortalSession(kind, userId);
      if (!ok && !cancelled && !invalidatedRef.current) {
        invalidatedRef.current = true;
        onInvalidRef.current();
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [kind, userId]);

  return null;
}
