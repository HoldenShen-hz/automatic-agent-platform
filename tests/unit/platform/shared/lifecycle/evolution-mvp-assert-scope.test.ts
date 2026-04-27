/**
 * Unit tests for assertEvolutionScope function.
 *
 * Tests validation of scope type and reference format.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { assertEvolutionScope } from "../../../../../src/ops-maturity/drift-detection/evolution-mvp-support.js";

test("assertEvolutionScope accepts valid division scope", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("division", "div-123");
  });
});

test("assertEvolutionScope accepts valid role scope", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("role", "role-456");
  });
});

test("assertEvolutionScope accepts valid task_intent scope", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("task_intent", "task-intent-789");
  });
});

test("assertEvolutionScope accepts scope ref with dots", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("division", "div.123.456");
  });
});

test("assertEvolutionScope accepts scope ref with underscores", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("division", "div_123_456");
  });
});

test("assertEvolutionScope accepts scope ref with colons", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("role", "region:us-west:resource-1");
  });
});

test("assertEvolutionScope accepts scope ref with hyphens", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("role", "my-role-name-123");
  });
});

test("assertEvolutionScope accepts minimum length scope ref (2 chars)", () => {
  assert.doesNotThrow(() => {
    assertEvolutionScope("division", "d1");
  });
});

test("assertEvolutionScope accepts maximum length scope ref (128 chars)", () => {
  const maxLengthRef = "a".repeat(128);
  assert.doesNotThrow(() => {
    assertEvolutionScope("division", maxLengthRef);
  });
});

test("assertEvolutionScope rejects scope ref that is too short (1 char)", () => {
  assert.throws(
    () => assertEvolutionScope("division", "d"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects empty scope ref", () => {
  assert.throws(
    () => assertEvolutionScope("division", ""),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref that is too long (129 chars)", () => {
  const tooLongRef = "a".repeat(129);
  assert.throws(
    () => assertEvolutionScope("division", tooLongRef),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with spaces", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div 123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with special characters", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div@123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with hash", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div#123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with dollar sign", () => {
  assert.throws(
    () => assertEvolutionScope("role", "role$123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with percent", () => {
  assert.throws(
    () => assertEvolutionScope("task_intent", "task%123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with caret", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div^123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with ampersand", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div&123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with asterisk", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div*123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with exclamation", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div!123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with question mark", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div?123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with tilde", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div~123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with plus", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div+123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with equals", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div=123"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with quotes", () => {
  assert.throws(
    () => assertEvolutionScope("division", 'div"123"'),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with brackets", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div[123]"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref with parentheses", () => {
  assert.throws(
    () => assertEvolutionScope("division", "div(123)"),
    /evolution\.invalid_scope_ref/,
  );
});

test("assertEvolutionScope rejects scope ref starting with number", () => {
  assert.throws(
    () => assertEvolutionScope("division", "123div"),
    /evolution\.invalid_scope_ref/,
  );
});
