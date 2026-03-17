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
    <div className="w-full animate-scale-in">
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.08)"
        }}
      >
        {/* Header */}
        <div
          className="px-8 pt-8 pb-7"
          style={{
            background: "linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(255,255,255,0.02) 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.07)"
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex items-center justify-center font-black text-[16px] shrink-0"
              style={{
                width: 42, height: 42, borderRadius: "50%",
                border: "1.5px solid #c9a84c", color: "#c9a84c",
                background: "rgba(201,168,76,0.1)",
                boxShadow: "0 0 20px rgba(201,168,76,0.3)"
              }}
            >7</div>
            <div>
              <div className="flex items-baseline">
                <span className="font-black text-[17px] tracking-widest text-white">SEVEN</span>
                <span className="font-black text-[17px] tracking-widest" style={{ color: "#c9a84c" }}>ARENA</span>
              </div>
              <div className="text-[9px] tracking-[0.3em] uppercase" style={{ color: "rgba(201,168,76,0.45)" }}>
                Operations Platform
              </div>
            </div>
          </div>
          <h1 className="font-black text-white" style={{ fontSize: "1.7rem", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
            Acceso Operativo
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Ingresa tus credenciales para continuar.
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.4)" }}>Email</span>
              <input className="input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@seven.com" required />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.4)" }}>Contraseña</span>
              <input className="input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </label>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fb7185" }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary w-full py-3 mt-1" type="submit" disabled={loading}
              style={{ fontSize: "0.9rem" }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                    style={{ animation: "spin 0.7s linear infinite" }} />
                  Ingresando...
                </span>
              ) : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
