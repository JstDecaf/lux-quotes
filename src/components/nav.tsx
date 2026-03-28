"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "H" },
  { href: "/quotes", label: "Quotes", icon: "Q" },
  { href: "/clients", label: "Clients", icon: "C" },
  { href: "/projects", label: "Projects", icon: "P" },
  { href: "/products", label: "Products", icon: "K" },
  { href: "/import", label: "Import XLS", icon: "I" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-[#0D1B2A] text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-white/10">
        <h1 className="font-archivo text-xl font-bold tracking-wide">
          <span className="text-[#DB412B]">LUX</span> Quotes
        </h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded text-sm transition-colors ${
                active
                  ? "bg-white/10 text-white font-medium"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 text-xs text-gray-500">
        LUX LED Solutions
      </div>
    </aside>
  );
}
