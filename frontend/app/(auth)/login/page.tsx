"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeTemporaryPassword, login } from "@/lib/api";

type LoginResponse = {
  user?: Record<string, unknown>;
  requiresPasswordChange?: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = (await login(normalizedEmail, normalizedPassword)) as LoginResponse;
      const userMetadata = (result?.user?.user_metadata as Record<string, unknown> | undefined) || {};
      const mustChange = Boolean(
        result?.requiresPasswordChange ??
          userMetadata.forcePasswordChange ??
          userMetadata.force_password_change,
      );
      if (mustChange) {
        setRequiresPasswordChange(true);
        return;
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
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
      await changeTemporaryPassword(normalizedEmail, normalizedPassword, newPassword.trim());
      const relogin = (await login(normalizedEmail, newPassword.trim())) as LoginResponse;
      const reloginMetadata = (relogin?.user?.user_metadata as Record<string, unknown> | undefined) || {};
      const stillRequiresChange = Boolean(
        relogin?.requiresPasswordChange ??
          reloginMetadata.forcePasswordChange ??
          reloginMetadata.force_password_change,
      );
      if (stillRequiresChange) {
        throw new Error("No se pudo finalizar el cambio de contraseña.");
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="animate-scale-in flex flex-col items-center">
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.95)",
          marginBottom: "18px",
          alignSelf: "flex-start",
        }}
      >
        Iniciar sesión
      </h2>

      <div className="w-full space-y-4">
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="m2 7 10 7 10-7" />
            </svg>
          </span>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email o nombre de usuario"
            required
            style={{
              width: "100%",
              padding: "16px 16px 16px 48px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.92)",
              color: "#0d1b3e",
              fontSize: "15px",
              outline: "none",
              fontWeight: 500,
            }}
          />
        </div>

        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={{
              width: "100%",
              padding: "16px 44px 16px 48px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.92)",
              color: "#0d1b3e",
              fontSize: "15px",
              outline: "none",
              fontWeight: 500,
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              color: "rgba(13,27,62,0.7)",
              cursor: "pointer",
              padding: 0,
            }}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {requiresPasswordChange ? (
          <div
            style={{
              borderRadius: "14px",
              border: "1px solid rgba(201,168,76,0.35)",
              background: "rgba(201,168,76,0.08)",
              padding: "12px",
              display: "grid",
              gap: "10px",
            }}
          >
            <p style={{ color: "#f5d68a", fontSize: "13px", margin: 0 }}>
              Debes cambiar la contraseña temporal para continuar.
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.92)",
                color: "#0d1b3e",
                fontSize: "14px",
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
                padding: "13px 14px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.92)",
                color: "#0d1b3e",
                fontSize: "14px",
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
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #d4a843 0%, #c9a84c 50%, #b8933a 100%)",
                color: "#0d1b3e",
                fontSize: "14px",
                fontWeight: 700,
                cursor: savingPassword ? "not-allowed" : "pointer",
                opacity: savingPassword ? 0.7 : 1,
                letterSpacing: "0.02em",
              }}
            >
              {savingPassword ? "Actualizando..." : "Actualizar contraseña y continuar"}
            </button>
          </div>
        ) : null}

        {error && <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center" }}>{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || requiresPasswordChange}
          style={{
            width: "100%",
            padding: "17px",
            borderRadius: "14px",
            border: "none",
            background: "linear-gradient(135deg, #d4a843 0%, #c9a84c 50%, #b8933a 100%)",
            color: "#0d1b3e",
            fontSize: "16px",
            fontWeight: 700,
            cursor: loading || requiresPasswordChange ? "not-allowed" : "pointer",
            opacity: loading || requiresPasswordChange ? 0.7 : 1,
            letterSpacing: "0.03em",
            boxShadow: "0 4px 20px rgba(201,168,76,0.4)",
            transition: "all 150ms ease",
          }}
        >
          {loading ? "Ingresando..." : "Log In"}
        </button>

      </div>
    </div>
  );
}
