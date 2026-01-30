export default function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-6 py-12">
      {children}
    </div>
  );
}
