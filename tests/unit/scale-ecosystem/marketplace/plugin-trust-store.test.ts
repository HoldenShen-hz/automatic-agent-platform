import assert from "node:assert/strict";
import test from "node:test";

import { PluginTrustStore } from "../../../../src/scale-ecosystem/marketplace/plugin-trust-store.js";

test("PluginTrustStore accepts trusted artifacts with provenance, trust root, and no revocation", () => {
  const store = new PluginTrustStore();
  const trustRoot = store.registerTrustRoot({
    publisherId: "publisher-1",
    rootFingerprint: "fingerprint-1234567890abcdef",
    source: "sigstore://publisher-1",
    supportedArtifactTypes: ["plugin"],
    requiredIsolationMode: "dedicated_pool",
  });
  const provenance = store.recordProvenance({
    artifactId: "artifact-1",
    publisherId: "publisher-1",
    sourceUri: "registry://artifact-1",
    manifestChecksum: "manifest-abc",
    sbomDigest: "sbom-abc",
    signatureDigest: "sig-abc",
  });

  const decision = store.evaluateArtifact({
    artifactId: "artifact-1",
    publisherId: "publisher-1",
    artifactType: "plugin",
    manifestChecksum: "manifest-abc",
    sbomDigest: "sbom-abc",
    signatureDigest: "sig-abc",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
  });

  assert.equal(decision.trusted, true);
  assert.equal(decision.matchedTrustRootId, trustRoot.trustRootId);
  assert.equal(decision.provenanceId, provenance.provenanceId);
  assert.equal(decision.requiredIsolationMode, "dedicated_pool");
});

test("PluginTrustStore blocks revoked artifacts and missing provenance evidence", () => {
  const store = new PluginTrustStore();
  store.registerTrustRoot({
    publisherId: "publisher-2",
    rootFingerprint: "fingerprint-fedcba0987654321",
    source: "sigstore://publisher-2",
    supportedArtifactTypes: ["plugin"],
  });
  store.revokeArtifact({
    artifactId: "artifact-2",
    publisherId: "publisher-2",
    reasonCode: "compromised_signing_key",
  });

  const decision = store.evaluateArtifact({
    artifactId: "artifact-2",
    publisherId: "publisher-2",
    artifactType: "plugin",
    manifestChecksum: "manifest-x",
    sbomDigest: "sbom-x",
    signatureDigest: "sig-x",
    signatureVerified: true,
    sbomVerified: true,
    sandboxVerified: true,
    egressPolicyReviewed: true,
  });

  assert.equal(decision.trusted, false);
  assert.equal(decision.blockedBy.includes("plugin_artifact_revoked"), true);
  assert.equal(decision.blockedBy.includes("plugin_provenance_missing"), true);
});
