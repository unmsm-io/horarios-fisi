import { describe, expect, it } from "bun:test";
import {
  getSessionCookieOptions,
  isTokenExpiringSoon,
  type SessionData,
  sealSession,
  unsealSession,
} from "./session";

const sampleSession: SessionData = {
  accessToken: "mock.access.token",
  refreshToken: "mock.refresh.token",
  expiresAt: Math.floor(Date.now() / 1000) + 900,
  user: {
    ldapUid: "lmotaa",
    email: "lmotaa@unmsm.edu.pe",
    name: "Lazaro Mota",
    role: "docente",
    institutionalRoles: ["DOCENTE"],
    code: "20200001",
    authUserId: 10,
    authAccountId: 20,
  },
};

describe("session sealing and unsealing", () => {
  it("seals and restores session data correctly with matching secret", async () => {
    const sealed = await sealSession(sampleSession, "test-secret-12345");
    expect(typeof sealed).toBe("string");
    expect(sealed).toContain(".");

    const restored = await unsealSession(sealed, "test-secret-12345");
    expect(restored).not.toBeNull();
    expect(restored?.accessToken).toBe("mock.access.token");
    expect(restored?.refreshToken).toBe("mock.refresh.token");
    expect(restored?.user.ldapUid).toBe("lmotaa");
    expect(restored?.user.role).toBe("docente");
    expect(restored?.user.code).toBe("20200001");
  });

  it("returns null when attempting to unseal with a different secret", async () => {
    const sealed = await sealSession(sampleSession, "test-secret-A");
    const restored = await unsealSession(sealed, "test-secret-B");
    expect(restored).toBeNull();
  });

  it("returns null for malformed or corrupted session tokens", async () => {
    expect(await unsealSession("")).toBeNull();
    expect(await unsealSession("not-a-token")).toBeNull();
    expect(await unsealSession("invalid.format.extra")).toBeNull();
    expect(await unsealSession("corrupted.payload")).toBeNull();
  });
});

describe("isTokenExpiringSoon", () => {
  it("detects when token expires within the threshold (e.g. 120s)", () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    // Expires in 60s (< 120s threshold)
    expect(isTokenExpiringSoon(nowInSeconds + 60, 120)).toBe(true);
    // Already expired (-10s)
    expect(isTokenExpiringSoon(nowInSeconds - 10, 120)).toBe(true);
    // Expires in 300s (> 120s threshold)
    expect(isTokenExpiringSoon(nowInSeconds + 300, 120)).toBe(false);
  });
});

describe("getSessionCookieOptions", () => {
  it("provides standard secure options", () => {
    const options = getSessionCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(7 * 24 * 60 * 60);
  });
});
