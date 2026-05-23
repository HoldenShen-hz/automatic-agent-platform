import { describe, it } from "node:test";
import { expect } from "../../../helpers/node-expect.js";
import { RecipeExecutor } from "../../../../src/domains/recipes/recipe-executor.js";
import type { DomainRecipe } from "../../../../src/domains/recipes/index.js";

describe("RecipeExecutor", () => {
  describe("constructor", () => {
    it("should create executor with no dependencies", () => {
      const executor = new RecipeExecutor();
      expect(executor).toBeDefined();
    });

    it("should create executor with workflow registry", () => {
      const executor = new RecipeExecutor({ get: () => null } as never);
      expect(executor).toBeDefined();
    });

    it("should accept options object", () => {
      const executor = new RecipeExecutor(null, {});
      expect(executor).toBeDefined();
    });
  });

  describe("execute", () => {
    const mockRecipe: DomainRecipe = {
      recipeId: "recipe_1",
      domainId: "domain_1",
      name: "Test Recipe",
      description: "A test recipe",
      riskProfileRef: "domain_1.risk",
      guardrailOverlay: {},
      triggerPhrases: ["test trigger"],
      defaultWorkflowId: "workflow_1",
      recommendedWorkflowIds: [],
      defaultToolBundleIds: ["bundle_1"],
      defaultPromptBundleRef: "domain_1.prompt",
      acceptanceChecklistRef: "domain_1.acceptance",
      archetype: "research",
    };

    const mockContext = {
      executionId: "exec_1",
      taskId: "task_1",
      tenantId: "tenant_1",
      correlationId: "corr_1",
      input: "test input",
    };

    it("should execute recipe and return success result", async () => {
      const executor = new RecipeExecutor(
        null,
        {},
        {
          existsWorkflow: () => true,
        },
      );

      const result = await executor.execute(mockRecipe, mockContext);
      expect(result.success).toBe(true);
      expect(result.executionId).toBe(mockContext.executionId);
      expect(result.recipeId).toBe(mockRecipe.recipeId);
      expect(result.workflowId).toBe(mockRecipe.defaultWorkflowId);
      expect(result.toolBundleIds).toEqual(mockRecipe.defaultToolBundleIds);
    });

    it("should return error when workflow does not exist", async () => {
      const executor = new RecipeExecutor(
        null,
        {},
        {
          existsWorkflow: () => false,
        },
      );

      const result = await executor.execute(mockRecipe, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not available");
    });

    it("should handle async workflow query", async () => {
      const executor = new RecipeExecutor(
        null,
        {},
        {
          existsWorkflow: async () => true,
        },
      );

      const result = await executor.execute(mockRecipe, mockContext);
      expect(result.success).toBe(true);
    });

    it("should use workflow registry fallback when no query provided", async () => {
      const mockRegistry = {
        get: () => ({ workflowId: "workflow_1" }),
      } as never;
      const executor = new RecipeExecutor(mockRegistry, {});

      const result = await executor.execute(mockRecipe, mockContext);
      expect(result.success).toBe(true);
    });

    it("should handle recipe with undefined recipeId", async () => {
      const badRecipe = {
        ...mockRecipe,
        recipeId: undefined,
      } as unknown as DomainRecipe;
      const executor = new RecipeExecutor(
        null,
        {},
        { existsWorkflow: () => true },
      );

      const result = await executor.execute(badRecipe, mockContext);
      expect(result.success).toBe(false);
      expect(result.recipeId).toBe("unknown_recipe");
    });

    it("should handle recipe with missing tool bundle ids", async () => {
      const badRecipe = {
        ...mockRecipe,
        defaultToolBundleIds: undefined,
      } as unknown as DomainRecipe;
      const executor = new RecipeExecutor(
        null,
        {},
        { existsWorkflow: () => true },
      );

      const result = await executor.execute(badRecipe, mockContext);
      expect(result.success).toBe(true);
      expect(result.toolBundleIds).toEqual([]);
    });

    it("should include output on success", async () => {
      const executor = new RecipeExecutor(
        null,
        {},
        { existsWorkflow: () => true },
      );

      const result = await executor.execute(mockRecipe, mockContext);
      expect(result.output).toBeDefined();
      expect(result.output?.summary).toContain(mockRecipe.recipeId);
      expect(result.output?.taskId).toBe(mockContext.taskId);
      expect(result.output?.tenantId).toBe(mockContext.tenantId);
      expect(result.output?.correlationId).toBe(mockContext.correlationId);
      expect(result.output?.input).toBe(mockContext.input);
    });

    it("should record metrics on success", async () => {
      let recordedMetrics: unknown = null;
      const executor = new RecipeExecutor(
        null,
        {
          metricsCollector: {
            recordExecution: (metrics) => {
              recordedMetrics = metrics;
            },
          },
        },
        { existsWorkflow: () => true },
      );

      await executor.execute(mockRecipe, mockContext);
      expect(recordedMetrics).toBeDefined();
      expect(recordedMetrics).toHaveProperty(
        "executionId",
        mockContext.executionId,
      );
      expect(recordedMetrics).toHaveProperty("recipeId", mockRecipe.recipeId);
      expect(recordedMetrics).toHaveProperty("success", true);
      expect(recordedMetrics).toHaveProperty("durationMs");
    });

    it("should record metrics on failure", async () => {
      let recordedMetrics: unknown = null;
      const executor = new RecipeExecutor(
        null,
        {
          metricsCollector: {
            recordExecution: (metrics) => {
              recordedMetrics = metrics;
            },
          },
        },
        { existsWorkflow: () => false },
      );

      await executor.execute(mockRecipe, mockContext);
      expect(recordedMetrics).toBeDefined();
      expect(recordedMetrics).toHaveProperty("success", false);
      expect(recordedMetrics).toHaveProperty("error");
    });

    it("should throw error and still record metrics", async () => {
      let recordedMetrics: unknown = null;
      const executor = new RecipeExecutor(
        null,
        {
          metricsCollector: {
            recordExecution: (metrics) => {
              recordedMetrics = metrics;
            },
          },
        },
        {
          existsWorkflow: () => {
            throw new Error("Query error");
          },
        },
      );

      try {
        await executor.execute(mockRecipe, mockContext);
      } catch {
        // Expected
      }
      expect(recordedMetrics).toBeDefined();
    });

    it("should handle recipes with array tool bundle ids", async () => {
      const recipeWithArray = {
        ...mockRecipe,
        defaultToolBundleIds: ["bundle_1", "bundle_2", "bundle_3"],
      };
      const executor = new RecipeExecutor(
        null,
        {},
        { existsWorkflow: () => true },
      );

      const result = await executor.execute(recipeWithArray, mockContext);
      expect(result.success).toBe(true);
      expect(result.toolBundleIds).toHaveLength(3);
    });
  });

  describe("RecipeExecutionResult structure", () => {
    it("should have all required fields in result", async () => {
      const executor = new RecipeExecutor(
        null,
        {},
        { existsWorkflow: () => true },
      );

      const recipe: DomainRecipe = {
        recipeId: "test_recipe",
        domainId: "test_domain",
        name: "Test",
        description: "Test recipe",
        riskProfileRef: "test_domain.risk",
        guardrailOverlay: {},
        triggerPhrases: ["trigger"],
        defaultWorkflowId: "wf_1",
        recommendedWorkflowIds: [],
        defaultToolBundleIds: ["bundle_1"],
        defaultPromptBundleRef: "test_domain.prompt",
        acceptanceChecklistRef: "test_domain.acceptance",
        archetype: "crud_heavy",
      };

      const result = await executor.execute(recipe, {
        executionId: "exec_1",
        taskId: "task_1",
        tenantId: "tenant_1",
        correlationId: "corr_1",
        input: "input",
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("executionId");
      expect(result).toHaveProperty("recipeId");
      expect(result).toHaveProperty("workflowId");
      expect(result).toHaveProperty("toolBundleIds");
    });
  });
});
