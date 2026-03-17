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
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: `${height + (showValues ? 20 : 0)}px` }}>
      {data.map((d, i) => {
        const color = d.color || defaultColor;
        const barH = Math.max((d.value / max) * height, d.value > 0 ? 4 : 0);
        return (
          <div
            key={i}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: "4px" }}
          >
            {showValues && (
              <span style={{ fontSize: "10px", color: "var(--text-muted)", minHeight: "14px" }}>
                {d.value > 0 ? d.value : ""}
              </span>
            )}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: `${height}px` }}>
              <div
                style={{
                  width: "100%",
                  height: `${barH}px`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                  boxShadow: `0 0 12px ${color}44`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Shimmer */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                  animation: "shimmer 2s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`
                }} />
              </div>
            </div>
            <span style={{ fontSize: "9px", color: "var(--text-muted)", textAlign: "center", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
