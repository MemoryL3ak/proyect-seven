"use client";

import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import SofiaWidget from "@/components/SofiaWidget";
import { useTheme } from "@/lib/theme";

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <div
      className="min-h-screen flex"
      style={{
        background: theme === "dark"
          ? "linear-gradient(to right, #07101f 260px, #f0f3fa 260px)"
          : "#f0f2f7"
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
