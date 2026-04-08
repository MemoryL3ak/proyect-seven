"use client";

export interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

export default function DonutChart({
  segments,
  size = 120,
  thickness = 18,
  label,
  sublabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, item) => s + item.value, 0);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const arc = {
      ...seg,
      pct,
      strokeDasharray: `${dash} ${gap}`,
      strokeDashoffset: -(offset * circumference),
    };
    offset += pct;
    return arc;
  });

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.08))" }}
        >
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={arc.strokeDasharray}
              strokeDashoffset={arc.strokeDashoffset}
              style={{
                transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1), stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)",
                filter: `drop-shadow(0 0 4px ${arc.color}55)`,
              }}
            />
          ))}
        </svg>
        {(label !== undefined) && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: size * 0.2, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.02em" }}>{label}</span>
            {sublabel && <span style={{ fontSize: size * 0.1, color: "#94a3b8", marginTop: "3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{sublabel}</span>}
          </div>
        )}
      </div>
      {segments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
          {arcs.map((seg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                {seg.label}
                <span style={{ fontWeight: 700, color: "#0f172a", marginLeft: 4 }}>{Math.round(seg.pct * 100)}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
