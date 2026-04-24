import { describe, expect, it } from "vitest";
import { createScenarioChecklist, findScenarioById } from "@aa/e2e";

describe("ui e2e tool catalog", () => {
  it("tracks concrete smoke scenarios with routes and expected titles", () => {
    const checklist = createScenarioChecklist();

    expect(checklist.length).toBeGreaterThanOrEqual(7);
    expect(checklist.every((item) => item.route.startsWith("/"))).toBe(true);
    expect(findScenarioById("approval-review")?.expectedTitle).toBe("Approval Center");
    expect(findScenarioById("hitl-intervention")?.route).toBe("/extended/hitl");
  });
});
