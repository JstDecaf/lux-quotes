import { Nav } from "@/components/nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Nav />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 p-4 sm:p-6 md:p-8" style={{ background: "var(--page-bg)" }}>
        {children}
      </main>
    </div>
  );
}
