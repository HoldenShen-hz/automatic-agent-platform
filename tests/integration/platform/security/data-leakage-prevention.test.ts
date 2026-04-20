/**
 * Security Integration Test: Data Leakage Prevention
 *
 * Verifies sensitive data is properly redacted in:
 * - Tool outputs
 * - Logs
 * - Error responses
 * - Artifacts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeToolOutput } from "../../../../src/platform/execution/tool-executor/tool-output-sanitizer.js";

test("security: OpenAI API key is redacted in tool output", () => {
  const output = "Using OpenAI API key sk-1234567890abcdefghij for request";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("sk-1234567890"),
    "OpenAI API key should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: Anthropic API key is redacted in tool output", () => {
  const output = "Anthropic key sk-ant-api1234567890abcdef used";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("sk-ant-api"),
    "Anthropic API key should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: GitHub token is redacted in tool output", () => {
  const output = "GitHub token ghp_1234567890abcdefghijklmnopqrstuvwxyz used";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("ghp_1234567890"),
    "GitHub token should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: GitHub fine-grained PAT is redacted", () => {
  const output = "github_pat_1234567890abcdefghijklmnopqrstuvwxyz";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("github_pat_"),
    "GitHub PAT should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: AWS access key ID is redacted", () => {
  const output = "AWS access key AKIA1234567890ABCDEF used";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("AKIA1234567890ABCDEF"),
    "AWS access key should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: Bearer token in Authorization header is redacted", () => {
  const output =
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("eyJhbGciOiJIUzI1NiJ9"),
    "Bearer token should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: database connection string credentials are redacted", () => {
  const output = "Connected to postgres://user:secretpass@localhost:5432/db";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("secretpass"),
    "DB password should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: ANSI escape sequences are removed", () => {
  const output = "\u001b[31mError\u001b[0m: \u001b[1mbold message\u001b[0m";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("\u001b["),
    "ANSI escape sequences should be removed",
  );
  assert.ok(
    sanitized.sanitizedText.includes("Error"),
    "Actual content should be preserved",
  );
});

test("security: control characters are removed", () => {
  const output = "Line1\u0000\u0001\u0002Line2\u007FLine3";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("\u0000"),
    "Null byte should be removed",
  );
  assert.ok(
    !sanitized.sanitizedText.includes("\u007F"),
    "Control characters should be removed",
  );
  assert.ok(
    sanitized.sanitizedText.includes("Line1"),
    "Actual content should be preserved",
  );
});

test("security: legitimate output is preserved", () => {
  const output = "File /workspace/src/index.ts has 150 lines";
  const sanitized = sanitizeToolOutput(output);

  assert.strictEqual(
    sanitized.sanitizedText,
    output,
    "Legitimate output should be unchanged",
  );
});

test("security: multiple secrets in same output are all redacted", () => {
  // Use valid patterns that match the sanitizer regexes (12+ chars for OpenAI, 16 for AWS, 20+ for GitHub)
  const output =
    "sk-123456789012 and AKIA9876543210987654 and ghp_abcdefghijklmnopqrstu";
  const sanitized = sanitizeToolOutput(output);

  const redactedCount = (sanitized.sanitizedText.match(/\[REDACTED\]/g) || [])
    .length;
  assert.ok(
    redactedCount >= 3,
    `Should have at least 3 redactions, found ${redactedCount}`,
  );
  assert.ok(
    !sanitized.sanitizedText.includes("sk-123456789012"),
    "OpenAI key should be redacted",
  );
  assert.ok(
    !sanitized.sanitizedText.includes("AKIA9876543210987654"),
    "AWS key should be redacted",
  );
  assert.ok(
    !sanitized.sanitizedText.includes("ghp_abcdefghijklmnopqrstu"),
    "GitHub token should be redacted",
  );
});

test("security: Stripe secret key is redacted", () => {
  const output = "Stripe key sk_test_abcdefghijklmnopqrstuvwxyz";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("sk_live_1234567890"),
    "Stripe secret key should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});

test("security: Google API key is redacted", () => {
  const output = "Google API key AIzaSyabcdefghijklmnopqrstuvwxyz1234567";
  const sanitized = sanitizeToolOutput(output);

  assert.ok(
    !sanitized.sanitizedText.includes("AIzaSy"),
    "Google API key should be redacted",
  );
  assert.ok(
    sanitized.sanitizedText.includes("[REDACTED]"),
    "Should contain redaction marker",
  );
});
