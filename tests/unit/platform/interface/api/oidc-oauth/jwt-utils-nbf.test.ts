import assert from "node:assert/strict";
import test from "node:test";

import { parseFederatedTokenClaims } from "../../../../../../src/platform/five-plane-interface/api/oidc-oauth/jwt-utils.js";

test("parseFederatedTokenClaims throws when nbf is present but not a number", () => {
  assert.throws(
    () =>
      parseFederatedTokenClaims({
        sub: "user123",
        iss: "https://issuer.example.com",
        aud: "client-id",
        exp: 1700000000,
        iat: 1600000000,
        nbf: "not-a-number",
      }),
    (err: unknown) => {
      const error = err as { code?: string };
      return error.code === "jwt.payload_invalid";
    }
  );
});

test("parseFederatedTokenClaims throws when nbf is present but not finite", () => {
  assert.throws(
    () =>
      parseFederatedTokenClaims({
        sub: "user123",
        iss: "https://issuer.example.com",
        aud: "client-id",
        exp: 1700000000,
        iat: 1600000000,
        nbf: Infinity,
      }),
    (err: unknown) => {
      const error = err as { code?: string };
      return error.code === "jwt.payload_invalid";
    }
  );
});

test("parseFederatedTokenClaims throws when nbf is NaN", () => {
  assert.throws(
    () =>
      parseFederatedTokenClaims({
        sub: "user123",
        iss: "https://issuer.example.com",
        aud: "client-id",
        exp: 1700000000,
        iat: 1600000000,
        nbf: NaN,
      }),
    (err: unknown) => {
      const error = err as { code?: string };
      return error.code === "jwt.payload_invalid";
    }
  );
});

test("parseFederatedTokenClaims accepts valid nbf", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
    nbf: 1599999999,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.nbf, 1599999999);
});

test("parseFederatedTokenClaims throws when jti is present but not a string", () => {
  assert.throws(
    () =>
      parseFederatedTokenClaims({
        sub: "user123",
        iss: "https://issuer.example.com",
        aud: "client-id",
        exp: 1700000000,
        iat: 1600000000,
        jti: 12345,
      }),
    (err: unknown) => {
      const error = err as { code?: string };
      return error.code === "jwt.payload_invalid";
    }
  );
});

test("parseFederatedTokenClaims accepts valid jti", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
    jti: "unique-token-id-123",
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.jti, "unique-token-id-123");
});

test("parseFederatedTokenClaims accepts empty roles array", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "client-id",
    exp: 1700000000,
    iat: 1600000000,
    roles: [],
  };
  const result = parseFederatedTokenClaims(claims);
  assert.deepEqual(result.roles, []);
});

test("parseFederatedTokenClaims throws when audience array is empty", () => {
  assert.throws(
    () =>
      parseFederatedTokenClaims({
        sub: "user123",
        iss: "https://issuer.example.com",
        aud: [],
        exp: 1700000000,
        iat: 1600000000,
      }),
    (err: unknown) => {
      const error = err as { code?: string };
      return error.code === "jwt.payload_invalid";
    }
  );
});