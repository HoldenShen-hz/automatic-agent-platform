import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ui docs alignment", () => {
  it("documents UI0-UI7 in both zh and en todolists", () => {
    const root = process.cwd();
    const zh = readFileSync(join(root, "../docs_zh/operations/current_todo_list.md"), "utf8");
    const en = readFileSync(join(root, "../docs_en/operations/current_todo_list.md"), "utf8");

    for (const key of ["UI0", "UI1", "UI2", "UI3", "UI4", "UI5", "UI6", "UI7"]) {
      expect(zh).toContain(key);
      expect(en).toContain(key);
    }
  });

  it("documents Phase 1-4 alignment in both zh and en todolists", () => {
    const root = process.cwd();
    const zh = readFileSync(join(root, "../docs_zh/operations/current_todo_list.md"), "utf8");
    const en = readFileSync(join(root, "../docs_en/operations/current_todo_list.md"), "utf8");

    for (const key of ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]) {
      expect(zh).toContain(key);
      expect(en).toContain(key);
    }
  });
});
