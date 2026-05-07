import { describe, expect, it } from "vitest";
import { createWebPlatformAdapter } from "@aa/shared-platform";

describe("web platform security regressions", () => {
  it("stores secure values outside localStorage", async () => {
    const adapter = createWebPlatformAdapter();
    window.localStorage.clear();

    await adapter.writeSecureValue("token", "secret-value");

    expect(await adapter.readSecureValue("token")).toBe("secret-value");
    expect(window.localStorage.getItem("aa.secure.token")).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});
