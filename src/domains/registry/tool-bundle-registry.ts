import type { ToolBundleConfig } from "./domain-model.js";

export class ToolBundleRegistry {
  private readonly bundles = new Map<string, ToolBundleConfig>();

  public registerAll(bundles: readonly ToolBundleConfig[]): void {
    for (const bundle of bundles) {
      this.bundles.set(bundle.bundleId, bundle);
    }
  }

  public get(bundleId: string): ToolBundleConfig | null {
    return this.bundles.get(bundleId) ?? null;
  }

  public list(): ToolBundleConfig[] {
    return [...this.bundles.values()];
  }
}
