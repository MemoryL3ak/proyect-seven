"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";

type Coupon = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  category: string;
  discountType?: string;
  discountValue?: number | null;
  termsAndConditions?: string | null;
  partnerName?: string | null;
  partnerLogoUrl?: string | null;
  partnerAddress?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  perUserLimit?: number | null;
  imageUrl?: string | null;
};

type Claim = {
  id: string;
  couponId: string;
  uniqueCode: string;
  qrToken: string;
  status: "CLAIMED" | "REDEEMED" | "EXPIRED" | "REVOKED";
  claimedAt: string;
  expiresAt: string;
  redeemedAt?: string | null;
  redemptionLocation?: string | null;
  coupon?: Coupon;
};

const CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  COMIDA: { label: "Comida", color: "#c78c00", bg: "#fff4d6" },
  ENTRETENIMIENTO: { label: "Entretenimiento", color: "#5e3aab", bg: "#f4f0fb" },
  TIENDA: { label: "Tienda", color: "#2e7d32", bg: "#e7f5ec" },
  OTHER: { label: "Otros", color: "#5e6b7a", bg: "#eef1f6" },
};

function discountDisplay(c: Coupon) {
  switch (c.discountType) {
    case "PERCENTAGE":
      return c.discountValue ? `${c.discountValue}% OFF` : "Descuento";
    case "AMOUNT":
      return c.discountValue
        ? `$${Number(c.discountValue).toLocaleString("es-CL")}`
        : "Descuento";
    case "FREE":
      return "GRATIS";
    default:
      return c.discountValue?.toString() || "Beneficio";
  }
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "-";

const fmtFull = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }) : "-";

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function CouponsPortalPage() {
  const [athleteId, setAthleteId] = useState("");
  const [identified, setIdentified] = useState(false);
  const [athleteName, setAthleteName] = useState<string>("");
  const [athleteType, setAthleteType] = useState<string>("ATHLETE");
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [available, setAvailable] = useState<Coupon[]>([]);
  const [mine, setMine] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("seven.athleteId");
    if (stored) {
      setAthleteId(stored);
      identify(stored);
    }
  }, []);

  const identify = async (id: string) => {
    if (!id.trim()) return;
    setError(null);
    setLoading(true);
    try {
      // Buscar info del atleta
      try {
        const a: any = await apiFetch(`/participants/${id.trim()}`);
        if (a) {
          setAthleteName(a.fullName || "");
          setAthleteType(a.userType || "ATHLETE");
        }
      } catch {
        // sigue de todos modos
      }
      setIdentified(true);
      localStorage.setItem("seven.athleteId", id.trim());
      await loadAll(id.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error identificando");
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async (id: string) => {
    const [list, claims] = await Promise.all([
      apiFetch<Coupon[]>(`/coupons/for-user?userType=${encodeURIComponent(athleteType || "ATHLETE")}`),
      apiFetch<Claim[]>(`/coupons/claims/mine?userId=${encodeURIComponent(id)}`),
    ]);
    setAvailable(Array.isArray(list) ? list : []);
    setMine(Array.isArray(claims) ? claims : []);
  };

  // Filtra los disponibles que ya están claimed/redeemed por el usuario al máximo
  const visibleAvailable = useMemo(() => {
    return available.map((c) => {
      const activeClaims = mine.filter(
        (m) => m.couponId === c.id && (m.status === "CLAIMED" || m.status === "REDEEMED"),
      );
      const limit = c.perUserLimit || 1;
      return { ...c, _used: activeClaims.length, _exhausted: activeClaims.length >= limit };
    });
  }, [available, mine]);

  const claim = async (couponId: string) => {
    if (!athleteId) return;
    setClaiming(couponId);
    setError(null);
    try {
      const result = await apiFetch<Claim>(`/coupons/${couponId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: athleteId,
          userType: athleteType,
          userName: athleteName || undefined,
        }),
      });
      const coupon = available.find((c) => c.id === couponId);
      setActiveClaim({ ...result, coupon });
      await loadAll(athleteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error reclamando");
    } finally {
      setClaiming(null);
    }
  };

  // Generar QR cuando se abre un claim
  useEffect(() => {
    if (!activeClaim) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(activeClaim.qrToken, {
      width: 320,
      margin: 2,
      color: { dark: "#1f2937", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [activeClaim]);

  if (!identified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #020c18 0%, #041a2e 45%, #062240 75%, #020c18 100%)" }}>
        {/* Brand grid pattern */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(33,208,179,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.04) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Ambient orbs */}
        <div style={{
          position: "absolute", top: -120, right: -100, width: 380, height: 380, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(33,208,179,0.18) 0%, transparent 60%)", filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: -100, left: -80, width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(31,205,255,0.14) 0%, transparent 60%)", filter: "blur(40px)",
        }} />

        <div className="relative w-full max-w-sm rounded-3xl p-8 space-y-5"
          style={{
            background: "linear-gradient(160deg, rgba(15,30,55,0.92) 0%, rgba(8,20,42,0.95) 100%)",
            border: "1px solid rgba(33,208,179,0.18)",
            boxShadow: "0 30px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
          }}>
          <div className="flex flex-col items-center">
            <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena"
              style={{ height: 40, width: "auto", objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(33,208,179,0.4))" }} />
            <div className="mt-4 flex items-center gap-2"
              style={{ background: "rgba(33,208,179,0.10)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: 99, padding: "4px 12px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 10px #21D0B3" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>
                Portal de Cupones
              </span>
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#f1f5f9" }}>Mis beneficios</h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(241,245,249,0.55)" }}>
              Ingresá tu credencial para descubrir y reclamar los cupones que tenés disponibles.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="ATH-123456"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && identify(athleteId)}
              autoFocus
              style={{
                width: "100%", padding: "14px 16px", borderRadius: 14,
                background: "rgba(8,20,42,0.6)", border: "1px solid rgba(33,208,179,0.25)",
                color: "#f1f5f9", fontSize: 15, fontWeight: 600, textAlign: "center", letterSpacing: "0.03em",
                outline: "none", fontFamily: "ui-monospace, SFMono-Regular, monospace",
                textTransform: "uppercase",
              }}
            />
            <button
              type="button"
              disabled={loading || !athleteId.trim()}
              onClick={() => identify(athleteId)}
              style={{
                width: "100%", padding: 14, borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
                color: "#062240", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading || !athleteId.trim() ? 0.6 : 1,
                letterSpacing: "0.03em", boxShadow: "0 6px 20px rgba(33,208,179,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              {loading ? "Verificando…" : "Continuar"}
            </button>
            {error && (
              <p className="text-xs text-center" style={{ color: "#fca5a5" }}>{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const userInitials = (athleteName || athleteId)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <div className="min-h-screen pb-12" style={{ background: "linear-gradient(180deg, #020c18 0%, #041a2e 220px, #f8fafc 220px, #eef2f7 100%)" }}>
      {/* Header */}
      <header className="px-4 py-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #020c18 0%, #041a2e 45%, #062240 100%)" }}>
        {/* Brand grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(33,208,179,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.05) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div style={{
          position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(33,208,179,0.18) 0%, transparent 65%)", filter: "blur(30px)",
        }} />

        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 relative">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div
              className="flex-shrink-0 inline-flex items-center justify-center rounded-2xl font-extrabold"
              style={{
                width: 48, height: 48,
                background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
                color: "#062240", fontSize: 15, letterSpacing: "0.02em",
                boxShadow: "0 6px 18px rgba(33,208,179,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            >
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "rgba(33,208,179,0.14)", border: "1px solid rgba(33,208,179,0.35)",
                  borderRadius: 99, padding: "2px 9px",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 8px #21D0B3" }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3" }}>
                    {athleteType}
                  </span>
                </span>
              </div>
              <h1 className="text-lg font-extrabold leading-tight truncate mt-1" style={{ color: "#f1f5f9" }}>
                {athleteName || "Atleta"}
              </h1>
              <p className="text-[10.5px] font-mono mt-0.5" style={{ color: "rgba(241,245,249,0.4)" }}>
                {athleteId.slice(0, 8)}…
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("seven.athleteId");
              setIdentified(false);
              setAthleteId("");
              setAvailable([]);
              setMine([]);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(33,208,179,0.25)",
              borderRadius: 10, padding: "7px 12px", color: "rgba(241,245,249,0.75)",
              cursor: "pointer", transition: "all 150ms",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(33,208,179,0.14)"; (e.currentTarget as HTMLElement).style.color = "#21D0B3"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(241,245,249,0.75)"; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cambiar
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4" style={{ marginTop: -28, position: "relative", zIndex: 1 }}>
        {/* Tabs */}
        <div className="rounded-2xl p-1 flex gap-1"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.05)",
          }}>
          <button
            type="button"
            onClick={() => setTab("available")}
            className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-all inline-flex items-center justify-center gap-2"
            style={{
              background: tab === "available"
                ? "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)"
                : "transparent",
              color: tab === "available" ? "#fff" : "#64748b",
              boxShadow: tab === "available" ? "0 4px 14px rgba(33,208,179,0.32)" : "none",
              letterSpacing: "0.01em",
            }}
          >
            Disponibles
            <span className="text-[10px] rounded-full font-bold px-2 py-0.5"
              style={{
                background: tab === "available" ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                color: tab === "available" ? "#fff" : "#64748b",
              }}>
              {visibleAvailable.filter((c) => !c._exhausted).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-all inline-flex items-center justify-center gap-2"
            style={{
              background: tab === "mine"
                ? "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)"
                : "transparent",
              color: tab === "mine" ? "#fff" : "#64748b",
              boxShadow: tab === "mine" ? "0 4px 14px rgba(33,208,179,0.32)" : "none",
              letterSpacing: "0.01em",
            }}
          >
            Mis cupones
            <span className="text-[10px] rounded-full font-bold px-2 py-0.5"
              style={{
                background: tab === "mine" ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                color: tab === "mine" ? "#fff" : "#64748b",
              }}>
              {mine.filter((m) => m.status === "CLAIMED").length}
            </span>
          </button>
        </div>

        {error && (
          <div className="surface rounded-2xl p-3"
            style={{ borderLeft: "4px solid #b3231b", backgroundColor: "#fde2e2" }}>
            <p className="text-sm" style={{ color: "#7a1313" }}>{error}</p>
          </div>
        )}

        {/* Tab content */}
        {tab === "available" ? (
          visibleAvailable.length === 0 ? (
            <EmptyHint
              title="No hay cupones disponibles para vos"
              description="Volvé a chequear más tarde, vamos a estar agregando beneficios durante el evento."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleAvailable.map((c) => {
                const cat = CATEGORIES[c.category] || CATEGORIES.OTHER;
                const exhausted = c._exhausted;
                return (
                  <article
                    key={c.id}
                    className="rounded-3xl overflow-hidden bg-white"
                    style={{
                      boxShadow: exhausted
                        ? "0 1px 4px rgba(15,23,42,0.06)"
                        : "0 4px 16px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)",
                      opacity: exhausted ? 0.6 : 1,
                      transition: "transform 200ms ease, box-shadow 200ms ease",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                    onMouseEnter={(e) => {
                      if (!exhausted) {
                        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 28px rgba(15,23,42,0.14), 0 2px 6px rgba(15,23,42,0.08)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.06)";
                    }}
                  >
                    {/* Hero image */}
                    <div
                      className="relative w-full overflow-hidden"
                      style={{ aspectRatio: "16/9", background: `linear-gradient(135deg, ${cat.color}30 0%, ${cat.color}60 100%)` }}
                    >
                      {c.imageUrl && (
                        <img
                          src={c.imageUrl}
                          alt={c.title}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ transition: "transform 400ms ease" }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      {/* Bottom gradient for legibility */}
                      <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(to top, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.2) 35%, transparent 60%)" }} />

                      {/* Category chip (top-left, glass effect) */}
                      <span
                        className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full font-bold uppercase tracking-wider"
                        style={{
                          background: "rgba(255,255,255,0.92)",
                          color: cat.color,
                          backdropFilter: "blur(6px)",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: cat.color }} />
                        {cat.label}
                      </span>

                      {/* Discount badge (top-right) */}
                      <div
                        className="absolute top-3 right-3 rounded-2xl font-extrabold"
                        style={{
                          background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}d0 100%)`,
                          color: "#fff",
                          padding: "8px 14px",
                          fontSize: 17,
                          letterSpacing: "0.01em",
                          boxShadow: `0 6px 18px ${cat.color}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
                          textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                        }}
                      >
                        {discountDisplay(c)}
                      </div>

                      {/* Partner row (bottom-left, on overlay) */}
                      {c.partnerName && (
                        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                          {c.partnerLogoUrl ? (
                            <img
                              src={c.partnerLogoUrl}
                              alt={c.partnerName}
                              loading="lazy"
                              className="flex-shrink-0 rounded-full bg-white object-contain"
                              style={{
                                width: 32, height: 32,
                                padding: 3,
                                border: "2px solid rgba(255,255,255,0.95)",
                                boxShadow: "0 3px 8px rgba(0,0,0,0.22)",
                              }}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div
                              className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
                              style={{
                                width: 32, height: 32,
                                background: "#fff", color: cat.color, fontSize: 11,
                                border: "2px solid rgba(255,255,255,0.95)",
                                boxShadow: "0 3px 8px rgba(0,0,0,0.22)",
                              }}
                            >
                              {c.partnerName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span
                            className="font-bold text-sm truncate"
                            style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.55)" }}
                          >
                            {c.partnerName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-2.5">
                      <p className="font-bold text-[15px] leading-tight" style={{ color: "#0f172a" }}>{c.title}</p>
                      {c.description && (
                        <p className="text-xs leading-relaxed line-clamp-2"
                          style={{ color: "var(--text-muted)" }}>
                          {c.description}
                        </p>
                      )}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 pt-1">
                        {c.validUntil && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium"
                            style={{ color: "var(--text-muted)" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Vigente hasta {fmt(c.validUntil)}
                          </span>
                        )}
                        {c.partnerAddress && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium truncate"
                            style={{ color: "var(--text-muted)", maxWidth: 200 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                            </svg>
                            {c.partnerAddress}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      type="button"
                      disabled={exhausted || claiming === c.id}
                      onClick={() => claim(c.id)}
                      className="w-full py-3.5 text-sm font-bold text-white transition-all inline-flex items-center justify-center gap-2"
                      style={{
                        background: exhausted
                          ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)"
                          : `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}dd 100%)`,
                        cursor: exhausted ? "not-allowed" : "pointer",
                        letterSpacing: "0.02em",
                        boxShadow: exhausted ? "none" : `inset 0 1px 0 rgba(255,255,255,0.2)`,
                      }}
                    >
                      {exhausted ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Ya lo reclamaste
                        </>
                      ) : claiming === c.id ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Reclamando…
                        </>
                      ) : (
                        <>
                          Reclamar cupón
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                          </svg>
                        </>
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          )
        ) : mine.length === 0 ? (
          <EmptyHint
            title="Todavía no reclamaste ningún cupón"
            description="Andá a la pestaña Disponibles y reclamá los que quieras."
          />
        ) : (
          <div className="space-y-3">
            {mine.map((c) => {
              const coupon = c.coupon;
              const cat = coupon ? CATEGORIES[coupon.category] || CATEGORIES.OTHER : CATEGORIES.OTHER;
              const statusMeta = STATUS_META[c.status];
              return (
                <article key={c.id} className="surface rounded-2xl overflow-hidden"
                  style={{ borderLeft: `5px solid ${cat.color}` }}>
                  <button type="button" className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                    onClick={() => c.status === "CLAIMED" && setActiveClaim(c)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}>
                            {statusMeta.label}
                          </span>
                          {coupon?.partnerName && (
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {coupon.partnerName}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-sm leading-tight">
                          {coupon?.title || "Cupón"}
                        </p>
                        <p className="font-mono text-xs mt-1 tracking-wide"
                          style={{ color: "var(--text-muted)" }}>
                          {c.uniqueCode}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold" style={{ color: cat.color }}>
                          {coupon ? discountDisplay(coupon) : "—"}
                        </p>
                        {c.status === "CLAIMED" && (
                          <p className="text-[11px] font-medium" style={{ color: "#c78c00" }}>
                            Expira en {timeLeft(c.expiresAt)}
                          </p>
                        )}
                        {c.status === "REDEEMED" && c.redeemedAt && (
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Canjeado {fmt(c.redeemedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    {c.status === "CLAIMED" && (
                      <p className="text-[11px] mt-2 font-medium" style={{ color: "#1f4e8c" }}>
                        Tocá para mostrar el QR
                      </p>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal QR */}
      {activeClaim && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
          onClick={() => setActiveClaim(null)}>
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-xl w-full md:max-w-md max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 flex items-start justify-between border-b">
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Tu cupón
                </p>
                <h2 className="text-lg font-bold leading-tight">
                  {activeClaim.coupon?.title}
                </h2>
                {activeClaim.coupon?.partnerName && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {activeClaim.coupon.partnerName}
                  </p>
                )}
              </div>
              <button type="button" className="text-2xl leading-none"
                onClick={() => setActiveClaim(null)}>×</button>
            </div>

            <div className="p-5 space-y-4">
              {/* QR */}
              <div className="flex justify-center">
                {qrDataUrl ? (
                  <div className="p-4 bg-white rounded-2xl"
                    style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                    <img src={qrDataUrl} alt="QR del cupón"
                      className="w-64 h-64" />
                  </div>
                ) : (
                  <div className="w-72 h-72 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <span className="text-sm text-gray-400">Generando QR…</span>
                  </div>
                )}
              </div>

              {/* Código manual */}
              <div className="text-center space-y-1">
                <p className="text-xs uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>
                  Código de respaldo
                </p>
                <p className="text-2xl font-mono font-bold tracking-wider"
                  style={{ color: "#1f4e8c" }}>
                  {activeClaim.uniqueCode}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Si el QR no escanea, dictá este código al comercio.
                </p>
              </div>

              {/* Instrucciones */}
              <div className="rounded-xl p-3"
                style={{ background: "linear-gradient(135deg, #fff8e1 0%, #fff4d6 100%)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#c78c00" }}>
                  Cómo canjearlo
                </p>
                <ol className="text-xs space-y-1 list-decimal list-inside"
                  style={{ color: "#7a5800" }}>
                  <li>Andá al local del comercio.</li>
                  <li>Mostrá esta pantalla con el QR.</li>
                  <li>El comercio lo escaneará y aplicará el descuento.</li>
                </ol>
              </div>

              {/* Detalles */}
              <div className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
                <p>📅 Reclamado el {fmtFull(activeClaim.claimedAt)}</p>
                <p>⏱️ Expira el {fmtFull(activeClaim.expiresAt)} <strong>
                  ({timeLeft(activeClaim.expiresAt)} restantes)
                </strong></p>
                {activeClaim.coupon?.partnerAddress && (
                  <p>📍 {activeClaim.coupon.partnerAddress}</p>
                )}
              </div>

              {activeClaim.coupon?.termsAndConditions && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium"
                    style={{ color: "var(--text-muted)" }}>
                    Términos y condiciones
                  </summary>
                  <p className="mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {activeClaim.coupon.termsAndConditions}
                  </p>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  CLAIMED: { label: "Activo", color: "#1f4e8c", bg: "#e3edfa" },
  REDEEMED: { label: "Canjeado", color: "#2e7d32", bg: "#e7f5ec" },
  EXPIRED: { label: "Expirado", color: "#b3231b", bg: "#fde2e2" },
  REVOKED: { label: "Anulado", color: "#5e6b7a", bg: "#eef1f6" },
};

function EmptyHint({ title, description }: { title: string; description: string }) {
  return (
    <div className="surface rounded-2xl p-8 text-center">
      <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: "#eef1f6" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5e6b7a"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v2a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
        </svg>
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{description}</p>
    </div>
  );
}
