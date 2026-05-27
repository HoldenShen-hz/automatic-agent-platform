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

    expect(review).toContain("当前结论");
    expect(review).toContain("GAP-01");
    expect(review).toContain("GAP-02");
    expect(review).toContain("GAP-03");
    expect(review).toContain("npm --prefix ui run typecheck");
    expect(review).toContain("已闭环");
    expect(review).toContain("维护规则");
    expect(review).toContain("ui/apps/web/src/feature-registry.ts");
  });
});
