import test from "node:test";
import assert from "node:assert/strict";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";

test("DomainRegistryService rejects path-like tool bundle entries", () => {
  const service = new DomainRegistryService();
  assert.throws(
    () =>
      service.register({
        domainId: "bad_domain",
        name: "Bad",
        description: "Bad domain",
        version: 1,
        workflows: [],
        toolBundles: [
          {
            bundleId: "bad-tools",
            tools: [{ toolName: "../escape", enabled: true, configOverrides: {} }],
          },
        ],
        outputContracts: [],
        promptOverrides: {},
        capabilities: {
          supportedTaskTypes: [],
          requiredTools: [],
          optionalTools: [],
          modelPreferences: {},
          budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
          securityLevel: "standard",
        },
        status: "draft",
        externalAdapters: [],
        pluginBindings: [],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "domain_registry.invalid_tool_bundle",
  );
});
