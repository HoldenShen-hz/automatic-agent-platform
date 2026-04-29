export interface WorkerServiceIdentity {
  readonly workerId: string;
  readonly serviceIdentity: string;
  readonly mtlsPeerFingerprint: string;
  readonly allowedNodeRunTenants: readonly string[];
}

export interface WorkerNodeRunClaim {
  readonly workerId: string;
  readonly nodeRunId: string;
  readonly tenantId: string;
  readonly serviceIdentity: string;
  readonly mtlsPeerFingerprint: string;
}

export interface WorkerIdentityDecision {
  readonly accepted: boolean;
  readonly reasonCode:
    | "worker_identity.accepted"
    | "worker_identity.worker_unknown"
    | "worker_identity.service_identity_mismatch"
    | "worker_identity.mtls_mismatch"
    | "worker_identity.tenant_not_allowed";
}

import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { Timestamp } from "../../contracts/types/domain/primitives.js";
import { ValidationError } from "../../contracts/errors.js";

/**
 * Worker service identity registry with P5 persistence.
 *
 * §8.2 requires P5 persistence - coordinator restart must not cause
 * worker identity loss. Identities are persisted to the worker snapshot store.
 */
export class WorkerServiceIdentityRegistry {
  private readonly identities = new Map<string, WorkerServiceIdentity>();
  private initialized = false;

  public constructor(private readonly store: AuthoritativeTaskStore) {}

  /**
   * Loads identities from persistent storage.
   * Called on service startup to recover identities after coordinator restart.
   */
  public loadFromStore(): void {
    if (this.initialized) {
      return;
    }
    const snapshots = this.store.worker.listWorkerSnapshots();
    for (const snapshot of snapshots) {
      if (snapshot.serviceIdentity) {
        const identity: WorkerServiceIdentity = {
          workerId: snapshot.workerId,
          serviceIdentity: snapshot.serviceIdentity,
          mtlsPeerFingerprint: snapshot.mtlsPeerFingerprint ?? "",
          allowedNodeRunTenants: snapshot.allowedNodeRunTenants ?? [],
        };
        this.identities.set(identity.workerId, identity);
      }
    }
    this.initialized = true;
  }

  public register(identity: WorkerServiceIdentity): WorkerServiceIdentity {
    // §8.2: Verify identity before overwriting to prevent mTLS fingerprint hijacking
    // If a verified identity exists, the new identity must match or provide valid challenge proof
    const existing = this.store.worker.getWorkerSnapshot(identity.workerId);
    if (existing != null && existing.registrationVerifiedAt != null && existing.mtlsPeerFingerprint != null) {
      // Identity has been previously verified with mTLS - new registration must match
      if (existing.mtlsPeerFingerprint !== identity.mtlsPeerFingerprint) {
        // Cannot overwrite verified identity without re-verification
        // This prevents a malicious actor from hijacking a legitimate worker's mTLS fingerprint
        throw new ValidationError(
          "worker_identity.verified_identity_overwrite_denied",
          "Cannot overwrite a verified worker identity with a different mTLS fingerprint.",
          {
            details: {
              workerId: identity.workerId,
              existingFingerprint: existing.mtlsPeerFingerprint,
              attemptedFingerprint: identity.mtlsPeerFingerprint,
              registrationVerifiedAt: existing.registrationVerifiedAt,
            },
          },
        );
      }
    }
    this.store.worker.upsertWorkerSnapshot({
      workerId: identity.workerId,
      status: existing?.status ?? "online",
      serviceIdentity: identity.serviceIdentity,
      mtlsPeerFingerprint: identity.mtlsPeerFingerprint,
      allowedNodeRunTenants: identity.allowedNodeRunTenants,
      placement: existing?.placement,
      isolationLevel: existing?.isolationLevel,
      repoVersion: existing?.repoVersion,
      remoteSessionStatus: existing?.remoteSessionStatus,
      lastAcknowledgedStreamOffset: existing?.lastAcknowledgedStreamOffset,
      streamResumeSuccessRate: existing?.streamResumeSuccessRate,
      credentialRefreshSuccessRate: existing?.credentialRefreshSuccessRate,
      sessionConsistencyCheckStatus: existing?.sessionConsistencyCheckStatus,
      sessionConsistencyCheckedAt: existing?.sessionConsistencyCheckedAt,
      workspaceSyncStatus: existing?.workspaceSyncStatus,
      workspaceSyncCheckedAt: existing?.workspaceSyncCheckedAt,
      saturation: existing?.saturation,
      activeLeaseCount: existing?.activeLeaseCount ?? 0,
      meanStartupLatencyMs: existing?.meanStartupLatencyMs,
      sandboxSuccessRate: existing?.sandboxSuccessRate,
      repoCacheHitRate: existing?.repoCacheHitRate,
      registrationVerifiedAt: existing?.registrationVerifiedAt,
      registrationChallengeId: existing?.registrationChallengeId,
      capabilitiesJson: existing?.capabilitiesJson ?? "{}",
      runningExecutionsJson: existing?.runningExecutionsJson ?? "[]",
      maxConcurrency: existing?.maxConcurrency ?? 1,
      queueAffinity: existing?.queueAffinity,
      runtimeInstanceId: existing?.runtimeInstanceId,
      restartedFromRuntimeInstanceId: existing?.restartedFromRuntimeInstanceId,
      restartGeneration: existing?.restartGeneration ?? 0,
      cpuPct: existing?.cpuPct,
      memoryMb: existing?.memoryMb,
      toolBacklogCount: existing?.toolBacklogCount ?? 0,
      currentStepId: existing?.currentStepId,
      lastProgressAt: existing?.lastProgressAt,
      lastHeartbeatAt: existing?.lastHeartbeatAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString() as Timestamp,
      version: (existing?.version ?? 0) + 1,
    });
    this.identities.set(identity.workerId, identity);
    return identity;
  }

  public evaluateClaim(claim: WorkerNodeRunClaim): WorkerIdentityDecision {
    // Ensure loaded from store before evaluation
    this.loadFromStore();
    const identity = this.identities.get(claim.workerId);
    if (identity == null) {
      return { accepted: false, reasonCode: "worker_identity.worker_unknown" };
    }
    if (identity.serviceIdentity !== claim.serviceIdentity) {
      return { accepted: false, reasonCode: "worker_identity.service_identity_mismatch" };
    }
    if (identity.mtlsPeerFingerprint !== claim.mtlsPeerFingerprint) {
      return { accepted: false, reasonCode: "worker_identity.mtls_mismatch" };
    }
    if (!identity.allowedNodeRunTenants.includes(claim.tenantId)) {
      return { accepted: false, reasonCode: "worker_identity.tenant_not_allowed" };
    }
    return { accepted: true, reasonCode: "worker_identity.accepted" };
  }
}
