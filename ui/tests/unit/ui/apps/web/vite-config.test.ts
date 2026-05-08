import { describe, expect, it } from "vitest";

import viteConfig from "../../../../../apps/web/vite.config";

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
    const plugin = config.plugins?.find((candidate) => candidate?.name === "csp-headers");
    expect(plugin).toBeDefined();

    const emittedAssets: Array<{ fileName: string; source: string }> = [];
    plugin?.generateBundle?.call(
      {
        emitFile(asset: { fileName: string; source: string }) {
          emittedAssets.push(asset);
          return asset.fileName;
        },
      },
      {},
      {},
    );

    expect(emittedAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "_headers",
          source: expect.stringContaining("Content-Security-Policy"),
        }),
      ]),
    );

    const middlewareCalls: Array<(req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => void> = [];
    plugin?.configurePreviewServer?.({
      middlewares: {
        use(handler) {
          middlewareCalls.push(handler);
        },
      },
    });
    const headers = new Map<string, string>();
    middlewareCalls[0]?.(
      {},
      {
        setHeader(name: string, value: string) {
          headers.set(name, value);
        },
      },
      () => undefined,
    );

    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Report-To")).toContain("csp-endpoint");
  });
});
