import { type NextRequest, NextResponse } from "next/server";
import {
  AuthServiceError,
  loginWithInstitutionalCredentials,
} from "@/lib/auth/auth-service-client";
import { resolveEffectiveRole } from "@/lib/auth/roles";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  type SessionData,
  sealSession,
} from "@/lib/auth/session";
import { syncInstitutionalUser } from "@/lib/data/schedule-db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };

    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json(
        { error: "Debes ingresar tu usuario y contraseña institucional." },
        { status: 400 },
      );
    }

    const authData = await loginWithInstitutionalCredentials({
      username,
      password,
    });

    const effectiveRole = resolveEffectiveRole(authData.user.roles);
    if (!effectiveRole) {
      return NextResponse.json(
        {
          error:
            "No cuentas con un rol habilitado para el sistema de Horarios. Contacta a soporte.",
        },
        { status: 403 },
      );
    }

    const fullName =
      `${authData.user.firstName} ${authData.user.lastName}`.trim();

    // Just-in-time synchronization in app_users
    await syncInstitutionalUser({
      ldapUid: authData.user.ldapUid,
      email: authData.user.email,
      name: fullName,
      role: effectiveRole,
      institutionalRoles: authData.user.roles,
      code: authData.user.code,
      authUserId: authData.user.id,
    });

    const expiresAt =
      Math.floor(Date.now() / 1000) + (authData.expiresIn || 900);

    const sessionData: SessionData = {
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      expiresAt,
      user: {
        ldapUid: authData.user.ldapUid,
        email: authData.user.email,
        name: fullName,
        role: effectiveRole,
        institutionalRoles: authData.user.roles,
        code: authData.user.code,
        authUserId: authData.user.id,
      },
    };

    const sealedToken = await sealSession(sessionData);
    const cookieOptions = getSessionCookieOptions();

    const redirectUrl =
      effectiveRole === "admin" || effectiveRole === "direccion"
        ? "/direction"
        : "/teacher";

    const response = NextResponse.json({
      success: true,
      user: sessionData.user,
      redirectUrl,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sealedToken, cookieOptions);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode },
      );
    }
    console.error("Login route error:", error);
    return NextResponse.json(
      { error: "Error inesperado al iniciar sesión institucional." },
      { status: 500 },
    );
  }
}
