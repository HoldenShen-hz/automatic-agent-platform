import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  rsaAlgToNode,
  ecAlgToNode,
  hmacAlgToNode,
} from "../../../../../../src/platform/five-plane-interface/api/oidc-oauth/crypto-utils.js";

test("rsaAlgToNode maps RS256 to RSA-SHA256", () => {
  assert.equal(rsaAlgToNode("RS256"), "RSA-SHA256");
});

test("rsaAlgToNode maps RS384 to RSA-SHA384", () => {
  assert.equal(rsaAlgToNode("RS384"), "RSA-SHA384");
});

test("rsaAlgToNode maps RS512 to RSA-SHA512", () => {
  assert.equal(rsaAlgToNode("RS512"), "RSA-SHA512");
});

test("rsaAlgToNode defaults to RSA-SHA256 for unknown algorithm", () => {
  assert.equal(rsaAlgToNode("RS999"), "RSA-SHA256");
  assert.equal(rsaAlgToNode(""), "RSA-SHA256");
  assert.equal(rsaAlgToNode("RS1"), "RSA-SHA256");
});

test("ecAlgToNode maps ES256 to SHA256", () => {
  assert.equal(ecAlgToNode("ES256"), "SHA256");
});

test("ecAlgToNode maps ES384 to SHA384", () => {
  assert.equal(ecAlgToNode("ES384"), "SHA384");
});

test("ecAlgToNode maps ES512 to SHA512", () => {
  assert.equal(ecAlgToNode("ES512"), "SHA512");
});

test("ecAlgToNode defaults to SHA256 for unknown algorithm", () => {
  assert.equal(ecAlgToNode("ES999"), "SHA256");
  assert.equal(ecAlgToNode(""), "SHA256");
  assert.equal(ecAlgToNode("ES1"), "SHA256");
});

test("hmacAlgToNode maps HS256 to sha256", () => {
  assert.equal(hmacAlgToNode("HS256"), "sha256");
});

test("hmacAlgToNode maps HS384 to sha384", () => {
  assert.equal(hmacAlgToNode("HS384"), "sha384");
});

test("hmacAlgToNode maps HS512 to sha512", () => {
  assert.equal(hmacAlgToNode("HS512"), "sha512");
});

test("hmacAlgToNode defaults to sha256 for unknown algorithm", () => {
  assert.equal(hmacAlgToNode("HS999"), "sha256");
  assert.equal(hmacAlgToNode(""), "sha256");
  assert.equal(hmacAlgToNode("HS1"), "sha256");
});
