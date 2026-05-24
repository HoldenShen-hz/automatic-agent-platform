import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preloadSource = readFileSync(
  new URL("../../../../../ui/apps/electron-win/src/preload.ts", import.meta.url),
  "utf8",
);
const mainSource = readFileSync(
  new URL("../../../../../ui/apps/electron-win/src/main.ts", import.meta.url),
  "utf8",
);

test("electron preload surface only exposes approved namespaces", () => {
  for (const fragment of [
    'openExternal: "shell:openExternal"',
    'minimize: "window:minimize"',
    'maximize: "window:maximize"',
    'open: "window:open"',
    'open: "deep-link:open"',
    'read: "secure-store:read"',
    'write: "secure-store:write"',
    'delete: "secure-store:delete"',
    'getAnalyticsConsent: "privacy:getAnalyticsConsent"',
    'setAnalyticsConsent: "privacy:setAnalyticsConsent"',
    'enableScreenSecurity: "privacy:enableScreenSecurity"',
  ]) {
    assert.equal(preloadSource.includes(fragment), true, `missing ${fragment}`);
  }

  for (const forbidden of ["shell:run", "shell:spawn", "files:read", "files:write"]) {
    assert.equal(preloadSource.includes(forbidden), false, `unexpected ${forbidden}`);
  }
});

test("installElectronBridge relies on contextBridge instead of mutating window", () => {
  assert.equal(preloadSource.includes("__AA_ELECTRON_CONTEXT_BRIDGE__"), true);
  assert.equal(preloadSource.includes('exposeInMainWorld("AA_ELECTRON", bridge)'), true);
  assert.equal(preloadSource.includes("__AA_ELECTRON__"), false);
});

test("every main-process channel is represented by the preload API contract", () => {
  const channelNames = [...mainSource.matchAll(/name: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(channelNames.length > 0, true);

  for (const channelName of channelNames) {
    assert.equal(
      preloadSource.includes(`"${channelName}"`),
      true,
      `preload surface is missing ${channelName}`,
    );
  }
});
