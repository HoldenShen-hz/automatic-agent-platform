/**
 * Tests for src/platform/contracts/constants/network.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  HTTP_STATUS_GATEWAY_TIMEOUT,
  WEBSOCKET_CLOSE_CODE_MISSING_TOKEN,
  WEBSOCKET_CLOSE_CODE_INVALID_TOKEN,
  WEBSOCKET_CLOSE_CODE_CONNECTION_LIMIT,
  WEBSOCKET_CLOSE_CODE_CONNECTION_TIMEOUT,
  WEBSOCKET_CLOSE_CODE_SERVER_SHUTDOWN,
} from "../../../../src/platform/contracts/constants/network.js";

describe("contracts/constants/network", () => {
  describe("HTTP_STATUS_GATEWAY_TIMEOUT", () => {
    it("should equal 504", () => {
      assert.strictEqual(HTTP_STATUS_GATEWAY_TIMEOUT, 504);
    });
  });

  describe("WEBSOCKET_CLOSE_CODE_MISSING_TOKEN", () => {
    it("should equal 4001", () => {
      assert.strictEqual(WEBSOCKET_CLOSE_CODE_MISSING_TOKEN, 4_001);
    });
  });

  describe("WEBSOCKET_CLOSE_CODE_INVALID_TOKEN", () => {
    it("should equal 4003", () => {
      assert.strictEqual(WEBSOCKET_CLOSE_CODE_INVALID_TOKEN, 4_003);
    });
  });

  describe("WEBSOCKET_CLOSE_CODE_CONNECTION_LIMIT", () => {
    it("should equal 1013", () => {
      assert.strictEqual(WEBSOCKET_CLOSE_CODE_CONNECTION_LIMIT, 1_013);
    });
  });

  describe("WEBSOCKET_CLOSE_CODE_CONNECTION_TIMEOUT", () => {
    it("should equal 4000", () => {
      assert.strictEqual(WEBSOCKET_CLOSE_CODE_CONNECTION_TIMEOUT, 4_000);
    });
  });

  describe("WEBSOCKET_CLOSE_CODE_SERVER_SHUTDOWN", () => {
    it("should equal 1001", () => {
      assert.strictEqual(WEBSOCKET_CLOSE_CODE_SERVER_SHUTDOWN, 1_001);
    });
  });
});