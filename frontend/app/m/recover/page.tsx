"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { mobileRecover } from "@/lib/api";

export default function MobileRecoverPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isValid = /\S+@\S+\.\S+/.test(email.trim());

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Ingresa un correo válido.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await mobileRecover(email.trim());
      setSuccessMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 20px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
        <img
          src="/branding/LOGO-SEVEN-1.png"
          alt="Seven Arena"
          style={{ height: 88, width: "auto", objectFit: "contain", marginBottom: "16px" }}
        />
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
          Recordarme mi código
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.5)",
            margin: "6px 0 0",
            textAlign: "center",
            maxWidth: "300px",
          }}
        >
          Ingresa tu correo y te enviaremos tu código de acceso.
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "28px 22px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {successMessage ? (
          <>
            <div
              style={{
                background: "rgba(52,243,198,0.1)",
                border: "1px solid rgba(52,243,198,0.35)",
                borderRadius: "12px",
                padding: "16px",
                color: "#a8f5e0",
                fontSize: "14px",
                lineHeight: 1.55,
                textAlign: "center",
              }}
            >
              {successMessage}
            </div>
            <button
              type="button"
              onClick={() => router.replace("/m/login")}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "#f1f5f9",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Volver al inicio de sesión
            </button>
          </>
        ) : (
          <>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Correo electrónico
              </label>
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isValid) void handleSubmit();
                }}
                placeholder="tu@correo.com"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: `1px solid ${email ? "rgba(52,243,198,0.5)" : "rgba(255,255,255,0.12)"}`,
                  background: "rgba(255,255,255,0.08)",
                  color: "#f1f5f9",
                  fontSize: "15px",
                  outline: "none",
                  transition: "border-color 150ms",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center", margin: 0 }}>{error}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !isValid}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
                color: "#0d1b3e",
                fontSize: "16px",
                fontWeight: 700,
                cursor: loading || !isValid ? "not-allowed" : "pointer",
                opacity: loading || !isValid ? 0.5 : 1,
                letterSpacing: "0.02em",
                boxShadow: "0 4px 20px rgba(52,243,198,0.35)",
              }}
            >
              {loading ? "Enviando..." : "Enviarme mi código"}
            </button>

            <Link
              href="/m/login"
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "13.5px",
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              ← Volver al inicio de sesión
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
