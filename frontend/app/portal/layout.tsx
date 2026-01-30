export default function PortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl">{children}</div>
    </div>
  );
}
