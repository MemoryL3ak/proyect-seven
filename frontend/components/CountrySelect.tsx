"use client";
import { useState, useRef, useEffect } from "react";

const COUNTRIES = [
  { value: "AFG", label: "Afganistán" }, { value: "ALB", label: "Albania" },
  { value: "DEU", label: "Alemania" }, { value: "AND", label: "Andorra" },
  { value: "AGO", label: "Angola" }, { value: "SAU", label: "Arabia Saudita" },
  { value: "DZA", label: "Argelia" }, { value: "ARG", label: "Argentina" },
  { value: "ARM", label: "Armenia" }, { value: "AUS", label: "Australia" },
  { value: "AUT", label: "Austria" }, { value: "AZE", label: "Azerbaiyán" },
  { value: "BHS", label: "Bahamas" }, { value: "BGD", label: "Bangladés" },
  { value: "BLR", label: "Bielorrusia" }, { value: "BEL", label: "Bélgica" },
  { value: "BLZ", label: "Belice" }, { value: "BEN", label: "Benín" },
  { value: "BOL", label: "Bolivia" }, { value: "BIH", label: "Bosnia y Herzegovina" },
  { value: "BWA", label: "Botsuana" }, { value: "BRA", label: "Brasil" },
  { value: "BRN", label: "Brunéi" }, { value: "BGR", label: "Bulgaria" },
  { value: "BFA", label: "Burkina Faso" }, { value: "BDI", label: "Burundi" },
  { value: "BTN", label: "Bután" }, { value: "CPV", label: "Cabo Verde" },
  { value: "KHM", label: "Camboya" }, { value: "CMR", label: "Camerún" },
  { value: "CAN", label: "Canadá" }, { value: "QAT", label: "Catar" },
  { value: "TCD", label: "Chad" }, { value: "CHL", label: "Chile" },
  { value: "CHN", label: "China" }, { value: "CYP", label: "Chipre" },
  { value: "COL", label: "Colombia" }, { value: "COM", label: "Comoras" },
  { value: "COD", label: "Congo (RDC)" }, { value: "COG", label: "Congo" },
  { value: "PRK", label: "Corea del Norte" }, { value: "KOR", label: "Corea del Sur" },
  { value: "CIV", label: "Costa de Marfil" }, { value: "CRI", label: "Costa Rica" },
  { value: "HRV", label: "Croacia" }, { value: "CUB", label: "Cuba" },
  { value: "DNK", label: "Dinamarca" }, { value: "DJI", label: "Djibouti" },
  { value: "ECU", label: "Ecuador" }, { value: "EGY", label: "Egipto" },
  { value: "SLV", label: "El Salvador" }, { value: "ARE", label: "Emiratos Árabes Unidos" },
  { value: "ERI", label: "Eritrea" }, { value: "SVK", label: "Eslovaquia" },
  { value: "SVN", label: "Eslovenia" }, { value: "ESP", label: "España" },
  { value: "USA", label: "Estados Unidos" }, { value: "EST", label: "Estonia" },
  { value: "ETH", label: "Etiopía" }, { value: "FJI", label: "Fiyi" },
  { value: "PHL", label: "Filipinas" }, { value: "FIN", label: "Finlandia" },
  { value: "FRA", label: "Francia" }, { value: "GAB", label: "Gabón" },
  { value: "GMB", label: "Gambia" }, { value: "GEO", label: "Georgia" },
  { value: "GHA", label: "Ghana" }, { value: "GRC", label: "Grecia" },
  { value: "GTM", label: "Guatemala" }, { value: "GIN", label: "Guinea" },
  { value: "GNB", label: "Guinea-Bisáu" }, { value: "GNQ", label: "Guinea Ecuatorial" },
  { value: "GUY", label: "Guyana" }, { value: "HTI", label: "Haití" },
  { value: "HND", label: "Honduras" }, { value: "HUN", label: "Hungría" },
  { value: "IND", label: "India" }, { value: "IDN", label: "Indonesia" },
  { value: "IRQ", label: "Irak" }, { value: "IRN", label: "Irán" },
  { value: "IRL", label: "Irlanda" }, { value: "ISL", label: "Islandia" },
  { value: "ISR", label: "Israel" }, { value: "ITA", label: "Italia" },
  { value: "JAM", label: "Jamaica" }, { value: "JPN", label: "Japón" },
  { value: "JOR", label: "Jordania" }, { value: "KAZ", label: "Kazajistán" },
  { value: "KEN", label: "Kenia" }, { value: "KGZ", label: "Kirguistán" },
  { value: "KWT", label: "Kuwait" }, { value: "LAO", label: "Laos" },
  { value: "LSO", label: "Lesoto" }, { value: "LVA", label: "Letonia" },
  { value: "LBN", label: "Líbano" }, { value: "LBR", label: "Liberia" },
  { value: "LBY", label: "Libia" }, { value: "LIE", label: "Liechtenstein" },
  { value: "LTU", label: "Lituania" }, { value: "LUX", label: "Luxemburgo" },
  { value: "MKD", label: "Macedonia del Norte" }, { value: "MDG", label: "Madagascar" },
  { value: "MYS", label: "Malasia" }, { value: "MWI", label: "Malaui" },
  { value: "MDV", label: "Maldivas" }, { value: "MLI", label: "Malí" },
  { value: "MLT", label: "Malta" }, { value: "MAR", label: "Marruecos" },
  { value: "MRT", label: "Mauritania" }, { value: "MUS", label: "Mauricio" },
  { value: "MEX", label: "México" }, { value: "MDA", label: "Moldavia" },
  { value: "MCO", label: "Mónaco" }, { value: "MNG", label: "Mongolia" },
  { value: "MNE", label: "Montenegro" }, { value: "MOZ", label: "Mozambique" },
  { value: "MMR", label: "Myanmar" }, { value: "NAM", label: "Namibia" },
  { value: "NPL", label: "Nepal" }, { value: "NIC", label: "Nicaragua" },
  { value: "NER", label: "Níger" }, { value: "NGA", label: "Nigeria" },
  { value: "NOR", label: "Noruega" }, { value: "NZL", label: "Nueva Zelanda" },
  { value: "OMN", label: "Omán" }, { value: "NLD", label: "Países Bajos" },
  { value: "PAK", label: "Pakistán" }, { value: "PAN", label: "Panamá" },
  { value: "PNG", label: "Papúa Nueva Guinea" }, { value: "PRY", label: "Paraguay" },
  { value: "PER", label: "Perú" }, { value: "POL", label: "Polonia" },
  { value: "PRT", label: "Portugal" }, { value: "GBR", label: "Reino Unido" },
  { value: "CAF", label: "República Centroafricana" }, { value: "CZE", label: "República Checa" },
  { value: "DOM", label: "República Dominicana" }, { value: "RWA", label: "Ruanda" },
  { value: "ROU", label: "Rumania" }, { value: "RUS", label: "Rusia" },
  { value: "SEN", label: "Senegal" }, { value: "SRB", label: "Serbia" },
  { value: "SLE", label: "Sierra Leona" }, { value: "SOM", label: "Somalia" },
  { value: "LKA", label: "Sri Lanka" }, { value: "SWZ", label: "Suazilandia" },
  { value: "ZAF", label: "Sudáfrica" }, { value: "SDN", label: "Sudán" },
  { value: "SSD", label: "Sudán del Sur" }, { value: "SWE", label: "Suecia" },
  { value: "CHE", label: "Suiza" }, { value: "SUR", label: "Surinam" },
  { value: "THA", label: "Tailandia" }, { value: "TZA", label: "Tanzania" },
  { value: "TJK", label: "Tayikistán" }, { value: "TLS", label: "Timor Oriental" },
  { value: "TGO", label: "Togo" }, { value: "TTO", label: "Trinidad y Tobago" },
  { value: "TUN", label: "Túnez" }, { value: "TKM", label: "Turkmenistán" },
  { value: "TUR", label: "Turquía" }, { value: "UGA", label: "Uganda" },
  { value: "UKR", label: "Ucrania" }, { value: "URY", label: "Uruguay" },
  { value: "UZB", label: "Uzbekistán" }, { value: "VEN", label: "Venezuela" },
  { value: "VNM", label: "Vietnam" }, { value: "YEM", label: "Yemen" },
  { value: "ZMB", label: "Zambia" }, { value: "ZWE", label: "Zimbabue" },
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function CountrySelect({ value, onChange, placeholder = "— Seleccionar —" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find(c => c.value === value);
  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.value.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Scroll selected item into view when opening
  useEffect(() => {
    if (!open || !value || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-value="${value}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, value]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <style>{`
        @keyframes cs-in { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }
        .cs-item:hover { background: var(--elevated) !important; }
        .cs-item-active { background: rgba(33,208,179,0.1) !important; color: #21D0B3 !important; font-weight: 600 !important; }
        .cs-list::-webkit-scrollbar { width: 4px; }
        .cs-list::-webkit-scrollbar-track { background: transparent; }
        .cs-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
        .cs-trigger { transition: border-color 120ms ease, box-shadow 120ms ease; outline: none; }
        .cs-trigger:hover { border-color: var(--brand-light) !important; }
        .cs-trigger:focus { outline: none; }
      `}</style>

      {/* Trigger */}
      <button
        type="button"
        className="input cs-trigger"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: "pointer",
          color: selected ? "var(--text)" : "var(--text-faint)",
          font: "inherit",
          outline: "none",
          textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        {selected && (
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", fontFamily: "monospace", flexShrink: 0 }}>
            {selected.value}
          </span>
        )}
        <svg
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease", color: "var(--text-faint)" }}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0, right: 0,
          zIndex: 1000,
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
          overflow: "hidden",
          animation: "cs-in 0.15s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          {/* Search */}
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar país…"
                style={{
                  width: "100%",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "8px",
                  padding: "6px 10px 6px 28px",
                  fontSize: "13px",
                  background: "var(--elevated)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* List */}
          <div ref={listRef} className="cs-list" style={{ maxHeight: "220px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "14px 16px", fontSize: "13px", color: "var(--text-faint)", textAlign: "center" }}>
                Sin resultados
              </div>
            ) : filtered.map(c => (
              <button
                key={c.value}
                data-value={c.value}
                type="button"
                className={`cs-item${c.value === value ? " cs-item-active" : ""}`}
                onClick={() => { onChange(c.value); setOpen(false); }}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  color: "var(--text)",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", minWidth: "32px", fontFamily: "monospace", letterSpacing: "0.02em" }}>
                  {c.value}
                </span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
