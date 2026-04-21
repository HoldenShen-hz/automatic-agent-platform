import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { RemoteWorkerRegistrationService } from "../../../src/platform/execution/worker-pool/remote-worker-registration-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
test("remote worker registration service issues and completes a trusted registration challenge", () => {
    const workspace = createTempWorkspace("aa-remote-worker-registration-");
    const dbPath = join(workspace, "remote-worker-registration.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const registration = new RemoteWorkerRegistrationService(db, store, {
            challengeTtlMs: 60_000,
            allowedCapabilities: ["bash", "edit"],
        });
        const issued = registration.issueChallenge({
            workerId: "worker-remote-1",
            requestedCapabilities: ["edit", "bash"],
            occurredAt: "2026-04-06T14:00:00.000Z",
        });
        const completed = registration.completeRegistration({
            workerId: "worker-remote-1",
            challengeId: issued.challengeId ?? "",
            challengeToken: issued.challengeToken ?? "",
            capabilities: ["bash", "edit"],
            maxConcurrency: 2,
            queueAffinity: "default",
            runtimeInstanceId: "runtime-remote-1",
            remoteSessionStatus: "connected",
            lastAcknowledgedStreamOffset: "stream:900",
            sessionConsistencyCheckStatus: "passed",
            occurredAt: "2026-04-06T14:00:10.000Z",
        });
        const worker = store.getWorkerSnapshot("worker-remote-1");
        const challenge = store.getWorkerRegistrationChallenge(issued.challengeId ?? "");
        db.close();
        assert.equal(issued.issued, true);
        assert.equal(issued.reasonCode, null);
        assert.equal(completed.accepted, true);
        assert.equal(completed.reasonCode, null);
        assert.equal(worker?.placement, "remote");
        assert.equal(worker?.registrationVerifiedAt, "2026-04-06T14:00:10.000Z");
        assert.equal(worker?.registrationChallengeId, issued.challengeId);
        assert.equal(worker?.remoteSessionStatus, "connected");
        assert.equal(worker?.lastAcknowledgedStreamOffset, "stream:900");
        assert.equal(challenge?.usedAt, "2026-04-06T14:00:10.000Z");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("remote worker registration service rejects capabilities outside the allowlist", () => {
    const workspace = createTempWorkspace("aa-remote-worker-registration-");
    const dbPath = join(workspace, "remote-worker-registration-reject.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const registration = new RemoteWorkerRegistrationService(db, store, {
            challengeTtlMs: 60_000,
            allowedCapabilities: ["bash"],
        });
        const issued = registration.issueChallenge({
            workerId: "worker-remote-2",
            requestedCapabilities: ["bash", "edit"],
            occurredAt: "2026-04-06T14:05:00.000Z",
        });
        db.close();
        assert.equal(issued.issued, false);
        assert.equal(issued.reasonCode, "capability_not_allowed");
        assert.deepEqual(issued.allowedCapabilities, ["bash"]);
        assert.deepEqual(issued.rejectedCapabilities, ["edit"]);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("remote worker registration service rejects expired challenges", () => {
    const workspace = createTempWorkspace("aa-remote-worker-registration-");
    const dbPath = join(workspace, "remote-worker-registration-expired.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const registration = new RemoteWorkerRegistrationService(db, store, {
            challengeTtlMs: 1000,
            allowedCapabilities: ["bash"],
        });
        const issued = registration.issueChallenge({
            workerId: "worker-remote-3",
            requestedCapabilities: ["bash"],
            occurredAt: "2026-04-06T14:10:00.000Z",
        });
        const completed = registration.completeRegistration({
            workerId: "worker-remote-3",
            challengeId: issued.challengeId ?? "",
            challengeToken: issued.challengeToken ?? "",
            capabilities: ["bash"],
            maxConcurrency: 1,
            occurredAt: "2026-04-06T14:10:02.000Z",
        });
        db.close();
        assert.equal(completed.accepted, false);
        assert.equal(completed.reasonCode, "challenge_expired");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=remote-worker-registration-service.test.js.map