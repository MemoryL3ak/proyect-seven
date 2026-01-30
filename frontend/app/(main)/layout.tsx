import SideNav from "@/components/SideNav";
import TopBar from "@/components/TopBar";

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-mesh">
      <div className="flex">
        <SideNav />
        <main className="flex-1 px-6 py-6">
          <TopBar />
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
