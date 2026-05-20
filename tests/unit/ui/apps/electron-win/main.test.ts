/**
 * Unit tests for electron-win/main.ts
 *
 * Tests the current hardened bridge baseline:
 * - shell execution channels remain removed
 * - unrestricted file IO channels remain removed
 *
 * @see ui/apps/electron-win/src/main.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

function getChannelNames(
  channels: ReadonlyArray<{ name: string; tier: string; permission: string }>,
): string[] {
  return channels.map((channel) => channel.name);
}

test.describe("electron-win main module structure", () => {
  test("main module exports electronMainBaseline", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.ok(main.electronMainBaseline !== undefined);
  });

  test("main module exports electronBridgeCapabilities", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.ok(main.electronBridgeCapabilities !== undefined);
  });
});

test.describe("electronMainBaseline security configuration", () => {
  test("has security.contextIsolation enabled", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronMainBaseline.security.contextIsolation, true);
  });

  test("has security.nodeIntegration disabled", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronMainBaseline.security.nodeIntegration, false);
  });

  test("has security.sandbox enabled", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronMainBaseline.security.sandbox, true);
  });

  test("window dimensions are properly configured", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronMainBaseline.window.width, 1440);
    assert.equal(main.electronMainBaseline.window.height, 960);
    assert.equal(main.electronMainBaseline.window.minWidth, 1180);
    assert.equal(main.electronMainBaseline.window.minHeight, 760);
  });
});

test.describe("IPC channels configuration", () => {
  test("shell:openExternal is in channels list", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(channelNames.includes("shell:openExternal"));
  });

  test("Issue #2162: shell:run and shell:spawn remain removed", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(!channelNames.includes("shell:run"));
    assert.ok(!channelNames.includes("shell:spawn"));
  });

  test("files:read remains removed", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(!channelNames.includes("files:read"));
  });

  test("files:write remains removed", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(!channelNames.includes("files:write"));
  });

  test("Issue #2165: unrestricted file channels stay disabled", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(!channelNames.includes("files:read"));
    assert.ok(!channelNames.includes("files:write"));
  });

  test("window control channels are present", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(channelNames.includes("window:minimize"));
    assert.ok(channelNames.includes("window:maximize"));
    assert.ok(channelNames.includes("window:open"));
  });

  test("deep-link channel is present", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(channelNames.includes("deep-link:open"));
  });

  test("secure-store channels are present", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(channelNames.includes("secure-store:read"));
    assert.ok(channelNames.includes("secure-store:write"));
    assert.ok(channelNames.includes("secure-store:delete"));
  });

  test("privacy channels are present", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const channelNames = getChannelNames(main.electronMainBaseline.channels);
    assert.ok(channelNames.includes("privacy:getAnalyticsConsent"));
    assert.ok(channelNames.includes("privacy:setAnalyticsConsent"));
    assert.ok(channelNames.includes("privacy:enableScreenSecurity"));
  });

  test("channel descriptors retain hardened permission metadata", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.deepEqual(main.electronMainBaseline.channels, [
      { name: "shell:openExternal", tier: "restricted", permission: "external-link:open" },
      { name: "window:minimize", tier: "trusted-ui", permission: "window:control" },
      { name: "window:maximize", tier: "trusted-ui", permission: "window:control" },
      { name: "window:open", tier: "trusted-ui", permission: "window:spawn" },
      { name: "deep-link:open", tier: "trusted-ui", permission: "deep-link:open" },
      { name: "secure-store:read", tier: "restricted", permission: "secure-store:read" },
      { name: "secure-store:write", tier: "restricted", permission: "secure-store:write" },
      { name: "secure-store:delete", tier: "restricted", permission: "secure-store:delete" },
      { name: "privacy:getAnalyticsConsent", tier: "trusted-ui", permission: "privacy:read" },
      { name: "privacy:setAnalyticsConsent", tier: "trusted-ui", permission: "privacy:write" },
      { name: "privacy:enableScreenSecurity", tier: "restricted", permission: "privacy:screen-security" },
    ]);
  });
});

test.describe("electronBridgeCapabilities", () => {
  test("has secureStore capability", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.secureStore, true);
  });

  test("has filesystem capability", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.filesystem, true);
  });

  test("shell capability remains disabled", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.shell, false);
  });

  test("has deepLink capability", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.deepLink, true);
  });

  test("process capability remains disabled", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.process, false);
  });

  test("has analyticsConsent capability", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.analyticsConsent, true);
  });

  test("has screenSecurity capability", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.screenSecurity, true);
  });

  test("has lifecycle capability", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    assert.equal(main.electronBridgeCapabilities.lifecycle, true);
  });
});

test.describe("Security verification", () => {
  test("All channels in baseline are also in capabilities where applicable", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const baseline = main.electronMainBaseline;
    const channelNames = getChannelNames(baseline.channels);

    // Only openExternal remains available from the shell surface.
    const shellChannels = channelNames.filter((ch) => ch.startsWith("shell:"));
    assert.deepEqual(shellChannels, ["shell:openExternal"]);

    // Direct file read/write channels remain removed until scoped allowlists exist.
    const filesChannels = channelNames.filter((ch) => ch.startsWith("files:"));
    assert.equal(filesChannels.length, 0);
  });

  test("Security defaults are safe (contextIsolation on, nodeIntegration off)", async () => {
    const main = await import("../../../../../ui/apps/electron-win/src/main.js");
    const security = main.electronMainBaseline.security;

    assert.equal(security.contextIsolation, true, "contextIsolation should be enabled");
    assert.equal(security.nodeIntegration, false, "nodeIntegration should be disabled");
    assert.equal(security.sandbox, true, "sandbox should be enabled");
  });
});
