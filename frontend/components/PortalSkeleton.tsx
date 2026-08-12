"use client";

/**
 * Pantalla de carga de los portales.
 *
 * En vez de un spinner sobre un fondo vacío, dibuja la silueta real del portal
 * (banner, tarjeta de perfil, tarjetas de contenido y barra inferior) con un
 * brillo que recorre los bloques. Así la recarga se percibe como que el
 * contenido está apareciendo y no como que la aplicación se reinició.
 */
export default function PortalSkeleton({
  tabs = 5,
  cards = 4,
}: {
  /** Cuántos accesos dibujar en la barra inferior. */
  tabs?: number;
  /** Cuántas tarjetas dibujar en la grilla de contenido. */
  cards?: number;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#eef1f8", display: "flex", flexDirection: "column" }} aria-busy="true" aria-live="polite">
      <style>{`
        @keyframes ps-shimmer{100%{transform:translateX(100%)}}
        @keyframes ps-fade{from{opacity:0}to{opacity:1}}
        .ps-root{animation:ps-fade .25s ease both}
        .ps-b{position:relative;overflow:hidden;background:#dfe4ee;border-radius:8px}
        .ps-b::after{
          content:'';position:absolute;inset:0;transform:translateX(-100%);
          background:linear-gradient(90deg,transparent,rgba(255,255,255,0.75),transparent);
          animation:ps-shimmer 1.5s infinite;
        }
        .ps-card{background:#fff;border:1px solid rgba(226,232,240,0.8);border-radius:24px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,0.05)}
        .ps-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
        @media(max-width:640px){
          .ps-card{padding:14px;border-radius:16px}
          .ps-grid{grid-template-columns:1fr 1fr;gap:8px}
        }
        /* Sin animación para quien la tenga desactivada en su sistema. */
        @media(prefers-reduced-motion:reduce){
          .ps-b::after{animation:none}
          .ps-root{animation:none}
        }
      `}</style>

      <div className="ps-root" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Banner superior */}
        <div style={{ background: "#062240", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="ps-b" style={{ width: 108, height: 26, background: "rgba(255,255,255,0.12)" }} />
          <div className="ps-b" style={{ width: 64, height: 12, background: "rgba(255,255,255,0.12)" }} />
        </div>

        <div style={{ flex: 1, width: "100%", maxWidth: 920, margin: "0 auto", padding: "16px 12px 24px" }}>
          {/* Tarjeta de perfil */}
          <div className="ps-card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 16 }}>
            <div className="ps-b" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ps-b" style={{ width: "62%", height: 16, marginBottom: 9 }} />
              <div className="ps-b" style={{ width: "40%", height: 11 }} />
            </div>
          </div>

          {/* Grilla de tarjetas */}
          <div className="ps-grid" style={{ marginBottom: 14 }}>
            {Array.from({ length: cards }).map((_, i) => (
              <div key={i} className="ps-card">
                <div className="ps-b" style={{ width: 60, height: 9, marginBottom: 12 }} />
                <div className="ps-b" style={{ width: "82%", height: 14, marginBottom: 8 }} />
                <div className="ps-b" style={{ width: "55%", height: 11 }} />
              </div>
            ))}
          </div>

          {/* Tarjeta ancha inferior */}
          <div className="ps-card">
            <div className="ps-b" style={{ width: 90, height: 9, marginBottom: 14 }} />
            <div className="ps-b" style={{ width: "100%", height: 11, marginBottom: 9 }} />
            <div className="ps-b" style={{ width: "72%", height: 11 }} />
          </div>
        </div>

        {/* Barra inferior */}
        <div style={{ background: "#062240", padding: "10px 12px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {Array.from({ length: tabs }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div className="ps-b" style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(255,255,255,0.12)" }} />
              <div className="ps-b" style={{ width: 30, height: 7, background: "rgba(255,255,255,0.12)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
