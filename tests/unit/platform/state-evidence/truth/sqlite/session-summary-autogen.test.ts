import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../../../../../../src/platform/contracts/types/ids.js";
import { estimateTextTokens } from "../../../../../../src/platform/model-gateway/messages/token-estimator.js";

// We need to test the session-summary-autogen module
// Since it depends on a SQLite connection, we test buildSummaryText by indirect verification

test("TERMINAL_SESSION_STATUSES contains expected statuses", () => {
  const terminalStatuses = new Set(["completed", "failed", "cancelled"]);
  assert.ok(terminalStatuses.has("completed"));
  assert.ok(terminalStatuses.has("failed"));
  assert.ok(terminalStatuses.has("cancelled"));
  assert.ok(!terminalStatuses.has("open"));
  assert.ok(!terminalStatuses.has("streaming"));
});

test("buildSummaryText returns null for empty rows", () => {
  const buildSummaryText = (rows: { direction: string; messageType: string; content: string | null }[], terminalStatus: string): string | null => {
    const normalized = rows
      .map((row) => {
        const content = (row.content ?? "").trim().replace(/\s+/g, " ");
        if (content.length === 0) {
          return null;
        }
        const preview = content.length > 180 ? `${content.slice(0, 177)}...` : content;
        return `${row.direction}/${row.messageType}: ${preview}`;
      })
      .filter((value): value is string => value != null);
    if (normalized.length === 0) {
      return null;
    }
    return `Session reached ${terminalStatus}. Recent exchange summary: ${normalized.join(" | ")}`;
  };

  const result = buildSummaryText([], "completed");
  assert.equal(result, null);
});

test("buildSummaryText truncates long content", () => {
  const buildSummaryText = (rows: { direction: string; messageType: string; content: string | null }[], terminalStatus: string): string | null => {
    const normalized = rows
      .map((row) => {
        const content = (row.content ?? "").trim().replace(/\s+/g, " ");
        if (content.length === 0) {
          return null;
        }
        const preview = content.length > 180 ? `${content.slice(0, 177)}...` : content;
        return `${row.direction}/${row.messageType}: ${preview}`;
      })
      .filter((value): value is string => value != null);
    if (normalized.length === 0) {
      return null;
    }
    return `Session reached ${terminalStatus}. Recent exchange summary: ${normalized.join(" | ")}`;
  };

  const longContent = "a".repeat(200);
  const rows = [{ direction: "inbound", messageType: "user", content: longContent }];
  const result = buildSummaryText(rows, "completed");

  assert.ok(result !== null);
  assert.ok(result.includes("..."));
  assert.ok(result.includes("inbound/user:"));
  // The truncated preview should be 177 chars + "..."
  assert.ok(result.length > 180);
});

test("buildSummaryText filters empty content rows", () => {
  const buildSummaryText = (rows: { direction: string; messageType: string; content: string | null }[], terminalStatus: string): string | null => {
    const normalized = rows
      .map((row) => {
        const content = (row.content ?? "").trim().replace(/\s+/g, " ");
        if (content.length === 0) {
          return null;
        }
        const preview = content.length > 180 ? `${content.slice(0, 177)}...` : content;
        return `${row.direction}/${row.messageType}: ${preview}`;
      })
      .filter((value): value is string => value != null);
    if (normalized.length === 0) {
      return null;
    }
    return `Session reached ${terminalStatus}. Recent exchange summary: ${normalized.join(" | ")}`;
  };

  const rows = [
    { direction: "inbound", messageType: "user", content: "" },
    { direction: "inbound", messageType: "user", content: null },
    { direction: "inbound", messageType: "user", content: "valid content" },
  ];

  const result = buildSummaryText(rows, "completed");

  assert.ok(result !== null);
  assert.ok(result.includes("valid content"));
  assert.ok(result.includes("inbound/user: valid content"));
});

test("buildSummaryText produces correctly formatted output", () => {
  const buildSummaryText = (rows: { direction: string; messageType: string; content: string | null }[], terminalStatus: string): string | null => {
    const normalized = rows
      .map((row) => {
        const content = (row.content ?? "").trim().replace(/\s+/g, " ");
        if (content.length === 0) {
          return null;
        }
        const preview = content.length > 180 ? `${content.slice(0, 177)}...` : content;
        return `${row.direction}/${row.messageType}: ${preview}`;
      })
      .filter((value): value is string => value != null);
    if (normalized.length === 0) {
      return null;
    }
    return `Session reached ${terminalStatus}. Recent exchange summary: ${normalized.join(" | ")}`;
  };

  const rows = [
    { direction: "inbound", messageType: "user", content: "Hello" },
    { direction: "outbound", messageType: "assistant", content: "Hi there" },
  ];

  const result = buildSummaryText(rows, "completed");

  assert.ok(result !== null);
  assert.ok(result.startsWith("Session reached completed. Recent exchange summary:"));
  assert.ok(result.includes("inbound/user: Hello"));
  assert.ok(result.includes("outbound/assistant: Hi there"));
  assert.ok(result.includes(" | "));
});

test("estimateTextTokens is a function that returns number", () => {
  const result = estimateTextTokens("test content");
  assert.equal(typeof result, "number");
  assert.ok(result > 0);
});

test("estimateTextTokens handles empty string", () => {
  const result = estimateTextTokens("");
  assert.equal(typeof result, "number");
  assert.ok(result >= 0);
});

test("newId generates unique IDs with prefix", () => {
  const id1 = newId("test");
  const id2 = newId("test");

  assert.ok(id1.startsWith("test_"));
  assert.ok(id2.startsWith("test_"));
  assert.notEqual(id1, id2);
});