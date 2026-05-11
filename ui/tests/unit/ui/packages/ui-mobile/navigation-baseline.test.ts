import { describe, expect, it } from "vitest";

import { mobileNavigationBaseline } from "../../../../../packages/ui-mobile/src/navigation";

describe("mobileNavigationBaseline", () => {
  it("keeps conversation in the shared mobile tab baseline", () => {
    expect(mobileNavigationBaseline.map((item) => item.tab)).toEqual([
      "dashboard",
      "tasks",
      "workflow-cockpit",
      "approvals",
      "conversation",
      "settings",
    ]);
  });
});
