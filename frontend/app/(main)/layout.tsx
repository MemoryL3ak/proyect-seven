"use client";

import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import SofiaWidget from "@/components/SofiaWidget";
import { useTheme } from "@/lib/theme";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  if (theme === "obsidian") {
    return (
      <div style={{ minHeight: "100vh", background: "#060913", display: "flex", position: "relative" }}>
        {/* Animated background orbs */}
        <div className="obsidian-bg">
          <div className="obsidian-orb obsidian-orb-1" />
          <div className="obsidian-orb obsidian-orb-2" />
          <div className="obsidian-orb obsidian-orb-3" />
        </div>
        {/* Sidebar */}
        <div style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0, zIndex: 20 }}>
          <SideNav />
        </div>
        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, overflowX: "hidden", padding: "28px 32px", position: "relative", zIndex: 1 }}>
          <TopBar />
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>{children}</div>
        </main>
        <SofiaWidget />
      </div>
    );
  }

  if (theme === "light") {
    return (
      <div style={{ minHeight: "100vh", background: "#e8edf5", padding: "16px", display: "flex", gap: "16px" }}>
        <div style={{
          borderRadius: "16px", background: "#ffffff",
          boxShadow: "0 2px 16px rgba(15,23,42,0.08)",
          overflow: "hidden", flexShrink: 0,
          height: "calc(100vh - 32px)", position: "sticky", top: "16px"
        }}>
          <SideNav />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0" }}>
          <div style={{
            borderRadius: "16px", background: "#ffffff",
            boxShadow: "0 2px 16px rgba(15,23,42,0.08)",
            padding: "24px 32px", marginBottom: "16px"
          }}>
            <TopBar />
          </div>
          <div style={{
            flex: 1, borderRadius: "16px", background: "#f4f7fc",
            padding: "24px 32px", overflowY: "auto", minHeight: 0
          }}>
            <div style={{ maxWidth: "1400px", margin: "0 auto" }}>{children}</div>
          </div>
        </div>
        <SofiaWidget />
      </div>
    );
  }

  if (theme === "atlas") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: "#eef1f8" }}>
        {/* Dark nav sidebar */}
        <div style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0, zIndex: 20 }}>
          <SideNav />
        </div>
        {/* Main canvas */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {/* Top bar strip */}
          <div style={{
            background: "#ffffff",
            borderBottom: "1px solid #e8edf5",
            padding: "0 32px",
            position: "sticky", top: 0, zIndex: 10,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <TopBar />
          </div>
          {/* Scrollable content */}
          <main style={{ flex: 1, padding: "24px 32px", overflowX: "hidden" }}>
            <div style={{ maxWidth: "1400px", margin: "0 auto" }}>{children}</div>
          </main>
        </div>
        <SofiaWidget />
      </div>
    );
  }

  // Dark mode
  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(to right, #07101f 260px, #f0f3fa 260px)" }}>
      <SideNav />
      <main className="flex-1 min-w-0 overflow-x-hidden px-7 py-7">
        <TopBar />
        <div className="min-w-0 mx-auto" style={{ maxWidth: "1400px" }}>{children}</div>
      </main>
      <SofiaWidget />
    </div>
  );
}
