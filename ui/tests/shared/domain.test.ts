import { describe, expect, it } from "vitest";
import { applyRedaction, createDomainUiConfig, createFeatureGuardContext, createRouteGuardChain, selectRedactionLevel } from "@aa/shared-domain";

describe("shared domain utilities", () => {
  it("creates route guards that reject missing permissions", () => {
    const guard = createRouteGuardChain("platform_sre");
    const result = guard.evaluate(createFeatureGuardContext({ permissions: ["authenticated"] }));

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("permission.missing");
  });

  it("applies summary and hidden redaction rules", () => {
    const policy = {
      rules: [
        { fieldPattern: "prompt", roleLevel: "L1", redactionLevel: "hidden" as const },
        { fieldPattern: "payload", roleLevel: "L2", redactionLevel: "summary" as const, summaryTemplate: "payload-summary" },
      ],
      defaultLevel: "visible" as const,
      piiFields: ["prompt"],
      auditOnAccess: true,
    };

    expect(applyRedaction(policy, "task.prompt", "L1", "secret prompt")).toBeUndefined();
    expect(applyRedaction(policy, "tool.payload", "L2", { a: 1 })).toBe("payload-summary");
    expect(selectRedactionLevel(policy, "tool.payload", "L2")).toBe("summary");
  });

  it("creates domain ui config defaults", () => {
    const config = createDomainUiConfig("legal");
    expect(config.domainId).toBe("legal");
    expect(config.defaultDrillDepth).toBe(2);
  });
});
