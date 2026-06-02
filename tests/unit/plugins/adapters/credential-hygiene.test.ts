import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHashedCredentialFingerprint,
  createZeroableCredentialSecret,
} from "../../../../src/plugins/adapters/credential-hygiene.js";

test("buildHashedCredentialFingerprint never exposes the token prefix directly", () => {
  const secret = "verysecret_token_12345";
  const fingerprint = buildHashedCredentialFingerprint("crm_hubspot", secret);

  assert.match(fingerprint, /^crm_hubspot_[a-f0-9]{24}$/);
  assert.equal(fingerprint.includes(secret), false);
  assert.equal(fingerprint.includes(secret.slice(0, 8)), false);
});

test("createZeroableCredentialSecret clears in-memory credential state", () => {
  const secret = createZeroableCredentialSecret("sensitive-value");

  assert.equal(secret.withSecretBytes((value) => value.toString("utf8")), "sensitive-value");
  secret.clear();
  assert.throws(() => secret.withSecretBytes((value) => value), /adapter\.credential_unavailable/);
});

test("buildHashedCredentialFingerprint incorporates caller salt", () => {
  const secret = "verysecret_token_12345";
  const fingerprintA = buildHashedCredentialFingerprint("crm_hubspot", secret, 24, "tenant-a");
  const fingerprintB = buildHashedCredentialFingerprint("crm_hubspot", secret, 24, "tenant-b");

  assert.notEqual(fingerprintA, fingerprintB);
});
