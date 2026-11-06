import { cookies } from "next/headers";
import { refreshInstitutionalTokens } from "@/lib/auth/auth-service-client";
import { isAppRole } from "@/lib/auth/roles";
import {
  getSessionCookieOptions,
  isTokenExpiringSoon,
  SESSION_COOKIE_NAME,
  sealSession,
  unsealSession,
} from "@/lib/auth/session";
import type { ScheduleIdentity } from "@/lib/domain/types";

export { isAppRole };

export async function resolveScheduleIdentity({
  preview = false,
}: {
  preview?: boolean;
} = {}): Promise<ScheduleIdentity | null> {
  const isDev =
    (process.env.NODE_ENV as string) === "dev" ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV !== "production";

  if (isDev && preview) {
    return localPreviewIdentity();
  }

  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (rawSession) {
      const session = await unsealSession(rawSession);
      if (session) {
        // Proactive silent refresh if expiring within 120 seconds
        if (isTokenExpiringSoon(session.expiresAt) && session.refreshToken) {
          try {
            const refreshData = await refreshInstitutionalTokens({
              refreshToken: session.refreshToken,
            });
            session.accessToken = refreshData.accessToken;
            session.refreshToken =
              refreshData.refreshToken || session.refreshToken;
            session.expiresAt =
              Math.floor(Date.now() / 1000) + (refreshData.expiresIn || 900);
            const sealedToken = await sealSession(session);
            try {
              cookieStore.set(
                SESSION_COOKIE_NAME,
                sealedToken,
                getSessionCookieOptions(),
              );
            } catch {
              // Setting cookies might be restricted in pure Server Components (read-only);
              // Server Actions or Route Handlers will persist it.
            }
          } catch {
            // If refresh fails, check if the access token has completely expired
            if (session.expiresAt < Math.floor(Date.now() / 1000)) {
              if (isDev) return localPreviewIdentity();
              return null;
            }
          }
        }

        return {
          ldapUid: session.user.ldapUid,
          clerkUserId: session.user.ldapUid,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
          institutionalRoles: session.user.institutionalRoles,
          preview: false,
        };
      }
    }
  } catch {
    if (!isDev) {
      return null;
    }
  }

  if (isDev) {
    return localPreviewIdentity();
  }

  return null;
}

export function localPreviewIdentity(): ScheduleIdentity {
  return {
    ldapUid: "local-preview",
    clerkUserId: "local-preview",
    email: "preview@unmsm.edu.pe",
    name: "Vista local",
    preview: true,
  };
}
