"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changeTemporaryPassword, mobileLogin } from "@/lib/api";
import { getMobileSession, markFromApp, setMobileSession, postToReactNative } from "@/lib/mobile-auth";

export default function MobileLoginPage() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(true);
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSecret = secret.trim();

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
    // Admin token persisted (cookie + localStorage) → main app
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("seven.auth");
      if (token) {
        markFromApp();
        router.replace("/");
        return;
      }
    }
    setRedirecting(false);
  }, [router]);

  const handleSubmit = async () => {
    if (!normalizedEmail || !normalizedSecret) {
      setError("Ingresa tu correo y tu contraseña o código.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await mobileLogin(normalizedEmail, normalizedSecret);

      if (result.kind === "admin") {
        if (result.requiresPasswordChange) {
          setRequiresPasswordChange(true);
          return;
        }
        markFromApp();
        postToReactNative({ kind: "admin", role: "ADMIN", user: result.user });
        router.replace("/");
        return;
      }

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
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.trim().length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("La confirmación de contraseña no coincide.");
      return;
    }
    setError(null);
    setSavingPassword(true);
    try {
      await changeTemporaryPassword(normalizedEmail, normalizedSecret, newPassword.trim());
      const relogin = await mobileLogin(normalizedEmail, newPassword.trim());
      if (relogin.kind === "admin" && relogin.requiresPasswordChange) {
        throw new Error("No se pudo finalizar el cambio de contraseña.");
      }
      markFromApp();
      postToReactNative({ kind: "admin", role: "ADMIN" });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña.");
    } finally {
      setSavingPassword(false);
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
          Ingresa con tu correo y contraseña, o con el código que te enviamos.
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "24px 22px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
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
              marginBottom: "7px",
            }}
          >
            Correo electrónico
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="tu@correo.com"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.08)",
              color: "#f1f5f9",
              fontSize: "15px",
              outline: "none",
              fontWeight: 500,
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "11.5px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "7px",
            }}
          >
            Contraseña o código
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showSecret ? "text" : "password"}
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "14px 44px 14px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.08)",
                color: "#f1f5f9",
                fontSize: "15px",
                outline: "none",
                fontWeight: 500,
              }}
            />
            <button
              type="button"
              onClick={() => setShowSecret((prev) => !prev)}
              aria-label={showSecret ? "Ocultar" : "Mostrar"}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.45)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 8px",
              }}
            >
              {showSecret ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        {requiresPasswordChange && (
          <div
            style={{
              borderRadius: "12px",
              border: "1px solid rgba(52,243,198,0.3)",
              background: "rgba(52,243,198,0.06)",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <p style={{ color: "#34F3C6", fontSize: "12.5px", margin: 0 }}>
              Debes cambiar la contraseña temporal para continuar.
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.08)",
                color: "#f1f5f9",
                fontSize: "15px",
                outline: "none",
                fontWeight: 500,
              }}
            />
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.08)",
                color: "#f1f5f9",
                fontSize: "15px",
                outline: "none",
                fontWeight: 500,
              }}
            />
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
                color: "#0d1b3e",
                fontSize: "14px",
                fontWeight: 700,
                cursor: savingPassword ? "not-allowed" : "pointer",
                opacity: savingPassword ? 0.7 : 1,
              }}
            >
              {savingPassword ? "Actualizando..." : "Actualizar contraseña y continuar"}
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center", margin: 0 }}>{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || requiresPasswordChange}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
            color: "#0d1b3e",
            fontSize: "16px",
            fontWeight: 700,
            cursor: loading || requiresPasswordChange ? "not-allowed" : "pointer",
            opacity: loading || requiresPasswordChange ? 0.7 : 1,
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
