import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { POST as loginHandler } from "./login/route";
import { POST as logoutHandler } from "./logout/route";
import { POST as refreshHandler } from "./refresh/route";

describe("Auth API Route Handlers", () => {
  it("POST /api/auth/login rejects empty credentials with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "", password: "" }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Debes ingresar tu usuario y contraseña");
  });

  it("POST /api/auth/logout sets expired cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });

    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });

  it("POST /api/auth/refresh rejects when no session cookie exists with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
    });

    const res = await refreshHandler(req);
    expect(res.status).toBe(401);
  });
});
