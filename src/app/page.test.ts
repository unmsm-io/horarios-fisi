import { describe, expect, it } from "bun:test";
import Home from "./page";

describe("Home page", () => {
  it("renders without throwing when unauthenticated", async () => {
    const result = await Home();
    expect(result).toBeDefined();
  });
});
