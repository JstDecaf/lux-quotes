"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

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
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0D1B2A] text-white flex items-center justify-between px-4 h-14">
        <h1 className="font-archivo text-lg font-bold tracking-wide">
          <span className="text-[#DB412B]">LUX</span> Quotes
        </h1>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded hover:bg-white/10 transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile slide-out menu */}
      <div
        className={`md:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-[#0D1B2A] text-white transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="p-3 space-y-1">
          {links.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-3 rounded text-sm transition-colors ${
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors w-full"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-[#0D1B2A] text-white flex-col shrink-0">
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
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors w-full"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
