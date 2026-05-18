// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Connect, Plugin, PluginOption } from "vite";

import viteConfig from "../../../../../apps/web/vite.config";

function flattenPlugins(plugins: PluginOption[] | undefined): Plugin[] {
  const resolved = plugins ?? [];
  const flattened = resolved.flatMap((plugin) => Array.isArray(plugin) ? plugin : [plugin]);
  return flattened.filter((plugin): plugin is Plugin => Boolean(plugin) && typeof plugin !== "boolean");
}

describe("web vite config", () => {
  it("enables hidden source maps for production builds", async () => {
    const config = await viteConfig({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
    expect(config.build?.sourcemap).toBe("hidden");
  });

  it("keeps source maps enabled outside production", async () => {
    const config = await viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false });
    expect(config.build?.sourcemap).toBe(true);
  });

  it("emits deployable CSP headers and serves them in preview/dev middleware", async () => {
    const config = await viteConfig({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
    const plugin = flattenPlugins(config.plugins).find((candidate) => candidate.name === "csp-headers");
    expect(plugin).toBeDefined();

    const emittedAssets: Array<{ fileName: string; source: string }> = [];
    const generateBundle = (
      typeof plugin?.generateBundle === "function"
        ? plugin.generateBundle
        : plugin?.generateBundle?.handler
    ) as ((this: { emitFile(asset: { fileName: string; source: string }): string }, options: unknown, bundle: unknown, isWrite?: boolean) => unknown) | undefined;
    generateBundle?.call(
      {
        emitFile(asset: { fileName: string; source: string }) {
          emittedAssets.push(asset);
          return asset.fileName;
        },
      },
      {},
      {},
      false,
    );

    expect(emittedAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "_headers",
          source: expect.stringContaining("Content-Security-Policy"),
        }),
      ]),
    );

    const middlewareCalls: Connect.NextHandleFunction[] = [];
    const configurePreviewServer = (
      typeof plugin?.configurePreviewServer === "function"
        ? plugin.configurePreviewServer
        : plugin?.configurePreviewServer?.handler
    ) as
      | ((server: { middlewares: { use(handler: Connect.NextHandleFunction): void } }) => void)
      | undefined;
    configurePreviewServer?.({
      middlewares: {
        use(handler: Connect.NextHandleFunction) {
          middlewareCalls.push(handler);
        },
      },
    });
    const headers = new Map<string, string>();
    middlewareCalls[0]?.(
      {} as never,
      {
        setHeader(name: string, value: string) {
          headers.set(name, value);
        },
      } as never,
      (() => undefined) as never,
    );

    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Report-To")).toContain("csp-endpoint");
  });
});
