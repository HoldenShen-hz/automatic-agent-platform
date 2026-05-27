import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DEFAULT_MODEL_METADATA_REGISTRY } from "../../../../../src/platform/five-plane-control-plane/config-center/model-metadata-registry.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import {
  SkillExecutionService,
  type SkillDefinition,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-execution-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createService() {
  const workspace = createTempWorkspace("aa-skill-methods-");
  const db = new SqliteDatabase(join(workspace, "skill-methods.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new SkillExecutionService(
    db,
    store,
    async () => ({ success: true, summary: "ok", output: "ok" }),
  );
  return { workspace, db, store, service };
}

test("SkillExecutionService resolveModelProfile handles blank, valid, and unknown profiles [skill-execution-methods]", () => {
  const { workspace, db, service } = createService();
  try {
    const [profileName] = Object.keys(DEFAULT_MODEL_METADATA_REGISTRY.profiles);
    assert.ok(profileName);

    assert.equal(service.resolveModelProfile(""), null);
    assert.equal(service.resolveModelProfile("   "), null);

    const resolved = service.resolveModelProfile(profileName);
    assert.equal(resolved?.profileName, profileName);
    assert.equal(resolved?.profile, DEFAULT_MODEL_METADATA_REGISTRY.profiles[profileName]);

    assert.throws(
      () => service.resolveModelProfile("missing-profile"),
      (error: unknown) =>
        error instanceof ValidationError && error.code === "skill.model_profile_unknown:missing-profile",
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("SkillExecutionService resolveSkillSteps applies matching model overrides [skill-execution-methods]", () => {
  const { workspace, db, service } = createService();
  try {
    const [profileName, profile] = Object.entries(DEFAULT_MODEL_METADATA_REGISTRY.profiles)[0]!;
    const skill: SkillDefinition = {
      skillId: "override-test",
      version: "1.0.0",
      description: "Resolve override by profile",
      requiredTools: ["read", "repo_map"],
      steps: [
        {
          stepId: "inspect",
          toolName: "read",
          modelOverrides: [
            {
              toolName: "repo_map",
              profileNames: [profileName],
              tiers: [profile.tier],
              requiredCapabilities: profile.capabilities.slice(0, 1),
            },
          ],
        },
      ],
    };

    const resolved = service.resolveSkillSteps(skill, {
      profileName,
      profile,
    });

    assert.equal(resolved.length, 1);
    assert.equal(resolved[0]!.requestedToolName, "read");
    assert.equal(resolved[0]!.resolvedToolName, "repo_map");
    assert.equal(resolved[0]!.modelOverrideApplied, true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("SkillExecutionService resolves cache lookup lifecycle from disabled to miss to hit to expired [skill-execution-methods]", async () => {
  const { workspace, db, service } = createService();
  try {
    const skill: SkillDefinition = {
      skillId: "cache-test",
      version: "1.0.0",
      description: "Cache skill",
      requiredTools: ["read"],
      cacheable: true,
      cacheTtlSeconds: 60,
      steps: [
        {
          stepId: "read",
          toolName: "read",
        },
      ],
    };

    const disabled = await service.resolveCacheLookup(skill, { enabled: false });
    assert.equal(disabled.metadata.status, "disabled");
    assert.equal(disabled.entry, null);

    const miss = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "source-hash",
      parameters: { path: "README.md" },
    });
    assert.equal(miss.metadata.status, "miss");
    assert.ok(miss.metadata.key);

    const stored = service.storeCacheEntry(
      skill,
      miss.metadata,
      [
        service.buildCachedStepResult({
          step: {
            stepId: "read",
            requestedToolName: "read",
            resolvedToolName: "read",
            description: undefined,
            onFailure: "fail",
            maxAttempts: 1,
            input: undefined,
            modelOverrideApplied: false,
          },
          status: "succeeded",
          attempts: 1,
          maxAttempts: 1,
          result: {
            success: true,
            status: "succeeded",
            summary: "done",
            output: "ok",
            retryable: false,
            errorSource: "tool",
            durationMs: 3,
          },
        }),
      ],
      0,
    );
    assert.equal(stored.status, "stored");
    assert.ok(stored.storedAt);
    assert.ok(stored.expiresAt);

    const hit = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "source-hash",
      parameters: { path: "README.md" },
    });
    assert.equal(hit.metadata.status, "hit");
    assert.ok(hit.entry);

    const cachedEntry = service.cache.get(hit.metadata.key!);
    assert.ok(cachedEntry);
    cachedEntry!.expiresAt = "2000-01-01T00:00:00.000Z";

    const expired = await service.resolveCacheLookup(skill, {
      enabled: true,
      sourceHash: "source-hash",
      parameters: { path: "README.md" },
    });
    assert.equal(expired.metadata.status, "miss");
    assert.equal(service.cache.has(hit.metadata.key!), false);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("SkillExecutionService buildStepOutput embeds cache hit metadata in the serialized payload [skill-execution-methods]", () => {
  const { workspace, db, service } = createService();
  try {
    const skill: SkillDefinition = {
      skillId: "step-output-cache",
      version: "1.0.0",
      description: "Build cached step output",
      requiredTools: ["read"],
      cacheable: true,
      steps: [
        {
          stepId: "read",
          toolName: "read",
        },
      ],
    };

    const stepOutput = service.buildStepOutput(
      "task-1",
      skill,
      {
        stepId: "read",
        requestedToolName: "read",
        resolvedToolName: "read",
        status: "succeeded",
        attempts: 2,
        maxAttempts: 3,
        retryCount: 1,
        continuedAfterFailure: false,
        errorCode: null,
        summary: "read ok",
        output: "hello",
        data: { lines: 10 },
        onFailure: "retry",
        durationMs: 7,
      },
      {
        eligible: true,
        enabled: true,
        status: "hit",
        key: "cache-key",
        workingDirectory: "/tmp/workspace",
        gitHead: "abc123",
        sourceHash: "src123",
        storedAt: "2026-04-16T00:00:00.000Z",
        expiresAt: "2026-04-16T01:00:00.000Z",
        reason: null,
      },
    );

    const data = JSON.parse(stepOutput.dataJson) as Record<string, unknown>;
    const validation = JSON.parse(stepOutput.validationJson ?? "{}") as Record<string, unknown>;

    assert.equal(stepOutput.status, "succeeded");
    assert.equal(data.toolName, "read");
    assert.equal((data.cache as Record<string, unknown>).status, "hit");
    assert.equal(validation.cacheHit, true);
    assert.equal(validation.retried, true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
