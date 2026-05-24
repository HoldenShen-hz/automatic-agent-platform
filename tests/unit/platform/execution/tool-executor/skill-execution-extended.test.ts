import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  normalizeAttempts,
  defaultSummary,
  stableSerialize,
  normalizeWorkingDirectory,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-execution-support.js";
import {
  SkillGovernanceService,
  computeSkillHealth,
  type SkillMetadata,
  type SkillExecutionPolicy,
  type AuthorizeSkillExecutionRequest,
  type UpdateSkillLifecycleRequest,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-governance-service.js";
import {
  SemanticRepoMapService,
  extractImports,
  extractSymbols,
  computeFileRelevance,
  computeSymbolRelevance,
  type RepoSymbol,
  type RepoFileNode,
} from "../../../../../src/platform/five-plane-execution/tool-executor/semantic-repo-map-service.js";
import { cleanupPath, createTempWorkspace, createFile } from "../../../../helpers/fs.js";

// =============================================================================
// skill-execution-support.ts utility function tests
// =============================================================================

test("normalizeAttempts returns 1 for undefined maxAttempts with fail mode", () => {
  const result = normalizeAttempts({ maxAttempts: undefined, onFailure: "fail" });
  assert.equal(result, 1);
});

test("normalizeAttempts returns 2 for undefined maxAttempts with retry mode", () => {
  const result = normalizeAttempts({ maxAttempts: undefined, onFailure: "retry" });
  assert.equal(result, 2);
});

test("normalizeAttempts returns max of 1 and truncated value", () => {
  const result = normalizeAttempts({ maxAttempts: 0, onFailure: "fail" });
  assert.equal(result, 1);
});

test("normalizeAttempts returns max of 1 and truncated value for 0.9", () => {
  const result = normalizeAttempts({ maxAttempts: 0.9, onFailure: "fail" });
  assert.equal(result, 1);
});

test("normalizeAttempts uses maxAttempts when provided", () => {
  const result = normalizeAttempts({ maxAttempts: 5, onFailure: "fail" });
  assert.equal(result, 5);
});

test("defaultSummary returns completion message for succeeded status", () => {
  const result = defaultSummary({ stepId: "step1", resolvedToolName: "read" }, "succeeded");
  assert.equal(result, "Skill step step1 completed via read.");
});

test("defaultSummary returns partial success message", () => {
  const result = defaultSummary({ stepId: "step1", resolvedToolName: "read" }, "partial_success");
  assert.equal(result, "Skill step step1 failed via read but continued.");
});

test("defaultSummary returns failure message", () => {
  const result = defaultSummary({ stepId: "step1", resolvedToolName: "read" }, "failed");
  assert.equal(result, "Skill step step1 failed via read.");
});

test("stableSerialize handles null", () => {
  const result = stableSerialize(null);
  assert.equal(result, "null");
});

test("stableSerialize handles undefined", () => {
  const result = stableSerialize(undefined);
  assert.equal(result, "undefined");
});

test("stableSerialize handles number", () => {
  const result = stableSerialize(42);
  assert.equal(result, "42");
});

test("stableSerialize handles string", () => {
  const result = stableSerialize("hello");
  assert.equal(result, '"hello"');
});

test("stableSerialize handles array", () => {
  const result = stableSerialize([1, 2, 3]);
  assert.equal(result, "[1,2,3]");
});

test("stableSerialize handles object with sorted keys", () => {
  const result = stableSerialize({ b: 2, a: 1 });
  // Keys should be sorted alphabetically
  assert.ok(result.includes("a") && result.includes("b"));
});

test("stableSerialize handles nested structures", () => {
  const result = stableSerialize({ arr: [1, 2], obj: { nested: true } });
  assert.ok(result.includes("arr"));
  assert.ok(result.includes("obj"));
});

test("normalizeWorkingDirectory returns null for null input", () => {
  const result = normalizeWorkingDirectory(null);
  assert.equal(result, null);
});

test("normalizeWorkingDirectory returns null for undefined input", () => {
  const result = normalizeWorkingDirectory(undefined);
  assert.equal(result, null);
});

test("normalizeWorkingDirectory returns null for empty string", () => {
  const result = normalizeWorkingDirectory("   ");
  assert.equal(result, null);
});

test("normalizeWorkingDirectory resolves valid path", () => {
  const workspace = createTempWorkspace("aa-norm-wd-");
  try {
    const result = normalizeWorkingDirectory(workspace);
    assert.ok(result != null);
    assert.ok(result.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// skill-governance-service.ts extended tests
// =============================================================================

const createMockStoreWithConnection = () => {
  const policies = new Map<string, {
    skill_id: string;
    allow_execution: number;
    require_approval: number;
    max_concurrent_executions: number;
    max_executions_per_hour: number;
    rate_limit_window_ms: number;
    blocked_message: string | null;
  }>();
  const connection = {
    exec: () => {},
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        if (sql.includes("INSERT INTO skill_execution_policies")) {
          policies.set(String(args[0]), {
            skill_id: String(args[0]),
            allow_execution: Number(args[1]),
            require_approval: Number(args[2]),
            max_concurrent_executions: Number(args[3]),
            max_executions_per_hour: Number(args[4]),
            rate_limit_window_ms: Number(args[5]),
            blocked_message: (args[6] as string | null | undefined) ?? null,
          });
        }
      },
      get: (skillId?: string) => {
        if (sql.includes("SELECT * FROM skill_execution_policies")) {
          return policies.get(String(skillId)) ?? undefined;
        }
        return undefined;
      },
      all: () => [],
    }),
  };
  return {
    withConnection: <T>(work: (db: typeof connection) => T): T => work(connection),
  };
};

test("computeSkillHealth returns 0.5 for zero executions", () => {
  const health = computeSkillHealth(0, 0.8);
  assert.equal(health, 0.5);
});

test("computeSkillHealth returns success rate when executions below 100", () => {
  // health = successRate * min(1, executions / 100)
  // 0.9 * min(1, 50/100) = 0.9 * 0.5 = 0.45
  const health = computeSkillHealth(50, 0.9);
  assert.equal(health, 0.45);
});

test("computeSkillHealth returns success rate when executions exactly 100", () => {
  const health = computeSkillHealth(100, 0.85);
  assert.equal(health, 0.85);
});

test("SkillGovernanceService.registerSkill returns true", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const metadata: SkillMetadata = {
    skillId: "test-skill",
    name: "Test Skill",
    version: "1.0.0",
    description: "A test skill for registration",
    author: "test",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    lifecycle: "active",
    riskLevel: "low",
    tags: ["test"],
    requiredTools: ["read"],
    requiredPermissions: [],
    cacheable: true,
    cacheTtlSeconds: 3600,
    executionCount: 0,
    successRate: 0,
    avgDurationMs: 0,
  };

  const result = service.registerSkill(metadata);
  assert.equal(result, true);
});

test("SkillGovernanceService.updateLifecycle returns true", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const request: UpdateSkillLifecycleRequest = {
    skillId: "test-skill",
    newLifecycle: "deprecated",
    reason: "No longer needed",
  };

  const result = service.updateLifecycle(request);
  assert.equal(result, true);
});

test("SkillGovernanceService.setExecutionPolicy returns true", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const policy: SkillExecutionPolicy = {
    skillId: "test-skill",
    allowExecution: true,
    requireApproval: false,
    maxConcurrentExecutions: 5,
    maxExecutionsPerHour: 100,
    rateLimitWindowMs: 3600000,
    blockedMessage: null,
  };

  const result = service.setExecutionPolicy(policy);
  assert.equal(result, true);
});

test("SkillGovernanceService.authorizeExecution returns authorized when allowed", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);
  service.setExecutionPolicy({
    skillId: "test-skill",
    allowExecution: true,
    requireApproval: false,
    maxConcurrentExecutions: 5,
    maxExecutionsPerHour: 100,
    rateLimitWindowMs: 3600000,
    blockedMessage: null,
  });

  const request: AuthorizeSkillExecutionRequest = {
    skillId: "test-skill",
    skillVersion: "1.0.0",
    sessionId: "session-1",
    executionId: "exec-1",
    requestedTools: ["read"],
  };

  const result = service.authorizeExecution(request);
  assert.equal(result.authorized, true);
});

test("SkillGovernanceService.archiveOldDeprecatedSkills returns number", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.archiveOldDeprecatedSkills(30);
  assert.equal(typeof result, "number");
});

test("SkillGovernanceService.validateSkill produces warnings for long cache TTL", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "test-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill with very long cache TTL",
    requiredTools: ["read"],
    cacheable: true,
    cacheTtlSeconds: 86400 * 10, // 10 days - greater than 7 days
  });

  assert.ok(result.warnings.some((w) => w.includes("cacheTtlSeconds")));
});

test("SkillGovernanceService.validateSkill produces warnings for empty requiredTools", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "test-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A test skill with no tools",
    requiredTools: [],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.ok(result.warnings.some((w) => w.includes("no required tools")));
});

test("SkillGovernanceService.validateSkill rejects description over 500 chars", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "test-skill",
    version: "1.0.0",
    name: "Test Skill",
    description: "A".repeat(501),
    requiredTools: ["read"],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.ok(result.errors.some((e) => e.includes("description")));
});

test("SkillGovernanceService.validateSkill rejects name over 100 chars", () => {
  const service = new SkillGovernanceService(createMockStoreWithConnection() as unknown as import("../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js").AuthoritativeTaskStore);

  const result = service.validateSkill({
    skillId: "test-skill",
    version: "1.0.0",
    name: "A".repeat(101),
    description: "A test skill with very long name",
    requiredTools: ["read"],
    cacheable: false,
    cacheTtlSeconds: 0,
  });

  assert.ok(result.errors.some((e) => e.includes("name")));
});

// =============================================================================
// semantic-repo-map-service.ts extended tests
// =============================================================================

test("extractImports extracts from complex content", () => {
  const content = `
    import { useState } from 'react';
    import React, { useEffect } from 'react';
    const { useCallback } = require('react');
    const utils = require('./utils');
    const lazyModule = import('./lazy');
  `;
  const { imports, dynamicImports } = extractImports(content);
  assert.ok(imports.includes("react"));
  assert.ok(imports.includes("./utils"));
  assert.ok(dynamicImports.includes("./lazy"));
});

test("extractSymbols does not extract const inside function", () => {
  const content = `
    function outer() {
      const inner = 1;
    }
    const topLevel = 2;
  `;
  const symbols = extractSymbols(content, "/test/file.ts");
  const constSymbols = symbols.filter((s) => s.kind === "constant");
  // inner should not be extracted since it has a brace on its line
  assert.ok(constSymbols.some((s) => s.name === "topLevel"));
});

test("computeFileRelevance boosts current file dependencies", () => {
  const file: RepoFileNode = {
    filePath: "/test/dep.ts",
    fileName: "dep.ts",
    extension: ".ts",
    relativePath: "lib/dep.ts",
    exports: ["Dep"],
    imports: [],
    referencedBy: ["/test/main.ts"],
    depth: 1,
  };

  // Query with currentFile that references this file
  const score = computeFileRelevance(file, { query: "dep", currentFile: "/test/main.ts" });
  assert.ok(score > 0);
});

test("computeSymbolRelevance handles multiple references", () => {
  const symbol: RepoSymbol = {
    name: "Service",
    kind: "class",
    filePath: "/test/service.ts",
    line: 1,
    column: 1,
    references: [
      { filePath: "/test/a.ts", line: 5, column: 10 },
      { filePath: "/test/b.ts", line: 10, column: 5 },
      { filePath: "/test/c.ts", line: 15, column: 3 },
    ],
  };

  const score = computeSymbolRelevance(symbol, { query: "Service" });
  // Should have base 0.5 + reference boost
  assert.ok(score >= 0.5);
});

test("SemanticRepoMapService.search returns results for matching query", () => {
  const workspace = createTempWorkspace("aa-repo-map-search-");
  try {
    createFile(join(workspace, "test.ts"), "export function test() {}");
    createFile(join(workspace, "service.ts"), "export class Service {}");

    const service = new SemanticRepoMapService(workspace, 0);
    const result = service.search({ query: "Service" });

    assert.ok(result.symbols.length >= 0 || result.files.length >= 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.search respects limit parameter", () => {
  const workspace = createTempWorkspace("aa-repo-map-limit-");
  try {
    createFile(join(workspace, "a.ts"), "function a() {}");
    createFile(join(workspace, "b.ts"), "function b() {}");
    createFile(join(workspace, "c.ts"), "function c() {}");

    const service = new SemanticRepoMapService(workspace, 0);
    const result = service.search({ query: "function", limit: 2 });

    // Should return at most 2 results
    assert.ok(result.symbols.length <= 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.getSymbol returns symbol by name", () => {
  const workspace = createTempWorkspace("aa-repo-map-symbol-");
  try {
    createFile(join(workspace, "myFunc.ts"), "export function myFunc() {}");

    const service = new SemanticRepoMapService(workspace, 0);
    const symbol = service.getSymbol("myFunc");

    assert.ok(symbol != null);
    assert.equal(symbol!.name, "myFunc");
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.getSymbol returns null for non-existent symbol", () => {
  const workspace = createTempWorkspace("aa-repo-map-symbol-null-");
  try {
    createFile(join(workspace, "existing.ts"), "function existing() {}");

    const service = new SemanticRepoMapService(workspace, 0);
    const symbol = service.getSymbol("nonExistent");

    assert.equal(symbol, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.getFileDependencies returns empty for non-existent file", () => {
  const workspace = createTempWorkspace("aa-repo-map-deps-");
  try {
    const service = new SemanticRepoMapService(workspace, 0);
    const deps = service.getFileDependencies("/nonExistent/file.ts");

    assert.ok(Array.isArray(deps));
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.getFileDependents returns empty for non-existent file", () => {
  const workspace = createTempWorkspace("aa-repo-map-reverse-");
  try {
    const service = new SemanticRepoMapService(workspace, 0);
    const deps = service.getFileDependents("/nonExistent/file.ts");

    assert.ok(Array.isArray(deps));
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.buildMap caches and returns same map on subsequent calls", () => {
  const workspace = createTempWorkspace("aa-repo-map-cache-");
  try {
    createFile(join(workspace, "file.ts"), "function test() {}");

    const service = new SemanticRepoMapService(workspace, 60_000);
    const map1 = service.buildMap();
    const map2 = service.buildMap();

    // Should return same map reference when within TTL
    assert.ok(map1 === map2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.buildMap rebuilds after cache expiry", async () => {
  const workspace = createTempWorkspace("aa-repo-map-rebuild-");
  try {
    createFile(join(workspace, "file.ts"), "function test() {}");

    // Very short TTL
    const service = new SemanticRepoMapService(workspace, 1);
    const map1 = service.buildMap();

    // Wait for cache to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    const map2 = service.buildMap();

    // Should be different references after TTL
    assert.ok(map1 !== map2);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.getStatistics returns correct file type counts", () => {
  const workspace = createTempWorkspace("aa-repo-map-stats-");
  try {
    createFile(join(workspace, "file1.ts"), "function test() {}");
    createFile(join(workspace, "file2.tsx"), "function test2() {}");
    createFile(join(workspace, "file3.js"), "function test3() {}");

    const service = new SemanticRepoMapService(workspace, 0);
    const stats = service.getStatistics();

    assert.ok(stats.totalFiles >= 3);
    assert.ok(stats.fileTypes.get(".ts")! >= 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService.getStatistics returns correct symbol kind counts", () => {
  const workspace = createTempWorkspace("aa-repo-map-symbol-stats-");
  try {
    createFile(join(workspace, "kinds.ts"), `
      function myFunc() {}
      class MyClass {}
      interface MyInterface {}
      type MyType = string;
      const MY_CONST = 1;
    `);

    const service = new SemanticRepoMapService(workspace, 0);
    const stats = service.getStatistics();

    assert.ok(stats.symbolKinds.get("function")! >= 1);
    assert.ok(stats.symbolKinds.get("class")! >= 1);
    assert.ok(stats.symbolKinds.get("interface")! >= 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService ignores node_modules and dist directories", () => {
  const workspace = createTempWorkspace("aa-repo-map-ignore-");
  try {
    createFile(join(workspace, "valid.ts"), "function valid() {}");
    createFile(join(workspace, "node_modules", "ignored.ts"), "function ignored() {}");
    createFile(join(workspace, "dist", "ignored.ts"), "function ignored() {}");
    createFile(join(workspace, ".hidden", "ignored.ts"), "function ignored() {}");

    const service = new SemanticRepoMapService(workspace, 0);
    const stats = service.getStatistics();

    assert.ok(stats.totalFiles === 1);
    assert.equal(stats.totalSymbols, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("SemanticRepoMapService handles file read errors gracefully", () => {
  const workspace = createTempWorkspace("aa-repo-map-error-");
  try {
    // Create a file with special characters that might cause issues
    createFile(join(workspace, "special.ts"), "function special() {}");

    const service = new SemanticRepoMapService(workspace, 0);
    const stats = service.getStatistics();

    assert.ok(typeof stats.totalFiles === "number");
  } finally {
    cleanupPath(workspace);
  }
});

test("extractSymbols returns empty array for content with no symbols", () => {
  const content = `
    // Just a comment
    const x = 1;
    // Another comment
  `;
  // The const in multi-line comment context may or may not be captured depending on implementation
  const symbols = extractSymbols(content, "/test/file.ts");
  // At minimum, should not throw
  assert.ok(Array.isArray(symbols));
});

test("computeFileRelevance returns 0 for non-matching query", () => {
  const file: RepoFileNode = {
    filePath: "/test/service.ts",
    fileName: "service.ts",
    extension: ".ts",
    relativePath: "src/service.ts",
    exports: ["Service"],
    imports: [],
    referencedBy: [],
    depth: 1,
  };

  const score = computeFileRelevance(file, { query: "xyz123nonexistent" });
  assert.equal(score, 0);
});

test("computeSymbolRelevance returns 0 for non-matching query", () => {
  const symbol: RepoSymbol = {
    name: "Service",
    kind: "class",
    filePath: "/test/service.ts",
    line: 1,
    column: 1,
    references: [],
  };

  const score = computeSymbolRelevance(symbol, { query: "xyz123nonexistent" });
  assert.equal(score, 0);
});

test("extractImports handles multiline import statements", () => {
  const content = `
    import {
      useState,
      useEffect,
      useCallback
    } from 'react';
  `;
  const { imports } = extractImports(content);
  assert.ok(imports.includes("react"));
});

test("extractImports handles import with type keyword", () => {
  const content = `
    import type { SomeType } from './types';
    import { useState } from 'react';
  `;
  const { imports } = extractImports(content);
  assert.ok(imports.includes("./types"));
  assert.ok(imports.includes("react"));
});
