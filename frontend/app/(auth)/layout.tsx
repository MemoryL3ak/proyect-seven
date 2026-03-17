export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background: "linear-gradient(160deg, #0c1635 0%, #1a2d5a 40%, #0d1b3e 100%)",
        backgroundAttachment: "fixed",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Texture overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat",
        backgroundSize: "128px",
        pointerEvents: "none",
        opacity: 0.6
      }} />
      {/* Radial glow center */}
      <div style={{
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px",
        height: "600px",
        background: "radial-gradient(ellipse, rgba(26,60,120,0.5) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
