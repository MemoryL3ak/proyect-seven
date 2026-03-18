export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex"
      style={{
        background: "#020b1a",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
          33% { transform: translateY(-40px) translateX(20px) scale(1.05); }
          66% { transform: translateY(20px) translateX(-15px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
          50% { transform: translateY(-60px) translateX(30px) rotate(180deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
          50% { transform: translateY(-30px) scale(1.1); opacity: 0.9; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(201,168,76,0.3), 0 0 80px rgba(201,168,76,0.1); }
          50% { box-shadow: 0 0 80px rgba(201,168,76,0.6), 0 0 160px rgba(201,168,76,0.2); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        @keyframes slide-up-in {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-slow {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes particle-drift {
          0% { transform: translateY(100vh) translateX(0px); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-100px) translateX(60px); opacity: 0; }
        }
        @keyframes ring-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.08); }
        }
        @keyframes text-reveal {
          from { opacity: 0; letter-spacing: 0.3em; }
          to { opacity: 1; letter-spacing: 0.15em; }
        }
        @keyframes ticker-scroll {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes bar-fill {
          0%   { width: 0%; opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        @keyframes row-in {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes count-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .auth-form-card {
          animation: slide-up-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.2s;
          opacity: 0;
        }
        .auth-left-content {
          animation: fade-in-slow 1.2s ease both;
          animation-delay: 0.1s;
          opacity: 0;
        }
        .particle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(201,168,76,0.7);
          animation: particle-drift linear infinite;
          pointer-events: none;
        }
      `}</style>

      {/* ── Left Panel — Branding (hidden on small screens) ── */}
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: "52%",
          minWidth: "480px",
          background: "linear-gradient(160deg, #020b1a 0%, #071530 40%, #0d2255 70%, #07101f 100%)",
          position: "relative",
          overflow: "hidden",
          padding: "0 64px 60px",
        }}
      >
        {/* Grid texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

        {/* Noise texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat", backgroundSize: "200px",
        }} />

        {/* Ambient orb 1 */}
        <div style={{
          position: "absolute", top: "-80px", left: "-80px",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(30,58,138,0.5) 0%, transparent 70%)",
          animation: "float1 12s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        {/* Ambient orb 2 — gold */}
        <div style={{
          position: "absolute", bottom: "80px", right: "-60px",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(201,168,76,0.18) 0%, transparent 70%)",
          animation: "float2 16s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        {/* Ambient orb 3 — deep blue */}
        <div style={{
          position: "absolute", top: "45%", left: "40%",
          width: "300px", height: "300px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(56,100,220,0.22) 0%, transparent 70%)",
          animation: "float3 9s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        {/* Floating particles */}
        {[
          { left: "15%", delay: "0s", duration: "8s" },
          { left: "35%", delay: "2s", duration: "11s" },
          { left: "55%", delay: "5s", duration: "9s" },
          { left: "72%", delay: "1s", duration: "13s" },
          { left: "88%", delay: "7s", duration: "10s" },
          { left: "25%", delay: "4s", duration: "12s" },
          { left: "65%", delay: "9s", duration: "8s" },
        ].map((p, i) => (
          <div key={i} className="particle" style={{
            left: p.left, bottom: "-10px",
            animationDelay: p.delay,
            animationDuration: p.duration,
          }} />
        ))}

        {/* Decorative rings */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "520px", height: "520px", borderRadius: "50%",
          border: "1px solid rgba(201,168,76,0.06)",
          animation: "ring-pulse 6s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "380px", height: "380px", borderRadius: "50%",
          border: "1px solid rgba(201,168,76,0.09)",
          animation: "ring-pulse 6s ease-in-out infinite 2s",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "240px", height: "240px", borderRadius: "50%",
          border: "1px solid rgba(201,168,76,0.14)",
          animation: "ring-pulse 6s ease-in-out infinite 4s",
          pointerEvents: "none",
        }} />

        {/* Spinning ring */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          marginTop: "-280px", marginLeft: "-280px",
          width: "560px", height: "560px", borderRadius: "50%",
          border: "1px dashed rgba(201,168,76,0.07)",
          animation: "spin-slow 30s linear infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          marginTop: "-200px", marginLeft: "-200px",
          width: "400px", height: "400px", borderRadius: "50%",
          border: "1px dashed rgba(30,78,216,0.1)",
          animation: "spin-reverse 22s linear infinite",
          pointerEvents: "none",
        }} />

        {/* Left content — Logo */}
        <div className="auth-left-content" style={{ position: "relative", zIndex: 1, overflow: "hidden" }}>
          <img
            src="/branding/LOGO-SEVEN.png"
            alt="Seven Arena"
            style={{
              height: 400, width: "auto", objectFit: "contain",
              display: "block",
              marginTop: "-30px",
              marginBottom: "-60px",
              filter: "drop-shadow(0 0 40px rgba(201,168,76,0.6)) drop-shadow(0 0 80px rgba(201,168,76,0.2)) drop-shadow(0 8px 24px rgba(0,0,0,0.9))",
            }}
          />
        </div>

        {/* Center hero */}
        <div className="auth-left-content" style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "20px" }}>

          {/* Animated tag */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "fit-content" }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#22d3ee", boxShadow: "0 0 12px #22d3ee",
              animation: "pulse-ring 2s ease-in-out infinite", display: "inline-block",
            }} />
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#22d3ee" }}>
              Plataforma de Gestión Deportiva
            </span>
          </div>

          {/* Main headline */}
          <h1 style={{ fontSize: "clamp(32px, 3vw, 48px)", fontWeight: 800, lineHeight: 1.1, color: "#f8fafc", letterSpacing: "-0.02em", margin: 0 }}>
            Gestión de alto<br />
            <span style={{
              background: "linear-gradient(90deg, #c9a84c 0%, #f0d070 40%, #c9a84c 80%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", animation: "shimmer 4s linear infinite",
            }}>rendimiento</span>{" "}deportivo
          </h1>

          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "360px", lineHeight: 1.7, margin: 0 }}>
            Centraliza operaciones, acreditaciones, hotelería y transporte en una sola plataforma para eventos de élite.
          </p>

          {/* ── LIVE DASHBOARD WIDGET ── */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(201,168,76,0.18)",
            borderRadius: "18px",
            overflow: "hidden",
            backdropFilter: "blur(16px)",
            marginTop: "4px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}>
            {/* Widget header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(201,168,76,0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#ef4444", boxShadow: "0 0 8px #ef4444",
                  animation: "pulse-ring 1.5s ease-in-out infinite",
                  display: "inline-block",
                }} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", letterSpacing: "0.12em" }}>EN VIVO</span>
              </div>
              <div style={{ display: "flex", gap: "5px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", opacity: 0.7 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", opacity: 0.7 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.7 }} />
              </div>
            </div>

            {/* Ticker — duplicated rows for seamless loop */}
            <div style={{ height: "148px", overflow: "hidden", position: "relative" }}>
              <div style={{ animation: "ticker-scroll 14s linear infinite" }}>
                {[
                  { flag: "🇨🇱", name: "C. Rodríguez", sport: "🏊 Natación", status: "✅ Acreditado", color: "#22c55e" },
                  { flag: "🇦🇷", name: "M. Fernández", sport: "🥊 Boxeo", status: "🔑 Check-in", color: "#c9a84c" },
                  { flag: "🇧🇷", name: "A. Santos", sport: "⚽ Fútbol", status: "✅ Acreditado", color: "#22c55e" },
                  { flag: "🇨🇴", name: "L. García", sport: "🚴 Ciclismo", status: "⏳ Pendiente", color: "#f59e0b" },
                  { flag: "🇵🇪", name: "V. Torres", sport: "🤸 Gimnasia", status: "✅ Acreditado", color: "#22c55e" },
                  { flag: "🇺🇾", name: "D. López", sport: "🏋️ Pesas", status: "🔑 Check-in", color: "#c9a84c" },
                  // duplicate for seamless scroll
                  { flag: "🇨🇱", name: "C. Rodríguez", sport: "🏊 Natación", status: "✅ Acreditado", color: "#22c55e" },
                  { flag: "🇦🇷", name: "M. Fernández", sport: "🥊 Boxeo", status: "🔑 Check-in", color: "#c9a84c" },
                  { flag: "🇧🇷", name: "A. Santos", sport: "⚽ Fútbol", status: "✅ Acreditado", color: "#22c55e" },
                  { flag: "🇨🇴", name: "L. García", sport: "🚴 Ciclismo", status: "⏳ Pendiente", color: "#f59e0b" },
                  { flag: "🇵🇪", name: "V. Torres", sport: "🤸 Gimnasia", status: "✅ Acreditado", color: "#22c55e" },
                  { flag: "🇺🇾", name: "D. López", sport: "🏋️ Pesas", status: "🔑 Check-in", color: "#c9a84c" },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "15px" }}>{row.flag}</span>
                      <span style={{ fontSize: "12.5px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{row.name}</span>
                    </div>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{row.sport}</span>
                    <span style={{ fontSize: "11.5px", fontWeight: 600, color: row.color }}>{row.status}</span>
                  </div>
                ))}
              </div>
              {/* Fade top/bottom */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "28px", background: "linear-gradient(to bottom, rgba(7,16,31,0.8), transparent)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "28px", background: "linear-gradient(to top, rgba(7,16,31,0.8), transparent)", pointerEvents: "none" }} />
            </div>

            {/* Widget footer — animated progress bar */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>ACREDITACIONES HOY</span>
                <span style={{ fontSize: "10.5px", color: "#c9a84c", fontWeight: 700 }}>847 / 1,200</span>
              </div>
              <div style={{ height: "4px", background: "rgba(255,255,255,0.07)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: "71%",
                  background: "linear-gradient(90deg, #c9a84c, #f0d070)",
                  borderRadius: "2px",
                  boxShadow: "0 0 8px rgba(201,168,76,0.6)",
                  animation: "bar-fill 8s ease-in-out infinite",
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="auth-left-content" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: "0", borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "24px" }}>
            {[
              { value: "2,400+", label: "Atletas gestionados" },
              { value: "80+",    label: "Disciplinas deportivas" },
              { value: "99.9%",  label: "Uptime" },
            ].map((s, i) => (
              <div key={s.label} style={{
                flex: 1,
                paddingRight: i < 2 ? "24px" : "0",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                paddingLeft: i > 0 ? "24px" : "0",
                animation: `count-up 0.8s ease both`,
                animationDelay: `${0.4 + i * 0.15}s`,
                opacity: 0,
              }}>
                <p style={{ fontSize: "22px", fontWeight: 800, color: "#c9a84c", margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.32)", margin: "4px 0 0", letterSpacing: "0.05em", textTransform: "uppercase" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel — Login form ── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12"
        style={{
          background: "linear-gradient(160deg, #03111f 0%, #071530 50%, #050f20 100%)",
          position: "relative",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        {/* Background texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat", backgroundSize: "150px",
        }} />
        {/* Right glow */}
        <div style={{
          position: "absolute", top: "30%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(20,50,120,0.35) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-50px", right: "-50px",
          width: "300px", height: "300px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(201,168,76,0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Form card */}
        <div className="auth-form-card relative z-10 w-full" style={{ maxWidth: "420px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
