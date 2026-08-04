"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";

type Props = {
  /** Llama a la API de baja de cuenta; debe lanzar (throw) si falla. */
  onDelete: () => Promise<void>;
  /** Limpieza y salida tras la baja exitosa (cerrar sesión, redirigir). */
  onDeleted: () => void | Promise<void>;
  /** Variante compacta: sólo el botón, para headers/filas de acciones. */
  compact?: boolean;
};

/**
 * Sección "Eliminar mi cuenta" común a todos los portales: botón + diálogo de
 * confirmación + manejo de error. La llamada concreta a la API y el logout
 * posterior los aporta cada portal vía props.
 */
export default function DeleteAccountSection({ onDelete, onDeleted, compact }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setConfirming(false);
      await onDeleted();
    } catch (err) {
      setConfirming(false);
      setBusy(false);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo eliminar la cuenta. Inténtalo nuevamente.",
      );
    }
  };

  const button = (
    <button
      type="button"
      disabled={busy}
      onClick={() => { setError(null); setConfirming(true); }}
      style={{
        width: compact ? undefined : "100%",
        padding: compact ? "8px 14px" : 12,
        borderRadius: compact ? 10 : 12,
        border: "1px solid #fecaca",
        background: "#fff",
        color: "#ef4444",
        fontSize: compact ? 12 : 13,
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "Eliminando cuenta…" : "Eliminar mi cuenta"}
    </button>
  );

  const errorLine = error ? (
    <p style={{ margin: 0, fontSize: 12, color: "#ef4444", lineHeight: 1.4 }}>{error}</p>
  ) : null;

  return (
    <>
      {compact ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignSelf: "flex-start" }}>
          {button}
          {errorLine}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #fecaca", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Eliminar cuenta
          </span>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
            Al eliminar tu cuenta pierdes el acceso al portal de forma permanente
            y se cierra tu sesión en todos los dispositivos.
          </p>
          {button}
          {errorLine}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title="Eliminar mi cuenta"
        message="Tu cuenta quedará desactivada de forma permanente y no podrás volver a ingresar al portal. Esta acción no se puede deshacer; si necesitas restablecer el acceso deberás contactar a la organización."
        confirmLabel={busy ? "Eliminando…" : "Sí, eliminar"}
        cancelLabel="Cancelar"
        danger
        onConfirm={handleConfirm}
        onCancel={() => { if (!busy) setConfirming(false); }}
      />
    </>
  );
}
