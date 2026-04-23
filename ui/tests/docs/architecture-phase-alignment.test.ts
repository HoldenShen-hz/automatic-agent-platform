import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ui architecture phase alignment", () => {
  it("captures the repo baseline for phase 1-4 in the architecture doc", () => {
    const root = process.cwd();
    const doc = readFileSync(
      join(root, "../docs_zh/architecture/05-cross-platform-ui-architecture.md"),
      "utf8",
    );

    expect(doc).toContain("v3.2");
    expect(doc).toContain("仓内 Phase 1-4 对齐快照");
    expect(doc).toContain("Phase 1 — Web MVP");
    expect(doc).toContain("Phase 2 — 桌面端");
    expect(doc).toContain("Phase 3 — 移动端");
    expect(doc).toContain("Phase 4 — 增强功能");
  });
});
