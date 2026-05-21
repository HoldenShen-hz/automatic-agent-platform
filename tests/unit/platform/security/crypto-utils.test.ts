import assert from "node:assert/strict";
import test from "node:test";

import { rsaAlgToNode, ecAlgToNode, hmacAlgToNode } from "../../../../src/platform/five-plane-interface/api/oidc-oauth/crypto-utils.js";

test("rsaAlgToNode maps RS256", (t) => {
  assert.equal(rsaAlgToNode("RS256"), "RSA-SHA256");
});

test("rsaAlgToNode maps RS384", (t) => {
  assert.equal(rsaAlgToNode("RS384"), "RSA-SHA384");
});

test("rsaAlgToNode maps RS512", (t) => {
  assert.equal(rsaAlgToNode("RS512"), "RSA-SHA512");
});

test("rsaAlgToNode defaults to RSA-SHA256", (t) => {
  assert.equal(rsaAlgToNode("unknown"), "RSA-SHA256");
  assert.equal(rsaAlgToNode(""), "RSA-SHA256");
});

test("ecAlgToNode maps ES256", (t) => {
  assert.equal(ecAlgToNode("ES256"), "SHA256");
});

test("ecAlgToNode maps ES384", (t) => {
  assert.equal(ecAlgToNode("ES384"), "SHA384");
});

test("ecAlgToNode maps ES512", (t) => {
  assert.equal(ecAlgToNode("ES512"), "SHA512");
});

test("ecAlgToNode defaults to SHA256", (t) => {
  assert.equal(ecAlgToNode("unknown"), "SHA256");
  assert.equal(ecAlgToNode(""), "SHA256");
});

test("hmacAlgToNode maps HS256", (t) => {
  assert.equal(hmacAlgToNode("HS256"), "sha256");
});

test("hmacAlgToNode maps HS384", (t) => {
  assert.equal(hmacAlgToNode("HS384"), "sha384");
});

test("hmacAlgToNode maps HS512", (t) => {
  assert.equal(hmacAlgToNode("HS512"), "sha512");
});

test("hmacAlgToNode defaults to sha256", (t) => {
  assert.equal(hmacAlgToNode("unknown"), "sha256");
  assert.equal(hmacAlgToNode(""), "sha256");
});