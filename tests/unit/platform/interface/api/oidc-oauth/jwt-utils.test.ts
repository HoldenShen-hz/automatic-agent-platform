import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeJwtJsonSegment,
  parseJwtHeader,
  parseFederatedTokenClaims,
} from "../../../../../../src/platform/five-plane-interface/api/oidc-oauth/jwt-utils.js";
import type { FederatedTokenClaims } from "../../../../../../src/platform/five-plane-interface/api/oidc-oauth/types.js";

test("decodeJwtJsonSegment decodes valid base64url payload", () => {
  // {"sub":"user"} in base64url
  const result = decodeJwtJsonSegment("eyJzdWIiOiJ1c2VyIn0", "payload");
  assert.deepStrictEqual(result, { sub: "user" });
});

test("decodeJwtJsonSegment decodes JSON payload", () => {
  const payload = JSON.stringify({ sub: "user123" });
  const base64 = Buffer.from(payload).toString("base64url");
  const result = decodeJwtJsonSegment(base64, "payload");
  assert.deepStrictEqual(result, { sub: "user123" });
});

test("decodeJwtJsonSegment throws AuthError for invalid base64", () => {
  assert.throws(
    () => decodeJwtJsonSegment("not-valid-base64!!!", "header"),
    (err: any) => err.code === "jwt.header_invalid",
  );
});

test("decodeJwtJsonSegment throws AuthError for invalid JSON", () => {
  // Valid base64 but not JSON
  const invalid = Buffer.from("not-json").toString("base64url");
  assert.throws(
    () => decodeJwtJsonSegment(invalid, "payload"),
    (err: any) => err.code === "jwt.payload_invalid",
  );
});

test("parseJwtHeader extracts kid and alg from valid header", () => {
  const result = parseJwtHeader({ kid: "key-1", alg: "RS256" });
  assert.deepStrictEqual(result, { kid: "key-1", alg: "RS256" });
});

test("parseJwtHeader returns empty object for empty record", () => {
  const result = parseJwtHeader({});
  assert.deepStrictEqual(result, {});
});

test("parseJwtHeader ignores non-string kid", () => {
  // kid is present (123) but not a string - should throw
  assert.throws(
    () => parseJwtHeader({ kid: 123, alg: "RS256" }),
    (err: any) => err.code === "jwt.header_invalid",
  );
});

test("parseJwtHeader ignores non-string alg", () => {
  // alg is present (999) but not a string - should throw
  assert.throws(
    () => parseJwtHeader({ kid: "key-1", alg: 999 }),
    (err: any) => err.code === "jwt.header_invalid",
  );
});

test("parseJwtHeader rejects unsupported algorithm names", () => {
  assert.throws(
    () => parseJwtHeader({ kid: "key-1", alg: "none" }),
    (err: any) => err.code === "jwt.header_invalid",
  );
});

test("parseJwtHeader throws for non-record value", () => {
  assert.throws(
    () => parseJwtHeader("string"),
    (err: any) => err.code === "jwt.header_invalid",
  );
  assert.throws(
    () => parseJwtHeader(null),
    (err: any) => err.code === "jwt.header_invalid",
  );
  assert.throws(
    () => parseJwtHeader(123),
    (err: any) => err.code === "jwt.header_invalid",
  );
});

test("parseFederatedTokenClaims parses valid claims", () => {
  const claims: FederatedTokenClaims = {
    sub: "user-1",
    iss: "https://issuer.example.com",
    aud: "audience-1",
    exp: 9999999999,
    iat: 1000000000,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "user"],
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user-1");
  assert.equal(result.iss, "https://issuer.example.com");
  assert.equal(result.aud, "audience-1");
  assert.equal(result.exp, 9999999999);
  assert.equal(result.iat, 1000000000);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.name, "Test User");
  assert.deepStrictEqual(result.roles, ["admin", "user"]);
});

test("parseFederatedTokenClaims handles audience as array", () => {
  const result = parseFederatedTokenClaims({
    sub: "user-1",
    iss: "https://issuer.example.com",
    aud: ["aud-1", "aud-2"],
    exp: 9999999999,
    iat: 1000000000,
  });
  assert.deepStrictEqual(result.aud, ["aud-1", "aud-2"]);
});

test("parseFederatedTokenClaims throws for missing required fields", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user-1" }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
  assert.throws(
    () => parseFederatedTokenClaims({ iss: "issuer" }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
});

test("parseFederatedTokenClaims throws for non-string sub or iss", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: 123, iss: "issuer", aud: "aud", exp: 1, iat: 1 }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: 123, aud: "aud", exp: 1, iat: 1 }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
});

test("parseFederatedTokenClaims throws for non-finite exp or iat", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: "aud", exp: Infinity, iat: 1 }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: "aud", exp: 1, iat: NaN }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
});

test("parseFederatedTokenClaims throws for invalid aud", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: 123, exp: 1, iat: 1 }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: ["a", 123], exp: 1, iat: 1 }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
});

test("parseFederatedTokenClaims throws for invalid optional string fields", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: "aud", exp: 1, iat: 1, email: 123 }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: "aud", exp: 1, iat: 1, name: 456 }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
});

test("parseFederatedTokenClaims throws for invalid roles", () => {
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: "aud", exp: 1, iat: 1, roles: "not-array" }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
  assert.throws(
    () => parseFederatedTokenClaims({ sub: "user", iss: "iss", aud: "aud", exp: 1, iat: 1, roles: [123] }),
    (err: any) => err.code === "jwt.payload_invalid",
  );
});

test("parseFederatedTokenClaims accepts minimal valid claims", () => {
  const result = parseFederatedTokenClaims({
    sub: "user",
    iss: "issuer",
    aud: "audience",
    exp: 1000000000,
    iat: 9999999999,
  });
  assert.equal(result.sub, "user");
  assert.equal(result.email, undefined);
  assert.equal(result.name, undefined);
  assert.equal(result.roles, undefined);
});

test("parseFederatedTokenClaims omits optional fields when not present", () => {
  const result = parseFederatedTokenClaims({
    sub: "user",
    iss: "iss",
    aud: "aud",
    exp: 1,
    iat: 1,
    email: "test@test.com",
  });
  assert.equal(result.email, "test@test.com");
  assert.equal(result.name, undefined);
});
