// Next.js route-level auth guard — JWT decode + role-based redirect. T-022
import { NextRequest, NextResponse } from "next/server";

// Routes and which roles may access them
const ROLE_ROUTES: Record<string, string[]> = {
  "/operator":       ["operator", "admin"],
  "/approver":       ["approver", "admin"],
  "/admin":          ["admin"],
  "/mission-control": ["operator", "approver", "admin"],
};

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → base64 → JSON
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without checks
  if (pathname.startsWith("/login") || pathname === "/") {
    return NextResponse.next();
  }

  // Find which rule prefix matches this path
  const matchedPrefix = Object.keys(ROLE_ROUTES).find((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  if (!matchedPrefix) {
    // No restriction — allow
    return NextResponse.next();
  }

  const token = request.cookies.get("scsp_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = parseJwtPayload(token);
  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check expiry (exp is seconds since epoch)
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp > 0 && exp < Date.now() / 1000) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const role = (payload.role as string | undefined) ?? "";
  const allowed = ROLE_ROUTES[matchedPrefix] ?? [];
  if (!allowed.includes(role)) {
    // Authenticated but wrong role — send to their home
    const homes: Record<string, string> = {
      operator: "/operator/dashboard",
      approver: "/approver/queue",
      admin:    "/admin/ledger",
    };
    const home = homes[role] ?? "/login";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/operator/:path*",
    "/approver/:path*",
    "/admin/:path*",
    "/mission-control/:path*",
    "/mission-control",
  ],
};
