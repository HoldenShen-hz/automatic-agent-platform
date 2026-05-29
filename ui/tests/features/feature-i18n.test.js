import { afterEach, describe, expect, it } from "vitest";
import { getSharedTranslationService, resetSharedTranslationService, translateFeatureCopy } from "../../packages/shared/i18n/src";
afterEach(() => {
    resetSharedTranslationService();
});
describe("feature i18n coverage", () => {
    it("returns translated feature manifest copy from the shared catalog", () => {
        getSharedTranslationService().setLocale("zh-CN");
        expect(translateFeatureCopy("dashboard").title).toBe("总览驾驶舱");
        expect(translateFeatureCopy("settings").title).toBe("设置中心");
        expect(translateFeatureCopy("feature-flags").summary).toContain("功能开关");
    });
});
