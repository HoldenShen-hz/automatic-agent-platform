import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeJwtJsonSegment,
  parseJwtHeader,
  parseFederatedTokenClaims,
} from "../../../../../src/platform/interface/api/oidc-oauth/jwt-utils.js";
import { AuthError, ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("decodeJwtJsonSegment decodes valid base64url segment", () => {
  // "eyJraWQiOiJ0ZXN0In0" decodes to {"kid":"test"}
  const result = decodeJwtJsonSegment("eyJraWQiOiJ0ZXN0In0", "header");
  assert.deepEqual(result, { kid: "test" });
});

test("decodeJwtJsonSegment decodes payload segment", () => {
  // "eyJzdWIiOiIxMjMiLCJpYXQiOjE1MDB9" decodes to {"sub":"123","iat":1500}
  const result = decodeJwtJsonSegment("eyJzdWIiOiIxMjMiLCJpYXQiOjE1MDB9", "payload");
  assert.deepEqual(result, { sub: "123", iat: 1500 });
});

test("decodeJwtJsonSegment throws AuthError for invalid base64", () => {
  assert.throws(
    () => decodeJwtJsonSegment("not-valid-base64!!!", "header"),
    (err: unknown) => err instanceof AuthError && err.code === "jwt.header_invalid"
  );
});

test("parseJwtHeader parses valid header with kid and alg", () => {
  const result = parseJwtHeader({ kid: "key-123", alg: "RS256" });
  assert.equal(result.kid, "key-123");
  assert.equal(result.alg, "RS256");
});

test("parseJwtHeader parses header with only kid", () => {
  const result = parseJwtHeader({ kid: "key-123" });
  assert.equal(result.kid, "key-123");
  assert.equal(result.alg, undefined);
});

test("parseJwtHeader parses header with only alg", () => {
  const result = parseJwtHeader({ alg: "ES256" });
  assert.equal(result.kid, undefined);
  assert.equal(result.alg, "ES256");
});

test("parseJwtHeader parses empty header", () => {
  const result = parseJwtHeader({});
  assert.equal(result.kid, undefined);
  assert.equal(result.alg, undefined);
});

test("parseJwtHeader throws for non-object", () => {
  assert.throws(
    () => parseJwtHeader("not an object"),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.header_invalid"
  );
});

test("parseJwtHeader throws for array", () => {
  assert.throws(
    () => parseJwtHeader(["array"]),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.header_invalid"
  );
});

test("parseJwtHeader throws for null", () => {
  assert.throws(
    () => parseJwtHeader(null),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.header_invalid"
  );
});

test("parseJwtHeader throws when kid is not string", () => {
  assert.throws(
    () => parseJwtHeader({ kid: 123 }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.header_invalid"
  );
});

test("parseJwtHeader throws when alg is not string", () => {
  assert.throws(
    () => parseJwtHeader({ alg: 123 }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.header_invalid"
  );
});

test("parseFederatedTokenClaims parses valid claims with string aud", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user123");
  assert.equal(result.iss, "https://issuer.example.com");
  assert.equal(result.aud, "client-id");
  assert.equal(result.exp, 1700000000);
  assert.equal(result.iat, 1600000000);
});

test("parseFederatedTokenClaims parses valid claims with array aud", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: ["client-1", "client-2"],
    exp: 1700000000,
    iat: 1600000000,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.deepEqual(result.aud, ["client-1", "client-2"]);
});

test("parseFederatedTokenClaims parses claims with optional fields", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "user"],
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.name, "Test User");
  assert.deepEqual(result.roles, ["admin", "user"]);
});

test("parseFederatedTokenClaims parses claims without optional fields", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.email, undefined);
  assert.equal(result.name, undefined);
  assert.equal(result.roles, undefined);
});

test("parseFederatedTokenClaims throws for non-object", () => {
  assert.throws(
    () => parseFederatedTokenClaims("not an object"),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for missing sub", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      iss: "https://issuer.example.com",
      aud: "client-id",
      exp: 1700000000,
      iat: 1600000000,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for missing iss", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      sub: "user123",
      aud: "client-id",
      exp: 1700000000,
      iat: 1600000000,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for invalid exp", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "client-id",
      exp: "not a number",
      iat: 1600000000,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for invalid iat", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "client-id",
      exp: 1700000000,
      iat: "not a number",
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for invalid aud format", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: { not: "a string or array" },
      exp: 1700000000,
      iat: 1600000000,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for invalid email", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "client-id",
      exp: 1700000000,
      iat: 1600000000,
      email: 123,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for invalid name", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "client-id",
      exp: 1700000000,
      iat: 1600000000,
      name: 123,
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});

test("parseFederatedTokenClaims throws for invalid roles", () => {
  assert.throws(
    () => parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "client-id",
      exp: 1700000000,
      iat: 1600000000,
      roles: ["valid", 123],
    }),
    (err: unknown) => err instanceof ValidationError && err.code === "jwt.payload_invalid"
  );
});
