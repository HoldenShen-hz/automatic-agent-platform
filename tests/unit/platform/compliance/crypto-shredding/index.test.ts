import assert from "node:assert/strict";
import test from "node:test";

import * as cryptoShredding from "../../../../../src/platform/compliance/crypto-shredding/index.js";

test("crypto-shredding module exports DekManager", () => {
  assert.ok("DekManager" in cryptoShredding);
});

test("crypto-shredding module exports CryptoShreddingService", () => {
  assert.ok("CryptoShreddingService" in cryptoShredding);
});

test("crypto-shredding module exports crypto-shredding sub-modules", () => {
  const exports = Object.keys(cryptoShredding);
  assert.ok(exports.length > 0, "crypto-shredding should export something");
});