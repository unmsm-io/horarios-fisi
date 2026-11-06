export type AuthUser = {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  ldapUid: string;
  roles: string[];
  systemCode: string;
};

export type LoginSuccessData = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
};

export type RefreshSuccessData = {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
};

export class AuthServiceError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function normalizeLdapUsername(identifier: string): string {
  if (!identifier) return "";
  const trimmed = identifier.trim().toLowerCase();
  return trimmed.split("@")[0];
}

export function getAuthServiceUrl(): string {
  return (
    process.env.AUTH_SERVICE_URL?.replace(/\/+$/, "") || "http://localhost:5000"
  );
}

export function getAuthSystemCode(): string {
  return process.env.AUTH_SYSTEM_CODE || "HORARIOS_FISI";
}

export async function loginWithInstitutionalCredentials({
  username,
  password,
  baseUrl = getAuthServiceUrl(),
  systemCode = getAuthSystemCode(),
  fetchFn = fetch,
}: {
  username: string;
  password: string;
  baseUrl?: string;
  systemCode?: string;
  fetchFn?: typeof fetch;
}): Promise<LoginSuccessData> {
  const normalizedUsername = normalizeLdapUsername(username);
  if (!normalizedUsername || !password) {
    throw new AuthServiceError(
      "Debes ingresar tu usuario y contraseña institucional.",
      400,
    );
  }

  const endpoint = `${baseUrl}/api/v1/auth/login`;
  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: normalizedUsername,
        password,
        systemCode,
      }),
    });
  } catch (error) {
    throw new AuthServiceError(
      "No se pudo conectar con el servicio de autenticación institucional.",
      503,
      error,
    );
  }

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: LoginSuccessData;
    error?: string;
    details?: unknown;
  };

  if (!response.ok || !json.data) {
    const message =
      json.message ||
      json.error ||
      (response.status === 401
        ? "Credenciales institucionales incorrectas."
        : response.status === 403
          ? "No cuentas con acceso asignado para este sistema. Contacta a soporte."
          : "Error al iniciar sesión institucional.");
    throw new AuthServiceError(message, response.status, json.details);
  }

  // Extract set-cookie if response has refreshToken in cookie but not in data body
  let refreshToken = json.data.refreshToken;
  if (!refreshToken && response.headers) {
    const setCookie = response.headers.get("set-cookie");
    const match = setCookie?.match(/refreshToken=([^;]+)/);
    if (match) {
      refreshToken = match[1];
    }
  }

  return {
    ...json.data,
    refreshToken: refreshToken || json.data.refreshToken,
  };
}

export async function refreshInstitutionalTokens({
  refreshToken,
  baseUrl = getAuthServiceUrl(),
  fetchFn = fetch,
}: {
  refreshToken: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<RefreshSuccessData> {
  if (!refreshToken) {
    throw new AuthServiceError("Refresh token no proporcionado.", 401);
  }

  const endpoint = `${baseUrl}/api/v1/auth/refresh`;
  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    throw new AuthServiceError(
      "No se pudo contactar al servicio de autenticación para renovar el token.",
      503,
      error,
    );
  }

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: RefreshSuccessData;
  };

  if (!response.ok || !json.data) {
    throw new AuthServiceError(
      json.message || "La sesión ha expirado o no es válida.",
      response.status,
    );
  }

  let newRefreshToken = json.data.refreshToken;
  if (!newRefreshToken && response.headers) {
    const setCookie = response.headers.get("set-cookie");
    const match = setCookie?.match(/refreshToken=([^;]+)/);
    if (match) {
      newRefreshToken = match[1];
    }
  }

  return {
    ...json.data,
    refreshToken: newRefreshToken || refreshToken,
  };
}

export async function logoutInstitutionalSession({
  refreshToken,
  accessToken,
  baseUrl = getAuthServiceUrl(),
  fetchFn = fetch,
}: {
  refreshToken?: string;
  accessToken?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  const endpoint = `${baseUrl}/api/v1/auth/logout`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (refreshToken) {
    headers.Cookie = `refreshToken=${refreshToken}`;
  }

  try {
    await fetchFn(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Non-blocking logout network error: local session will still be destroyed
  }
}
