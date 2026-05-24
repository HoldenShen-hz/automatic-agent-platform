import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../../../../ui/apps/electron-win/src/main.ts", import.meta.url),
  "utf8",
);

test("electron main baseline keeps hardened window defaults", () => {
  for (const fragment of [
    "width: 1440",
    "height: 960",
    "minWidth: 1180",
    "minHeight: 760",
    "contextIsolation: true",
    "nodeIntegration: false",
    "sandbox: true",
  ]) {
    assert.equal(source.includes(fragment), true, `missing ${fragment}`);
  }
});

test("electron main baseline only exposes approved IPC channels", () => {
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
    assert.equal(source.includes(`name: "${channel}"`), true, `missing ${channel}`);
  }

  for (const forbidden of ["shell:run", "shell:spawn", "files:read", "files:write"]) {
    assert.equal(source.includes(forbidden), false, `unexpected ${forbidden}`);
  }
});

test("electron bridge capabilities keep shell and process disabled", () => {
  for (const fragment of [
    "secureStore: true",
    "filesystem: true",
    "shell: false",
    "deepLink: true",
    "process: false",
    "analyticsConsent: true",
    "screenSecurity: true",
    "lifecycle: true",
  ]) {
    assert.equal(source.includes(fragment), true, `missing ${fragment}`);
  }
});

test("shell command allowlist stays explicit and minimal", () => {
  assert.equal(
    source.includes('new Set(["status", "health", "version"])'),
    true,
  );
});

test("main window forwards external links to the OS shell and denies popup ownership", () => {
  assert.equal(source.includes('mainWindow.webContents.setWindowOpenHandler(({ url }) => {'), true);
  assert.equal(source.includes("void shell.openExternal(url);"), true);
  assert.equal(source.includes('return { action: "deny" };'), true);
});

test("trusted desktop shortcuts remain bound to safe actions", () => {
  for (const shortcut of [
    '"CommandOrControl+K"',
    '"CommandOrControl+N"',
    '"Shift+CommandOrControl+D"',
    '"command-palette:open"',
    'openSecondaryWindow("/shared/settings")',
    'showPlatformNotification("Diagnostics", "Desktop diagnostics shortcut triggered")',
  ]) {
    assert.equal(source.includes(shortcut), true, `missing ${shortcut}`);
  }
});
