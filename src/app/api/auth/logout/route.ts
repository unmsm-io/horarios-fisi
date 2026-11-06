import { type NextRequest, NextResponse } from "next/server";
import { logoutInstitutionalSession } from "@/lib/auth/auth-service-client";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  unsealSession,
} from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    const session = await unsealSession(cookie);
    if (session) {
      await logoutInstitutionalSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    }
  }

  const response = NextResponse.json({
    success: true,
    message: "Sesión cerrada exitosamente",
  });

  const cookieOptions = getSessionCookieOptions();
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  return response;
}
