/**
 * Unit tests for data replicator
 *
 * Part of §52 multi-region data sync.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ReplicationPolicySchema, shouldReplicateToRegion, ReplicationEventBuffer, computeChecksum, createDataReplicator, } from "../../../../src/scale-ecosystem/multi-region/data-replicator/index.js";
test("ReplicationPolicySchema parses valid input", () => {
    const input = {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    };
    const result = ReplicationPolicySchema.safeParse(input);
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.sourceRegionId, "us-east");
        assert.deepEqual(result.data.targetRegionIds, ["eu-west"]);
    }
});
test("ReplicationPolicySchema applies defaults", () => {
    const input = {
        sourceRegionId: "us-east",
    };
    const result = ReplicationPolicySchema.safeParse(input);
    assert.equal(result.success, true);
    if (result.success) {
        assert.deepEqual(result.data.targetRegionIds, []);
        assert.equal(result.data.residencyMode, "same_jurisdiction");
    }
});
test("shouldReplicateToRegion returns true when target in policy and not blocked", () => {
    const policy = {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west", "ap-south"],
        residencyMode: "same_jurisdiction",
    };
    assert.equal(shouldReplicateToRegion(policy, "eu-west"), true);
    assert.equal(shouldReplicateToRegion(policy, "ap-south"), true);
});
test("shouldReplicateToRegion returns false when blocked", () => {
    const policy = {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "blocked",
    };
    assert.equal(shouldReplicateToRegion(policy, "eu-west"), false);
});
test("shouldReplicateToRegion returns false when target not in list", () => {
    const policy = {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    };
    assert.equal(shouldReplicateToRegion(policy, "ap-south"), false);
});
test("shouldReplicateToRegion works with allowed_cross_border mode", () => {
    const policy = {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west", "ap-south"],
        residencyMode: "allowed_cross_border",
    };
    assert.equal(shouldReplicateToRegion(policy, "eu-west"), true);
    assert.equal(shouldReplicateToRegion(policy, "ap-south"), true);
    assert.equal(shouldReplicateToRegion(policy, "unknown"), false);
});
test("ReplicationEventBuffer adds and flushes events", () => {
    const buffer = new ReplicationEventBuffer(100, 60000);
    const event = {
        eventId: "test-1",
        sourceRegionId: "us-east",
        targetRegionId: "eu-west",
        aggregateType: "task",
        aggregateId: "task-123",
        payload: { value: "test" },
        timestamp: new Date().toISOString(),
        checksum: "abc",
    };
    const needsFlush = buffer.add(event);
    assert.equal(needsFlush, false);
    assert.equal(buffer.size(), 1);
});
test("ReplicationEventBuffer flushes when max size reached", () => {
    const buffer = new ReplicationEventBuffer(3, 60000);
    const events = [
        { eventId: "1", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "t", aggregateId: "a", payload: {}, timestamp: "", checksum: "c" },
        { eventId: "2", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "t", aggregateId: "b", payload: {}, timestamp: "", checksum: "c" },
        { eventId: "3", sourceRegionId: "us", targetRegionId: "eu", aggregateType: "t", aggregateId: "c", payload: {}, timestamp: "", checksum: "c" },
    ];
    const lastNeedsFlush = buffer.add(events[0]);
    assert.equal(lastNeedsFlush, false);
    const needsFlush = buffer.add(events[1]);
    assert.equal(needsFlush, false);
    const flushNow = buffer.add(events[2]);
    assert.equal(flushNow, true); // 3rd event triggers flush since maxSize=3
    const flushed = buffer.flush();
    assert.equal(flushed.length, 3);
});
test("computeChecksum generates consistent checksums", () => {
    const payload = { key: "value", number: 42 };
    const checksum1 = computeChecksum(payload, "sha256");
    const checksum2 = computeChecksum(payload, "sha256");
    assert.equal(checksum1, checksum2);
    assert.ok(checksum1.length === 64); // SHA256 hex is 64 chars
});
test("computeChecksum different for different payloads", () => {
    const payload1 = { key: "value1" };
    const payload2 = { key: "value2" };
    const checksum1 = computeChecksum(payload1, "sha256");
    const checksum2 = computeChecksum(payload2, "sha256");
    assert.notEqual(checksum1, checksum2);
});
test("DataReplicatorService records events", () => {
    const replicator = createDataReplicator("us-east", ["eu-west"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    });
    const event = replicator.recordEvent("eu-west", "task", "task-123", { status: "completed" });
    assert.ok(event.eventId);
    assert.equal(event.sourceRegionId, "us-east");
    assert.equal(event.targetRegionId, "eu-west");
    assert.equal(event.aggregateType, "task");
    assert.equal(event.aggregateId, "task-123");
    assert.ok(event.checksum);
});
test("DataReplicatorService flushes to target region", async () => {
    const replicator = createDataReplicator("us-east", ["eu-west"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    }, { batchSize: 10, flushIntervalMs: 60000 });
    replicator.recordEvent("eu-west", "task", "task-1", { id: "1" });
    replicator.recordEvent("eu-west", "task", "task-2", { id: "2" });
    const result = await replicator.flush("eu-west");
    assert.equal(result.success, true);
    assert.equal(result.eventsReplicated, 2);
});
test("DataReplicatorService handles unknown target region", async () => {
    const replicator = createDataReplicator("us-east", ["eu-west"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    });
    const result = await replicator.flush("ap-south");
    assert.equal(result.success, false);
    assert.ok(result.errors.some((e) => e.includes("Unknown target region")));
});
test("DataReplicatorService validates incoming event checksum", () => {
    const replicator = createDataReplicator("us-east", ["eu-west"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    });
    const event = {
        eventId: "test",
        sourceRegionId: "eu-west",
        targetRegionId: "us-east",
        aggregateType: "task",
        aggregateId: "task-123",
        payload: { value: "test" },
        timestamp: new Date().toISOString(),
        checksum: "invalid",
    };
    const valid = replicator.validateEvent(event);
    assert.equal(valid, false);
});
test("DataReplicatorService validates correct checksum", () => {
    const replicator = createDataReplicator("us-east", ["eu-west"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    });
    const payload = { value: "test" };
    const checksum = computeChecksum(payload, "sha256");
    const event = {
        eventId: "test",
        sourceRegionId: "eu-west",
        targetRegionId: "us-east",
        aggregateType: "task",
        aggregateId: "task-123",
        payload,
        timestamp: new Date().toISOString(),
        checksum,
    };
    const valid = replicator.validateEvent(event);
    assert.equal(valid, true);
});
test("DataReplicatorService gets status for all regions", () => {
    const replicator = createDataReplicator("us-east", ["eu-west", "ap-south"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west", "ap-south"],
        residencyMode: "same_jurisdiction",
    });
    replicator.recordEvent("eu-west", "task", "task-1", {});
    replicator.recordEvent("ap-south", "task", "task-2", {});
    const status = replicator.getStatus();
    assert.equal(status.size, 2);
    assert.ok(status.get("eu-west"));
    assert.ok(status.get("ap-south"));
    assert.equal(status.get("eu-west")?.bufferSize, 1);
    assert.equal(status.get("ap-south")?.bufferSize, 1);
});
test("DataReplicatorService flushes all regions", async () => {
    const replicator = createDataReplicator("us-east", ["eu-west", "ap-south"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west", "ap-south"],
        residencyMode: "allowed_cross_border",
    });
    replicator.recordEvent("eu-west", "task", "task-1", {});
    replicator.recordEvent("ap-south", "task", "task-2", {});
    const results = await replicator.flushAll();
    assert.equal(results.size, 2);
    assert.equal(results.get("eu-west")?.eventsReplicated, 1);
    assert.equal(results.get("ap-south")?.eventsReplicated, 1);
});
test("DataReplicatorService handles incoming events via handler", async () => {
    const replicator = createDataReplicator("us-east", ["eu-west"], {
        sourceRegionId: "us-east",
        targetRegionIds: ["eu-west"],
        residencyMode: "same_jurisdiction",
    });
    let receivedEvent = null;
    replicator.onEvent("eu-west", async (event) => {
        receivedEvent = event;
    });
    const testEvent = {
        eventId: "from-eu",
        sourceRegionId: "eu-west",
        targetRegionId: "us-east",
        aggregateType: "task",
        aggregateId: "task-456",
        payload: { data: "test" },
        timestamp: new Date().toISOString(),
        checksum: computeChecksum({ data: "test" }, "sha256"),
    };
    await replicator.handleIncomingEvent(testEvent);
    assert.ok(receivedEvent);
    assert.equal(receivedEvent?.eventId, "from-eu");
    assert.equal(receivedEvent?.aggregateId, "task-456");
});
//# sourceMappingURL=data-replicator.test.js.map