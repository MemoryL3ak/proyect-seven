"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Partner,
  clearPartner,
  getStoredPartner,
  loginPartner,
} from "@/lib/partnerAuth";

const TEAL = "#21D0B3";
const TEAL_MID = "#34F3C6";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stored, setStored] = useState<Partner | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setStored(getStoredPartner());
    setMounted(true);
  }, []);

  const submit = async () => {
    if (!code.trim() || !pin.trim()) {
      setError("Ingresá código y PIN");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await loginPartner(code.trim(), pin.trim());
      router.push("/portal/partner/scanner");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(175deg, #0d1e3a 0%, #1a2d4f 50%, #0d1e3a 100%)",
      }}>
      <style jsx global>{`
        @keyframes float-orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -30px) scale(1.1); }
        }
        @keyframes float-orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, 40px) scale(1.15); }
        }
        @keyframes float-orb-3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 30px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 24px ${TEAL}50, 0 0 0 0 ${TEAL}40; }
          50% { box-shadow: 0 12px 32px ${TEAL}70, 0 0 0 12px ${TEAL}00; }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .anim-fade-up { animation: fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-logo-float { animation: logo-float 4s ease-in-out infinite; }
        .anim-pulse-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
        .anim-orb-1 { animation: float-orb-1 12s ease-in-out infinite; }
        .anim-orb-2 { animation: float-orb-2 14s ease-in-out infinite; }
        .anim-orb-3 { animation: float-orb-3 10s ease-in-out infinite; }
        .anim-spin-slow { animation: spin-slow 30s linear infinite; }
        .shimmer-line {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Ambient orbs flotantes */}
      <div className="anim-orb-1" style={{
        position: "absolute", top: "5%", left: "10%", zIndex: 0,
        width: "500px", height: "500px",
        background: `radial-gradient(circle, ${TEAL}30 0%, transparent 65%)`,
        pointerEvents: "none", filter: "blur(40px)",
      }} />
      <div className="anim-orb-2" style={{
        position: "absolute", bottom: "-5%", right: "5%", zIndex: 0,
        width: "400px", height: "400px",
        background: "radial-gradient(circle, rgba(31,205,255,0.15) 0%, transparent 65%)",
        pointerEvents: "none", filter: "blur(40px)",
      }} />
      <div className="anim-orb-3" style={{
        position: "absolute", top: "40%", right: "20%", zIndex: 0,
        width: "300px", height: "300px",
        background: "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 65%)",
        pointerEvents: "none", filter: "blur(30px)",
      }} />

      {/* Grid pattern sutil */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "30px 30px",
        pointerEvents: "none",
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
      }} />

      <div className={`relative z-10 w-full max-w-md ${mounted ? "anim-fade-up" : "opacity-0"}`}>
        {/* Logo Seven Arena */}
        <div className="text-center mb-8">
          <div className="inline-block anim-logo-float relative">
            {/* Glow detrás del logo */}
            <div style={{
              position: "absolute", inset: "-20px", zIndex: -1,
              background: `radial-gradient(circle, ${TEAL}40 0%, transparent 70%)`,
              filter: "blur(20px)",
            }} />
            <img
              src="/branding/LOGO-SEVEN-4.png"
              alt="Seven Arena"
              style={{
                height: "72px", width: "auto",
                filter: `drop-shadow(0 0 16px ${TEAL}60) drop-shadow(0 4px 12px rgba(0,0,0,0.4))`,
              }}
            />
          </div>
          <p className="text-[11px] font-bold tracking-[0.35em] uppercase mt-3"
            style={{ color: TEAL_MID }}>
            Portal de Partners
          </p>
        </div>

        {stored ? (
          <SessionCard partner={stored}
            onContinue={() => router.push("/portal/partner/scanner")}
            onClear={() => { clearPartner(); setStored(null); }} />
        ) : (
          <div className="rounded-3xl p-7 space-y-5 relative overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(33,208,179,0.1), inset 0 1px 0 rgba(255,255,255,0.6)`,
            }}>
            {/* Borde shimmer arriba */}
            <div className="absolute top-0 left-0 right-0 h-[1px] shimmer-line" />

            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center relative anim-pulse-glow"
                style={{
                  background: `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)`,
                }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight"
                  style={{ color: "#0d1e3a" }}>Iniciar sesión</h1>
                <p className="text-[13px] mt-1" style={{ color: "#5e6b7a" }}>
                  Acceso para comercios habilitados.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="block text-[11px] font-semibold mb-1.5 tracking-wider uppercase"
                  style={{ color: "#5e6b7a" }}>
                  Código del local
                </span>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl text-lg font-mono uppercase text-center tracking-wider transition-all"
                  style={{
                    background: "#f8fafc",
                    border: "2px solid #e2e8f0",
                    outline: "none",
                  }}
                  placeholder="MCDO-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onFocus={(e) => {
                    e.target.style.borderColor = TEAL;
                    e.target.style.background = "#fff";
                    e.target.style.boxShadow = `0 0 0 4px ${TEAL}15`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#e2e8f0";
                    e.target.style.background = "#f8fafc";
                    e.target.style.boxShadow = "none";
                  }}
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="block text-[11px] font-semibold mb-1.5 tracking-wider uppercase"
                  style={{ color: "#5e6b7a" }}>
                  PIN
                </span>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl text-2xl font-mono text-center tracking-[0.5em] transition-all"
                  style={{
                    background: "#f8fafc",
                    border: "2px solid #e2e8f0",
                    outline: "none",
                  }}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = TEAL;
                    e.target.style.background = "#fff";
                    e.target.style.boxShadow = `0 0 0 4px ${TEAL}15`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#e2e8f0";
                    e.target.style.background = "#f8fafc";
                    e.target.style.boxShadow = "none";
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  maxLength={12}
                />
              </label>

              <button
                type="button"
                disabled={loading}
                onClick={submit}
                className="w-full py-3.5 rounded-xl text-base font-semibold text-white transition-all relative overflow-hidden group"
                style={{
                  background: loading
                    ? "#9ba3ad"
                    : `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)`,
                  boxShadow: loading ? "none" : `0 6px 18px ${TEAL}50`,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = `0 10px 28px ${TEAL}70`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = `0 6px 18px ${TEAL}50`;
                  }
                }}>
                <span className="relative z-10">
                  {loading ? "Verificando…" : "Iniciar sesión →"}
                </span>
                {!loading && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.5s linear infinite",
                    }} />
                )}
              </button>

              {error && (
                <div className="rounded-xl px-4 py-2.5 text-sm font-medium anim-fade-up"
                  style={{ background: "#fde2e2", color: "#7a1313", borderLeft: "3px solid #b3231b" }}>
                  {error}
                </div>
              )}
            </div>

            <p className="text-[11px] text-center pt-2 border-t"
              style={{ color: "#5e6b7a", borderColor: "#eef1f6" }}>
              ¿Sin credenciales? Contactá al comité organizador.
            </p>
          </div>
        )}

        <p className="text-center text-[10px] mt-6" style={{ color: "rgba(255,255,255,0.35)" }}>
          © Seven Arena · Juegos Panamericanos 2026
        </p>
      </div>
    </div>
  );
}

function SessionCard({
  partner, onContinue, onClear,
}: {
  partner: Partner;
  onContinue: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-3xl p-7 text-center space-y-5 relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(46,125,50,0.15)",
      }}>
      <div className="absolute top-0 left-0 right-0 h-[1px] shimmer-line" />

      <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center anim-pulse-glow"
        style={{
          background: "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)",
        }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#5e6b7a" }}>
          Sesión activa
        </p>
        <h1 className="text-xl font-bold mt-1" style={{ color: "#0d1e3a" }}>{partner.name}</h1>
        <p className="text-xs font-mono mt-1" style={{ color: "#5e6b7a" }}>{partner.code}</p>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={onContinue}
          className="w-full py-3.5 rounded-xl text-base font-semibold text-white transition-all"
          style={{
            background: `linear-gradient(135deg, ${TEAL} 0%, #1eb19a 100%)`,
            boxShadow: `0 6px 18px ${TEAL}50`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = `0 10px 28px ${TEAL}70`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = `0 6px 18px ${TEAL}50`;
          }}>
          Ir al scanner →
        </button>
        <button type="button" onClick={onClear}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: "transparent", color: "#5e6b7a" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
