"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = "Confirmar acción",
  message,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cd-title"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        background: "rgba(2,12,24,0.72)",
        backdropFilter: "blur(6px)",
        animation: "cd-bg-in .18s ease both",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <style>{`
        @keyframes cd-bg-in{from{opacity:0}to{opacity:1}}
        @keyframes cd-in{from{opacity:0;transform:scale(0.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .cd-confirm-btn{transition:all .18s;}
        .cd-confirm-btn:hover{filter:brightness(1.1);transform:translateY(-1px);}
        .cd-confirm-btn:active{transform:translateY(0);}
        .cd-cancel-btn{transition:all .18s;}
        .cd-cancel-btn:hover{background:#f1f5f9!important;border-color:#94a3b8!important;}
      `}</style>

      <div
        style={{
          background: "#fff",
          borderRadius: "20px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 0 0 1px rgba(226,232,240,0.8)",
          padding: "32px 28px 24px",
          maxWidth: "400px",
          width: "100%",
          animation: "cd-in .22s cubic-bezier(0.16,1,0.3,1) both",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top accent line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "3px",
          background: danger
            ? "linear-gradient(90deg,#ef4444,#f87171,#ef4444)"
            : "linear-gradient(90deg,#21D0B3,#34F3C6,#21D0B3)",
        }} />

        {/* Icon */}
        <div style={{
          width: "48px", height: "48px", borderRadius: "14px", marginBottom: "16px",
          background: danger ? "rgba(239,68,68,0.1)" : "rgba(33,208,179,0.1)",
          border: `1px solid ${danger ? "rgba(239,68,68,0.2)" : "rgba(33,208,179,0.2)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {danger ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>

        <h2 id="cd-title" style={{
          fontSize: "17px", fontWeight: 700, color: "#0f172a",
          margin: "0 0 8px", letterSpacing: "-0.01em",
        }}>
          {title}
        </h2>
        <p style={{
          fontSize: "14px", color: "#64748b", margin: "0 0 24px", lineHeight: 1.6,
        }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            ref={cancelRef}
            className="cd-cancel-btn"
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 20px", borderRadius: "12px",
              border: "1px solid #e2e8f0", background: "#f8fafc",
              color: "#475569", fontSize: "14px", fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            className="cd-confirm-btn"
            type="button"
            onClick={onConfirm}
            style={{
              padding: "10px 22px", borderRadius: "12px", border: "none",
              background: danger
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "linear-gradient(135deg,#21D0B3,#17a68e)",
              color: "#fff", fontSize: "14px", fontWeight: 700,
              cursor: "pointer",
              boxShadow: danger
                ? "0 4px 16px rgba(239,68,68,0.35)"
                : "0 4px 16px rgba(33,208,179,0.35)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
