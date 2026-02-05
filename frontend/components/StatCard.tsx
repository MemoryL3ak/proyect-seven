export default function StatCard({
  title,
  value,
  helper
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="surface rounded-2xl p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
      <h3 className="font-display text-3xl text-ink mt-2">{value}</h3>
      <p className="text-sm text-slate-500 mt-2">{helper}</p>
    </div>
  );
}
