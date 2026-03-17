import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import SofiaWidget from "@/components/SofiaWidget";

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-mesh min-h-screen flex">
      <SideNav />
      <main className="flex-1 min-w-0 overflow-x-hidden px-7 py-7">
        <TopBar />
        <div className="min-w-0 mx-auto" style={{ maxWidth: "1400px" }}>{children}</div>
      </main>
      <SofiaWidget />
    </div>
  );
}
