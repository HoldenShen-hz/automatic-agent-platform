// @vitest-environment node
import { describe, expect, it } from "vitest";
import viteConfig from "../../../../../apps/web/vite.config";
import testTarget from "../../../../../test-target.json";
function flattenPlugins(plugins) {
    const resolved = plugins ?? [];
    const flattened = resolved.flatMap((plugin) => Array.isArray(plugin) ? plugin : [plugin]);
    return flattened.filter((plugin) => Boolean(plugin) && typeof plugin !== "boolean");
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
    it("uses shared target ports for dev and preview", async () => {
        const config = await viteConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false });
        expect(config.server).toMatchObject({
            host: testTarget.host,
            port: testTarget.port + 1000,
            strictPort: true,
        });
        expect(config.preview).toMatchObject({
            host: testTarget.host,
            port: testTarget.port,
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
        const emittedAssets = [];
        const generateBundle = (typeof plugin?.generateBundle === "function"
            ? plugin.generateBundle
            : plugin?.generateBundle?.handler);
        generateBundle?.call({
            emitFile(asset) {
                emittedAssets.push(asset);
                return asset.fileName;
            },
        }, {}, {}, false);
        expect(emittedAssets).toEqual(expect.arrayContaining([
            expect.objectContaining({
                fileName: "_headers",
                source: expect.stringContaining("Content-Security-Policy"),
            }),
        ]));
        const middlewareCalls = [];
        const configurePreviewServer = (typeof plugin?.configurePreviewServer === "function"
            ? plugin.configurePreviewServer
            : plugin?.configurePreviewServer?.handler);
        configurePreviewServer?.({
            middlewares: {
                use(handler) {
                    middlewareCalls.push(handler);
                },
            },
        });
        const headers = new Map();
        middlewareCalls[0]?.({}, {
            setHeader(name, value) {
                headers.set(name, value);
            },
        }, (() => undefined));
        expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
        expect(headers.get("Content-Security-Policy")).toContain("worker-src 'self' blob:");
        expect(headers.get("Content-Security-Policy")).toContain("connect-src 'self' https://api.example.com wss://ws.example.com https://otel.example.com");
        expect(headers.has("Report-To")).toBe(false);
        process.env.VITE_API_BASE_URL = originalApiBaseUrl;
        process.env.VITE_WS_URL = originalWsUrl;
        process.env.VITE_OTLP_ENDPOINT = originalOtlpEndpoint;
    });
});
