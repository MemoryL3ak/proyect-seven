import Link from "next/link";

export default function ScannerOperationsPage() {
  return (
    <div className="space-y-6">
      <section style={{ borderRadius: "24px", background: "#ffffff", border: "1px solid #e2e8f0", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "3px 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#21D0B3" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", display: "inline-block" }} />
              Control de acceso
            </span>
            <h1 style={{ marginTop: "10px", fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.1, color: "#0f172a" }}>Portal de escaneo QR</h1>
            <p style={{ marginTop: "6px", fontSize: "14px", color: "#64748b", maxWidth: "480px" }}>
              El escaner se abre ahora en una vista independiente, optimizada para telefono y uso operativo en acceso.
            </p>
          </div>
          <Link
            href="/scanner"
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "12px", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", fontSize: "13px", fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 10px rgba(33,208,179,0.35)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Abrir portal independiente
          </Link>
        </div>
      </section>

      <section style={{ borderRadius: "24px", background: "#ffffff", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { label: "Uso recomendado", title: "Teléfono o totem", desc: "Interfaz limpia, full screen y sin menú lateral para operación continua." },
            { label: "Lugares activos", title: "Estadio, Hotel, Gimnasio, Casino", desc: "Cada lectura queda identificada por el lugar seleccionado en pantalla." },
            { label: "Acceso directo", title: "/scanner", desc: "Puedes abrir esa ruta directamente desde el navegador del teléfono." },
          ].map((card) => (
            <div key={card.label} style={{ borderRadius: "16px", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "20px" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>{card.label}</p>
              <p style={{ marginTop: "10px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>{card.title}</p>
              <p style={{ marginTop: "6px", fontSize: "13px", lineHeight: 1.6, color: "#64748b" }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
