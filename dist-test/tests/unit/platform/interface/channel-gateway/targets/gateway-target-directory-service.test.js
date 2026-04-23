import assert from "node:assert/strict";
import test from "node:test";
import { GatewayTargetDirectoryService, GatewayTargetNotFoundError, GatewayTargetAmbiguousError, } from "../../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
// Mock storage port for testing
function createMockStoragePort(overrides) {
    const targets = new Map();
    const sessionCandidates = [];
    return {
        getGatewayTarget(targetId) {
            return targets.get(targetId) ?? null;
        },
        upsertGatewayTarget(target) {
            targets.set(target.targetId, target);
        },
        listGatewayTargets(limit = 200, channel) {
            let results = [...targets.values()];
            if (channel) {
                results = results.filter((t) => t.channel === channel);
            }
            return results.slice(0, limit);
        },
        listGatewaySessionTargetCandidates(limit = 200, channel) {
            let results = sessionCandidates;
            if (channel) {
                results = results.filter((c) => c.channel === channel);
            }
            return results.slice(0, limit);
        },
        ...overrides,
    };
}
// Helper to create a minimal valid target record
function createTargetRecord(overrides) {
    const now = new Date().toISOString();
    return {
        targetId: "telegram:user:123",
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test User",
        aliasesJson: "[]",
        metadataJson: null,
        source: "directory",
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}
// Helper to add a target to the mock storage
function addTargetToStorage(storage, record) {
    storage.upsertGatewayTarget(record);
}
test("RegisterGatewayTargetInput structure", () => {
    const input = {
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123456",
        displayName: "John Doe",
        aliases: ["@johndoe", "john"],
        metadata: { active: true },
        source: "directory",
        observedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(input.channel, "telegram");
    assert.equal(input.targetKind, "user");
    assert.equal(input.externalTargetId, "123456");
    assert.equal(input.displayName, "John Doe");
    assert.deepEqual(input.aliases, ["@johndoe", "john"]);
    assert.deepEqual(input.metadata, { active: true });
    assert.equal(input.source, "directory");
    assert.equal(input.observedAt, "2026-04-14T00:00:00.000Z");
});
test("RegisterGatewayTargetInput optional fields", () => {
    const input = {
        channel: "slack",
        targetKind: "group",
        externalTargetId: "C12345",
        displayName: "General",
    };
    assert.equal(input.channel, "slack");
    assert.equal(input.aliases, undefined);
    assert.equal(input.metadata, undefined);
    assert.equal(input.source, undefined);
    assert.equal(input.observedAt, undefined);
});
test("GatewayTargetDirectoryEntry structure", () => {
    const entry = {
        targetId: "telegram:user:123",
        channel: "telegram",
        targetKind: "user",
        source: "directory",
        displayName: "Test User",
        aliases: ["@testuser", "test"],
        externalTargetId: "123",
        sessionId: null,
        taskId: null,
        lastSeenAt: "2026-04-14T00:00:00.000Z",
        latestMessagePreview: "Hello world",
    };
    assert.equal(entry.targetId, "telegram:user:123");
    assert.equal(entry.channel, "telegram");
    assert.equal(entry.targetKind, "user");
    assert.equal(entry.source, "directory");
    assert.equal(entry.displayName, "Test User");
    assert.deepEqual(entry.aliases, ["@testuser", "test"]);
    assert.equal(entry.externalTargetId, "123");
    assert.equal(entry.sessionId, null);
    assert.equal(entry.taskId, null);
    assert.equal(entry.lastSeenAt, "2026-04-14T00:00:00.000Z");
    assert.equal(entry.latestMessagePreview, "Hello world");
});
test("GatewayTargetDirectoryEntry with session info", () => {
    const entry = {
        targetId: "telegram:session:abc",
        channel: "telegram",
        targetKind: "session",
        source: "session_history",
        displayName: "telegram :: My Task",
        aliases: ["session_abc", "task_xyz"],
        externalTargetId: "ext_123",
        sessionId: "session_abc",
        taskId: "task_xyz",
        lastSeenAt: "2026-04-14T00:00:00.000Z",
        latestMessagePreview: "Recent message here",
    };
    assert.equal(entry.targetKind, "session");
    assert.equal(entry.source, "session_history");
    assert.equal(entry.sessionId, "session_abc");
    assert.equal(entry.taskId, "task_xyz");
});
test("ListGatewayTargetsQuery structure", () => {
    const query = {
        channel: "telegram",
        query: "john",
        limit: 100,
    };
    assert.equal(query.channel, "telegram");
    assert.equal(query.query, "john");
    assert.equal(query.limit, 100);
});
test("ListGatewayTargetsQuery optional fields", () => {
    const query = {};
    assert.equal(query.channel, undefined);
    assert.equal(query.query, undefined);
    assert.equal(query.limit, undefined);
});
test("ResolveGatewayTargetQuery structure", () => {
    const query = {
        query: "john",
        channel: "telegram",
    };
    assert.equal(query.query, "john");
    assert.equal(query.channel, "telegram");
});
test("ResolveGatewayTargetQuery requires query", () => {
    const query = {
        query: "test",
    };
    assert.equal(query.query, "test");
    assert.equal(query.channel, undefined);
});
test("GatewayTargetResolution structure", () => {
    const entry = {
        targetId: "telegram:user:123",
        channel: "telegram",
        targetKind: "user",
        source: "directory",
        displayName: "Test User",
        aliases: [],
        externalTargetId: "123",
        sessionId: null,
        taskId: null,
        lastSeenAt: "2026-04-14T00:00:00.000Z",
        latestMessagePreview: null,
    };
    const resolution = {
        entry,
        matchedBy: "target_id_exact",
    };
    assert.equal(resolution.entry.targetId, "telegram:user:123");
    assert.equal(resolution.matchedBy, "target_id_exact");
});
test("GatewayTargetResolution matchedBy types", () => {
    const entry = {
        targetId: "telegram:user:123",
        channel: "telegram",
        targetKind: "user",
        source: "directory",
        displayName: "Test User",
        aliases: ["alias1"],
        externalTargetId: "123",
        sessionId: null,
        taskId: null,
        lastSeenAt: "2026-04-14T00:00:00.000Z",
        latestMessagePreview: null,
    };
    const matchTypes = [
        "target_id_exact",
        "display_name_exact",
        "alias_exact",
        "target_id_prefix",
        "display_name_prefix",
        "alias_prefix",
    ];
    for (const matchedBy of matchTypes) {
        const resolution = { entry, matchedBy };
        assert.equal(resolution.matchedBy, matchedBy);
    }
});
test("GatewayTargetNotFoundError structure", () => {
    const error = new GatewayTargetNotFoundError("unknown_target");
    assert.equal(error.name, "GatewayTargetNotFoundError");
    assert.ok(error.code.includes("gateway.target_not_found"));
    assert.equal(error.statusCode, 404);
    assert.equal(error.retryable, false);
    assert.deepEqual(error.details, { query: "unknown_target" });
});
test("GatewayTargetNotFoundError is ValidationError", () => {
    const error = new GatewayTargetNotFoundError("test");
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes("test"));
});
test("GatewayTargetAmbiguousError structure", () => {
    const entries = [
        {
            targetId: "telegram:user:1",
            channel: "telegram",
            targetKind: "user",
            source: "directory",
            displayName: "John",
            aliases: [],
            externalTargetId: "1",
            sessionId: null,
            taskId: null,
            lastSeenAt: "2026-04-14T00:00:00.000Z",
            latestMessagePreview: null,
        },
        {
            targetId: "telegram:user:2",
            channel: "telegram",
            targetKind: "user",
            source: "directory",
            displayName: "John",
            aliases: [],
            externalTargetId: "2",
            sessionId: null,
            taskId: null,
            lastSeenAt: "2026-04-14T00:00:00.000Z",
            latestMessagePreview: null,
        },
    ];
    const error = new GatewayTargetAmbiguousError("john", entries);
    assert.equal(error.name, "GatewayTargetAmbiguousError");
    assert.ok(error.code.includes("gateway.target_ambiguous"));
    assert.equal(error.statusCode, 409);
    assert.equal(error.retryable, false);
    assert.equal(error.candidates.length, 2);
    assert.deepEqual(error.details, { query: "john", candidateCount: 2 });
});
test("GatewayTargetAmbiguousError is ValidationError", () => {
    const error = new GatewayTargetAmbiguousError("test", []);
    assert.ok(error instanceof Error);
    assert.ok(error.message.includes("test"));
});
test("GatewayTargetDirectoryService.registerTarget creates new target", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123456",
        displayName: "John Doe",
    };
    const result = service.registerTarget(input);
    assert.equal(result.channel, "telegram");
    assert.equal(result.targetKind, "user");
    assert.equal(result.displayName, "John Doe");
    assert.ok(result.targetId.startsWith("telegram:user:"));
});
test("GatewayTargetDirectoryService.registerTarget rejects empty externalTargetId", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "   ",
        displayName: "John",
    };
    assert.throws(() => service.registerTarget(input), (err) => err.code === "gateway.invalid_external_target_id");
});
test("GatewayTargetDirectoryService.registerTarget rejects empty displayName", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "   ",
    };
    assert.throws(() => service.registerTarget(input), (err) => err.code === "gateway.invalid_display_name");
});
test("GatewayTargetDirectoryService.registerTarget normalizes channel to lowercase", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "TELEGRAM",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test",
    };
    const result = service.registerTarget(input);
    assert.equal(result.channel, "telegram");
});
test("GatewayTargetDirectoryService.registerTarget rejects empty channel", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "   ",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test",
    };
    assert.throws(() => service.registerTarget(input), (err) => err.code === "gateway.invalid_channel");
});
test("GatewayTargetDirectoryService.registerTarget stores metadata", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test User",
        metadata: { key: "value", nested: { a: 1 } },
    };
    const result = service.registerTarget(input);
    assert.ok(result.metadataJson !== null);
    const parsed = JSON.parse(result.metadataJson);
    assert.equal(parsed.key, "value");
    assert.equal(parsed.nested.a, 1);
});
test("GatewayTargetDirectoryService.registerTarget handles null metadata", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test User",
        metadata: null,
    };
    const result = service.registerTarget(input);
    assert.equal(result.metadataJson, null);
});
test("GatewayTargetDirectoryService.registerTarget normalizes aliases", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const input = {
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test User",
        aliases: ["  @john  ", "john", "  "],
    };
    const result = service.registerTarget(input);
    const stored = storage.getGatewayTarget(result.targetId);
    assert.ok(stored);
    const aliases = JSON.parse(stored.aliasesJson);
    assert.deepEqual(aliases, ["@john", "john"]);
});
test("GatewayTargetDirectoryService.listTargets returns empty initially", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    const result = service.listTargets();
    assert.deepEqual(result, []);
});
test("GatewayTargetDirectoryService.listTargets returns registered targets", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "User One",
    });
    const result = service.listTargets();
    assert.equal(result.length, 1);
    assert.equal(result[0].displayName, "User One");
});
test("GatewayTargetDirectoryService.listTargets filters by channel", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Telegram User",
    });
    service.registerTarget({
        channel: "slack",
        targetKind: "user",
        externalTargetId: "456",
        displayName: "Slack User",
    });
    const telegramOnly = service.listTargets({ channel: "telegram" });
    assert.equal(telegramOnly.length, 1);
    assert.equal(telegramOnly[0].channel, "telegram");
    const slackOnly = service.listTargets({ channel: "slack" });
    assert.equal(slackOnly.length, 1);
    assert.equal(slackOnly[0].channel, "slack");
});
test("GatewayTargetDirectoryService.listTargets filters by query", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "John Doe",
    });
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "456",
        displayName: "Jane Smith",
    });
    const result = service.listTargets({ query: "john" });
    assert.equal(result.length, 1);
    assert.equal(result[0].displayName, "John Doe");
});
test("GatewayTargetDirectoryService.listTargets respects limit", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    for (let i = 0; i < 10; i++) {
        service.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: String(i),
            displayName: `User ${i}`,
        });
    }
    const result = service.listTargets({ limit: 3 });
    assert.equal(result.length, 3);
});
test("GatewayTargetDirectoryService.listTargets clamps limit to max 200", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    // Add many targets
    for (let i = 0; i < 250; i++) {
        service.registerTarget({
            channel: "telegram",
            targetKind: "user",
            externalTargetId: String(i),
            displayName: `User ${i}`,
        });
    }
    const result = service.listTargets({ limit: 500 });
    assert.equal(result.length, 200);
});
test("GatewayTargetDirectoryService.resolveTarget finds by exact targetId", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test User",
    });
    const result = service.resolveTarget({ query: "telegram:user:123" });
    assert.equal(result.entry.displayName, "Test User");
    assert.equal(result.matchedBy, "target_id_exact");
});
test("GatewayTargetDirectoryService.resolveTarget finds by displayName", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Special User Name",
    });
    const result = service.resolveTarget({ query: "Special User Name" });
    assert.equal(result.entry.displayName, "Special User Name");
    assert.equal(result.matchedBy, "display_name_exact");
});
test("GatewayTargetDirectoryService.resolveTarget finds by alias", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Test User",
        aliases: ["@testuser", "test123"],
    });
    const result = service.resolveTarget({ query: "@testuser" });
    assert.equal(result.entry.displayName, "Test User");
    assert.equal(result.matchedBy, "alias_exact");
});
test("GatewayTargetDirectoryService.resolveTarget finds by prefix match", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123456",
        displayName: "Unique Username",
    });
    const result = service.resolveTarget({ query: "telegram:user:12" });
    assert.equal(result.entry.displayName, "Unique Username");
    assert.equal(result.matchedBy, "target_id_prefix");
});
test("GatewayTargetDirectoryService.resolveTarget throws NotFound for unknown query", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Existing User",
    });
    assert.throws(() => service.resolveTarget({ query: "nonexistent" }), GatewayTargetNotFoundError);
});
test("GatewayTargetDirectoryService.resolveTarget throws Ambiguous for multiple matches", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "John",
    });
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "456",
        displayName: "John",
    });
    assert.throws(() => service.resolveTarget({ query: "john" }), GatewayTargetAmbiguousError);
});
test("GatewayTargetDirectoryService.resolveTarget rejects empty query", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    assert.throws(() => service.resolveTarget({ query: "   " }), (err) => err.code === "gateway.target_query_required");
});
test("GatewayTargetDirectoryService.resolveTarget filters by channel when provided", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "Telegram User",
    });
    service.registerTarget({
        channel: "slack",
        targetKind: "user",
        externalTargetId: "456",
        displayName: "Telegram User", // Same display name, different channel
    });
    const result = service.resolveTarget({ query: "Telegram User", channel: "telegram" });
    assert.equal(result.entry.channel, "telegram");
});
test("GatewayTargetDirectoryService.listTargets sorts by lastSeenAt descending", () => {
    const storage = createMockStoragePort();
    const service = new GatewayTargetDirectoryService(storage);
    // Register in order
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "1",
        displayName: "First User",
        observedAt: "2026-04-14T01:00:00.000Z",
    });
    service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "2",
        displayName: "Second User",
        observedAt: "2026-04-14T02:00:00.000Z",
    });
    const result = service.listTargets();
    // Most recent first
    assert.equal(result[0].displayName, "Second User");
    assert.equal(result[1].displayName, "First User");
});
//# sourceMappingURL=gateway-target-directory-service.test.js.map