"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mobileLogin } from "@/lib/api";
import { getMobileSession, markFromApp, setMobileSession, postToReactNative } from "@/lib/mobile-auth";

const CODE_LENGTH = 6;

export default function MobileLoginPage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = digits.join("");
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
    // Focus the first input once the form is shown
    setTimeout(() => inputsRef.current[0]?.focus(), 50);
  }, [router]);

  const setDigit = (index: number, value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 1).toLowerCase();
    setDigits((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
    if (sanitized && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && isComplete) {
      void handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/[^a-zA-Z0-9]/g, "").slice(0, CODE_LENGTH).toLowerCase();
    if (!pasted) return;
    e.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputsRef.current[focusIndex]?.focus();
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

      if (result.kind === "athlete") {
        const session = {
          kind: "athlete" as const,
          athleteId: result.athleteId,
          profile: result.profile,
        };
        setMobileSession(session);
        markFromApp();
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
      // Clear digits on error so user can re-enter
      setDigits(Array(CODE_LENGTH).fill(""));
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
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
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={1}
                value={digit}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                style={{
                  width: "44px",
                  height: "54px",
                  textAlign: "center",
                  borderRadius: "12px",
                  border: `1px solid ${digit ? "rgba(52,243,198,0.5)" : "rgba(255,255,255,0.12)"}`,
                  background: "rgba(255,255,255,0.08)",
                  color: "#f1f5f9",
                  fontSize: "22px",
                  fontWeight: 700,
                  outline: "none",
                  transition: "border-color 150ms",
                  textTransform: "lowercase",
                }}
              />
            ))}
          </div>
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
      </div>
    </div>
  );
}
