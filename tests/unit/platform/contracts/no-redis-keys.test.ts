/**
 * [SYS-PERF-3.2] No Redis KEYS Command Tests
 *
 * Verifies that platform code does not use Redis KEYS command.
 * KEYS command is O(n) and blocks the event loop on large keyspaces.
 * Production code must use SCAN instead for key iteration.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

// Redis KEYS command patterns to detect
// Must be specific to actual Redis .keys() method calls, not Object.keys()
const KEY_PATTERNS = [
  // Match redis.keys() or redisClient.keys() but NOT Object.keys()
  // Only match when preceded by 'redis' (case insensitive)
  /(?:^|[^a-zA-Z])redis[a-zA-Z]*\.keys\(/i,
];

// Files to exclude from KEYS detection (test mocks, fixtures)
const EXCLUDED_PATTERNS = [
  /no-redis-keys\.test\./,
  /\.test\./,
  /mock/i,
  /fixture/i,
];

function findSourceFiles(dir, extensions = [".ts", ".js"]) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, dist, .git
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "dist_test" ||
        entry.name === "dist-checkpoints" ||
        entry.name === ".git"
      ) {
        continue;
      }
      files.push(...findSourceFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function detectKeysUsage(content) {
  const detections = [];

  // Find all .keys( occurrences
  const keysRegex = /\.keys\(/g;
  let match;
  while ((match = keysRegex.exec(content)) !== null) {
    // Get surrounding context to determine if this is a Redis keys call
    const start = Math.max(0, match.index - 20);
    const end = Math.min(content.length, match.index + match[0].length + 10);
    const context = content.slice(start, end);

    // Skip Object.keys()
    if (context.includes("Object.keys(")) {
      continue;
    }

    // Check if preceded by redis (or similar redis client identifier)
    const beforeMatch = content.slice(Math.max(0, match.index - 10), match.index);
    if (/redis/i.test(beforeMatch)) {
      detections.push("redis.keys() detected");
    }
  }

  return detections;
}

test("[SYS-PERF-3.2] platform code must not use Redis KEYS command", () => {
  const srcDir = "src/platform";
  const files = findSourceFiles(srcDir);

  const violations = [];

  for (const file of files) {
    // Skip test files and mocks
    if (EXCLUDED_PATTERNS.some((p) => p.test(file))) {
      continue;
    }

    const content = readFileSync(file, "utf8");
    const detected = detectKeysUsage(content);

    if (detected.length > 0) {
      violations.push({
        file: relative(process.cwd(), file),
        patterns: detected,
      });
    }
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Found Redis KEYS command usage in platform code:\n${JSON.stringify(violations, null, 2)}`,
  );
});

test("[SYS-PERF-3.2] redis lock adapter uses SCAN instead of KEYS", () => {
  const redisLockPath = "src/platform/execution/distributed-lock/redis-lock-adapter.ts";

  let content;
  try {
    content = readFileSync(redisLockPath, "utf8");
  } catch {
    // If file doesn't exist, skip this test
    return;
  }

  // Must not use .keys() method which is O(n) blocking
  assert.ok(
    !content.includes(".keys("),
    "Redis lock adapter must not use .keys() method - use SCAN instead",
  );

  // Must use SCAN or scanStream for key iteration
  assert.ok(
    content.includes(".scan(") || content.includes("scanStream("),
    "Redis lock adapter must use SCAN or scanStream for key iteration",
  );
});

test("[SYS-PERF-3.2] redis lock adapter listHeldAsync uses SCAN", () => {
  const redisLockPath = "src/platform/execution/distributed-lock/redis-lock-adapter.ts";

  let content;
  try {
    content = readFileSync(redisLockPath, "utf8");
  } catch {
    return;
  }

  // Check if listHeldAsync exists and uses SCAN
  const listHeldAsyncMatch = content.match(
    /listHeldAsync[\s\S]*?\{([\s\S]*?)\}/,
  );
  if (listHeldAsyncMatch && listHeldAsyncMatch[1] !== undefined) {
    const methodBody = listHeldAsyncMatch[1];
    assert.ok(
      !methodBody.includes(".keys("),
      "listHeldAsync must not use .keys() - use SCAN instead",
    );
    assert.ok(
      methodBody.includes(".scan(") || methodBody.includes("scanStream("),
      "listHeldAsync must use SCAN or scanStream for key iteration",
    );
  }
});

test("[SYS-PERF-3.2] other redis operations do not use blocking KEYS command", () => {
  const redisLockPath = "src/platform/execution/distributed-lock/redis-lock-adapter.ts";

  let content;
  try {
    content = readFileSync(redisLockPath, "utf8");
  } catch {
    return;
  }

  // Find all uses of redis.keys
  const keysUsage = content.match(/redis\.keys\(/g);
  assert.equal(
    keysUsage?.length ?? 0,
    0,
    "redis.keys() is forbidden - it blocks the event loop on large keyspaces",
  );
});

test("[SYS-PERF-3.2] search detects KEYS pattern in source files", () => {
  // Create a temporary test content with KEYS pattern
  const testContent = `
    // This file contains a KEYS pattern for testing
    async function findKeys() {
      return await redis.keys("pattern:*");
    }
  `;

  const detected = detectKeysUsage(testContent);
  assert.ok(
    detected.length > 0,
    "detectKeysUsage should detect redis.keys() pattern",
  );
});

test("[SYS-PERF-3.2] search correctly allows SCAN usage", () => {
  // SCAN usage should not be flagged
  const scanContent = `
    async function scanKeys() {
      const stream = redis.scanStream({ match: "pattern:*" });
      for await (const key of stream) {
        console.log(key);
      }
    }
  `;

  const detected = detectKeysUsage(scanContent);
  assert.equal(
    detected.length,
    0,
    "SCAN usage should not be flagged as KEYS violation",
  );
});
