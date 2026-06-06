import { describe, expect, it } from "vitest";
import { createComplianceMobileCards } from "../../../../../../packages/features/compliance/src/mobile/index";

describe("createComplianceMobileCards", () => {
  it("uses descriptive contract-safe copy instead of hard-coded fake live metrics", () => {
    const cards = createComplianceMobileCards();

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.title)).toEqual(["标准框架", "审计事件", "例外批准率"]);
    expect(cards.map((card) => card.subtitle)).toEqual([
      "后端策略注册表覆盖情况",
      "近期治理活动动态",
      "已审例外的批准比例",
    ]);
    expect(cards.some((card) => /\d+%|\d+ 个/.test(card.subtitle))).toBe(false);
  });
});
