import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ui review alignment", () => {
  it("captures the rewritten repository-truth review", () => {
    const root = process.cwd();
    const review = readFileSync(
      join(root, "../docs_zh/reviews/ui-design-vs-implementation-review.md"),
      "utf8",
    );

    expect(review).toContain("UIR0-UIR6");
    expect(review).toContain("TS/TSX 文件总数");
    expect(review).toContain("330");
    expect(review).toContain("对外注册的 feature 路由");
    expect(review).toContain("33");
    expect(review).toContain("npm test");
    expect(review).toContain("8.1 GAP 整改状态回写");
    expect(review).toContain("已完成闭环");
    expect(review).toContain("本文件为 UI review 权威版本");
    expect(review).toContain("GAP-01");
    expect(review).toContain("已完成");
    expect(review).toContain("FeatureWorkbenchPanel");
  });
});
