"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-scale-in flex flex-col items-center">
      {/* Logo */}
      <div className="flex justify-center mb-10">
        <img
          src="/branding/LOGO-SEVEN.png"
          alt="Seven Arena"
          style={{
            height: 180,
            width: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 0 32px rgba(201,168,76,0.4)) drop-shadow(0 8px 24px rgba(0,0,0,0.6))"
          }}
        />
      </div>

      {/* Form */}
      <div className="w-full space-y-4">
        {/* Email */}
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            color: "rgba(255,255,255,0.3)", pointerEvents: "none"
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="m2 7 10 7 10-7"/>
            </svg>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
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
              fontWeight: 500
            }}
          />
        </div>

        {/* Password */}
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            color: "rgba(255,255,255,0.3)", pointerEvents: "none"
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
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
              fontWeight: 500
            }}
          />
        </div>

        {error && (
          <p style={{ color: "#fca5a5", fontSize: "13px", textAlign: "center" }}>{error}</p>
        )}

        {/* Login button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "17px",
            borderRadius: "14px",
            border: "none",
            background: "linear-gradient(135deg, #d4a843 0%, #c9a84c 50%, #b8933a 100%)",
            color: "#0d1b3e",
            fontSize: "16px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            letterSpacing: "0.03em",
            boxShadow: "0 4px 20px rgba(201,168,76,0.4)",
            transition: "all 150ms ease"
          }}
        >
          {loading ? "Ingresando..." : "Log In"}
        </button>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "13px", marginTop: "4px" }}>
          Forgot password?
        </p>
      </div>

      <div style={{ marginTop: "48px", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
          Don't have an account?
        </p>
        <p style={{ color: "#c9a84c", fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
          Sign Up
        </p>
      </div>
    </div>
  );
}
