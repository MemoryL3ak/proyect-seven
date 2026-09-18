"use client";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";

/**
 * QR a pantalla completa DENTRO del portal, con botón "← Volver" siempre
 * visible (mismo patrón que PdfViewerOverlay: en la app nativa la página
 * nunca debe navegar). Se abre al pinchar el QR de alimentación para que
 * el validador del comedor pueda escanearlo fácil.
 */
export default function QrFullscreenOverlay({
  qrDataUrl,
  code,
  title,
  subtitle,
  onClose,
}: {
  qrDataUrl: string;
  code?: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: `linear-gradient(160deg, ${BRAND.navy} 0%, ${BRAND.navyLight} 100%)`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(52,243,198,0.4)",
            background: "rgba(33,208,179,0.15)",
            color: BRAND.tealLight,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ArrowLeftIcon size={15} strokeWidth={2.5} />
          Volver
        </button>
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: SURFACE.card,
            margin: 0,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </p>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          gap: 18,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: SURFACE.card,
            borderRadius: 20,
            padding: 18,
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}
        >
          <img
            src={qrDataUrl}
            alt="Código QR"
            style={{
              width: "min(78vw, 340px)",
              height: "min(78vw, 340px)",
              display: "block",
            }}
          />
        </div>
        {code && (
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.3em",
              color: BRAND.tealLight,
              margin: 0,
            }}
          >
            {code.toUpperCase()}
          </p>
        )}
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              margin: 0,
              textAlign: "center",
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
