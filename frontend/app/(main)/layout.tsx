import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";
import SofiaWidget from "@/components/SofiaWidget";

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-mesh">
      <div className="flex">
        <SideNav />
        <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-6">
          <TopBar />
          <div className="mt-6 min-w-0 overflow-x-hidden">{children}</div>
        </main>
      </div>
      <SofiaWidget />
    </div>
  );
}
