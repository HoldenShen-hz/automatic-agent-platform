import { DomainRecipeSchema, matchDomainRecipe, type DomainRecipe } from "./index.js";

export class RecipeRegistry {
  private readonly recipes = new Map<string, DomainRecipe>();

  public register(recipe: DomainRecipe): void {
    const parsed = DomainRecipeSchema.parse(recipe);
    this.recipes.set(parsed.recipeId, parsed);
  }

  public registerAll(recipes: readonly DomainRecipe[]): void {
    for (const recipe of recipes) {
      this.register(recipe);
    }
  }

  public get(recipeId: string): DomainRecipe | null {
    return this.recipes.get(recipeId) ?? null;
  }

  public list(): DomainRecipe[] {
    return [...this.recipes.values()];
  }

  public clear(): void {
    this.recipes.clear();
  }

  public has(recipeId: string): boolean {
    return this.recipes.has(recipeId);
  }

  public listByDomain(domainId: string): DomainRecipe[] {
    return this.list().filter((recipe) => recipe.domainId === domainId);
  }

  public findByTriggerPhrase(input: string): DomainRecipe | null {
    return matchDomainRecipe(this.list(), input);
  }
}
