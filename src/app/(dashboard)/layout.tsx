import { Nav } from "@/components/nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Nav />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 p-3 sm:p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
