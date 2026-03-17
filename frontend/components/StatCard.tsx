export default function StatCard({
  title,
  value,
  helper,
  accent = false,
  index = 0,
}: {
  title: string;
  value: string;
  helper: string;
  accent?: boolean;
  index?: number;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
      style={{
        background: accent
          ? "linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(11,22,40,0.95) 100%)"
          : "rgba(255,255,255,0.04)",
        borderColor: accent ? "rgba(201,168,76,0.35)" : "rgba(255,255,255,0.08)",
        borderTopWidth: accent ? "2px" : "1px",
        borderTopColor: accent ? "#c9a84c" : "rgba(255,255,255,0.08)",
        animationDelay: `${index * 60}ms`,
      }}
    >
      <p className="text-xs uppercase tracking-[0.25em] text-white/40">{title}</p>
      <h3
        className="mt-2 font-sans font-bold text-3xl"
        style={{ color: accent ? "#c9a84c" : "#ffffff" }}
      >
        {value}
      </h3>
      <p className="mt-2 text-sm text-white/50">{helper}</p>
    </div>
  );
}
