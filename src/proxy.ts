import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { validateApiKey } from "@/lib/mail-service";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/icon.png",
  "/logo.png",
  "/favicon.png",
  "/favicon.ico",
  "/hero-illustration.jpg",
  "/og-image.jpg",
  "/robots.txt",
  "/sitemap.xml",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/webhook") ||
    pathname.startsWith("/api/v1/auth") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$/i) ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") {
      const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (token && await verifySessionToken(token)) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/api/v1")) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ") && validateApiKey(authHeader)) {
      return NextResponse.next();
    }
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
