"use client";

import { useState } from "react";
import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import SofiaWidget from "@/components/SofiaWidget";
import { useTheme } from "@/lib/theme";

function MobileOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  return (
    <div
      className="md:hidden"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 40,
        backdropFilter: "blur(2px)",
      }}
    />
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);
  const openSidebar = () => setSidebarOpen(true);

  if (theme === "obsidian") {
    return (
      <div style={{ minHeight: "100vh", background: "#060913", display: "flex", position: "relative" }}>
        <div className="obsidian-bg">
          <div className="obsidian-orb obsidian-orb-1" />
          <div className="obsidian-orb obsidian-orb-2" />
          <div className="obsidian-orb obsidian-orb-3" />
        </div>
        <MobileOverlay visible={sidebarOpen} onClose={closeSidebar} />
        <div className={`sidebar-wrapper${sidebarOpen ? " open" : ""}`} style={{ zIndex: 50 }}>
          <SideNav onClose={closeSidebar} />
        </div>
        <main className="mobile-content-pad" style={{ flex: 1, minWidth: 0, overflowX: "hidden", padding: "28px 32px", position: "relative", zIndex: 1 }}>
          <TopBar onMenuOpen={openSidebar} />
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>{children}</div>
        </main>
        <SofiaWidget />
      </div>
    );
  }

  if (theme === "light") {
    return (
      <div className="mobile-full-width" style={{ minHeight: "100vh", background: "#e8edf5", padding: "16px", display: "flex", gap: "16px" }}>
        <MobileOverlay visible={sidebarOpen} onClose={closeSidebar} />
        <div
          className={`sidebar-wrapper${sidebarOpen ? " open" : ""}`}
          style={{
            borderRadius: "16px", background: "#ffffff",
            boxShadow: "0 2px 16px rgba(15,23,42,0.08)",
            overflow: "hidden", flexShrink: 0,
            height: "calc(100vh - 32px)", zIndex: 50,
          }}
        >
          <SideNav onClose={closeSidebar} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0" }}>
          <div style={{
            borderRadius: "16px", background: "#ffffff",
            boxShadow: "0 2px 16px rgba(15,23,42,0.08)",
            padding: "24px 32px", marginBottom: "16px"
          }}>
            <TopBar onMenuOpen={openSidebar} />
          </div>
          <div className="mobile-content-pad" style={{
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
        <MobileOverlay visible={sidebarOpen} onClose={closeSidebar} />
        <div className={`sidebar-wrapper${sidebarOpen ? " open" : ""}`} style={{ zIndex: 50 }}>
          <SideNav onClose={closeSidebar} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div className="px-4 md:px-8" style={{
            background: "#ffffff",
            borderBottom: "1px solid #e8edf5",
            position: "sticky", top: 0, zIndex: 10,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
          }}>
            <TopBar onMenuOpen={openSidebar} />
          </div>
          <main className="mobile-content-pad" style={{ flex: 1, padding: "24px 32px", overflowX: "hidden" }}>
            <div style={{ maxWidth: "1400px", margin: "0 auto" }}>{children}</div>
          </main>
        </div>
        <SofiaWidget />
      </div>
    );
  }

  // Dark mode
  return (
    <div className="dark-layout-root min-h-screen flex">
      <MobileOverlay visible={sidebarOpen} onClose={closeSidebar} />
      <div className={`sidebar-wrapper${sidebarOpen ? " open" : ""}`} style={{ zIndex: 50 }}>
        <SideNav onClose={closeSidebar} />
      </div>
      <main className="flex-1 min-w-0 overflow-x-hidden px-4 py-5 md:px-7 md:py-7">
        <TopBar onMenuOpen={openSidebar} />
        <div className="min-w-0 mx-auto" style={{ maxWidth: "1400px" }}>{children}</div>
      </main>
      <SofiaWidget />
    </div>
  );
}
