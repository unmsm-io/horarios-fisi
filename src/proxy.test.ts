import { describe, expect, it } from "bun:test";
import { type NextFetchEvent, NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  type SessionData,
  sealSession,
} from "@/lib/auth/session";
import proxy from "./proxy";

const dummyEvent = {} as unknown as NextFetchEvent;

describe("middleware proxy", () => {
  it("allows public paths without authentication", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await proxy(req, dummyEvent);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated users trying to access protected routes to /sign-in", async () => {
    const req = new NextRequest("http://localhost:3000/teacher");
    const res = await proxy(req, dummyEvent);
    expect(res.headers.get("location")).toBe("http://localhost:3000/sign-in");
  });

  it("allows authenticated user to access protected routes", async () => {
    const sessionData: SessionData = {
      accessToken: "token-1",
      refreshToken: "token-2",
      expiresAt: Math.floor(Date.now() / 1000) + 900,
      user: {
        ldapUid: "lmotaa",
        email: "lmotaa@unmsm.edu.pe",
        name: "Lazaro Mota",
        role: "docente",
        institutionalRoles: ["DOCENTE"],
      },
    };
    const sealed = await sealSession(sessionData);

    const req = new NextRequest("http://localhost:3000/teacher", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sealed}`,
      },
    });

    const res = await proxy(req, dummyEvent);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects authenticated users visiting /sign-in to their role destination", async () => {
    const adminSession: SessionData = {
      accessToken: "token-1",
      refreshToken: "token-2",
      expiresAt: Math.floor(Date.now() / 1000) + 900,
      user: {
        ldapUid: "adminuser",
        email: "admin@unmsm.edu.pe",
        name: "Admin User",
        role: "admin",
        institutionalRoles: ["ADMIN"],
      },
    };
    const sealed = await sealSession(adminSession);

    const req = new NextRequest("http://localhost:3000/sign-in", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sealed}`,
      },
    });

    const res = await proxy(req, dummyEvent);
    expect(res.headers.get("location")).toBe("http://localhost:3000/direction");
  });
});
