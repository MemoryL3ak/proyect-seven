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
    <div className="glass rounded-3xl p-8 w-full max-w-lg shadow-soft">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Seven</p>
        <h1 className="font-display text-3xl text-ink">Acceso Operativo</h1>
        <p className="text-sm text-slate-500 mt-2">
          Ingresa con tu cuenta para coordinar la logística en tiempo real.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="operador@seven.com"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          Contraseña
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <div className="mt-6 text-xs text-slate-500">
        Tip: configura `NEXT_PUBLIC_API_BASE` para apuntar al backend.
      </div>
    </div>
  );
}
