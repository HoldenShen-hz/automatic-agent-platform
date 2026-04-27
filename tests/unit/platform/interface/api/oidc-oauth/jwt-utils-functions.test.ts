import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeJwtJsonSegment,
  parseJwtHeader,
  parseFederatedTokenClaims,
} from "../../../../../../../src/platform/interface/api/oidc-oauth/jwt-utils.js";

test("decodeJwtJsonSegment decodes valid base64url payload", () => {
  // "eyJzdWIiOiJ1c2VyMTIzIn0=" is base64url for {"sub":"user123"}
  const result = decodeJwtJsonSegment("eyJzdWIiOiJ1c2VyMTIzIn0", "payload");
  assert.deepEqual(result, { sub: "user123" });
});

test("decodeJwtJsonSegment decodes valid base64url header", () => {
  // "eyJhbGciOiJSUzI1NiJ9" is base64url for {"alg":"RS256"}
  const result = decodeJwtJsonSegment("eyJhbGciOiJSUzI1NiJ9", "header");
  assert.deepEqual(result, { alg: "RS256" });
});

test("decodeJwtJsonSegment throws on invalid base64", () => {
  try {
    decodeJwtJsonSegment("not-valid-base64!!!", "payload");
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
    assert.equal(error.statusCode, 401);
  }
});

test("decodeJwtJsonSegment throws on invalid JSON", () => {
  // Valid base64 but invalid JSON
  const invalidJson = Buffer.from("this is not json").toString("base64url");
  try {
    decodeJwtJsonSegment(invalidJson, "header");
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.header_invalid");
  }
});

test("parseJwtHeader extracts kid and alg from valid header", () => {
  const header = { kid: "key123", alg: "RS256" };
  const result = parseJwtHeader(header);
  assert.equal(result.kid, "key123");
  assert.equal(result.alg, "RS256");
});

test("parseJwtHeader handles missing optional fields", () => {
  const header = {};
  const result = parseJwtHeader(header);
  assert.equal(result.kid, undefined);
  assert.equal(result.alg, undefined);
});

test("parseJwtHeader throws when header is not a record", () => {
  try {
    parseJwtHeader("string header");
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.header_invalid");
  }
});

test("parseJwtHeader throws when header is array", () => {
  try {
    parseJwtHeader([1, 2, 3]);
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.header_invalid");
  }
});

test("parseJwtHeader throws when kid is not string", () => {
  try {
    parseJwtHeader({ kid: 123 });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.header_invalid");
  }
});

test("parseJwtHeader throws when alg is not string", () => {
  try {
    parseJwtHeader({ alg: true });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.header_invalid");
  }
});

test("parseJwtHeader allows null kid", () => {
  const header = { kid: null, alg: "RS256" };
  const result = parseJwtHeader(header);
  assert.equal(result.kid, undefined);
  assert.equal(result.alg, "RS256");
});

test("parseFederatedTokenClaims parses minimal valid claims", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "audience",
    exp: 1700000000,
    iat: 1699999999,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user123");
  assert.equal(result.iss, "https://issuer.example.com");
  assert.equal(result.aud, "audience");
  assert.equal(result.exp, 1700000000);
  assert.equal(result.iat, 1699999999);
});

test("parseFederatedTokenClaims parses claims with string array audience", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: ["aud1", "aud2"],
    exp: 1700000000,
    iat: 1699999999,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.deepEqual(result.aud, ["aud1", "aud2"]);
});

test("parseFederatedTokenClaims parses claims with optional fields", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "audience",
    exp: 1700000000,
    iat: 1699999999,
    email: "user@example.com",
    name: "Test User",
    roles: ["admin", "user"],
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.email, "user@example.com");
  assert.equal(result.name, "Test User");
  assert.deepEqual(result.roles, ["admin", "user"]);
});

test("parseFederatedTokenClaims throws when claims is not a record", () => {
  try {
    parseFederatedTokenClaims("not an object");
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when sub is missing", () => {
  try {
    parseFederatedTokenClaims({
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: 1700000000,
      iat: 1699999999,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when sub is not string", () => {
  try {
    parseFederatedTokenClaims({
      sub: 123,
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: 1700000000,
      iat: 1699999999,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when iss is not string", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: null,
      aud: "audience",
      exp: 1700000000,
      iat: 1699999999,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when exp is not number", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: "1700000000",
      iat: 1699999999,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when iat is not number", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: 1700000000,
      iat: NaN,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when exp is Infinity", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: Infinity,
      iat: 1699999999,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when audience is invalid type", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: { type: "object" },
      exp: 1700000000,
      iat: 1699999999,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when audience array contains non-strings", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: ["valid", 123, "also valid"],
      exp: 1700000000,
      iat: 1699999999,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when email is not string", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: 1700000000,
      iat: 1699999999,
      email: 123,
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when name is not string", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: 1700000000,
      iat: 1699999999,
      name: ["array", "not", "string"],
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims throws when roles is not string array", () => {
  try {
    parseFederatedTokenClaims({
      sub: "user123",
      iss: "https://issuer.example.com",
      aud: "audience",
      exp: 1700000000,
      iat: 1699999999,
      roles: ["admin", 123],
    });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.payload_invalid");
  }
});

test("parseFederatedTokenClaims allows null optional fields", () => {
  const claims = {
    sub: "user123",
    iss: "https://issuer.example.com",
    aud: "audience",
    exp: 1700000000,
    iat: 1699999999,
    email: null,
    name: null,
    roles: null,
  };
  const result = parseFederatedTokenClaims(claims);
  assert.equal(result.sub, "user123");
  assert.equal(result.email, undefined);
  assert.equal(result.name, undefined);
  assert.equal(result.roles, undefined);
});

test("decodeJwtJsonSegment decodes empty object", () => {
  const result = decodeJwtJsonSegment("e30", "payload"); // "e30" = base64url of "{}"
  assert.deepEqual(result, {});
});

test("parseJwtHeader allows numeric alg in legacy format", () => {
  // This is a numeric alg which is not a string, so it should fail
  try {
    parseJwtHeader({ alg: 256 });
    assert.fail("Expected error");
  } catch (error: any) {
    assert.equal(error.code, "jwt.header_invalid");
  }
});