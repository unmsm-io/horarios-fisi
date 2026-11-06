import { describe, expect, it } from "bun:test";
import {
  AuthServiceError,
  loginWithInstitutionalCredentials,
  logoutInstitutionalSession,
  normalizeLdapUsername,
  refreshInstitutionalTokens,
} from "./auth-service-client";

describe("normalizeLdapUsername", () => {
  it("extracts username from institutional email", () => {
    expect(normalizeLdapUsername("lmotaa@unmsm.edu.pe")).toBe("lmotaa");
    expect(normalizeLdapUsername("  LMOTAA@UNMSM.EDU.PE  ")).toBe("lmotaa");
  });

  it("preserves bare username and lowercases", () => {
    expect(normalizeLdapUsername("lmotaa")).toBe("lmotaa");
    expect(normalizeLdapUsername("  LMotaA  ")).toBe("lmotaa");
  });

  it("handles empty or falsy string", () => {
    expect(normalizeLdapUsername("")).toBe("");
  });
});

describe("loginWithInstitutionalCredentials", () => {
  it("authenticates successfully against the mock microservice", async () => {
    const mockFetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(String(url)).toBe("http://mock-auth:5000/api/v1/auth/login");
      const body = JSON.parse(init?.body as string);
      expect(body.username).toBe("lmotaa");
      expect(body.password).toBe("secret123");
      expect(body.systemCode).toBe("HORARIOS_FISI");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Autenticación exitosa",
          data: {
            accessToken: "mock-jwt-access",
            refreshToken: "mock-jwt-refresh",
            tokenType: "Bearer",
            expiresIn: 900,
            user: {
              id: 10,
              code: "20200001",
              firstName: "LAZARO",
              lastName: "MOTA",
              email: "lmotaa@unmsm.edu.pe",
              ldapUid: "lmotaa",
              roles: ["DOCENTE"],
              systemCode: "HORARIOS_FISI",
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const data = await loginWithInstitutionalCredentials({
      username: "lmotaa@unmsm.edu.pe",
      password: "secret123",
      baseUrl: "http://mock-auth:5000",
      systemCode: "HORARIOS_FISI",
      fetchFn: mockFetch,
    });

    expect(data.accessToken).toBe("mock-jwt-access");
    expect(data.refreshToken).toBe("mock-jwt-refresh");
    expect(data.user.ldapUid).toBe("lmotaa");
    expect(data.user.roles).toEqual(["DOCENTE"]);
  });

  it("throws 400 when username or password are missing", async () => {
    await expect(
      loginWithInstitutionalCredentials({
        username: "",
        password: "password",
      }),
    ).rejects.toThrow(AuthServiceError);
  });

  it("throws 401 when microservice reports invalid credentials", async () => {
    const mockFetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Credenciales inválidas",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    await expect(
      loginWithInstitutionalCredentials({
        username: "baduser",
        password: "badpassword",
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("Credenciales inválidas");
  });

  it("throws 403 with support notice when user lacks system roles", async () => {
    const mockFetch = (async () => {
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 403,
          message:
            "El usuario no cuenta con roles asignados para el sistema solicitado",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    await expect(
      loginWithInstitutionalCredentials({
        username: "alumnouser",
        password: "secretpassword",
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("El usuario no cuenta con roles asignados");
  });
});

describe("refreshInstitutionalTokens", () => {
  it("renews access token successfully", async () => {
    const mockFetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(String(url)).toBe("http://mock-auth:5000/api/v1/auth/refresh");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Cookie).toContain("refreshToken=valid-refresh-token");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Token renovado exitosamente",
          data: {
            accessToken: "new-access-token",
            tokenType: "Bearer",
            expiresIn: 900,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              "refreshToken=new-rotated-refresh-token; Path=/api/v1/auth",
          },
        },
      );
    }) as unknown as typeof fetch;

    const data = await refreshInstitutionalTokens({
      refreshToken: "valid-refresh-token",
      baseUrl: "http://mock-auth:5000",
      fetchFn: mockFetch,
    });

    expect(data.accessToken).toBe("new-access-token");
    expect(data.refreshToken).toBe("new-rotated-refresh-token");
  });

  it("throws 401 when refresh token is missing", async () => {
    await expect(
      refreshInstitutionalTokens({
        refreshToken: "",
      }),
    ).rejects.toThrow("Refresh token no proporcionado.");
  });
});

describe("logoutInstitutionalSession", () => {
  it("calls the logout endpoint with authorization and cookie", async () => {
    let called = false;
    const mockFetch = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(String(url)).toBe("http://mock-auth:5000/api/v1/auth/logout");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test-access-token");
      expect(headers.Cookie).toBe("refreshToken=test-refresh-token");
      called = true;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;

    await logoutInstitutionalSession({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      baseUrl: "http://mock-auth:5000",
      fetchFn: mockFetch,
    });

    expect(called).toBe(true);
  });
});
