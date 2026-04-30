/**
 * Unit tests for tauri-linux/lib.ts (src/index.ts)
 *
 * Tests the following security fixes:
 * - Issue #2172: DesktopShellManifest missing updateChannel
 *
 * @see ui/apps/tauri-linux/src/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

test.describe("tauri-linux module structure", () => {
  test("module exports tauriLinuxManifest", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.ok(lib.tauriLinuxManifest !== undefined);
  });

  test("module exports createTauriLinuxAdapter function", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.equal(typeof lib.createTauriLinuxAdapter, "function");
  });

  test("module exports createTauriLinuxDefaultAdapter function", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.equal(typeof lib.createTauriLinuxDefaultAdapter, "function");
  });
});

test.describe("tauriLinuxManifest structure", () => {
  test("has correct platform value", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.equal(lib.tauriLinuxManifest.platform, "linux");
  });

  test("has correct runtime value", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.equal(lib.tauriLinuxManifest.runtime, "tauri");
  });

  test("has supportsBackgroundAgent enabled", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.equal(lib.tauriLinuxManifest.supportsBackgroundAgent, true);
  });

  test("Issue #2172: updateChannel should exist but is MISSING", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    // Issue #2172: DesktopShellManifest for linux is missing updateChannel
    // Compare with tauri-macos which has updateChannel
    const fs = await import("node:fs");

    const linuxSource = fs.readFileSync(
      "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-linux/src/index.ts",
      "utf-8",
    );

    const macosSource = fs.readFileSync(
      "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-macos/src/index.ts",
      "utf-8",
    );

    const linuxHasUpdateChannel = linuxSource.includes("updateChannel");
    const macosHasUpdateChannel = macosSource.includes("updateChannel");

    // Document the discrepancy
    if (!linuxHasUpdateChannel && macosHasUpdateChannel) {
      console.warn("[Issue #2172] tauri-linux manifest is missing updateChannel field");
    }

    // The manifest should have updateChannel like tauri-macos does
    assert.equal(linuxHasUpdateChannel, macosHasUpdateChannel,
      "tauri-linux should have updateChannel like tauri-macos");
  });
});

test.describe("createTauriLinuxAdapter function", () => {
  test("accepts base PlatformAdapter parameter", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.equal(typeof lib.createTauriLinuxAdapter, "function");
  });

  test("returns PlatformAdapter with platform set to linux", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    const mockBase: any = { platform: "unknown" };
    const result = lib.createTauriLinuxAdapter(mockBase);
    assert.equal(result.platform, "linux");
  });

  test("preserves other PlatformAdapter properties", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    const mockBase: any = { platform: "unknown", otherProp: "value" };
    const result = lib.createTauriLinuxAdapter(mockBase);
    assert.equal(result.platform, "linux");
    assert.equal((result as any).otherProp, "value");
  });
});

test.describe("createTauriLinuxDefaultAdapter function", () => {
  test("is a function", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    assert.equal(typeof lib.createTauriLinuxDefaultAdapter, "function");
  });

  test("returns a PlatformAdapter", async () => {
    const lib = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    const result = lib.createTauriLinuxDefaultAdapter();
    assert.ok(result !== undefined);
    assert.ok(result.platform !== undefined);
  });
});

test.describe("Comparison with tauri-macos", () => {
  test("Both DesktopShellManifests should have similar structure", async () => {
    const linux = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    const macos = await import("../../../../../../ui/apps/tauri-macos/src/index.js");

    // Both should have platform, runtime
    assert.equal(linux.tauriLinuxManifest.platform, "linux");
    assert.equal(macos.tauriMacosManifest.platform, "macos");
    assert.equal(linux.tauriLinuxManifest.runtime, "tauri");
    assert.equal(macos.tauriMacosManifest.runtime, "tauri");

    // Both should have updateChannel for consistency
    assert.ok(macos.tauriMacosManifest.updateChannel !== undefined);
    // Issue #2172: linux is missing updateChannel
  });

  test("Both should support similar capabilities for parity", async () => {
    const linux = await import("../../../../../../ui/apps/tauri-linux/src/index.js");
    const macos = await import("../../../../../../ui/apps/tauri-macos/src/index.js");

    // macos has supportsDeepLink, linux has supportsBackgroundAgent
    // These are platform-specific capabilities, so differences are expected
    assert.equal(typeof macos.tauriMacosManifest.supportsDeepLink, "boolean");
    assert.equal(typeof linux.tauriLinuxManifest.supportsBackgroundAgent, "boolean");
  });
});

test.describe("Package.json verification", () => {
  test("tauri-linux package.json is valid", async () => {
    const fs = await import("node:fs");
    const packagePath = "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-linux/package.json";
    const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

    assert.ok(packageJson.name !== undefined);
    assert.equal(packageJson.name, "@aa/tauri-linux");
    assert.ok(packageJson.version !== undefined);
    assert.ok(packageJson.scripts !== undefined);
    assert.ok(packageJson.scripts.smoke !== undefined);
  });
});
