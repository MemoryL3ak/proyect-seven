"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { downloadCredentialPdf, type CredentialPdfData } from "@/lib/credential-pdf";

/**
 * Página de descarga de la credencial en PDF.
 *
 * Se abre en el NAVEGADOR DEL SISTEMA desde la app nativa (puente `url.open`):
 * dentro del WebView las descargas no funcionan, así que "Guardar" del visor
 * de credencial redirige aquí, donde el PDF se regenera y se descarga de
 * verdad. Los datos vienen por query string (e=evento, n=nombre, r=rol,
 * c=código, t=país, o=organización, q=contenido del QR).
 */
function CredencialDownload() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"generando" | "listo" | "error">("generando");
  const dataRef = useRef<CredentialPdfData | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const fullName = params.get("n") || "";
        if (!fullName) {
          setStatus("error");
          return;
        }
        const qrContent = params.get("q") || "";
        const qrDataUrl = qrContent
          ? await QRCode.toDataURL(qrContent, { width: 200, margin: 1 })
          : undefined;
        const access = (params.get("a") || "").split(",").map((v) => v.trim()).filter(Boolean);
        const data: CredentialPdfData = {
          eventName: params.get("e") || "Seven Arena",
          fullName,
          roleLabel: params.get("r") || "",
          code: params.get("c") || undefined,
          countryTag: params.get("t") || undefined,
          organization: params.get("o") || undefined,
          issuedAtLabel: params.get("d") || undefined,
          providerLabel: params.get("p") || undefined,
          photoUrl: params.get("f") || undefined,
          accessTypes: access.length ? access : undefined,
          qrDataUrl,
        };
        dataRef.current = data;
        await downloadCredentialPdf(data);
        setStatus("listo");
      } catch {
        setStatus("error");
      }
    })();
  }, [params]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #041a2e 0%, #062240 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <img
          src="/branding/LOGO-SEVEN-1.png"
          alt="Seven Arena"
          style={{ height: 72, width: "auto", objectFit: "contain", marginBottom: 20 }}
        />
        {status === "generando" && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>Generando tu credencial…</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "8px 0 0" }}>
              La descarga comenzará en un instante.
            </p>
          </>
        )}
        {status === "listo" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>Credencial descargada</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "8px 0 18px", lineHeight: 1.5 }}>
              Revisa la carpeta de descargas de tu teléfono. Ya puedes cerrar esta pestaña y volver a la app.
            </p>
            <button
              type="button"
              onClick={() => {
                if (dataRef.current) void downloadCredentialPdf(dataRef.current);
              }}
              style={{
                padding: "13px 22px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 100%)",
                color: "#0d1b3e",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(52,243,198,0.35)",
              }}
            >
              Descargar de nuevo
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>No se pudo generar la credencial</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "8px 0 0", lineHeight: 1.5 }}>
              El enlace es inválido o está incompleto. Vuelve a la app e intenta nuevamente desde tu credencial.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CredencialPage() {
  return (
    <Suspense fallback={null}>
      <CredencialDownload />
    </Suspense>
  );
}
