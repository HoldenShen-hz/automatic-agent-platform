import { createHash, randomBytes } from "node:crypto";

import { newId, nowIso } from "../../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../state-evidence/truth/authoritative-sql-database.js";
import { WorkerRegistryService } from "./worker-registry-service.js";

export interface RemoteWorkerRegistrationServiceOptions {
  challengeTtlMs?: number;
  allowedCapabilities?: string[];
}

export interface IssueRemoteWorkerRegistrationChallengeInput {
  workerId: string;
  requestedCapabilities: string[];
  occurredAt?: string;
  ttlMs?: number;
}

export interface IssueRemoteWorkerRegistrationChallengeDecision {
  issued: boolean;
  reasonCode: "capability_not_allowed" | "challenge_ttl_invalid" | null;
  challengeId: string | null;
  challengeToken: string | null;
  expiresAt: string | null;
  allowedCapabilities: string[];
  rejectedCapabilities: string[];
}

export interface CompleteRemoteWorkerRegistrationInput {
  workerId: string;
  challengeId: string;
  challengeToken: string;
  capabilities: string[];
  maxConcurrency: number;
  queueAffinity?: string | null;
  isolationLevel?: "standard" | "hardened" | "strict" | null;
  repoVersion?: string | null;
  runtimeInstanceId?: string | null;
  restartedFromRuntimeInstanceId?: string | null;
  remoteSessionStatus?: "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "viewer_only" | null;
  lastAcknowledgedStreamOffset?: string | null;
  sessionConsistencyCheckStatus?: "unknown" | "passed" | "mismatch" | null;
  sessionConsistencyCheckedAt?: string | null;
  workspaceSyncStatus?: "unknown" | "aligned" | "conflict" | null;
  workspaceSyncCheckedAt?: string | null;
  occurredAt?: string;
}

export interface CompleteRemoteWorkerRegistrationDecision {
  accepted: boolean;
  reasonCode:
    | "challenge_not_found"
    | "challenge_worker_mismatch"
    | "challenge_expired"
    | "challenge_already_used"
    | "challenge_token_invalid"
    | "capability_not_allowed"
    | null;
  workerId: string;
  registrationVerifiedAt: string | null;
  registrationChallengeId: string | null;
  allowedCapabilities: string[];
  rejectedCapabilities: string[];
}

function normalizeCapabilities(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export class RemoteWorkerRegistrationService {
  private readonly workers: WorkerRegistryService;
  private readonly allowedCapabilities: string[];
  private readonly challengeTtlMs: number;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: RemoteWorkerRegistrationServiceOptions = {},
  ) {
    this.workers = new WorkerRegistryService(store);
    this.allowedCapabilities = normalizeCapabilities(options.allowedCapabilities ?? ["bash", "edit", "mcp"]);
    this.challengeTtlMs = options.challengeTtlMs ?? 300_000;
  }

  public issueChallenge(
    input: IssueRemoteWorkerRegistrationChallengeInput,
  ): IssueRemoteWorkerRegistrationChallengeDecision {
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

  public completeRegistration(
    input: CompleteRemoteWorkerRegistrationInput,
  ): CompleteRemoteWorkerRegistrationDecision {
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

    const allowedCapabilities = normalizeCapabilities(JSON.parse(challenge.allowedCapabilitiesJson) as string[]);
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
