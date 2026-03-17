export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060e1a 0%, #0b1628 50%, #0f1e35 100%)" }}
    >
      <div style={{ position:"absolute", top:"8%", left:"12%", width:500, height:500, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
        pointerEvents:"none", filter:"blur(40px)" }} />
      <div style={{ position:"absolute", bottom:"5%", right:"8%", width:400, height:400, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
        pointerEvents:"none", filter:"blur(30px)" }} />
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", opacity:0.025,
        backgroundImage:"radial-gradient(rgba(201,168,76,1) 1px, transparent 1px)",
        backgroundSize:"32px 32px" }} />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
