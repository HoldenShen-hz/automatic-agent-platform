// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createWebPlatformAdapter } from "@aa/shared-platform";
afterEach(() => {
    window.localStorage.clear();
});
describe("web platform security regressions", () => {
    it("stores secure values outside localStorage", async () => {
        const adapter = createWebPlatformAdapter();
        window.localStorage.clear();
        await adapter.writeSecureValue("token", "secret-value");
        expect(await adapter.readSecureValue("token")).toBe("secret-value");
        expect(window.localStorage.getItem("aa.secure.token")).toBeNull();
        expect(window.localStorage.length).toBe(0);
    });
    it("rejects unsafe window targets and local file keys", async () => {
        const adapter = createWebPlatformAdapter();
        window.localStorage.clear();
        await adapter.openWindow("javascript:alert(1)");
        await adapter.writeFile("../escape", "secret");
        expect(window.localStorage.length).toBe(0);
    });
});
