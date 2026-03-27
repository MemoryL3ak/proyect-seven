"use client";

import { useState } from "react";
import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import SofiaWidget from "@/components/SofiaWidget";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dark-layout-root min-h-screen flex">
      <MobileOverlay visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`sidebar-wrapper${sidebarOpen ? " open" : ""}`} style={{ zIndex: 50 }}>
        <SideNav onClose={() => setSidebarOpen(false)} />
      </div>
      <main className="flex-1 min-w-0 overflow-x-hidden px-4 py-5 md:px-7 md:py-7">
        <TopBar onMenuOpen={() => setSidebarOpen(true)} />
        <div className="min-w-0 mx-auto" style={{ maxWidth: "1400px" }}>{children}</div>
      </main>
      <SofiaWidget />
    </div>
  );
}
