export const WEB_BUILD_TARGET = "es2022";
export const WEB_MINIFY_MODE = "esbuild";
export const WEB_CHUNK_WARNING_LIMIT_KB = 200;

function normalizeVendorChunkName(packagePath: string): string {
  return packagePath
    .replace(/^@/, "")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9_-]/gi, "-");
}

export function selectManualChunk(id: string): string | undefined {
  if (id.includes("node_modules/reactflow")) {
    return "flow-canvas";
  }
  if (id.includes("react-router-dom") || id.includes("/react/") || id.includes("/react-dom/")) {
    return "react";
  }
  if (id.includes("@tanstack/react-query") || id.includes("/zustand/")) {
    return "query";
  }
  if (id.includes("/packages/features/")) {
    const match = id.match(/\/packages\/features\/([^/]+)\//);
    if (match) {
      return `feature-${match[1]}`;
    }
    return "features-misc";
  }
  if (id.includes("node_modules/")) {
    const [, packagePath = "vendor"] = id.split("node_modules/");
    const segments = packagePath.split("/");
    const packageName = segments[0]?.startsWith("@")
      ? `${segments[0]}-${segments[1] ?? "pkg"}`
      : segments[0];
    return `vendor-${normalizeVendorChunkName(packageName ?? "vendor")}`;
  }
  return undefined;
}
