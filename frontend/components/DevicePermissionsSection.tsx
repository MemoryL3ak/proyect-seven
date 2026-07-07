"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPermissionsStatus,
  isNativeAvailable,
  openDeviceSettings,
  requestDevicePermission,
  type PermissionKind,
  type PermissionState,
  type PermissionsStatus,
} from "@/lib/device-permissions";

type ItemConfig = {
  kind: PermissionKind;
  title: string;
  description: string;
  icon: string;
};

const ITEMS: ItemConfig[] = [
  {
    kind: "notifications",
    title: "Notificaciones",
    description: "Avisos de cambios en tus traslados y viajes próximos.",
    icon: "🔔",
  },
  {
    kind: "location",
    title: "Ubicación",
    description: "Rutas y traslados cercanos a tu posición actual.",
    icon: "📍",
  },
  {
    kind: "camera",
    title: "Cámara",
    description: "Tomar fotos de credenciales, documentos o evidencias.",
    icon: "📷",
  },
  {
    kind: "gallery",
    title: "Galería",
    description: "Subir fotos o documentos guardados en tu dispositivo.",
    icon: "🖼️",
  },
];

const STATE_LABEL: Record<PermissionState, string> = {
  granted: "Activado",
  denied: "Sin activar",
  undetermined: "Sin activar",
  blocked: "Bloqueado en Ajustes",
};

const STATE_COLOR: Record<PermissionState, string> = {
  granted: "#0a7a6b",
  denied: "#92400E",
  undetermined: "#475569",
  blocked: "#b91c1c",
};

const STATE_BG: Record<PermissionState, string> = {
  granted: "rgba(33,208,179,0.12)",
  denied: "#FEF3C7",
  undetermined: "#f1f5f9",
  blocked: "#FEE2E2",
};

export default function DevicePermissionsSection() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<PermissionsStatus | null>(null);
  const [busy, setBusy] = useState<PermissionKind | null>(null);

  const refresh = useCallback(async () => {
    const next = await getPermissionsStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    setAvailable(isNativeAvailable());
    void refresh();
  }, [refresh]);

  // Re-check when the tab regains visibility (user came back from Ajustes).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  if (available === false) {
    // Outside the app the bridge is unavailable; nothing useful to show.
    return null;
  }

  const handleAction = async (kind: PermissionKind) => {
    if (busy) return;
    const current = status?.[kind] ?? "undetermined";
    setBusy(kind);
    try {
      if (current === "blocked") {
        openDeviceSettings();
      } else if (current !== "granted") {
        await requestDevicePermission(kind);
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>⚙️</span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Permisos del dispositivo
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11.5,
              color: "#64748b",
            }}
          >
            Controlá qué puede hacer la app
          </p>
        </div>
      </div>
      {ITEMS.map((item, index) => {
        const state = status?.[item.kind] ?? "undetermined";
        const granted = state === "granted";
        const blocked = state === "blocked";
        const actionLabel = granted
          ? "Activado"
          : blocked
            ? "Abrir ajustes"
            : "Activar";
        return (
          <div
            key={item.kind}
            style={{
              padding: "12px 14px",
              borderTop: index > 0 ? "1px solid #f1f5f9" : "none",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11.5,
                  color: "#64748b",
                  lineHeight: 1.35,
                }}
              >
                {item.description}
              </p>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: STATE_BG[state],
                  color: STATE_COLOR[state],
                }}
              >
                {STATE_LABEL[state]}
              </span>
            </div>
            <button
              type="button"
              disabled={granted || busy === item.kind}
              onClick={() => handleAction(item.kind)}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: 9,
                border: granted ? "1px solid #cbd5e1" : "none",
                background: granted
                  ? "#f8fafc"
                  : "linear-gradient(135deg,#21D0B3,#14AE98)",
                color: granted ? "#475569" : "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: granted ? "default" : "pointer",
                opacity: busy === item.kind ? 0.6 : 1,
              }}
            >
              {busy === item.kind ? "…" : actionLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function DevicePermissionsBanner({
  kind,
  message,
}: {
  kind: PermissionKind;
  message?: string;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [state, setState] = useState<PermissionState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const status = await getPermissionsStatus();
    setState(status?.[kind] ?? null);
  }, [kind]);

  useEffect(() => {
    setAvailable(isNativeAvailable());
    void refresh();
  }, [refresh]);

  if (available === false || state === null || state === "granted") return null;

  const handleAction = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (state === "blocked") {
        openDeviceSettings();
      } else {
        await requestDevicePermission(kind);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const defaultMessage =
    kind === "location"
      ? "Activá la ubicación para ver rutas y traslados cercanos."
      : kind === "camera"
        ? "Activá la cámara para tomar fotos de credenciales y documentos."
        : kind === "gallery"
          ? "Activá la galería para subir fotos guardadas en tu dispositivo."
          : "Activá las notificaciones para no perderte cambios en tus traslados.";

  const bannerIcon =
    kind === "location"
      ? "📍"
      : kind === "camera"
        ? "📷"
        : kind === "gallery"
          ? "🖼️"
          : "🔔";

  return (
    <div
      style={{
        background: "linear-gradient(135deg,#fff7ed,#fef3c7)",
        border: "1px solid #fde68a",
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18 }}>{bannerIcon}</span>
      <p
        style={{
          flex: 1,
          margin: 0,
          fontSize: 12.5,
          color: "#78350F",
          lineHeight: 1.35,
        }}
      >
        {message ?? defaultMessage}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={handleAction}
        style={{
          flexShrink: 0,
          padding: "7px 12px",
          borderRadius: 8,
          border: "none",
          background: "#92400E",
          color: "#fff",
          fontSize: 11.5,
          fontWeight: 700,
          cursor: "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "…" : state === "blocked" ? "Abrir ajustes" : "Activar"}
      </button>
    </div>
  );
}
