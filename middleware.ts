export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (the sign-in page)
     * - /api/auth (NextAuth.js routes)
     * - /_next/static (static files)
     * - /_next/image (image optimization)
     * - /favicon.ico, /lux-logo.svg, and other public assets
     */
    "/((?!login|api/auth|api/mcp|api/fx/update|_next/static|_next/image|favicon\\.ico|.*\\.svg).*)",
  ],
};
