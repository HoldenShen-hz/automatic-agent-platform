import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const architectureDocPath = resolve(currentDir, "../../../docs_zh/architecture/05-cross-platform-ui-architecture.md");

describe("ui architecture phase alignment", () => {
  it("captures the repo baseline for phase 1-4 in the architecture doc", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("v4.3");
    expect(doc).toContain("仓内 Phase 1-4 对齐快照");
    expect(doc).toContain("Phase 1 — Web MVP");
    expect(doc).toContain("Phase 2 — 桌面端");
    expect(doc).toContain("Phase 3 — 移动端");
    expect(doc).toContain("Phase 4 — 增强功能");
    expect(doc).toContain("PlanGraphBundle");
    expect(doc).toContain("NodeAttemptReceipt");
  });
});
