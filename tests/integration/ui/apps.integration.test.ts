import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveRepoPath } from "../../helpers/repo-root.js";

function read(relativePath: string): string {
  return readFileSync(resolveRepoPath(relativePath), "utf8");
}

test("desktop app manifests keep platform-specific exports and update channels aligned", () => {
  const electronIndex = read("ui/apps/electron-win/src/index.ts");
  const tauriMacosIndex = read("ui/apps/tauri-macos/src/index.ts");
  const tauriLinuxIndex = read("ui/apps/tauri-linux/src/index.ts");

  assert.match(electronIndex, /export const electronWinManifest/);
  assert.match(electronIndex, /platform:\s*"windows"/);
  assert.match(electronIndex, /updateChannel:\s*"stable"/);
  assert.match(tauriMacosIndex, /export const tauriMacosManifest/);
  assert.match(tauriMacosIndex, /platform:\s*"macos"/);
  assert.match(tauriLinuxIndex, /export const tauriLinuxManifest/);
  assert.match(tauriLinuxIndex, /platform:\s*"linux"/);
});

test("electron main and preload keep the secure IPC surface in sync", () => {
  const mainSource = read("ui/apps/electron-win/src/main.ts");
  const preloadSource = read("ui/apps/electron-win/src/preload.ts");

  for (const channel of [
    "shell:openExternal",
    "window:minimize",
    "window:maximize",
    "window:open",
    "deep-link:open",
    "secure-store:read",
    "secure-store:write",
    "secure-store:delete",
    "privacy:getAnalyticsConsent",
    "privacy:setAnalyticsConsent",
    "privacy:enableScreenSecurity",
  ]) {
    assert.ok(mainSource.includes(channel), `${channel} should stay registered in electron main`);
    assert.ok(preloadSource.includes(channel), `${channel} should stay exposed in preload`);
  }

  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(preloadSource, /export function installElectronBridge/);
});

test("web runtime and mobile shell keep current startup capabilities wired", () => {
  const webRuntime = read("ui/apps/web/src/runtime.ts");
  const mobileIndex = read("ui/apps/mobile/src/index.ts");

  assert.match(webRuntime, /export function createWebRuntimeConfig/);
  assert.match(webRuntime, /VITE_API_BASE_URL/);
  assert.match(webRuntime, /VITE_WS_URL/);
  assert.match(webRuntime, /export function createWebRuntimeClients/);
  assert.match(webRuntime, /createPersistentOfflineQueue/);
  assert.match(webRuntime, /BrowserWSClient/);

  assert.match(mobileIndex, /export const mobileShellManifest/);
  assert.match(mobileIndex, /platforms:\s*\["android", "ios"\]/);
  assert.match(mobileIndex, /supportsScreenSecurity:\s*true/);
  assert.match(mobileIndex, /export function createMobileAdapter/);
});

test("html and package assets preserve the expected security and packaging contracts", () => {
  const electronHtml = read("ui/apps/electron-win/index.html");
  const webHtml = read("ui/apps/web/index.html");
  const webViteConfig = read("ui/apps/web/vite.config.ts");
  const electronPackage = JSON.parse(read("ui/apps/electron-win/package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.ok(electronHtml.toLowerCase().includes("<!doctype html>"));
  assert.ok(electronHtml.includes('http-equiv="Content-Security-Policy"'));
  assert.ok(!webHtml.includes('http-equiv="Content-Security-Policy"'));
  assert.ok(!webHtml.includes('name="aa-csrf-token"'));
  assert.match(webViteConfig, /defineConfig/);
  assert.ok(
    "electron" in (electronPackage.dependencies ?? {})
      || "electron" in (electronPackage.devDependencies ?? {}),
  );
});
