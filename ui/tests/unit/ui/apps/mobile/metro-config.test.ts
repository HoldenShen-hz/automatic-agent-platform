import { describe, expect, it } from "vitest";
import metroConfig from "../../../../../apps/mobile/metro.config.js";

const typedMetroConfig = metroConfig as {
  projectRoot: string;
  watchFolders: string[];
  resolver: {
    sourceExts: string[];
    nodeModulesPaths: string[];
    unstable_enablePackageExports?: boolean;
  };
};

describe("mobile metro config", () => {
  it("watches the workspace root so shared packages resolve inside the monorepo", () => {
    expect(typedMetroConfig.watchFolders.length).toBeGreaterThan(0);
    expect(typedMetroConfig.watchFolders.some((folder) => folder.endsWith("/ui"))).toBe(true);
  });

  it("searches both app-level and workspace-level node_modules", () => {
    expect(typedMetroConfig.resolver.nodeModulesPaths.some((folder) => folder.endsWith("/ui/apps/mobile/node_modules"))).toBe(true);
    expect(typedMetroConfig.resolver.nodeModulesPaths.some((folder) => folder.endsWith("/ui/node_modules"))).toBe(true);
    expect(typedMetroConfig.resolver.unstable_enablePackageExports).toBe(true);
  });
});
