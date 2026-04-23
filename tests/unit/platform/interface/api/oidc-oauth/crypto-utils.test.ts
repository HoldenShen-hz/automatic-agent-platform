import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rsaAlgToNode, ecAlgToNode, hmacAlgToNode } from "../../../../../src/platform/interface/api/oidc-oauth/crypto-utils.js";

describe("api/oidc-oauth/crypto-utils", () => {
  describe("rsaAlgToNode", () => {
    it("should map RS256 to RSA-SHA256", () => {
      assert.equal(rsaAlgToNode("RS256"), "RSA-SHA256");
    });

    it("should map RS384 to RSA-SHA384", () => {
      assert.equal(rsaAlgToNode("RS384"), "RSA-SHA384");
    });

    it("should map RS512 to RSA-SHA512", () => {
      assert.equal(rsaAlgToNode("RS512"), "RSA-SHA512");
    });

    it("should default to RSA-SHA256 for unknown algorithms", () => {
      assert.equal(rsaAlgToNode("RS999"), "RSA-SHA256");
      assert.equal(rsaAlgToNode(""), "RSA-SHA256");
    });
  });

  describe("ecAlgToNode", () => {
    it("should map ES256 to SHA256", () => {
      assert.equal(ecAlgToNode("ES256"), "SHA256");
    });

    it("should map ES384 to SHA384", () => {
      assert.equal(ecAlgToNode("ES384"), "SHA384");
    });

    it("should map ES512 to SHA512", () => {
      assert.equal(ecAlgToNode("ES512"), "SHA512");
    });

    it("should default to SHA256 for unknown algorithms", () => {
      assert.equal(ecAlgToNode("ES999"), "SHA256");
      assert.equal(ecAlgToNode(""), "SHA256");
    });
  });

  describe("hmacAlgToNode", () => {
    it("should map HS256 to sha256", () => {
      assert.equal(hmacAlgToNode("HS256"), "sha256");
    });

    it("should map HS384 to sha384", () => {
      assert.equal(hmacAlgToNode("HS384"), "sha384");
    });

    it("should map HS512 to sha512", () => {
      assert.equal(hmacAlgToNode("HS512"), "sha512");
    });

    it("should default to sha256 for unknown algorithms", () => {
      assert.equal(hmacAlgToNode("HS999"), "sha256");
      assert.equal(hmacAlgToNode(""), "sha256");
    });
  });
});