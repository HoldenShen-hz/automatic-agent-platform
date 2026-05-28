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
  it("disables source maps for production builds to keep SRI deterministic", async () => {
    const config = await viteConfig({ command: "build", mode: "production", isSsrBuild: false, isPreview: false });
    expect(config.build?.sourcemap).toBe(false);
  });

  it("keeps source maps enabled outside production", async () => {
    const config = await viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false });
    expect(config.build?.sourcemap).toBe(true);
  });

  it("uses stable localhost ports for dev and preview", async () => {
    const config = await viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false });
    expect(config.server).toMatchObject({
      host: "localhost",
      port: 5173,
      strictPort: true,
    });
    expect(config.preview).toMatchObject({
      host: "localhost",
      port: 4173,
      strictPort: true,
    });
  });

  it("emits deployable CSP headers and serves them in preview/dev middleware", async () => {
    const originalApiBaseUrl = process.env.VITE_API_BASE_URL;
    const originalWsUrl = process.env.VITE_WS_URL;
    const originalOtlpEndpoint = process.env.VITE_OTLP_ENDPOINT;
    process.env.VITE_API_BASE_URL = "https://api.example.com";
    process.env.VITE_WS_URL = "wss://ws.example.com";
    process.env.VITE_OTLP_ENDPOINT = "https://otel.example.com/v1/logs";
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
    expect(headers.get("Content-Security-Policy")).toContain("worker-src 'self' blob:");
    expect(headers.get("Content-Security-Policy")).toContain("connect-src 'self' https://api.example.com wss://ws.example.com https://otel.example.com");
    expect(headers.has("Report-To")).toBe(false);

    process.env.VITE_API_BASE_URL = originalApiBaseUrl;
    process.env.VITE_WS_URL = originalWsUrl;
    process.env.VITE_OTLP_ENDPOINT = originalOtlpEndpoint;
  });
});
