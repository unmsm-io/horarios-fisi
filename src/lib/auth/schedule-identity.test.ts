import { describe, expect, it } from "bun:test";
import {
  isAppRole,
  localPreviewIdentity,
  resolveScheduleIdentity,
} from "./schedule-identity";

describe("schedule-identity", () => {
  it("validates app roles correctly", () => {
    expect(isAppRole("docente")).toBe(true);
    expect(isAppRole("direccion")).toBe(true);
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("other")).toBe(false);
  });

  it("returns preview identity when preview flag is true in dev", async () => {
    const identity = await resolveScheduleIdentity({ preview: true });
    expect(identity).not.toBeNull();
    expect(identity?.ldapUid).toBe("local-preview");
    expect(identity?.preview).toBe(true);
  });

  it("provides standard localPreviewIdentity", () => {
    const preview = localPreviewIdentity();
    expect(preview.ldapUid).toBe("local-preview");
    expect(preview.email).toBe("preview@unmsm.edu.pe");
    expect(preview.preview).toBe(true);
  });
});
