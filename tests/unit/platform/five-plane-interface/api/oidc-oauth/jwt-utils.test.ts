import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  decodeJwtJsonSegment,
  parseJwtHeader,
  parseFederatedTokenClaims,
} from "../../../../../../src/platform/five-plane-interface/api/oidc-oauth/jwt-utils.js";
import type { FederatedTokenClaims } from "../../../../../../src/platform/five-plane-interface/api/oidc-oauth/types.js";

test("decodeJwtJsonSegment decodes valid base64url encoded JSON", () => {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "key123" }), "utf8").toString("base64url");
  const result = decodeJwtJsonSegment(header, "header");
  assert.deepEqual(result, { alg: "RS256", kid: "key123" });
});

test("decodeJwtJsonSegment throws AuthError for invalid base64", () => {
  assert.throws(
    () => decodeJwtJsonSegment("not-valid-base64!!!", "header"),
    /jwt\.header_invalid/,
  );
});

test("decodeJwtJsonSegment throws AuthError for invalid JSON", () => {
  const invalidJson = Buffer.from("not json", "utf8").toString("base64url");
  assert.throws(
    () => decodeJwtJsonSegment(invalidJson, "header"),
    /jwt\.header_invalid/,
  );
});

test("decodeJwtJsonSegment works for payload segment", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "user123", iss: "https://example.com" }), "utf8").toString("base64url");
  const result = decodeJwtJsonSegment(payload, "payload");
  assert.deepEqual(result, { sub: "user123", iss: "https://example.com" });
});

test("parseJwtHeader extracts kid and alg from valid header", () => {
  const result = parseJwtHeader({ alg: "RS256", kid: "key123" });
  assert.deepEqual(result, { alg: "RS256", kid: "key123" });
});

test("parseJwtHeader returns empty object when no kid or alg", () => {
  const result = parseJwtHeader({});
  assert.deepEqual(result, {});
});

test("parseJwtHeader only extracts string kid", () => {
  const result = parseJwtHeader({ alg: "RS256", kid: 123 });
  assert.deepEqual(result, { alg: "RS256" });
});

test("parseJwtHeader only extracts string alg", () => {
  const result = parseJwtHeader({ alg: 123, kid: "key123" });
  assert.deepEqual(result, { kid: "key123" });
});

test("parseJwtHeader throws for non-object value", () => {
  assert.throws(
    () => parseJwtHeader(null),
    /jwt\.header_invalid/,
  );
  assert.throws(
    () => parseJwtHeader("string"),
    /jwt\.header_invalid/,
  );
  assert.throws(
    () => parseJwtHeader(123),
    /jwt\.header_invalid/,
  );
  assert.throws(
    () => parseJwtHeader(undefined),
    /jwt\.header_invalid/,
  );
  assert.throws(
    () => parseJwtHeader(["array"]),
    /jwt\.header_invalid/,
  );
});

test("parseJwtHeader ignores extra fields", () => {
  const result = parseJwtHeader({ alg: "RS256", kid: "key123", extra: "ignored", num: 42 });
  assert.deepEqual(result, { alg: "RS256", kid: "key123" });
});

test("parseFederatedTokenClaims parses valid claims with string aud", () => {
  const claims: FederatedTokenClaims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id-123",
    exp: 1747200000,
    iat: 1747196400,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "user"],
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user123");
  assert.equal(result.iss, "https://issuer.example.com");
  assert.equal(result.aud, "client-id-123");
  assert.equal(result.exp, 1747200000);
  assert.equal(result.iat, 1747196400);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.name, "Test User");
  assert.deepEqual(result.roles, ["admin", "user"]);
});

test("parseFederatedTokenClaims parses valid claims with array aud", () => {
  const claims = {
    sub: "user456",
    iss: "https://issuer.example.com",
    aud: ["client-1", "client-2", "client-3"],
    exp: 1747200000,
    iat: 1747196400,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user456");
  assert.deepEqual(result.aud, ["client-1", "client-2", "client-3"]);
});

test("parseFederatedTokenClaims works with minimal claims", () => {
  const claims = {
    sub: "user789",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user789");
  assert.equal(result.iss, "https://issuer.example.com");
  assert.equal(result.aud, "client-id");
  assert.equal(result.exp, 1747200000);
  assert.equal(result.iat, 1747196400);
  assert.equal(result.email, undefined);
  assert.equal(result.name, undefined);
  assert.equal(result.roles, undefined);
});

test("parseFederatedTokenClaims throws when sub is missing or not string", () => {
  const claims = {
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
  };
  assert.throws(
    () => parseFederatedTokenClaims(claims),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, sub: 123 }),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws when iss is missing or not string", () => {
  const claims = {
    sub: "user123",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
  };
  assert.throws(
    () => parseFederatedTokenClaims(claims),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, iss: 123 }),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws when exp is missing, not number, or not finite", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    iat: 1747196400,
  };
  assert.throws(
    () => parseFederatedTokenClaims(claims),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, exp: "123" }),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, exp: Infinity }),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, exp: -Infinity }),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws when iat is missing, not number, or not finite", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
  };
  assert.throws(
    () => parseFederatedTokenClaims(claims),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, iat: "123" }),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, iat: NaN }),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws when aud is invalid", () => {
  const baseClaims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    exp: 1747200000,
    iat: 1747196400,
  };

  // number
  assert.throws(
    () => parseFederatedTokenClaims({ ...baseClaims, aud: 123 }),
    /jwt\.payload_invalid/,
  );

  // object
  assert.throws(
    () => parseFederatedTokenClaims({ ...baseClaims, aud: { key: "value" } }),
    /jwt\.payload_invalid/,
  );

  // array with non-strings
  assert.throws(
    () => parseFederatedTokenClaims({ ...baseClaims, aud: ["client", 123] }),
    /jwt\.payload_invalid/,
  );

  // empty array
  assert.throws(
    () => parseFederatedTokenClaims({ ...baseClaims, aud: [] }),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws when email is not string", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
    email: 123,
  };
  assert.throws(
    () => parseFederatedTokenClaims(claims),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws when name is not string", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
    name: 123,
  };
  assert.throws(
    () => parseFederatedTokenClaims(claims),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws when roles is not array of strings", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1747200000,
    iat: 1747196400,
    roles: "admin",
  };
  assert.throws(
    () => parseFederatedTokenClaims(claims),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, roles: [123, "user"] }),
    /jwt\.payload_invalid/,
  );

  assert.throws(
    () => parseFederatedTokenClaims({ ...claims, roles: ["admin", 123] }),
    /jwt\.payload_invalid/,
  );
});

test("parseFederatedTokenClaims throws for non-object value", () => {
  assert.throws(
    () => parseFederatedTokenClaims(null),
    /jwt\.payload_invalid/,
  );
  assert.throws(
    () => parseFederatedTokenClaims("string"),
    /jwt\.payload_invalid/,
  );
  assert.throws(
    () => parseFederatedTokenClaims(123),
    /jwt\.payload_invalid/,
  );
  assert.throws(
    () => parseFederatedTokenClaims(undefined),
    /jwt\.payload_invalid/,
  );
  assert.throws(
    () => parseFederatedTokenClaims(["array"]),
    /jwt\.payload_invalid/,
  );
});
