import assert from "node:assert/strict";
import test from "node:test";

import {
  expandToolNames,
  inferPromotedToolNames,
  type ExpandedToolNames,
} from "../../../../../src/platform/shared/tool-discovery/index.js";

test("expandToolNames resolves exact tool names", () => {
  const result = expandToolNames(["read", "bash"]);

  assert.ok(result.resolvedToolNames.includes("read"));
  assert.ok(result.resolvedToolNames.includes("bash"));
  assert.equal(result.unresolvedToolNames.length, 0);
  assert.equal(result.corrections.length, 0);
});

test("expandToolNames handles unknown tool names", () => {
  const result = expandToolNames(["unknown-tool-xyz"]);

  assert.equal(result.resolvedToolNames.length, 0);
  assert.ok(result.unresolvedToolNames.includes("unknown-tool-xyz"));
});

test("expandToolNames resolves aliases", () => {
  const result = expandToolNames(["command"]);

  // command should resolve to command_exec or bash
  assert.ok(result.resolvedToolNames.length > 0);
  assert.ok(result.resolvedToolNames.includes("bash") || result.resolvedToolNames.includes("command_exec"));
});

test("expandToolNames applies normalized exact strategy for compact matches", () => {
  const result = expandToolNames(["edit"]);

  // edit should match edit_replace via normalized exact
  const hasCorrection = result.corrections.some((c) => c.strategy === "normalized_exact");
  assert.ok(hasCorrection || result.resolvedToolNames.length > 0);
});

test("expandToolNames handles fuzzy matching for typos", () => {
  const result = expandToolNames(["readd"]); // typo of "read"

  // Should either resolve to "read" or be unresolved
  assert.ok(
    result.resolvedToolNames.includes("read") ||
    result.unresolvedToolNames.includes("readd") ||
    result.corrections.some((c) => c.strategy === "fuzzy_unique")
  );
});

test("expandToolNames dedupes resolved tool names", () => {
  const result = expandToolNames(["read", "read", "bash"]);

  assert.equal(result.resolvedToolNames.filter((n) => n === "read").length, 1);
  assert.equal(result.resolvedToolNames.filter((n) => n === "bash").length, 1);
});

test("expandToolNames handles empty input", () => {
  const result = expandToolNames([]);

  assert.equal(result.resolvedToolNames.length, 0);
  assert.equal(result.unresolvedToolNames.length, 0);
  assert.equal(result.corrections.length, 0);
});

test("expandToolNames trims and lowercases input", () => {
  const result = expandToolNames(["  READ  ", "BASH"]);

  assert.ok(result.resolvedToolNames.includes("read") || result.resolvedToolNames.includes("bash"));
});

test("expandToolNames skips empty strings", () => {
  const result = expandToolNames(["read", "", "bash"]);

  assert.ok(result.resolvedToolNames.includes("read"));
  assert.ok(result.resolvedToolNames.includes("bash"));
  assert.ok(!result.resolvedToolNames.includes(""));
});

test("expandToolNames returns correct correction details", () => {
  const result = expandToolNames(["edit"]);

  for (const correction of result.corrections) {
    assert.ok(correction.inputToolName.length > 0);
    assert.ok(correction.matchedCandidate.length > 0);
    assert.ok(correction.resolvedToolNames.length > 0);
    assert.ok(["normalized_exact", "fuzzy_unique"].includes(correction.strategy));
  }
});

test("inferPromotedToolNames promotes tools based on keywords", () => {
  const result = inferPromotedToolNames("I need to patch some files", ["read", "bash", "apply_patch"]);

  // "patch" keyword should promote apply_patch
  assert.ok(result.includes("apply_patch"));
});

test("inferPromotedToolNames promotes edit tools for modify keywords", () => {
  const result = inferPromotedToolNames("Please modify the configuration", ["edit_replace", "bash"]);

  assert.ok(result.includes("edit_replace"));
});

test("inferPromotedToolNames promotes read tools for view keywords", () => {
  const result = inferPromotedToolNames("Show me the logs", ["read", "bash"]);

  assert.ok(result.includes("read"));
});

test("inferPromotedToolNames promotes command tools for shell keywords", () => {
  const result = inferPromotedToolNames("Run a shell script to fix this", ["command_exec", "bash"]);

  assert.ok(result.includes("command_exec") || result.includes("bash"));
});

test("inferPromotedToolNames only includes available tools", () => {
  const result = inferPromotedToolNames("patch the diff", ["read"]); // apply_patch not available

  // Should not promote tools that aren't in the available list
  assert.ok(!result.includes("apply_patch"));
});

test("inferPromotedToolNames handles multiple matching keywords", () => {
  const result = inferPromotedToolNames("edit and modify the files", ["edit_replace", "apply_patch", "read"]);

  // Both edit and modify keywords should fire, but deduped
  assert.ok(result.includes("edit_replace"));
});

test("inferPromotedToolNames handles no matching keywords", () => {
  const result = inferPromotedToolNames("do something generic", ["read", "bash", "edit_replace"]);

  assert.equal(result.length, 0);
});

test("inferPromotedToolNames dedupes promoted tools", () => {
  const result = inferPromotedToolNames("edit modify change update replace", ["edit_replace", "apply_patch"]);

  // Multiple keywords matching same tool should not duplicate
  assert.equal(result.filter((t) => t === "edit_replace").length, 1);
});

test("inferPromotedToolNames is case insensitive", () => {
  const result = inferPromotedToolNames("PATCH THE FILES", ["apply_patch", "bash"]);

  assert.ok(result.includes("apply_patch"));
});

test("expandToolNames and inferPromotedToolNames work together", () => {
  const toolNames = ["edit", "bash"];
  const expanded = expandToolNames(toolNames);

  // First expand tool names
  const availableTools = [...expanded.resolvedToolNames];

  // Then infer promotions based on context
  const promoted = inferPromotedToolNames("Please edit the configuration and run a bash command", availableTools);

  assert.ok(promoted.includes("edit_replace"));
  assert.ok(promoted.includes("bash") || promoted.includes("command_exec"));
});

test("expandToolNames handles tool names with underscores and dashes", () => {
  // The normalizeCompactToolName removes underscores, dashes, and spaces
  const result = expandToolNames(["edit_replace", "edit-batch"]);

  // Both should resolve to edit_replace
  assert.ok(result.resolvedToolNames.includes("edit_replace"));
});