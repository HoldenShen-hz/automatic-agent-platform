import assert from "node:assert/strict";
import test from "node:test";

import { decodeJwtJsonSegment, parseJwtHeader, parseFederatedTokenClaims } from "../../../../src/platform/interface/api/oidc-oauth/crypto-utils.js";
import { AuthError } from "../../../../src/platform/contracts/errors.js";
import type { FederatedTokenClaims } from "../../../../src/platform/interface/api/oidc-oauth/types.js";

test("decodeJwtJsonSegment decodes base64url encoded JSON", () => {
  const encoded = btoa(JSON.stringify({ alg: "RS256", kid: "key-123" }));
  const decoded = decodeJwtJsonSegment(encoded, "header");
  assert.deepEqual(decoded, { alg: "RS256", kid: "key-123" });
});

test("decodeJwtJsonSegment throws AuthError for invalid base64", () => {
  assert.throws(
    () => decodeJwtJsonSegment("not-valid-base64!!!", "header"),
    AuthError,
  );
});

test("decodeJwtJsonSegment throws AuthError for invalid JSON", () => {
  const invalidJson = Buffer.from("this is not json").toString("base64url");
  assert.throws(
    () => decodeJwtJsonSegment(invalidJson, "payload"),
    AuthError,
  );
});

test("parseJwtHeader extracts kid and alg from valid header", () => {
  const result = parseJwtHeader({ alg: "RS256", kid: "my-key" });
  assert.equal(result.alg, "RS256");
  assert.equal(result.kid, "my-key");
});

test("parseJwtHeader returns empty object for header without kid or alg", () => {
  const result = parseJwtHeader({});
  assert.deepEqual(result, {});
});

test("parseJwtHeader throws for non-object header", () => {
  assert.throws(() => parseJwtHeader(null), /jwt.header_invalid/);
  assert.throws(() => parseJwtHeader("string"), /jwt.header_invalid/);
  assert.throws(() => parseJwtHeader(123), /jwt.header_invalid/);
});

test("parseJwtHeader throws for invalid kid type", () => {
  assert.throws(() => parseJwtHeader({ kid: 123 }), /jwt.header_invalid/);
  assert.throws(() => parseJwtHeader({ kid: {} }), /jwt.header_invalid/);
});

test("parseJwtHeader throws for invalid alg type", () => {
  assert.throws(() => parseJwtHeader({ alg: 456 }), /jwt.header_invalid/);
  assert.throws(() => parseJwtHeader({ alg: [] }), /jwt.header_invalid/);
});

test("parseFederatedTokenClaims parses valid claims", () => {
  const claims: FederatedTokenClaims = {
    sub: "user-123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1735689600,
    iat: 1735686000,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "user"],
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user-123");
  assert.equal(result.iss, "https://issuer.example.com");
  assert.equal(result.aud, "client-id");
  assert.equal(result.exp, 1735689600);
  assert.equal(result.iat, 1735686000);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.name, "Test User");
  assert.deepEqual(result.roles, ["admin", "user"]);
});

test("parseFederatedTokenClaims accepts string array aud", () => {
  const claims = {
    sub: "user-123",
    iss: "https://issuer.example.com",
    aud: ["client-1", "client-2"],
    exp: 1735689600,
    iat: 1735686000,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.deepEqual(result.aud, ["client-1", "client-2"]);
});

test("parseFederatedTokenClaims throws for missing sub", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: 123, iss: "issuer", aud: "aud", exp: 1, iat: 1 }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for missing iss", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: 123, aud: "aud", exp: 1, iat: 1 }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for invalid exp", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: "aud", exp: "invalid", iat: 1 }),
    /jwt.payload_invalid/,
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: "aud", exp: Infinity, iat: 1 }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for invalid iat", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: "aud", exp: 1, iat: "invalid" }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for invalid aud", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: 123, exp: 1, iat: 1 }),
    /jwt.payload_invalid/,
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: ["a", 123], exp: 1, iat: 1 }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for invalid email type", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: "aud", exp: 1, iat: 1, email: 123 }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for invalid name type", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: "aud", exp: 1, iat: 1, name: {} }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for invalid roles type", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: "aud", exp: 1, iat: 1, roles: "admin" }),
    /jwt.payload_invalid/,
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "issuer", aud: "aud", exp: 1, iat: 1, roles: [1, 2, 3] }),
    /jwt.payload_invalid/,
  );
});

test("parseFederatedTokenClaims omits optional fields when not present", () => {
  const claims = {
    sub: "user-123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1735689600,
    iat: 1735686000,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.email, undefined);
  assert.equal(result.name, undefined);
  assert.equal(result.roles, undefined);
});