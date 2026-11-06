import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";
import { SESSION_COOKIE_NAME, unsealSession } from "@/lib/auth/session";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/demo")
  );
}

const isDev =
  (process.env.NODE_ENV as string) === "dev" ||
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV !== "production";

export default async function proxy(
  request: NextRequest,
  _event: NextFetchEvent,
) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? await unsealSession(sessionCookie) : null;

  // Authenticated user trying to access /sign-in should be redirected to their role portal
  if (session && pathname.startsWith("/sign-in")) {
    const destination =
      session.user.role === "admin" || session.user.role === "direccion"
        ? "/direction"
        : "/teacher";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Public routes allowed without authentication
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow development bypass if explicitly configured via header/cookie or dev preview flag
  if (isDev && request.nextUrl.searchParams.get("preview") === "true") {
    return NextResponse.next();
  }

  // Protected route accessed without valid session -> redirect to /sign-in
  if (!session) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
