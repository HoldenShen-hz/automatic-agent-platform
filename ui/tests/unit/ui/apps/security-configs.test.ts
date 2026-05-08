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
    expect(readFileSync(electronRendererPath, "utf8")).toContain("Automatic Agent Platform Electron Shell");
  });

  it("tauri macos config enables the security section and CSP", () => {
    const config = readJson(tauriMacosConfigPath);
    const security = config.security as Record<string, unknown>;
    const firstWindow = ((config.app as { windows?: Array<Record<string, unknown>> }).windows ?? [])[0] ?? {};

    expect(security.csp).toContain("default-src 'self'");
    expect(security.dangerousDisableAssetCspModification).toBe(false);
    expect(firstWindow.minWidth).toBe(1180);
    expect(firstWindow.minHeight).toBe(760);
  });

  it("tauri linux config enables the security section and CSP", () => {
    const config = readJson(tauriLinuxConfigPath);
    const security = config.security as Record<string, unknown>;

    expect(security.csp).toContain("default-src 'self'");
    expect(security.dangerousDisableAssetCspModification).toBe(false);
  });
});
