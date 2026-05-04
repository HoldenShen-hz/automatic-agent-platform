import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DomainDefinitionSchema,
  WorkflowConfigSchema,
  ToolBundleConfigSchema,
  OutputContractConfigSchema,
  DomainCapabilityProfileSchema,
  PluginBindingSchema,
  type DomainDefinition,
} from "../../../../src/domains/registry/domain-model.js";

describe("DomainDefinitionSchema", () => {
  describe("valid domain definitions", () => {
    it("should parse a minimal valid domain definition", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain for unit testing",
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.domainId, "test-domain");
      assert.strictEqual(result.name, "Test Domain");
      assert.strictEqual(result.description, "A test domain for unit testing");
      assert.strictEqual(result.version, 1);
      assert.strictEqual(result.status, "draft");
    });

    it("should parse a fully configured domain definition", () => {
      const input: DomainDefinition = {
        domainId: "complete-domain",
        name: "Complete Domain",
        description: "A fully configured domain",
        version: 2,
        status: "active",
        workflows: [
          {
            workflowId: "workflow-1",
            name: "Test Workflow",
            triggerConditions: { type: "manual" },
            steps: [
              {
                stepName: "step-1",
                toolHints: ["tool-a", "tool-b"],
                modelHints: { preferredModel: "claude-3", temperature: 0.7 },
                outputSchema: { result: "string" },
                retryPolicy: { maxRetries: 3, backoffMs: 1000 },
                requiresReview: false,
                timeoutMs: 30000,
                dependsOn: [],
              },
            ],
          },
        ],
        toolBundles: [
          {
            bundleId: "bundle-1",
            tools: [
              { toolName: "read", enabled: true, configOverrides: {} },
              { toolName: "write", enabled: false, configOverrides: { mode: "append" } },
            ],
          },
        ],
        outputContracts: [
          {
            contractId: "contract-1",
            name: "Output Contract",
            schema: { field1: "string", field2: "number" },
            validationLevel: "strict",
          },
        ],
        promptOverrides: { system: "Custom system prompt" },
        capabilities: {
          supportedTaskTypes: ["code_generation", "text_analysis"],
          requiredTools: ["read", "write"],
          optionalTools: ["search"],
          modelPreferences: { preferredModel: "claude-3-sonnet" },
          budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 10 },
          securityLevel: "elevated",
        },
        externalAdapters: ["adapter-1", "adapter-2"],
        pluginBindings: [
          {
            bindingId: "binding-1",
            domainId: "complete-domain",
            pluginType: "retriever",
            pluginId: "plugin-retriever-1",
            priority: 1,
            enabled: true,
            config: {},
          },
        ],
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.domainId, "complete-domain");
      assert.strictEqual(result.workflows.length, 1);
      assert.strictEqual(result.workflows[0]!.steps.length, 1);
      assert.strictEqual(result.toolBundles.length, 1);
      assert.strictEqual(result.toolBundles[0]!.tools.length, 2);
      assert.strictEqual(result.outputContracts.length, 1);
      assert.strictEqual(result.pluginBindings.length, 1);
      assert.strictEqual(result.capabilities.securityLevel, "elevated");
    });

    it("should apply default values", () => {
      const input = {
        domainId: "minimal-domain",
        name: "Minimal Domain",
        description: "Minimal domain with defaults",
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.version, 1);
      assert.strictEqual(result.status, "draft");
      assert.deepStrictEqual(result.workflows, []);
      assert.deepStrictEqual(result.toolBundles, []);
      assert.deepStrictEqual(result.outputContracts, []);
      assert.deepStrictEqual(result.promptOverrides, {});
      assert.deepStrictEqual(result.capabilities.supportedTaskTypes, []);
      assert.strictEqual(result.capabilities.securityLevel, "standard");
    });
  });

  describe("invalid domain definitions", () => {
    it("should reject empty domainId", () => {
      const input = {
        domainId: "",
        name: "Test Domain",
        description: "A test domain",
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /domainId.*empty|minimum.*1/,
      );
    });

    it("should reject empty name", () => {
      const input = {
        domainId: "test-domain",
        name: "",
        description: "A test domain",
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /name.*empty|minimum.*1/,
      );
    });

    it("should reject empty description", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "",
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /description.*empty|minimum.*1/,
      );
    });

    it("should reject negative version", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        version: -1,
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /greater than or equal to 0/i,
      );
    });

    it("should reject invalid status", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        status: "invalid-status",
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /Invalid enum value/i,
      );
    });

    it("should reject invalid security level", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        capabilities: {
          securityLevel: "invalid-level",
        },
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /Invalid enum value/i,
      );
    });

    it("should reject invalid plugin type", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        pluginBindings: [
          {
            bindingId: "binding-1",
            domainId: "test-domain",
            pluginType: "invalid-type",
            pluginId: "plugin-1",
          },
        ],
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /Invalid enum value/i,
      );
    });
  });

  describe("workflow schema validation", () => {
    it("should accept workflow with all step options", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        workflows: [
          {
            workflowId: "wf-1",
            name: "Workflow",
            triggerConditions: {},
            steps: [
              {
                stepName: "step-1",
                toolHints: ["tool-a"],
                modelHints: { preferredModel: "claude-3", temperature: 1.5 },
                outputSchema: { key: "value" },
                retryPolicy: { maxRetries: 5, backoffMs: 2000 },
                requiresReview: true,
                timeoutMs: 120000,
                dependsOn: ["other-step"],
              },
            ],
          },
        ],
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.workflows[0]!.steps[0]!.requiresReview, true);
      assert.strictEqual(result.workflows[0]!.steps[0]!.timeoutMs, 120000);
    });

    it("should reject invalid temperature in modelHints", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        workflows: [
          {
            workflowId: "wf-1",
            name: "Workflow",
            steps: [
              {
                stepName: "step-1",
                modelHints: { temperature: 5 }, // Invalid: must be 0-2
              },
            ],
          },
        ],
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /less than or equal to 2/i,
      );
    });

    it("should reject negative maxRetries in retryPolicy", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        workflows: [
          {
            workflowId: "wf-1",
            name: "Workflow",
            steps: [
              {
                stepName: "step-1",
                retryPolicy: { maxRetries: -1, backoffMs: 100 },
              },
            ],
          },
        ],
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /greater than 0/i,
      );
    });

    it("should reject non-positive timeoutMs", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        workflows: [
          {
            workflowId: "wf-1",
            name: "Workflow",
            steps: [
              {
                stepName: "step-1",
                timeoutMs: 0,
              },
            ],
          },
        ],
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /greater than 0/i,
      );
    });
  });

  describe("tool bundle schema validation", () => {
    it("should accept valid tool bundle entries", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        toolBundles: [
          {
            bundleId: "bundle-1",
            tools: [
              { toolName: "read", enabled: true, configOverrides: { timeout: 5000 } },
              { toolName: "write", enabled: false, configOverrides: {} },
            ],
          },
        ],
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.toolBundles[0]!.tools[0]!.toolName, "read");
      assert.strictEqual(result.toolBundles[0]!.tools[0]!.enabled, true);
    });

    it("should reject empty tool name", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        toolBundles: [
          {
            bundleId: "bundle-1",
            tools: [{ toolName: "" }],
          },
        ],
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /at least 1 character/i,
      );
    });

    it("should reject empty bundleId", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        toolBundles: [
          {
            bundleId: "",
            tools: [{ toolName: "read" }],
          },
        ],
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /at least 1 character/i,
      );
    });
  });

  describe("output contract schema validation", () => {
    it("should accept valid output contract", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        outputContracts: [
          {
            contractId: "contract-1",
            name: "Test Contract",
            schema: { field1: "string", field2: "number" },
            validationLevel: "strict",
          },
        ],
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.outputContracts[0]!.contractId, "contract-1");
      assert.strictEqual(result.outputContracts[0]!.validationLevel, "strict");
    });

    it("should accept lenient validation level", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        outputContracts: [
          {
            contractId: "contract-1",
            name: "Test Contract",
            validationLevel: "lenient",
          },
        ],
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.outputContracts[0]!.validationLevel, "lenient");
    });

    it("should accept none validation level", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        outputContracts: [
          {
            contractId: "contract-1",
            name: "Test Contract",
            validationLevel: "none",
          },
        ],
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.outputContracts[0]!.validationLevel, "none");
    });

    it("should reject invalid validation level", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        outputContracts: [
          {
            contractId: "contract-1",
            name: "Test Contract",
            validationLevel: "invalid",
          },
        ],
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /Invalid enum value/i,
      );
    });
  });

  describe("capabilities schema validation", () => {
    it("should accept valid capability profile", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        capabilities: {
          supportedTaskTypes: ["code_generation", "text_analysis"],
          requiredTools: ["read", "write"],
          optionalTools: ["search", "edit"],
          modelPreferences: { preferredModel: "claude-3-sonnet" },
          budgetLimits: { maxTokensPerTask: 16000, maxCostPerTask: 20 },
          securityLevel: "restricted",
        },
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.capabilities.securityLevel, "restricted");
      assert.strictEqual(result.capabilities.budgetLimits.maxTokensPerTask, 16000);
    });

    it("should reject negative maxTokensPerTask", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        capabilities: {
          budgetLimits: { maxTokensPerTask: -100, maxCostPerTask: 5 },
        },
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /greater than or equal to 0/i,
      );
    });

    it("should reject negative maxCostPerTask", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        capabilities: {
          budgetLimits: { maxTokensPerTask: 4000, maxCostPerTask: -1 },
        },
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /greater than or equal to 0/i,
      );
    });

    it("should reject invalid security level", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        capabilities: {
          securityLevel: "super-secure",
        },
      };

      assert.throws(
        () => DomainDefinitionSchema.parse(input),
        /Invalid enum value/i,
      );
    });
  });

  describe("plugin binding schema validation", () => {
    it("should accept valid plugin bindings for all types", () => {
      const pluginTypes = [
        ["retriever", "retriever"],
        ["validator", "evaluator"],
        ["planner", "tool"],
        ["presenter", "tool"],
        ["adapter", "adapter"],
      ] as const;

      for (const [pluginType, expected] of pluginTypes) {
        const input = {
          domainId: "test-domain",
          name: "Test Domain",
          description: "A test domain",
          pluginBindings: [
            {
              bindingId: `binding-${pluginType}`,
              domainId: "test-domain",
              pluginType,
              pluginId: `plugin-${pluginType}-1`,
              priority: 10,
              enabled: true,
              config: { key: "value" },
            },
          ],
        };

        const result = DomainDefinitionSchema.parse(input);

        assert.strictEqual(result.pluginBindings[0]!.pluginType, expected);
      }
    });

    it("should apply default priority and enabled values", () => {
      const input = {
        domainId: "test-domain",
        name: "Test Domain",
        description: "A test domain",
        pluginBindings: [
          {
            bindingId: "binding-1",
            domainId: "test-domain",
            pluginType: "retriever",
            pluginId: "plugin-1",
          },
        ],
      };

      const result = DomainDefinitionSchema.parse(input);

      assert.strictEqual(result.pluginBindings[0]!.priority, 0);
      assert.strictEqual(result.pluginBindings[0]!.enabled, true);
    });
  });
});
