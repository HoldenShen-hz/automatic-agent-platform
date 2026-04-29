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

import type { WorkerServiceIdentity, WorkerNodeRunClaim, WorkerIdentityDecision } from "./worker-service-identity.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

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
    // Persist to store for P5 durability
    const existing = this.store.worker.getWorkerSnapshot(identity.workerId);
    if (existing) {
      this.store.worker.upsertWorkerSnapshot({
        ...existing,
        serviceIdentity: identity.serviceIdentity,
        mtlsPeerFingerprint: identity.mtlsPeerFingerprint,
        allowedNodeRunTenants: identity.allowedNodeRunTenants,
      });
    }
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
