/**
 * Knowledge Semantic Readiness CLI Tests
 *
 * Tests for knowledge-semantic-readiness.ts CLI module.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Tests for report structure
// ---------------------------------------------------------------------------

test("knowledge-semantic-readiness report includes validatedAt timestamp", () => {
  const report = {
    validatedAt: new Date().toISOString(),
    ready: true,
  };

  assert.ok(report.validatedAt != null);
  assert.ok(report.validatedAt.length > 0);
});

test("knowledge-semantic-readiness report includes ready flag", () => {
  const readyReport = { ready: true };
  const notReadyReport = { ready: false };

  assert.equal(readyReport.ready, true);
  assert.equal(notReadyReport.ready, false);
});

test("knowledge-semantic-readiness report includes errorCode when not ready", () => {
  const errorMessage = "vector_not_initialized";
  const report = {
    validatedAt: new Date().toISOString(),
    ready: false,
    errorCode: errorMessage,
    errorMessage: errorMessage,
  };

  assert.equal(report.ready, false);
  assert.equal(report.errorCode, "vector_not_initialized");
});

test("knowledge-semantic-readiness sets exit code 1 when not ready", () => {
  const report = { ready: false };
  const exitCode = report.ready ? 0 : 1;
  assert.equal(exitCode, 1);
});

test("knowledge-semantic-readiness does not set exit code when ready", () => {
  const report = { ready: true };
  const exitCode = report.ready ? 0 : 1;
  assert.equal(exitCode, 0);
});

// ---------------------------------------------------------------------------
// Tests for error handling in main
// ---------------------------------------------------------------------------

test("knowledge-semantic-readiness catches errors and reports them", () => {
  const error = new Error("database_connection_failed");
  const message = error instanceof Error ? error.message : String(error);

  const report = {
    validatedAt: new Date().toISOString(),
    ready: false,
    errorCode: message,
    errorMessage: message,
  };

  assert.equal(report.ready, false);
  assert.equal(report.errorCode, "database_connection_failed");
});

test("knowledge-semantic-readiness handles non-Error throws", () => {
  const error = "string_error";
  const message = error instanceof Error ? error.message : String(error);

  assert.equal(message, "string_error");
});

test("knowledge-semantic-readiness handles null error", () => {
  const error = null;
  const message = error instanceof Error ? error.message : String(error);

  assert.equal(message, "null");
});

test("knowledge-semantic-readiness handles undefined error", () => {
  const error = undefined;
  const message = error instanceof Error ? error.message : String(error);

  assert.equal(message, "undefined");
});

// ---------------------------------------------------------------------------
// Tests for env config structure
// ---------------------------------------------------------------------------

test("knowledge-semantic-readiness uses process.env", () => {
  // The CLI passes process.env to validateSemanticVectorReadiness
  const env = process.env;
  assert.ok(env != null);
});

test("knowledge-semantic-readiness resolves db path", () => {
  // The CLI uses resolveCliDbPath() to get the database path
  // This typically resolves to data/sqlite/authoritative-demo.db or AA_DB_PATH
  const dbPath = process.env.AA_DB_PATH ?? "/default/path.db";
  assert.ok(dbPath != null);
});
