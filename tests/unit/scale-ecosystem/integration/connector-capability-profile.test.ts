/**
 * Unit tests for ConnectorCapabilityProfileSchema
 *
 * @see src/scale-ecosystem/integration/connector-registry/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ConnectorCapabilityProfileSchema,
  ConnectorManifestSchema,
} from "../../../../src/scale-ecosystem/integration/connector-registry/index.ts";

test("ConnectorCapabilityProfileSchema parses valid profile [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({
    actionRiskProfiles: {
      create_pr: "medium",
      delete_repo: "critical",
      read_code: "low",
    },
    permissionProbes: [
      { permission: "repo", probeType: "read", required: true },
      { permission: "admin:repo_hook", probeType: "write", required: false },
    ],
    quotaProbes: [
      { quotaKey: "api_requests", limit: 5000, window: "minute" },
      { quotaKey: "search_requests", limit: 30, window: "second" },
    ],
    credentialRotationPolicy: {
      rotationDays: 90,
      autoRotate: true,
      gracePeriodDays: 14,
    },
  });

  assert.deepEqual(result.actionRiskProfiles, { create_pr: "medium", delete_repo: "critical", read_code: "low" });
  assert.equal(result.permissionProbes.length, 2);
  assert.equal(result.credentialRotationPolicy.rotationDays, 90);
});

test("ConnectorCapabilityProfileSchema accepts empty profile with defaults [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({});

  assert.deepEqual(result.actionRiskProfiles, {});
  assert.deepEqual(result.permissionProbes, []);
  assert.deepEqual(result.quotaProbes, []);
  assert.equal(result.credentialRotationPolicy.rotationDays, 90);
  assert.equal(result.credentialRotationPolicy.autoRotate, false);
  assert.equal(result.credentialRotationPolicy.gracePeriodDays, 7);
});

test("ConnectorCapabilityProfileSchema validates risk levels [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({
    actionRiskProfiles: {
      low_risk_action: "low",
      medium_risk_action: "medium",
      high_risk_action: "high",
      critical_action: "critical",
    },
  });

  assert.equal(result.actionRiskProfiles.low_risk_action, "low");
  assert.equal(result.actionRiskProfiles.medium_risk_action, "medium");
  assert.equal(result.actionRiskProfiles.high_risk_action, "high");
  assert.equal(result.actionRiskProfiles.critical_action, "critical");
});

test("ConnectorCapabilityProfileSchema rejects invalid risk level [connector-capability-profile]", () => {
  assert.throws(() => {
    ConnectorCapabilityProfileSchema.parse({
      actionRiskProfiles: { action: "invalid_risk" },
    });
  });
});

test("ConnectorCapabilityProfileSchema validates permission probe types [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({
    permissionProbes: [
      { permission: "read_perm", probeType: "read", required: false },
      { permission: "write_perm", probeType: "write", required: true },
      { permission: "admin_perm", probeType: "admin", required: false },
    ],
  });

  assert.equal(result.permissionProbes[0]!.probeType, "read");
  assert.equal(result.permissionProbes[1]!.probeType, "write");
  assert.equal(result.permissionProbes[2]!.probeType, "admin");
});

test("ConnectorCapabilityProfileSchema rejects invalid probe type [connector-capability-profile]", () => {
  assert.throws(() => {
    ConnectorCapabilityProfileSchema.parse({
      permissionProbes: [
        { permission: "test", probeType: "invalid_probe" as any, required: false },
      ],
    });
  });
});

test("ConnectorCapabilityProfileSchema validates quota window enum [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({
    quotaProbes: [
      { quotaKey: "per_second", limit: 100, window: "second" },
      { quotaKey: "per_minute", limit: 5000, window: "minute" },
      { quotaKey: "per_hour", limit: 100000, window: "hour" },
      { quotaKey: "per_day", limit: 1000000, window: "day" },
    ],
  });

  assert.equal(result.quotaProbes[0]!.window, "second");
  assert.equal(result.quotaProbes[1]!.window, "minute");
  assert.equal(result.quotaProbes[2]!.window, "hour");
  assert.equal(result.quotaProbes[3]!.window, "day");
});

test("ConnectorCapabilityProfileSchema rejects invalid window [connector-capability-profile]", () => {
  assert.throws(() => {
    ConnectorCapabilityProfileSchema.parse({
      quotaProbes: [
        { quotaKey: "test", limit: 100, window: "week" as any },
      ],
    });
  });
});

test("ConnectorCapabilityProfileSchema requires positive rotation days [connector-capability-profile]", () => {
  assert.throws(() => {
    ConnectorCapabilityProfileSchema.parse({
      credentialRotationPolicy: { rotationDays: 0 },
    });
  });
});

test("ConnectorCapabilityProfileSchema requires positive rotation days (negative) [connector-capability-profile]", () => {
  assert.throws(() => {
    ConnectorCapabilityProfileSchema.parse({
      credentialRotationPolicy: { rotationDays: -30 },
    });
  });
});

test("ConnectorCapabilityProfileSchema accepts zero grace period [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({
    credentialRotationPolicy: { gracePeriodDays: 0, rotationDays: 30 },
  });

  assert.equal(result.credentialRotationPolicy.gracePeriodDays, 0);
});

test("ConnectorCapabilityProfileSchema rejects negative grace period [connector-capability-profile]", () => {
  assert.throws(() => {
    ConnectorCapabilityProfileSchema.parse({
      credentialRotationPolicy: { gracePeriodDays: -5 },
    });
  });
});

test("ConnectorManifestSchema accepts capabilityProfile [connector-capability-profile]", () => {
  const result = ConnectorManifestSchema.parse({
    connectorId: "test-connector",
    provider: "TestProvider",
    lifecycleState: "registered",
    capabilityProfile: {
      actionRiskProfiles: { create_issue: "medium" },
      credentialRotationPolicy: { rotationDays: 60 },
    },
  });

  assert.equal(result.capabilityProfile.actionRiskProfiles.create_issue, "medium");
  assert.equal(result.capabilityProfile.credentialRotationPolicy.rotationDays, 60);
});

test("ConnectorCapabilityProfileSchema has correct default rotation days [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({});
  assert.equal(result.credentialRotationPolicy.rotationDays, 90);
});

test("ConnectorCapabilityProfileSchema has correct default autoRotate [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({});
  assert.equal(result.credentialRotationPolicy.autoRotate, false);
});

test("ConnectorCapabilityProfileSchema has correct default grace period [connector-capability-profile]", () => {
  const result = ConnectorCapabilityProfileSchema.parse({});
  assert.equal(result.credentialRotationPolicy.gracePeriodDays, 7);
});