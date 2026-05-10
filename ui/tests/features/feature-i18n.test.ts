import { describe, expect, it } from "vitest";
import { translateFeatureCopy } from "../../packages/shared/i18n/src";

describe("feature i18n coverage", () => {
  it("returns translated feature manifest copy from the shared catalog", () => {
    expect(translateFeatureCopy("dashboard").title).toBe("总览驾驶舱");
    expect(translateFeatureCopy("settings").title).toBe("设置中心");
    expect(translateFeatureCopy("feature-flags").summary).toContain("功能开关");
  });
});
