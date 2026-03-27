export default function PortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--elevated)" }}>
      {children}
    </div>
  );
}
