import { type NextRequest, NextResponse } from "next/server";
import {
  AuthServiceError,
  refreshInstitutionalTokens,
} from "@/lib/auth/auth-service-client";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  type SessionData,
  sealSession,
  unsealSession,
} from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) {
    return NextResponse.json(
      { error: "No hay sesión activa para renovar." },
      { status: 401 },
    );
  }

  const session = await unsealSession(cookie);
  if (!session) {
    return NextResponse.json(
      { error: "Sesión inválida o expirada." },
      { status: 401 },
    );
  }

  try {
    const refreshData = await refreshInstitutionalTokens({
      refreshToken: session.refreshToken,
    });

    const expiresAt =
      Math.floor(Date.now() / 1000) + (refreshData.expiresIn || 900);

    const updatedSession: SessionData = {
      ...session,
      accessToken: refreshData.accessToken,
      refreshToken: refreshData.refreshToken || session.refreshToken,
      expiresAt,
    };

    const sealedToken = await sealSession(updatedSession);
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({
      success: true,
      message: "Token renovado exitosamente",
    });

    response.cookies.set(SESSION_COOKIE_NAME, sealedToken, cookieOptions);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      const response = NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
      // Clear invalid session cookie on failed refresh
      response.cookies.set(SESSION_COOKIE_NAME, "", {
        ...getSessionCookieOptions(),
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.json(
      { error: "Error al renovar la sesión." },
      { status: 500 },
    );
  }
}
