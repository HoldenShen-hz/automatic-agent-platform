import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith("/ui") ? join(cwd, "..") : cwd;
}

describe("ui docs alignment", () => {
  it("keeps both zh and en todolists pointed at the current authoritative review entry", () => {
    const root = resolveRepoRoot();
    const zh = readFileSync(join(root, "docs_zh/operations/current_todo_list.md"), "utf8");
    const en = readFileSync(join(root, "docs_en/operations/current_todo_list.md"), "utf8");

    for (const key of [
      "docs_zh/reviews/issues-table.md",
      "docs_zh/operations/archive/current_todo_list-history-2026-05-14.md",
    ]) {
      expect(zh).toContain(key);
      expect(en).toContain(key);
    }
  });

  it("documents the archive-oriented execution rules in both zh and en todolists", () => {
    const root = resolveRepoRoot();
    const zh = readFileSync(join(root, "docs_zh/operations/current_todo_list.md"), "utf8");
    const en = readFileSync(join(root, "docs_en/operations/current_todo_list.md"), "utf8");

    expect(zh).toContain("历史全量测试失败基线");
    expect(zh).toContain("当前执行规则");
    expect(en).toContain("Historical full test failure baseline");
    expect(en).toContain("Current Execution Rules");
  });

  it("documents the archived batch index in both zh and en todolists", () => {
    const root = resolveRepoRoot();
    const zh = readFileSync(join(root, "docs_zh/operations/current_todo_list.md"), "utf8");
    const en = readFileSync(join(root, "docs_en/operations/current_todo_list.md"), "utf8");

    for (const key of ["A1", "A9", "B7"]) {
      expect(zh).toContain(key);
      expect(en).toContain(key);
    }
    expect(zh).toContain("已归档");
    expect(en).toContain("Archived");
  });
});
