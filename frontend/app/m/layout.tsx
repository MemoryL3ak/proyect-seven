export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(160deg, #060e16 0%, #0d1a28 55%, #091422 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        body { background: #060e16 !important; }
      `}</style>
      {children}
    </div>
  );
}
