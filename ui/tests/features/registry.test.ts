import { describe, expect, it } from "vitest";
import { featureRegistry } from "../../apps/web/src/feature-registry";

describe("feature registry", () => {
  it("registers all implemented and planned features", () => {
    expect(featureRegistry.length).toBe(27);
    expect(featureRegistry.some((feature) => feature.manifest.id === "dashboard")).toBe(true);
    expect(featureRegistry.some((feature) => feature.manifest.id === "workflow-builder" && feature.manifest.kind === "planned")).toBe(true);
    expect(featureRegistry.some((feature) => feature.manifest.id === "policy")).toBe(true);
    expect(featureRegistry.some((feature) => feature.manifest.id === "workers")).toBe(true);
  });

  it("keeps route paths unique", () => {
    const paths = featureRegistry.map((feature) => feature.route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
