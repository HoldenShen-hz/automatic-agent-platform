import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decodeJwtJsonSegment, parseJwtHeader, parseFederatedTokenClaims } from "../../../../../src/platform/interface/api/oidc-oauth/jwt-utils.js";
import { AuthError } from "../../../../../../src/platform/contracts/errors.js";

describe("api/oidc-oauth/jwt-utils", () => {
  describe("decodeJwtJsonSegment", () => {
    it("should decode base64url encoded JSON", () => {
      const encoded = btoa(JSON.stringify({ alg: "RS256", kid: "key-123" }));
      const decoded = decodeJwtJsonSegment(encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""), "header");
      assert.deepEqual(decoded, { alg: "RS256", kid: "key-123" });
    });

    it("should throw AuthError for invalid base64", () => {
      assert.throws(() => decodeJwtJsonSegment("not-valid-base64!!!", "header"), AuthError);
    });

    it("should throw AuthError for invalid JSON", () => {
      const encoded = Buffer.from("not json").toString("base64url");
      assert.throws(() => decodeJwtJsonSegment(encoded, "payload"), AuthError);
    });
  });

  describe("parseJwtHeader", () => {
    it("should parse valid header with kid and alg", () => {
      const result = parseJwtHeader({ alg: "RS256", kid: "my-key" });
      assert.equal(result.alg, "RS256");
      assert.equal(result.kid, "my-key");
    });

    it("should parse header with only alg", () => {
      const result = parseJwtHeader({ alg: "ES256" });
      assert.equal(result.alg, "ES256");
      assert.ok(!("kid" in result));
    });

    it("should parse header with only kid", () => {
      const result = parseJwtHeader({ kid: "key-123" });
      assert.equal(result.kid, "key-123");
      assert.ok(!("alg" in result));
    });

    it("should throw for non-object header", () => {
      assert.throws(() => parseJwtHeader("string"), /jwt.header_invalid/);
    });

    it("should throw for array header", () => {
      assert.throws(() => parseJwtHeader([1, 2, 3]), /jwt.header_invalid/);
    });

    it("should throw for null header", () => {
      assert.throws(() => parseJwtHeader(null), /jwt.header_invalid/);
    });

    it("should throw if kid is not string", () => {
      assert.throws(() => parseJwtHeader({ kid: 123 }), /jwt.header_invalid/);
    });

    it("should throw if alg is not string", () => {
      assert.throws(() => parseJwtHeader({ alg: 456 }), /jwt.header_invalid/);
    });
  });

  describe("parseFederatedTokenClaims", () => {
    it("should parse valid claims", () => {
      const claims = {
        sub: "user-123",
        iss: "https://auth.example.com",
        aud: "my-app",
        exp: 9999999999,
        iat: 1000000000,
      };
      const result = parseFederatedTokenClaims(claims);
      assert.equal(result.sub, "user-123");
      assert.equal(result.iss, "https://auth.example.com");
      assert.equal(result.aud, "my-app");
      assert.equal(result.exp, 9999999999);
      assert.equal(result.iat, 1000000000);
    });

    it("should handle aud as array", () => {
      const claims = {
        sub: "user-123",
        iss: "https://auth.example.com",
        aud: ["app-1", "app-2"],
        exp: 9999999999,
        iat: 1000000000,
      };
      const result = parseFederatedTokenClaims(claims);
      assert.deepEqual(result.aud, ["app-1", "app-2"]);
    });

    it("should parse optional email", () => {
      const claims = {
        sub: "user-123",
        iss: "https://auth.example.com",
        aud: "my-app",
        exp: 9999999999,
        iat: 1000000000,
        email: "user@example.com",
      };
      const result = parseFederatedTokenClaims(claims);
      assert.equal(result.email, "user@example.com");
    });

    it("should parse optional name", () => {
      const claims = {
        sub: "user-123",
        iss: "https://auth.example.com",
        aud: "my-app",
        exp: 9999999999,
        iat: 1000000000,
        name: "John Doe",
      };
      const result = parseFederatedTokenClaims(claims);
      assert.equal(result.name, "John Doe");
    });

    it("should parse optional roles array", () => {
      const claims = {
        sub: "user-123",
        iss: "https://auth.example.com",
        aud: "my-app",
        exp: 9999999999,
        iat: 1000000000,
        roles: ["admin", "user"],
      };
      const result = parseFederatedTokenClaims(claims);
      assert.deepEqual(result.roles, ["admin", "user"]);
    });

    it("should throw for non-object claims", () => {
      assert.throws(() => parseFederatedTokenClaims("string"), /jwt.payload_invalid/);
    });

    it("should throw if sub is missing", () => {
      const claims = { iss: "x", aud: "x", exp: 1, iat: 1 };
      assert.throws(() => parseFederatedTokenClaims(claims), /jwt.payload_invalid/);
    });

    it("should throw if iss is missing", () => {
      const claims = { sub: "x", aud: "x", exp: 1, iat: 1 };
      assert.throws(() => parseFederatedTokenClaims(claims), /jwt.payload_invalid/);
    });

    it("should throw if exp is not a finite number", () => {
      const claims = { sub: "x", iss: "x", aud: "x", exp: Infinity, iat: 1 };
      assert.throws(() => parseFederatedTokenClaims(claims), /jwt.payload_invalid/);
    });

    it("should throw if iat is not a finite number", () => {
      const claims = { sub: "x", iss: "x", aud: "x", exp: 1, iat: NaN };
      assert.throws(() => parseFederatedTokenClaims(claims), /jwt.payload_invalid/);
    });

    it("should throw if aud is not string or string array", () => {
      const claims = { sub: "x", iss: "x", aud: 123, exp: 1, iat: 1 };
      assert.throws(() => parseFederatedTokenClaims(claims), /jwt.payload_invalid/);
    });

    it("should throw if roles is not string array", () => {
      const claims = { sub: "x", iss: "x", aud: "x", exp: 1, iat: 1, roles: [1, 2, 3] };
      assert.throws(() => parseFederatedTokenClaims(claims), /jwt.payload_invalid/);
    });
  });
});