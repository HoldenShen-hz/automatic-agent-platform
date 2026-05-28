import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../../../../");
const electronIndexHtmlPath = resolve(repoRoot, "ui/apps/electron-win/index.html");
const electronRendererPath = resolve(repoRoot, "ui/apps/electron-win/src/renderer.js");
const tauriMacosConfigPath = resolve(repoRoot, "ui/apps/tauri-macos/src-tauri/tauri.conf.json");
const tauriLinuxConfigPath = resolve(repoRoot, "ui/apps/tauri-linux/src-tauri/tauri.conf.json");
const webViteConfigPath = resolve(repoRoot, "ui/apps/web/vite.config.ts");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("desktop shell security configs", () => {
  it("electron shell html declares a CSP baseline", () => {
    const html = readFileSync(electronIndexHtmlPath, "utf8");

    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'self'");
    expect(html).toContain("frame-ancestors 'none'");
    expect(html).toContain('<script type="module" src="./src/renderer.js"></script>');
    expect(readFileSync(electronRendererPath, "utf8")).toContain("Automatic Agent Platform Electron");
  });

  it("tauri macos config enables the security section and CSP", () => {
    const config = readJson(tauriMacosConfigPath);
    const security = config.security as Record<string, unknown>;
    const plugins = config.plugins as Record<string, unknown>;
    const firstWindow = ((config.app as { windows?: Array<Record<string, unknown>> }).windows ?? [])[0] ?? {};

    expect(security.csp).toContain("default-src 'self'");
    expect(security.csp).toContain("worker-src 'self'");
    expect(security.dangerousDisableAssetCspModification).toBe(false);
    expect(firstWindow.minWidth).toBe(1180);
    expect(firstWindow.minHeight).toBe(760);
    expect((plugins.updater as Record<string, unknown>).active).toBe(false);
    expect((plugins.shell as Record<string, unknown>).open).toBe(false);
  });

  it("tauri linux config enables the security section and CSP", () => {
    const config = readJson(tauriLinuxConfigPath);
    const security = config.security as Record<string, unknown>;
    const plugins = config.plugins as Record<string, unknown>;

    expect(security.csp).toContain("default-src 'self'");
    expect(security.csp).toContain("worker-src 'self'");
    expect(security.dangerousDisableAssetCspModification).toBe(false);
    expect((plugins.updater as Record<string, unknown>).active).toBe(false);
    expect((plugins.notification as Record<string, unknown>).all).toBe(false);
  });

  it("R12-29 CSP does not contain unsafe-inline for styles", () => {
    const webViteSource = readFileSync(webViteConfigPath, "utf8");
    const electronHtml = readFileSync(electronIndexHtmlPath, "utf8");
    const tauriMacosCsp = (readJson(tauriMacosConfigPath).security as Record<string, string>).csp;
    const tauriLinuxCsp = (readJson(tauriLinuxConfigPath).security as Record<string, string>).csp;

    expect(webViteSource).not.toContain("unsafe-inline");
    expect(electronHtml).not.toContain("unsafe-inline");
    expect(tauriMacosCsp).not.toContain("unsafe-inline");
    expect(tauriLinuxCsp).not.toContain("unsafe-inline");
  });

  it("injects SRI hashes into built web assets", () => {
    const webViteSource = readFileSync(webViteConfigPath, "utf8");

    expect(webViteSource).toContain('createHash("sha384")');
    expect(webViteSource).toContain("applySubresourceIntegrity(bundle");
    expect(webViteSource).toContain('integrity="${integrity}"');
    expect(webViteSource).toContain('crossorigin="anonymous"');
  });
});
