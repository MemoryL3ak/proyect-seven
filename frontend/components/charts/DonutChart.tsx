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
      strokeDasharray: `${dash} ${gap}`,
      strokeDashoffset: -(offset * circumference),
    };
    offset += pct;
    return arc;
  });

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
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
              style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 6px ${arc.color}88)` }}
            />
          ))}
        </svg>
        {(label !== undefined) && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none"
          }}>
            <span style={{ fontSize: size * 0.19, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{label}</span>
            {sublabel && <span style={{ fontSize: size * 0.11, color: "var(--text-muted)", marginTop: "2px" }}>{sublabel}</span>}
          </div>
        )}
      </div>
      {segments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
          {segments.map((seg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0, boxShadow: `0 0 6px ${seg.color}` }} />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{seg.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
