import { describe, expect, it } from "vitest";
import { applyRedaction, createDomainUiConfig, createFeatureGuardContext, createRouteGuardChain, selectRedactionLevel } from "@aa/shared-domain";

describe("shared domain utilities", () => {
  it("creates route guards that reject missing permissions", () => {
    const guard = createRouteGuardChain("platform_sre");
    const result = guard.evaluate(createFeatureGuardContext({ permissions: ["authenticated"] }));

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("permission.missing");
  });

  it("evaluates five layers and blocks role or domain mismatches", () => {
    const roleGuard = createRouteGuardChain("platform_sre", undefined, {
      requiredRoles: ["admin"],
      featureFlag: "governance",
      featureId: "governance",
      allowedDomains: ["legal"],
    });
    const roleResult = roleGuard.evaluate(createFeatureGuardContext({
      permissions: ["authenticated", "platform_sre"],
      roles: ["operator"],
      featureFlags: { governance: true },
      featureVisibility: { governance: true },
      domainId: "legal",
    }));
    const domainResult = roleGuard.evaluate(createFeatureGuardContext({
      permissions: ["authenticated", "platform_sre"],
      roles: ["admin"],
      featureFlags: { governance: true },
      featureVisibility: { governance: true },
      domainId: "finance",
    }));

    expect(roleResult.allowed).toBe(false);
    expect(roleResult.reason).toContain("role.missing");
    expect(roleResult.evaluatedLayers).toEqual(["auth", "role"]);
    expect(domainResult.allowed).toBe(false);
    expect(domainResult.reason).toContain("domain.unauthorized");
    expect(domainResult.evaluatedLayers).toEqual(["auth", "role", "permission", "feature-flag", "domain"]);
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
