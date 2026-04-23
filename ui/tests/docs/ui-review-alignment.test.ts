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
    expect(review).toContain("200");
    expect(review).toContain("对外注册的 feature 路由");
    expect(review).toContain("27");
    expect(review).toContain("npm run test");
    expect(review).toContain("36/36");
    expect(review).toContain("本文件现在是 UI review 的权威版本");
  });
});
