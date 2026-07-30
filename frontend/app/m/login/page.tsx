"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { mobileLogin } from "@/lib/api";
import { getMobileSession, markFromApp, setMobileSession, postToReactNative } from "@/lib/mobile-auth";
import { claimPortalSession } from "@/lib/portal-session";
import { clearPersistedTabs } from "@/lib/portal-tab";

const CODE_LENGTH = 6;

export default function MobileLoginPage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);
  // Un solo input (invisible) maneja todo el código y las casillas son sólo
  // visuales. Con 6 inputs, cada salto de foco reabría el teclado del sistema
  // en su layout por defecto y descartaba el cambio manual a numérico; con un
  // único campo el teclado no se cierra nunca y la capa elegida persiste.
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = code.length === CODE_LENGTH;

  // Auto-redirect on mount if a session is already present (persistencia móvil).
  useEffect(() => {
    const session = getMobileSession();
    if (session?.kind === "athlete") {
      markFromApp();
      router.replace("/portal/user");
      return;
    }
    if (session?.kind === "driver") {
      markFromApp();
      router.replace("/portal/conductor");
      return;
    }
    setRedirecting(false);
    // Focus the input once the form is shown
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [router]);

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/[^a-zA-Z0-9]/g, "").slice(0, CODE_LENGTH).toLowerCase());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isComplete) {
      void handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      setError(`Ingresa los ${CODE_LENGTH} caracteres del código.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await mobileLogin(code);
      // Login explícito: el portal debe abrir en su home, no en el último tab.
      clearPersistedTabs();

      if (result.kind === "athlete") {
        const session = {
          kind: "athlete" as const,
          athleteId: result.athleteId,
          profile: result.profile,
        };
        setMobileSession(session);
        markFromApp();
        // Sesión única: este dispositivo pasa a ser la sesión activa.
        void claimPortalSession("athlete", result.athleteId);
        postToReactNative({
          kind: "athlete",
          role: "ATHLETE",
          athleteId: result.athleteId,
          profile: result.profile,
        });
        router.replace("/portal/user");
        return;
      }

      if (result.kind === "driver") {
        const session = {
          kind: "driver" as const,
          driverId: result.driverId,
          profile: result.profile,
        };
        setMobileSession(session);
        markFromApp();
        // Sesión única: este dispositivo pasa a ser la sesión activa.
        void claimPortalSession("driver", result.driverId);
        postToReactNative({
          kind: "driver",
          role: "DRIVER",
          driverId: result.driverId,
          profile: result.profile,
        });
        router.replace("/portal/conductor");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
      // Clear the code on error so user can re-enter
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(52,243,198,0.25)",
            borderTopColor: "#34F3C6",
            animation: "ml-spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes ml-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

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
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Iniciar sesión</h1>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", margin: "6px 0 0", textAlign: "center" }}>
          Ingresa el código de acceso que recibiste por correo.
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
              textAlign: "center",
            }}
          >
            Código de acceso
          </label>
          {/* Un solo input real (invisible) sobre las casillas visuales: el foco
              nunca salta, así el teclado del sistema no se reabre y la capa
              (numérica o texto) que eligió el usuario persiste de forma nativa. */}
          <div
            style={{ position: "relative" }}
            onClick={() => inputRef.current?.focus()}
          >
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }} aria-hidden>
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const char = code[i] || "";
                const isActive = focused && i === Math.min(code.length, CODE_LENGTH - 1) && !isComplete;
                const isCursor = focused && i === code.length;
                return (
                  <div
                    key={i}
                    style={{
                      width: "44px",
                      height: "54px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "12px",
                      border: `1px solid ${
                        isCursor || isActive
                          ? "rgba(52,243,198,0.8)"
                          : char
                          ? "rgba(52,243,198,0.5)"
                          : "rgba(255,255,255,0.12)"
                      }`,
                      boxShadow: isCursor || isActive ? "0 0 0 3px rgba(52,243,198,0.15)" : "none",
                      background: "rgba(255,255,255,0.08)",
                      color: "#f1f5f9",
                      fontSize: "22px",
                      fontWeight: 700,
                      transition: "border-color 150ms, box-shadow 150ms",
                    }}
                  >
                    {char || (isCursor ? (
                      <span
                        style={{
                          width: 2,
                          height: 24,
                          background: "#34F3C6",
                          borderRadius: 1,
                          animation: "ml-caret 1.1s step-end infinite",
                        }}
                      />
                    ) : "")}
                  </div>
                );
              })}
            </div>
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                setFocused(true);
                // Mantener el caret al final: el código se edita como flujo.
                const len = e.currentTarget.value.length;
                e.currentTarget.setSelectionRange(len, len);
              }}
              onBlur={() => setFocused(false)}
              onSelect={(e) => {
                const len = e.currentTarget.value.length;
                if (e.currentTarget.selectionStart !== len) {
                  e.currentTarget.setSelectionRange(len, len);
                }
              }}
              aria-label="Código de acceso"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0.01,
                border: "none",
                background: "transparent",
                color: "transparent",
                caretColor: "transparent",
                // 16px evita el auto-zoom de iOS al enfocar.
                fontSize: "16px",
                textAlign: "center",
                outline: "none",
              }}
            />
          </div>
          <style>{`@keyframes ml-caret{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
        </div>

        {error && (
          <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center", margin: 0 }}>{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !isComplete}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
            color: "#0d1b3e",
            fontSize: "16px",
            fontWeight: 700,
            cursor: loading || !isComplete ? "not-allowed" : "pointer",
            opacity: loading || !isComplete ? 0.5 : 1,
            letterSpacing: "0.02em",
            boxShadow: "0 4px 20px rgba(52,243,198,0.35)",
          }}
        >
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>

        <Link
          href="/m/recover"
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "13.5px",
            textAlign: "center",
            textDecoration: "none",
            marginTop: "-4px",
          }}
        >
          <span style={{ color: "#34F3C6", fontWeight: 600 }}>Recordarme mi código</span>
        </Link>
      </div>
    </div>
  );
}
