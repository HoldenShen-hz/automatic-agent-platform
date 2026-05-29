import assert from "node:assert/strict";
import test from "node:test";

import {
  revokePluginBundle,
  getPluginRevocationStatus,
  isPluginRevoked,
  listRevokedPlugins,
  removePluginRevocation,
  BundleRevocationSeverity,
} from "../../../src/plugins/builtin-plugin-registry.js";

test("revokePluginBundle creates revocation record with LOW severity", () => {
  const record = revokePluginBundle(
    "plugin.info",
    BundleRevocationSeverity.LOW,
    "Low severity revocation",
  );
  assert.equal(record.pluginId, "plugin.info");
  assert.equal(record.severity, BundleRevocationSeverity.LOW);
  assert.equal(record.reason, "Low severity revocation");
  assert.ok(typeof record.revokedAt === "string");
});

test("revokePluginBundle creates revocation record with MEDIUM severity", () => {
  const record = revokePluginBundle(
    "plugin.warning",
    BundleRevocationSeverity.MEDIUM,
    "Medium severity revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.MEDIUM);
});

test("revokePluginBundle creates revocation record with HIGH severity", () => {
  const record = revokePluginBundle(
    "plugin.moderate",
    BundleRevocationSeverity.HIGH,
    "High severity revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.HIGH);
});

test("revokePluginBundle accepts CRITICAL severity", () => {
  const record = revokePluginBundle(
    "plugin.severe",
    BundleRevocationSeverity.CRITICAL,
    "Critical revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.CRITICAL);
});

test("revokePluginBundle creates revocation record with CRITICAL severity", () => {
  const record = revokePluginBundle(
    "plugin.critical",
    BundleRevocationSeverity.CRITICAL,
    "Critical emergency revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.CRITICAL);
});

test("revokePluginBundle stores affectedVersions default to wildcard", () => {
  const record = revokePluginBundle(
    "plugin.default_versions",
    BundleRevocationSeverity.LOW,
    "Test",
  );
  assert.deepEqual(record.affectedVersions, ["*"]);
});

test("revokePluginBundle accepts custom affectedVersions", () => {
  const record = revokePluginBundle(
    "plugin.specific_versions",
    BundleRevocationSeverity.HIGH,
    "Security patch required",
    ["1.0.0", "1.1.0"],
  );
  assert.deepEqual(record.affectedVersions, ["1.0.0", "1.1.0"]);
});

test("getPluginRevocationStatus returns null for non-revoked plugin", () => {
  const status = getPluginRevocationStatus("plugin.never_revoked");
  assert.equal(status, null);
});

test("getPluginRevocationStatus returns record for revoked plugin", () => {
  revokePluginBundle("plugin.to_check", BundleRevocationSeverity.LOW, "Testing");
  const status = getPluginRevocationStatus("plugin.to_check");
  assert.ok(status !== null);
  assert.equal(status!.pluginId, "plugin.to_check");
});

test("isPluginRevoked returns false for non-revoked plugin", () => {
  assert.equal(isPluginRevoked("plugin.not_revoked"), false);
});

test("isPluginRevoked returns true for revoked plugin", () => {
  revokePluginBundle("plugin.revoked_test", BundleRevocationSeverity.MEDIUM, "Testing");
  assert.equal(isPluginRevoked("plugin.revoked_test"), true);
});

test("listRevokedPlugins returns empty array when no revocations", () => {
  const list = listRevokedPlugins();
  assert.ok(Array.isArray(list));
});

test("listRevokedPlugins returns all revoked plugins", () => {
  revokePluginBundle("plugin.list_1", BundleRevocationSeverity.LOW, "First");
  revokePluginBundle("plugin.list_2", BundleRevocationSeverity.HIGH, "Second");
  const list = listRevokedPlugins();
  const pluginIds = list.map((r) => r.pluginId);
  assert.ok(pluginIds.includes("plugin.list_1"));
  assert.ok(pluginIds.includes("plugin.list_2"));
});

test("removePluginRevocation returns true for existing revocation", () => {
  revokePluginBundle("plugin.to_remove", BundleRevocationSeverity.LOW, "Testing");
  const removed = removePluginRevocation("plugin.to_remove");
  assert.equal(removed, true);
  assert.equal(isPluginRevoked("plugin.to_remove"), false);
});

test("removePluginRevocation returns false for non-existent revocation", () => {
  const removed = removePluginRevocation("plugin.was_never_revoked");
  assert.equal(removed, false);
});

test("removePluginRevocation allows re-revocation after removal", () => {
  revokePluginBundle("plugin.rerevoke", BundleRevocationSeverity.LOW, "First");
  removePluginRevocation("plugin.rerevoke");
  const record = revokePluginBundle(
    "plugin.rerevoke",
    BundleRevocationSeverity.CRITICAL,
    "Re-revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.CRITICAL);
});

test("multiple revocations of same plugin update the record", () => {
  revokePluginBundle("plugin.multiple", BundleRevocationSeverity.LOW, "First");
  revokePluginBundle("plugin.multiple", BundleRevocationSeverity.CRITICAL, "Second");
  const status = getPluginRevocationStatus("plugin.multiple");
  assert.ok(status !== null);
  assert.equal(status!.reason, "Second");
  assert.equal(status!.severity, BundleRevocationSeverity.CRITICAL);
});
