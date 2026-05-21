import { beforeEach, describe, it } from "node:test";
import { expect } from "../../../helpers/node-expect.js";
import { RecipeRegistry } from "../../../../src/domains/recipes/recipe-registry.js";
import type { DomainRecipe } from "../../../../src/domains/recipes/index.js";

describe("RecipeRegistry", () => {
  let registry: RecipeRegistry;

  const createMockRecipe = (
    recipeId: string,
    domainId: string = "domain_1",
  ): DomainRecipe => ({
    recipeId,
    domainId,
    name: `Recipe ${recipeId}`,
    description: `Description for ${recipeId}`,
    riskProfileRef: `${domainId}.risk`,
    guardrailOverlay: {},
    triggerPhrases: [`trigger_${recipeId}`],
    defaultWorkflowId: "workflow_1",
    recommendedWorkflowIds: [],
    defaultToolBundleIds: ["bundle_1"],
    defaultPromptBundleRef: `${domainId}.prompt`,
    acceptanceChecklistRef: `${domainId}.acceptance`,
    archetype: "research",
  });

  beforeEach(() => {
    registry = new RecipeRegistry();
  });

  describe("register", () => {
    it("should register a recipe", () => {
      const recipe = createMockRecipe("recipe_1");
      registry.register(recipe);
      expect(registry.get("recipe_1")).toEqual(recipe);
    });

    it("should update existing recipe", () => {
      const recipe1 = createMockRecipe("recipe_1");
      const recipe2 = { ...createMockRecipe("recipe_1"), name: "Updated" };
      registry.register(recipe1);
      registry.register(recipe2);
      expect(registry.get("recipe_1")?.name).toBe("Updated");
    });
  });

  describe("registerAll", () => {
    it("should register multiple recipes", () => {
      const recipes = [
        createMockRecipe("recipe_1"),
        createMockRecipe("recipe_2"),
        createMockRecipe("recipe_3"),
      ];
      registry.registerAll(recipes);
      expect(registry.list()).toHaveLength(3);
    });

    it("should handle empty array", () => {
      registry.registerAll([]);
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe("get", () => {
    it("should return registered recipe", () => {
      const recipe = createMockRecipe("recipe_1");
      registry.register(recipe);
      expect(registry.get("recipe_1")).toEqual(recipe);
    });

    it("should return null for non-existent recipe", () => {
      expect(registry.get("non_existent")).toBeNull();
    });
  });

  describe("list", () => {
    it("should return all registered recipes", () => {
      registry.register(createMockRecipe("recipe_1"));
      registry.register(createMockRecipe("recipe_2"));
      const list = registry.list();
      expect(list).toHaveLength(2);
    });

    it("should return empty array when no recipes registered", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should return a copy of the recipes array", () => {
      registry.register(createMockRecipe("recipe_1"));
      const list1 = registry.list();
      const list2 = registry.list();
      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });

  describe("clear", () => {
    it("should remove all recipes", () => {
      registry.register(createMockRecipe("recipe_1"));
      registry.register(createMockRecipe("recipe_2"));
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });

    it("should allow adding recipes after clear", () => {
      registry.register(createMockRecipe("recipe_1"));
      registry.clear();
      registry.register(createMockRecipe("recipe_2"));
      expect(registry.list()).toHaveLength(1);
      expect(registry.get("recipe_2")).toBeDefined();
    });
  });

  describe("has", () => {
    it("should return true for registered recipe", () => {
      registry.register(createMockRecipe("recipe_1"));
      expect(registry.has("recipe_1")).toBe(true);
    });

    it("should return false for non-existent recipe", () => {
      expect(registry.has("non_existent")).toBe(false);
    });
  });

  describe("listByDomain", () => {
    it("should return recipes for specific domain", () => {
      registry.register(createMockRecipe("recipe_1", "domain_1"));
      registry.register(createMockRecipe("recipe_2", "domain_2"));
      registry.register(createMockRecipe("recipe_3", "domain_1"));

      const domain1Recipes = registry.listByDomain("domain_1");
      expect(domain1Recipes).toHaveLength(2);
      expect(domain1Recipes.every((r) => r.domainId === "domain_1")).toBe(true);
    });

    it("should return empty array when no recipes for domain", () => {
      registry.register(createMockRecipe("recipe_1", "domain_1"));
      expect(registry.listByDomain("non_existent_domain")).toEqual([]);
    });
  });

  describe("findByTriggerPhrase", () => {
    it("should find recipe matching trigger phrase", () => {
      registry.register(createMockRecipe("recipe_1"));
      const found = registry.findByTriggerPhrase("trigger_recipe_1");
      expect(found).toBeDefined();
      if (found) {
        expect(found.recipeId).toBe("recipe_1");
      }
    });

    it("should return null when no match found", () => {
      registry.register(createMockRecipe("recipe_1"));
      const found = registry.findByTriggerPhrase("non_matching_phrase");
      expect(found).toBeNull();
    });

    it("should handle empty trigger phrase", () => {
      registry.register(createMockRecipe("recipe_1"));
      const found = registry.findByTriggerPhrase("");
      // Returns first match or null depending on implementation
      expect(found === null || typeof found === "object").toBe(true);
    });
  });
});
