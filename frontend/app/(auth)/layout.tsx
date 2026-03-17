export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: "var(--bg)" }}
    >
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
