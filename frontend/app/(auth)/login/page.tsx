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
    <div className="animate-scale-in">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <img
          src="/branding/LOGO-SEVEN.png"
          alt="Seven Arena"
          style={{ height: 56, width: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Card */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
        }}
      >
        {/* Header */}
        <div
          className="px-7 pt-7 pb-6"
          style={{ borderBottom: "1px solid var(--border-muted)" }}
        >
          <h1
            className="font-bold"
            style={{ fontSize: "1.3rem", letterSpacing: "-0.02em", color: "var(--text)" }}
          >
            Acceso Operativo
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Ingresa tus credenciales para continuar.
          </p>
        </div>

        {/* Form */}
        <div className="px-7 py-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1.5">
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
                Email
              </span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@seven.com"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
                Contraseña
              </span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {error && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{
                  background: "var(--danger-dim)",
                  border: "1px solid rgba(248,81,73,0.25)",
                  color: "var(--danger)"
                }}
              >
                {error}
              </div>
            )}

            <button
              className="btn btn-primary w-full mt-2"
              type="submit"
              disabled={loading}
              style={{ padding: "0.65rem 1rem", fontSize: "0.9rem" }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border-2"
                    style={{
                      borderColor: "rgba(13,17,23,0.3)",
                      borderTopColor: "#0d1117",
                      animation: "spin 0.7s linear infinite"
                    }}
                  />
                  Ingresando...
                </span>
              ) : "Ingresar"}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
        Seven Arena · The Event Platform
      </p>
    </div>
  );
}
