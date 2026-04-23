import { createHash, randomBytes } from "node:crypto";
import { newId, nowIso } from "../../../contracts/types/ids.js";
import { WorkerRegistryService } from "./worker-registry-service.js";
function normalizeCapabilities(values) {
    return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort();
}
function hashToken(token) {
    return createHash("sha256").update(token, "utf8").digest("hex");
}
function addMs(iso, ms) {
    return new Date(Date.parse(iso) + ms).toISOString();
}
export class RemoteWorkerRegistrationService {
    db;
    store;
    workers;
    allowedCapabilities;
    challengeTtlMs;
    constructor(db, store, options = {}) {
        this.db = db;
        this.store = store;
        this.workers = new WorkerRegistryService(store);
        this.allowedCapabilities = normalizeCapabilities(options.allowedCapabilities ?? ["bash", "edit", "mcp"]);
        this.challengeTtlMs = options.challengeTtlMs ?? 300_000;
    }
    issueChallenge(input) {
        const occurredAt = input.occurredAt ?? nowIso();
        const requestedCapabilities = normalizeCapabilities(input.requestedCapabilities);
        const allowedCapabilities = requestedCapabilities.filter((capability) => this.allowedCapabilities.includes(capability));
        const rejectedCapabilities = requestedCapabilities.filter((capability) => !allowedCapabilities.includes(capability));
        const ttlMs = input.ttlMs ?? this.challengeTtlMs;
        if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
            return {
                issued: false,
                reasonCode: "challenge_ttl_invalid",
                challengeId: null,
                challengeToken: null,
                expiresAt: null,
                allowedCapabilities,
                rejectedCapabilities,
            };
        }
        if (rejectedCapabilities.length > 0) {
            return {
                issued: false,
                reasonCode: "capability_not_allowed",
                challengeId: null,
                challengeToken: null,
                expiresAt: null,
                allowedCapabilities,
                rejectedCapabilities,
            };
        }
        const challengeId = newId("wchal");
        const challengeToken = randomBytes(24).toString("hex");
        const expiresAt = addMs(occurredAt, ttlMs);
        this.store.worker.insertWorkerRegistrationChallenge({
            id: challengeId,
            workerId: input.workerId,
            challengeTokenHash: hashToken(challengeToken),
            allowedCapabilitiesJson: JSON.stringify(allowedCapabilities),
            expiresAt,
            usedAt: null,
            createdAt: occurredAt,
        });
        return {
            issued: true,
            reasonCode: null,
            challengeId,
            challengeToken,
            expiresAt,
            allowedCapabilities,
            rejectedCapabilities: [],
        };
    }
    completeRegistration(input) {
        const occurredAt = input.occurredAt ?? nowIso();
        const challenge = this.store.worker.getWorkerRegistrationChallenge(input.challengeId);
        const capabilities = normalizeCapabilities(input.capabilities);
        if (!challenge) {
            return {
                accepted: false,
                reasonCode: "challenge_not_found",
                workerId: input.workerId,
                registrationVerifiedAt: null,
                registrationChallengeId: null,
                allowedCapabilities: [],
                rejectedCapabilities: capabilities,
            };
        }
        const allowedCapabilities = normalizeCapabilities(JSON.parse(challenge.allowedCapabilitiesJson));
        const rejectedCapabilities = capabilities.filter((capability) => !allowedCapabilities.includes(capability));
        if (challenge.workerId !== input.workerId) {
            return {
                accepted: false,
                reasonCode: "challenge_worker_mismatch",
                workerId: input.workerId,
                registrationVerifiedAt: null,
                registrationChallengeId: challenge.id,
                allowedCapabilities,
                rejectedCapabilities,
            };
        }
        if (challenge.usedAt != null) {
            return {
                accepted: false,
                reasonCode: "challenge_already_used",
                workerId: input.workerId,
                registrationVerifiedAt: null,
                registrationChallengeId: challenge.id,
                allowedCapabilities,
                rejectedCapabilities,
            };
        }
        if (Date.parse(challenge.expiresAt) < Date.parse(occurredAt)) {
            return {
                accepted: false,
                reasonCode: "challenge_expired",
                workerId: input.workerId,
                registrationVerifiedAt: null,
                registrationChallengeId: challenge.id,
                allowedCapabilities,
                rejectedCapabilities,
            };
        }
        if (challenge.challengeTokenHash !== hashToken(input.challengeToken)) {
            return {
                accepted: false,
                reasonCode: "challenge_token_invalid",
                workerId: input.workerId,
                registrationVerifiedAt: null,
                registrationChallengeId: challenge.id,
                allowedCapabilities,
                rejectedCapabilities,
            };
        }
        if (rejectedCapabilities.length > 0) {
            return {
                accepted: false,
                reasonCode: "capability_not_allowed",
                workerId: input.workerId,
                registrationVerifiedAt: null,
                registrationChallengeId: challenge.id,
                allowedCapabilities,
                rejectedCapabilities,
            };
        }
        this.db.transaction(() => {
            this.store.worker.consumeWorkerRegistrationChallenge(challenge.id, occurredAt);
            this.workers.verifyRemoteWorkerRegistration({
                workerId: input.workerId,
                capabilities,
                maxConcurrency: input.maxConcurrency,
                queueAffinity: input.queueAffinity ?? null,
                isolationLevel: input.isolationLevel ?? "standard",
                repoVersion: input.repoVersion ?? null,
                runtimeInstanceId: input.runtimeInstanceId ?? null,
                restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId ?? null,
                remoteSessionStatus: input.remoteSessionStatus ?? "connected",
                lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset ?? null,
                sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus ?? null,
                sessionConsistencyCheckedAt: input.sessionConsistencyCheckedAt ?? null,
                workspaceSyncStatus: input.workspaceSyncStatus ?? null,
                workspaceSyncCheckedAt: input.workspaceSyncCheckedAt ?? null,
                registrationVerifiedAt: occurredAt,
                registrationChallengeId: challenge.id,
                occurredAt,
            });
        });
        return {
            accepted: true,
            reasonCode: null,
            workerId: input.workerId,
            registrationVerifiedAt: occurredAt,
            registrationChallengeId: challenge.id,
            allowedCapabilities,
            rejectedCapabilities: [],
        };
    }
}
//# sourceMappingURL=remote-worker-registration-service.js.map