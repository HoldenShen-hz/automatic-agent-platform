import assert from "node:assert/strict";
import test from "node:test";

import {
  rsaAlgToNode,
  ecAlgToNode,
  hmacAlgToNode,
} from "../../../../../../../src/platform/interface/api/oidc-oauth/crypto-utils.js";

test("rsaAlgToNode converts RS256 to RSA-SHA256", () => {
  assert.equal(rsaAlgToNode("RS256"), "RSA-SHA256");
});

test("rsaAlgToNode converts RS384 to RSA-SHA384", () => {
  assert.equal(rsaAlgToNode("RS384"), "RSA-SHA384");
});

test("rsaAlgToNode converts RS512 to RSA-SHA512", () => {
  assert.equal(rsaAlgToNode("RS512"), "RSA-SHA512");
});

test("rsaAlgToNode defaults to RSA-SHA256 for unknown algorithms", () => {
  assert.equal(rsaAlgToNode("RS999"), "RSA-SHA256");
  assert.equal(rsaAlgToNode(""), "RSA-SHA256");
  assert.equal(rsaAlgToNode("RS256x"), "RSA-SHA256");
});

test("ecAlgToNode converts ES256 to SHA256", () => {
  assert.equal(ecAlgToNode("ES256"), "SHA256");
});

test("ecAlgToNode converts ES384 to SHA384", () => {
  assert.equal(ecAlgToNode("ES384"), "SHA384");
});

test("ecAlgToNode converts ES512 to SHA512", () => {
  assert.equal(ecAlgToNode("ES512"), "SHA512");
});

test("ecAlgToNode defaults to SHA256 for unknown algorithms", () => {
  assert.equal(ecAlgToNode("ES999"), "SHA256");
  assert.equal(ecAlgToNode(""), "SHA256");
  assert.equal(ecAlgToNode("ES256k"), "SHA256");
});

test("hmacAlgToNode converts HS256 to sha256", () => {
  assert.equal(hmacAlgToNode("HS256"), "sha256");
});

test("hmacAlgToNode converts HS384 to sha384", () => {
  assert.equal(hmacAlgToNode("HS384"), "sha384");
});

test("hmacAlgToNode converts HS512 to sha512", () => {
  assert.equal(hmacAlgToNode("HS512"), "sha512");
});

test("hmacAlgToNode defaults to sha256 for unknown algorithms", () => {
  assert.equal(hmacAlgToNode("HS999"), "sha256");
  assert.equal(hmacAlgToNode(""), "sha256");
  assert.equal(hmacAlgToNode("HS256x"), "sha256");
});

test("rsaAlgToNode handles lowercase input", () => {
  // Note: The function doesn't normalize case, so lowercase should still produce default
  assert.equal(rsaAlgToNode("rs256"), "RSA-SHA256"); // default due to switch default
});

test("ecAlgToNode handles lowercase input", () => {
  // Note: The function doesn't normalize case
  assert.equal(ecAlgToNode("es256"), "SHA256"); // default due to switch default
});

test("hmacAlgToNode handles lowercase input", () => {
  // Note: The function doesn't normalize case
  assert.equal(hmacAlgToNode("hs256"), "sha256"); // default due to switch default
});