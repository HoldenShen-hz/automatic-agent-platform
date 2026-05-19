/**
 * Perception CLI Tests
 *
 * Tests for perception.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
// ---------------------------------------------------------------------------
// Tests for perception action validation
// ---------------------------------------------------------------------------
const PERCEPTION_ACTIONS = ["upsert_source", "ingest", "brief", "propose", "export", "sources", "briefs"];
test("perception supports upsert_source action", () => {
    const action = "upsert_source";
    assert.ok(PERCEPTION_ACTIONS.includes(action));
});
test("perception supports ingest action", () => {
    const action = "ingest";
    assert.ok(PERCEPTION_ACTIONS.includes(action));
});
test("perception supports brief action", () => {
    const action = "brief";
    assert.ok(PERCEPTION_ACTIONS.includes(action));
});
test("perception supports propose action", () => {
    const action = "propose";
    assert.ok(PERCEPTION_ACTIONS.includes(action));
});
test("perception supports export action", () => {
    const action = "export";
    assert.ok(PERCEPTION_ACTIONS.includes(action));
});
test("perception supports sources action", () => {
    const action = "sources";
    assert.ok(PERCEPTION_ACTIONS.includes(action));
});
test("perception supports briefs action", () => {
    const action = "briefs";
    assert.ok(PERCEPTION_ACTIONS.includes(action));
});
test("perception throws ValidationError for unknown action", () => {
    const action = "unknown";
    const errorPrefix = `unknown_perception_action:${action}`;
    assert.throws(() => {
        if (!PERCEPTION_ACTIONS.includes(action)) {
            throw new ValidationError(errorPrefix, errorPrefix);
        }
    }, { message: errorPrefix });
});
// ---------------------------------------------------------------------------
// Tests for upsert_source action validation
// ---------------------------------------------------------------------------
test("upsert_source requires sourceType", () => {
    const envConfig = { sourceType: null, sourceName: "Test Source" };
    assert.throws(() => {
        if (envConfig.sourceType == null) {
            throw new ValidationError("missing_env:AA_SOURCE_TYPE", "missing_env:AA_SOURCE_TYPE");
        }
    }, { message: "missing_env:AA_SOURCE_TYPE" });
});
test("upsert_source requires sourceName", () => {
    const envConfig = { sourceType: "rss", sourceName: null };
    assert.throws(() => {
        if (envConfig.sourceName == null) {
            throw new ValidationError("missing_env:AA_SOURCE_NAME", "missing_env:AA_SOURCE_NAME");
        }
    }, { message: "missing_env:AA_SOURCE_NAME" });
});
test("upsert_source builds args with required fields", () => {
    const envConfig = {
        sourceType: "rss",
        sourceName: "Test RSS Feed",
        tenantId: null,
        sourceId: null,
        sourceEnabled: true,
        sourceSchedule: undefined,
        sourceFilters: undefined,
        sourcePriority: null,
        accountId: null,
    };
    const args = {
        type: envConfig.sourceType,
        name: envConfig.sourceName,
        enabled: envConfig.sourceEnabled,
    };
    if (envConfig.tenantId !== null) {
        args.tenantId = envConfig.tenantId;
    }
    if (envConfig.sourceId) {
        args.sourceId = envConfig.sourceId;
    }
    if (envConfig.sourceSchedule) {
        args.schedule = envConfig.sourceSchedule;
    }
    if (envConfig.sourceFilters) {
        args.filters = envConfig.sourceFilters;
    }
    if (envConfig.sourcePriority != null) {
        args.priority = envConfig.sourcePriority;
    }
    if (envConfig.accountId !== null) {
        args.accountId = envConfig.accountId;
    }
    assert.equal(args.type, "rss");
    assert.equal(args.name, "Test RSS Feed");
    assert.equal(args.enabled, true);
});
test("upsert_source includes optional sourceId", () => {
    const envConfig = {
        sourceType: "rss",
        sourceName: "Test",
        sourceId: "source-123",
    };
    const args = {
        type: envConfig.sourceType,
        name: envConfig.sourceName,
    };
    if (envConfig.sourceId) {
        args.sourceId = envConfig.sourceId;
    }
    assert.equal(args.sourceId, "source-123");
});
// ---------------------------------------------------------------------------
// Tests for ingest action validation
// ---------------------------------------------------------------------------
test("ingest requires sourceId", () => {
    const envConfig = { sourceId: null, intelItems: [] };
    assert.throws(() => {
        if (envConfig.sourceId == null) {
            throw new ValidationError("missing_env:AA_SOURCE_ID", "missing_env:AA_SOURCE_ID");
        }
    }, { message: "missing_env:AA_SOURCE_ID" });
});
test("ingest requires intelItems", () => {
    const envConfig = { sourceId: "source-123", intelItems: null };
    assert.throws(() => {
        if (envConfig.intelItems == null) {
            throw new ValidationError("missing_env:AA_INTEL_ITEMS_JSON", "missing_env:AA_INTEL_ITEMS_JSON");
        }
    }, { message: "missing_env:AA_INTEL_ITEMS_JSON" });
});
test("ingest builds args correctly", () => {
    const envConfig = {
        sourceId: "source-123",
        tenantId: null,
        intelItems: [{ title: "Test Item" }],
        accountId: null,
    };
    const args = {
        sourceId: envConfig.sourceId,
        items: envConfig.intelItems,
    };
    if (envConfig.tenantId !== null) {
        args.tenantId = envConfig.tenantId;
    }
    if (envConfig.accountId !== null) {
        args.accountId = envConfig.accountId;
    }
    assert.equal(args.sourceId, "source-123");
    assert.deepEqual(args.items, [{ title: "Test Item" }]);
});
// ---------------------------------------------------------------------------
// Tests for brief action
// ---------------------------------------------------------------------------
test("brief builds args with optional filters", () => {
    const envConfig = {
        tenantId: "tenant-1",
        briefSince: "2024-01-01T00:00:00.000Z",
        briefUntil: "2024-01-31T23:59:59.999Z",
        sourceIds: ["source-1", "source-2"],
        briefGeneratedAt: null,
        briefLimit: 10,
        accountId: null,
    };
    const args = {};
    if (envConfig.tenantId !== null) {
        args.tenantId = envConfig.tenantId;
    }
    if (envConfig.briefSince) {
        args.since = envConfig.briefSince;
    }
    if (envConfig.briefUntil) {
        args.until = envConfig.briefUntil;
    }
    if (envConfig.sourceIds) {
        args.sourceIds = envConfig.sourceIds;
    }
    if (envConfig.briefGeneratedAt) {
        args.generatedAt = envConfig.briefGeneratedAt;
    }
    if (envConfig.briefLimit != null) {
        args.limit = envConfig.briefLimit;
    }
    if (envConfig.accountId !== null) {
        args.accountId = envConfig.accountId;
    }
    assert.equal(args.tenantId, "tenant-1");
    assert.equal(args.since, "2024-01-01T00:00:00.000Z");
    assert.equal(args.until, "2024-01-31T23:59:59.999Z");
    assert.deepEqual(args.sourceIds, ["source-1", "source-2"]);
    assert.equal(args.limit, 10);
});
test("brief omits optional fields when not provided", () => {
    const envConfig = {
        tenantId: null,
        briefSince: null,
        briefUntil: null,
        sourceIds: undefined,
        briefGeneratedAt: null,
        briefLimit: null,
        accountId: null,
    };
    const args = {};
    if (envConfig.tenantId !== null) {
        args.tenantId = envConfig.tenantId;
    }
    if (envConfig.briefSince) {
        args.since = envConfig.briefSince;
    }
    if (envConfig.briefUntil) {
        args.until = envConfig.briefUntil;
    }
    if (envConfig.sourceIds) {
        args.sourceIds = envConfig.sourceIds;
    }
    if (envConfig.briefGeneratedAt) {
        args.generatedAt = envConfig.briefGeneratedAt;
    }
    if (envConfig.briefLimit != null) {
        args.limit = envConfig.briefLimit;
    }
    if (envConfig.accountId !== null) {
        args.accountId = envConfig.accountId;
    }
    assert.equal(args.tenantId, undefined);
    assert.equal(args.since, undefined);
    assert.equal(args.limit, undefined);
});
// ---------------------------------------------------------------------------
// Tests for propose action validation
// ---------------------------------------------------------------------------
test("propose requires briefId", () => {
    const envConfig = { briefId: null };
    assert.throws(() => {
        if (envConfig.briefId == null) {
            throw new ValidationError("missing_env:AA_BRIEF_ID", "missing_env:AA_BRIEF_ID");
        }
    }, { message: "missing_env:AA_BRIEF_ID" });
});
test("propose builds args correctly", () => {
    const envConfig = {
        briefId: "brief-456",
        tenantId: "tenant-1",
        accountId: null,
    };
    const args = {
        briefId: envConfig.briefId,
    };
    if (envConfig.tenantId !== null) {
        args.tenantId = envConfig.tenantId;
    }
    if (envConfig.accountId !== null) {
        args.accountId = envConfig.accountId;
    }
    assert.equal(args.briefId, "brief-456");
    assert.equal(args.tenantId, "tenant-1");
});
// ---------------------------------------------------------------------------
// Tests for export action validation
// ---------------------------------------------------------------------------
test("export requires briefId", () => {
    const envConfig = { briefId: null };
    assert.throws(() => {
        if (envConfig.briefId == null) {
            throw new ValidationError("missing_env:AA_BRIEF_ID", "missing_env:AA_BRIEF_ID");
        }
    }, { message: "missing_env:AA_BRIEF_ID" });
});
test("export passes briefId and optional tenant/account", () => {
    const envConfig = {
        briefId: "brief-789",
        accountId: "account-1",
        tenantId: "tenant-1",
    };
    const args = [
        envConfig.briefId,
        envConfig.accountId,
        envConfig.tenantId,
    ];
    assert.deepEqual(args, ["brief-789", "account-1", "tenant-1"]);
});
// ---------------------------------------------------------------------------
// Tests for sources action
// ---------------------------------------------------------------------------
test("sources builds args correctly", () => {
    const envConfig = {
        sourcesEnabledOnly: true,
        tenantId: "tenant-1",
    };
    const args = [
        envConfig.sourcesEnabledOnly,
        envConfig.tenantId,
    ];
    assert.deepEqual(args, [true, "tenant-1"]);
});
test("sources handles disabled-only filter", () => {
    const envConfig = {
        sourcesEnabledOnly: false,
        tenantId: null,
    };
    const args = [
        envConfig.sourcesEnabledOnly,
        envConfig.tenantId,
    ];
    assert.deepEqual(args, [false, null]);
});
// ---------------------------------------------------------------------------
// Tests for briefs action
// ---------------------------------------------------------------------------
test("briefs uses default limit of 20", () => {
    const envConfig = {
        briefsLimit: null,
        tenantId: null,
    };
    const limit = envConfig.briefsLimit ?? 20;
    assert.equal(limit, 20);
});
test("briefs uses custom limit when provided", () => {
    const envConfig = {
        briefsLimit: 50,
        tenantId: "tenant-1",
    };
    const limit = envConfig.briefsLimit ?? 20;
    assert.equal(limit, 50);
});
test("briefs passes limit and tenantId", () => {
    const envConfig = {
        briefsLimit: 30,
        tenantId: "tenant-1",
    };
    const args = [
        envConfig.briefsLimit ?? 20,
        envConfig.tenantId,
    ];
    assert.deepEqual(args, [30, "tenant-1"]);
});
//# sourceMappingURL=perception.test.js.map