"use client";

export interface BarData {
  label: string;
  value: number;
  color?: string;
}

export default function BarChart({
  data,
  height = 80,
  defaultColor = "#22d3ee",
  showValues = false,
}: {
  data: BarData[];
  height?: number;
  defaultColor?: string;
  showValues?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: `${height + (showValues ? 24 : 0) + 20}px` }}>
      {data.map((d, i) => {
        const color = d.color || defaultColor;
        const barH = Math.max((d.value / max) * height, d.value > 0 ? 6 : 0);
        return (
          <div
            key={i}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: "5px" }}
          >
            {showValues && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", minHeight: "16px", fontVariantNumeric: "tabular-nums" }}>
                {d.value > 0 ? d.value : ""}
              </span>
            )}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: `${height}px` }}>
              <div
                style={{
                  width: "100%",
                  height: `${barH}px`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}99 100%)`,
                  borderRadius: "6px 6px 2px 2px",
                  transition: "height 0.8s cubic-bezier(0.34,1.2,0.64,1)",
                  boxShadow: `0 2px 8px ${color}30`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Shimmer */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
                  animation: "shimmer 2.5s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`
                }} />
                {/* Top highlight */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "3px",
                  background: "rgba(255,255,255,0.35)",
                  borderRadius: "6px 6px 0 0",
                }} />
              </div>
            </div>
            <span style={{
              fontSize: "10px", fontWeight: 600, color: "#64748b",
              textAlign: "center", width: "100%",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
