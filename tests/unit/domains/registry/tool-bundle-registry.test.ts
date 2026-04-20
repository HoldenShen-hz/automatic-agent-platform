import test from "node:test";
import assert from "node:assert/strict";

import { ToolBundleRegistry } from "../../../../src/domains/registry/tool-bundle-registry.js";
import type { ToolBundleConfig } from "../../../../src/domains/registry/domain-model.js";

function makeBundle(bundleId: string): ToolBundleConfig {
  return {
    bundleId,
    tools: [
      { toolName: "tool_read", enabled: true, configOverrides: {} },
      { toolName: "tool_write", enabled: true, configOverrides: {} },
    ],
  };
}

test("ToolBundleRegistry.registerAll stores multiple bundles", () => {
  const registry = new ToolBundleRegistry();
  registry.registerAll([makeBundle("bundle_a"), makeBundle("bundle_b")]);

  assert.equal(registry.list().length, 2);
});

test("ToolBundleRegistry.get returns bundle by id", () => {
  const registry = new ToolBundleRegistry();
  registry.registerAll([makeBundle("bundle_get")]);

  const result = registry.get("bundle_get");
  assert.ok(result !== null);
  assert.equal(result!.bundleId, "bundle_get");
});

test("ToolBundleRegistry.get returns null for unknown id", () => {
  const registry = new ToolBundleRegistry();
  assert.equal(registry.get("nonexistent"), null);
});

test("ToolBundleRegistry.list returns all bundles", () => {
  const registry = new ToolBundleRegistry();
  registry.registerAll([makeBundle("bundle_list_1"), makeBundle("bundle_list_2")]);

  const list = registry.list();
  assert.ok(list.length >= 2);
});

test("ToolBundleRegistry.list returns a copy", () => {
  const registry = new ToolBundleRegistry();
  registry.registerAll([makeBundle("bundle_copy")]);

  const list1 = registry.list();
  list1.push({} as never);

  const list2 = registry.list();
  assert.ok(list2.every((b) => b.bundleId !== undefined));
});

test("ToolBundleRegistry.registerAll overwrites existing bundle with same id", () => {
  const registry = new ToolBundleRegistry();
  registry.registerAll([makeBundle("bundle_dup")]);
  registry.registerAll([makeBundle("bundle_dup")]);

  assert.equal(registry.list().length, 1);
});
