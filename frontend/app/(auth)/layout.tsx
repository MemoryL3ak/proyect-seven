export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row" style={{ background: "#060e16", height: "100vh", overflow: "hidden" }}>
      <style>{`
        body { background: #060e16 !important; }
        @keyframes slide-up-in {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes ticker-scroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes bar-fill {
          0%   { width: 0%;   opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        @keyframes count-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
        .auth-form-card {
          animation: slide-up-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.15s;
          opacity: 0;
        }
        .auth-left-content {
          animation: fade-in 0.9s ease both;
          animation-delay: 0.05s;
          opacity: 0;
        }
        .auth-left-panel {
          width: 100%;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          background: #0e1822;
          position: relative;
          overflow-y: auto;
        }
        @media (min-width: 1024px) {
          .auth-left-panel {
            width: 52% !important;
            min-width: 480px !important;
            height: 100vh;
            padding: 44px 60px !important;
            justify-content: space-between;
            overflow: hidden;
          }
        }
      `}</style>

      {/* ── Left Panel ── */}
      <div className="auth-left-panel">

        {/* Subtle noise overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`,
          backgroundSize: "150px",
        }} />

        {/* Teal left-edge accent bar */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: "4px",
          background: "linear-gradient(180deg, transparent 0%, #34F3C6 20%, #21D0B3 70%, transparent 100%)",
          zIndex: 1,
        }} />

        {/* Subtle bottom-right teal bloom */}
        <div style={{
          position: "absolute", bottom: "-80px", right: "-60px",
          width: "360px", height: "360px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(33,208,179,0.08) 0%, transparent 65%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        {/* ── Mobile: logo + tagline ── */}
        <div className="flex lg:hidden items-center gap-3 auth-left-content" style={{ position: "relative", zIndex: 1, marginBottom: "24px" }}>
          <img src="/branding/LOGO-SEVEN-1.png" alt="Seven Arena" style={{ height: 52, width: "auto", objectFit: "contain" }} />
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#34F3C6", margin: 0 }}>
              Plataforma Deportiva
            </p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9", margin: "2px 0 0" }}>
              Gestión de alto <span style={{ color: "#34F3C6" }}>rendimiento</span>
            </p>
          </div>
        </div>

        {/* ── Mobile: stats ── */}
        <div className="flex lg:hidden auth-left-content" style={{
          position: "relative", zIndex: 1,
          borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "16px", marginBottom: "4px",
        }}>
          {[
            { value: "2,400+", label: "Atletas" },
            { value: "80+",    label: "Disciplinas" },
            { value: "99.9%",  label: "Uptime" },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: 1, textAlign: "center",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <p style={{ fontSize: "18px", fontWeight: 800, color: "#34F3C6", margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Desktop: Logo block ── */}
        <div className="hidden lg:block auth-left-content" style={{ position: "relative", zIndex: 1 }}>
          <img
            src="/branding/LOGO-SEVEN-1.png"
            alt="Seven Arena"
            style={{ height: 130, width: "auto", objectFit: "contain", display: "block" }}
          />
        </div>

        {/* ── Desktop: Hero ── */}
        <div className="hidden lg:flex auth-left-content" style={{
          position: "relative", zIndex: 1,
          flex: 1, flexDirection: "column", justifyContent: "center", gap: "14px",
          paddingTop: "4px",
        }}>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "32px", height: "2px", background: "#34F3C6", borderRadius: "1px" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(52,243,198,0.7)" }}>
              Plataforma de Gestión Deportiva
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(30px, 2.8vw, 44px)", fontWeight: 800,
            lineHeight: 1.12, color: "#f1f5f9",
            letterSpacing: "-0.025em", margin: 0,
          }}>
            Gestión de alto<br />
            <span style={{
              background: "linear-gradient(90deg, #34F3C6 0%, #1FCDFF 50%, #34F3C6 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", animation: "shimmer 5s linear infinite",
            }}>rendimiento</span>{" "}deportivo
          </h1>

          <p style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.4)", maxWidth: "360px", lineHeight: 1.75, margin: 0 }}>
            Centraliza operaciones, acreditaciones, hotelería y transporte en una sola plataforma para eventos de élite.
          </p>

          {/* Live widget */}
          <div style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "14px", overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            {/* Widget header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#ef4444",
                  animation: "pulse-dot 1.4s ease-in-out infinite", display: "inline-block",
                }} />
                <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.14em" }}>EN VIVO</span>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                {["#ef4444","#f59e0b","#22c55e"].map(c => (
                  <span key={c} style={{ width: 7, height: 7, borderRadius: "50%", background: c, opacity: 0.75 }} />
                ))}
              </div>
            </div>

            {/* Ticker rows */}
            <div style={{ height: "108px", overflow: "hidden", position: "relative" }}>
              <div style={{ animation: "ticker-scroll 14s linear infinite" }}>
                {[
                  { flag: "🇨🇱", name: "C. Rodríguez", sport: "Natación",  status: "Acreditado", color: "#22c55e" },
                  { flag: "🇦🇷", name: "M. Fernández", sport: "Boxeo",     status: "Check-in",   color: "#34F3C6" },
                  { flag: "🇧🇷", name: "A. Santos",    sport: "Fútbol",    status: "Acreditado", color: "#22c55e" },
                  { flag: "🇨🇴", name: "L. García",    sport: "Ciclismo",  status: "Pendiente",  color: "#f59e0b" },
                  { flag: "🇵🇪", name: "V. Torres",    sport: "Gimnasia",  status: "Acreditado", color: "#22c55e" },
                  { flag: "🇺🇾", name: "D. López",     sport: "Pesas",     status: "Check-in",   color: "#34F3C6" },
                  { flag: "🇨🇱", name: "C. Rodríguez", sport: "Natación",  status: "Acreditado", color: "#22c55e" },
                  { flag: "🇦🇷", name: "M. Fernández", sport: "Boxeo",     status: "Check-in",   color: "#34F3C6" },
                  { flag: "🇧🇷", name: "A. Santos",    sport: "Fútbol",    status: "Acreditado", color: "#22c55e" },
                  { flag: "🇨🇴", name: "L. García",    sport: "Ciclismo",  status: "Pendiente",  color: "#f59e0b" },
                  { flag: "🇵🇪", name: "V. Torres",    sport: "Gimnasia",  status: "Acreditado", color: "#22c55e" },
                  { flag: "🇺🇾", name: "D. López",     sport: "Pesas",     status: "Check-in",   color: "#34F3C6" },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: "130px" }}>
                      <span style={{ fontSize: "13px" }}>{row.flag}</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{row.name}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", flex: 1, textAlign: "center" }}>{row.sport}</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: row.color, minWidth: "72px", textAlign: "right" }}>{row.status}</span>
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "24px", background: "linear-gradient(to bottom, rgba(14,24,34,0.9), transparent)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "24px", background: "linear-gradient(to top, rgba(14,24,34,0.9), transparent)", pointerEvents: "none" }} />
            </div>

            {/* Progress footer */}
            <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em" }}>ACREDITACIONES HOY</span>
                <span style={{ fontSize: "10px", color: "#34F3C6", fontWeight: 700 }}>847 / 1,200</span>
              </div>
              <div style={{ height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: "71%",
                  background: "linear-gradient(90deg, #21D0B3, #34F3C6)",
                  borderRadius: "2px",
                  animation: "bar-fill 8s ease-in-out infinite",
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Desktop: Bottom stats ── */}
        <div className="hidden lg:block auth-left-content" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "24px" }}>
            {[
              { value: "2,400+", label: "Atletas gestionados" },
              { value: "80+",    label: "Disciplinas deportivas" },
              { value: "99.9%",  label: "Uptime" },
            ].map((s, i) => (
              <div key={s.label} style={{
                flex: 1,
                paddingLeft:  i > 0 ? "24px" : "0",
                paddingRight: i < 2 ? "24px" : "0",
                borderRight:  i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                animation: `count-up 0.7s ease both`,
                animationDelay: `${0.3 + i * 0.12}s`,
                opacity: 0,
              }}>
                <p style={{ fontSize: "20px", fontWeight: 800, color: "#34F3C6", margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", margin: "4px 0 0", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel — Login form ── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-10"
        style={{
          background: "linear-gradient(160deg, #060e16 0%, #0d1a28 50%, #091422 100%)",
          position: "relative",
          overflow: "hidden",
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {/* Subtle teal bloom center-right */}
        <div style={{
          position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(33,208,179,0.06) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        <div className="auth-form-card relative z-10 w-full" style={{ maxWidth: "420px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
