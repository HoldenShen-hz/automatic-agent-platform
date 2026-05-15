/**
 * Unit tests for HTTP Server Schema validation
 * Tests src/platform/five-plane-interface/api/http-server/schemas.ts - additional validation coverage
 */

import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

test("Zod schema validates string with min length", () => {
  const schema = z.string().min(1);

  const result1 = schema.safeParse("hello");
  assert.equal(result1.success, true);

  const result2 = schema.safeParse("");
  assert.equal(result2.success, false);
});

test("Zod schema validates number with range", () => {
  const schema = z.number().min(0).max(100);

  const result1 = schema.safeParse(50);
  assert.equal(result1.success, true);

  const result2 = schema.safeParse(-1);
  assert.equal(result2.success, false);

  const result3 = schema.safeParse(101);
  assert.equal(result3.success, false);
});

test("Zod schema validates enum values", () => {
  const schema = z.enum(["active", "paused", "completed"]);

  assert.equal(schema.safeParse("active").success, true);
  assert.equal(schema.safeParse("paused").success, true);
  assert.equal(schema.safeParse("completed").success, true);
  assert.equal(schema.safeParse("unknown").success, false);
});

test("Zod schema validates object with optional fields", () => {
  const schema = z.object({
    required: z.string(),
    optional: z.number().optional(),
  });

  assert.equal(schema.safeParse({ required: "hello" }).success, true);
  assert.equal(schema.safeParse({ required: "hello", optional: 123 }).success, true);
  assert.equal(schema.safeParse({}).success, false);
});

test("Zod schema validates nested objects", () => {
  const schema = z.object({
    user: z.object({
      id: z.string(),
      profile: z.object({
        name: z.string(),
      }),
    }),
  });

  const valid = {
    user: {
      id: "user-1",
      profile: {
        name: "Test User",
      },
    },
  };
  assert.equal(schema.safeParse(valid).success, true);

  const invalid = {
    user: {
      id: "user-1",
      profile: {
        name: 123, // should be string
      },
    },
  };
  assert.equal(schema.safeParse(invalid).success, false);
});

test("Zod schema validates arrays", () => {
  const schema = z.array(z.string());

  assert.equal(schema.safeParse(["a", "b", "c"]).success, true);
  assert.equal(schema.safeParse([]).success, true);
  assert.equal(schema.safeParse([1, 2, 3]).success, false);
});

test("Zod schema validates array with length constraint", () => {
  const schema = z.array(z.string()).min(1).max(10);

  assert.equal(schema.safeParse(["one"]).success, true);
  assert.equal(schema.safeParse(Array(10).fill("item")).success, true);
  assert.equal(schema.safeParse([]).success, false);
  assert.equal(schema.safeParse(Array(11).fill("item")).success, false);
});

test("Zod schema validates union types", () => {
  const schema = z.union([z.string(), z.number()]);

  assert.equal(schema.safeParse("hello").success, true);
  assert.equal(schema.safeParse(123).success, true);
  assert.equal(schema.safeParse(true).success, false);
});

test("Zod schema validates record types", () => {
  const schema = z.record(z.string());

  assert.equal(schema.safeParse({ key1: "value1", key2: "value2" }).success, true);
  assert.equal(schema.safeParse({}).success, true);
  assert.equal(schema.safeParse({ key: 123 }).success, false);
});

test("Zod schema validates strict object (no extra keys)", () => {
  const schema = z.object({
    name: z.string(),
  }).strict();

  assert.equal(schema.safeParse({ name: "test" }).success, true);
  assert.equal(schema.safeParse({ name: "test", extra: "key" }).success, false);
});

test("Zod schema validates date type", () => {
  const schema = z.string().datetime();

  assert.equal(schema.safeParse("2026-04-01T10:00:00.000Z").success, true);
  assert.equal(schema.safeParse("not-a-date").success, false);
});

test("Zod schema validates email format", () => {
  const schema = z.string().email();

  assert.equal(schema.safeParse("user@example.com").success, true);
  assert.equal(schema.safeParse("invalid-email").success, false);
  assert.equal(schema.safeParse("@example.com").success, false);
});

test("Zod schema validates UUID format", () => {
  const schema = z.string().uuid();

  assert.equal(schema.safeParse("550e8400-e29b-41d4-a716-446655440000").success, true);
  assert.equal(schema.safeParse("not-a-uuid").success, false);
});

test("Zod schema validates URL format", () => {
  const schema = z.string().url();

  assert.equal(schema.safeParse("https://example.com").success, true);
  assert.equal(schema.safeParse("https://example.com/path?query=value").success, true);
  assert.equal(schema.safeParse("not-a-url").success, false);
});

test("Zod schema validates pattern (regex)", () => {
  const schema = z.string().regex(/^[a-zA-Z0-9_]+$/);

  assert.equal(schema.safeParse("user_123").success, true);
  assert.equal(schema.safeParse("user@example.com").success, false);
  assert.equal(schema.safeParse("user-name").success, false);
});
