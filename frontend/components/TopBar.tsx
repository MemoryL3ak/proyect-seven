"use client";

import { useRouter } from "next/navigation";
import { clearTokens } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export default function TopBar() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-4 mb-7 pb-4"
      style={{ borderBottom: "1px solid var(--border-muted)" }}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] font-bold flex items-center gap-2" style={{ color: "var(--gold)" }}>
        <span className="inline-block w-3 h-[2px] rounded-full" style={{ background: "var(--gold)" }} />
        Seven Arena · Operations
      </p>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "36px", height: "36px", borderRadius: "8px",
            background: theme === "dark" ? "#0d1b3e" : "#f1f5f9",
            border: theme === "dark" ? "1px solid rgba(201,168,76,0.3)" : "1px solid #e2e8f0",
            cursor: "pointer", transition: "all 150ms ease",
            color: theme === "dark" ? "#d4a843" : "#64748b"
          }}
        >
          {theme === "dark" ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
          style={{
            background: "rgba(22,163,74,0.1)",
            border: "1px solid rgba(63,185,80,0.2)",
            color: "var(--success)"
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--success)", animation: "pulseDot 2s ease-in-out infinite" }}
          />
          En vivo
        </div>

        <button
          className="btn btn-ghost text-sm"
          style={{ color: "#475569", borderColor: "#cbd5e1" }}
          onClick={() => { clearTokens(); router.push("/login"); }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
