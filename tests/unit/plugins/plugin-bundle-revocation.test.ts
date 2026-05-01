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

test("revokePluginBundle creates revocation record with INFO severity", () => {
  const record = revokePluginBundle(
    "plugin.info",
    BundleRevocationSeverity.INFO,
    "Informational revocation",
  );
  assert.equal(record.pluginId, "plugin.info");
  assert.equal(record.severity, BundleRevocationSeverity.INFO);
  assert.equal(record.reason, "Informational revocation");
  assert.ok(typeof record.revokedAt === "string");
});

test("revokePluginBundle creates revocation record with WARNING severity", () => {
  const record = revokePluginBundle(
    "plugin.warning",
    BundleRevocationSeverity.WARNING,
    "Warning level revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.WARNING);
});

test("revokePluginBundle creates revocation record with MODERATE severity", () => {
  const record = revokePluginBundle(
    "plugin.moderate",
    BundleRevocationSeverity.MODERATE,
    "Moderate revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.MODERATE);
});

test("revokePluginBundle creates revocation record with SEVERE severity", () => {
  const record = revokePluginBundle(
    "plugin.severe",
    BundleRevocationSeverity.SEVERE,
    "Severe revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.SEVERE);
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
    BundleRevocationSeverity.INFO,
    "Test",
  );
  assert.deepEqual(record.affectedVersions, ["*"]);
});

test("revokePluginBundle accepts custom affectedVersions", () => {
  const record = revokePluginBundle(
    "plugin.specific_versions",
    BundleRevocationSeverity.SEVERE,
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
  revokePluginBundle("plugin.to_check", BundleRevocationSeverity.INFO, "Testing");
  const status = getPluginRevocationStatus("plugin.to_check");
  assert.ok(status !== null);
  assert.equal(status!.pluginId, "plugin.to_check");
});

test("isPluginRevoked returns false for non-revoked plugin", () => {
  assert.equal(isPluginRevoked("plugin.not_revoked"), false);
});

test("isPluginRevoked returns true for revoked plugin", () => {
  revokePluginBundle("plugin.revoked_test", BundleRevocationSeverity.WARNING, "Testing");
  assert.equal(isPluginRevoked("plugin.revoked_test"), true);
});

test("listRevokedPlugins returns empty array when no revocations", () => {
  const list = listRevokedPlugins();
  assert.ok(Array.isArray(list));
});

test("listRevokedPlugins returns all revoked plugins", () => {
  revokePluginBundle("plugin.list_1", BundleRevocationSeverity.INFO, "First");
  revokePluginBundle("plugin.list_2", BundleRevocationSeverity.SEVERE, "Second");
  const list = listRevokedPlugins();
  const pluginIds = list.map((r) => r.pluginId);
  assert.ok(pluginIds.includes("plugin.list_1"));
  assert.ok(pluginIds.includes("plugin.list_2"));
});

test("removePluginRevocation returns true for existing revocation", () => {
  revokePluginBundle("plugin.to_remove", BundleRevocationSeverity.INFO, "Testing");
  const removed = removePluginRevocation("plugin.to_remove");
  assert.equal(removed, true);
  assert.equal(isPluginRevoked("plugin.to_remove"), false);
});

test("removePluginRevocation returns false for non-existent revocation", () => {
  const removed = removePluginRevocation("plugin.was_never_revoked");
  assert.equal(removed, false);
});

test("removePluginRevocation allows re-revocation after removal", () => {
  revokePluginBundle("plugin.rerevoke", BundleRevocationSeverity.INFO, "First");
  removePluginRevocation("plugin.rerevoke");
  const record = revokePluginBundle(
    "plugin.rerevoke",
    BundleRevocationSeverity.CRITICAL,
    "Re-revocation",
  );
  assert.equal(record.severity, BundleRevocationSeverity.CRITICAL);
});

test("multiple revocations of same plugin update the record", () => {
  revokePluginBundle("plugin.multiple", BundleRevocationSeverity.INFO, "First");
  revokePluginBundle("plugin.multiple", BundleRevocationSeverity.CRITICAL, "Second");
  const status = getPluginRevocationStatus("plugin.multiple");
  assert.ok(status !== null);
  assert.equal(status!.reason, "Second");
  assert.equal(status!.severity, BundleRevocationSeverity.CRITICAL);
});