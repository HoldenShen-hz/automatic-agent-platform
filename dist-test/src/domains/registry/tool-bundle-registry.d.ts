import type { ToolBundleConfig } from "./domain-model.js";
export declare class ToolBundleRegistry {
    private readonly bundles;
    registerAll(bundles: readonly ToolBundleConfig[]): void;
    get(bundleId: string): ToolBundleConfig | null;
    list(): ToolBundleConfig[];
}
