"use client";

import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import SofiaWidget from "@/components/SofiaWidget";
import { useTheme } from "@/lib/theme";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  if (theme === "light") {
    return (
      <div style={{ minHeight: "100vh", background: "#e8edf5", padding: "16px", display: "flex", gap: "16px" }}>
        {/* Light sidebar: standalone rounded card */}
        <div style={{
          borderRadius: "16px",
          background: "#ffffff",
          boxShadow: "0 2px 16px rgba(15,23,42,0.08)",
          overflow: "hidden",
          flexShrink: 0,
          height: "calc(100vh - 32px)",
          position: "sticky",
          top: "16px"
        }}>
          <SideNav />
        </div>
        {/* Light content: rounded card */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0" }}>
          <div style={{
            borderRadius: "16px",
            background: "#ffffff",
            boxShadow: "0 2px 16px rgba(15,23,42,0.08)",
            padding: "24px 32px",
            marginBottom: "16px"
          }}>
            <TopBar />
          </div>
          <div style={{
            flex: 1,
            borderRadius: "16px",
            background: "#f4f7fc",
            padding: "24px 32px",
            overflowY: "auto",
            minHeight: 0
          }}>
            <div style={{ maxWidth: "1400px", margin: "0 auto" }}>{children}</div>
          </div>
        </div>
        <SofiaWidget />
      </div>
    );
  }

  // Dark mode layout (unchanged)
  return (
    <div
      className="min-h-screen flex"
      style={{
        background: "linear-gradient(to right, #07101f 260px, #f0f3fa 260px)"
      }}
    >
      <SideNav />
      <main className="flex-1 min-w-0 overflow-x-hidden px-7 py-7">
        <TopBar />
        <div className="min-w-0 mx-auto" style={{ maxWidth: "1400px" }}>{children}</div>
      </main>
      <SofiaWidget />
    </div>
  );
}
