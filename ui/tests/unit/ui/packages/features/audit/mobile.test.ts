import { describe, expect, it } from "vitest";
import { createAuditMobileCards } from "../../../../../../packages/features/audit/src/mobile/index";

describe("createAuditMobileCards", () => {
  it("keeps audit mobile copy aligned to live read-only backend coverage", () => {
    const cards = createAuditMobileCards();

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.title)).toEqual(["时间线", "证据", "主体轨迹"]);
    expect(cards.map((card) => card.subtitle)).toEqual([
      "回看配置与审批变更",
      "查看后端关联的证据上下文",
      "跟踪用户和代理动作",
    ]);
    expect(cards.some((card) => /导出|export/i.test(card.subtitle))).toBe(false);
  });
});
