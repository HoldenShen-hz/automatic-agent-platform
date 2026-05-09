import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

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

// R13-19: Persisted worker identity record for durable storage
export interface WorkerIdentityRecord {
  workerId: string;
  serviceIdentity: string;
  mtlsPeerFingerprint: string;
  allowedNodeRunTenantsJson: string;
  createdAt: string;
  updatedAt: string;
}

export class WorkerServiceIdentityRegistry {
  private readonly store: AuthoritativeTaskStore | null;

  public constructor(store?: AuthoritativeTaskStore) {
    this.store = store ?? null;
  }

  public register(identity: WorkerServiceIdentity): WorkerServiceIdentity {
    // R13-19 fix: Persist identity to durable storage when store is available
    if (this.store) {
      const record: WorkerIdentityRecord = {
        workerId: identity.workerId,
        serviceIdentity: identity.serviceIdentity,
        mtlsPeerFingerprint: identity.mtlsPeerFingerprint,
        allowedNodeRunTenantsJson: JSON.stringify(identity.allowedNodeRunTenants),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        (this.store.worker as typeof this.store.worker & {
          upsertWorkerIdentity?: (record: WorkerIdentityRecord) => void;
        }).upsertWorkerIdentity?.(record);
      } catch {
        // Persistence failure should not prevent registration
      }
    }
    return identity;
  }

  public evaluateClaim(claim: WorkerNodeRunClaim): WorkerIdentityDecision {
    // R13-19 fix: Try to load from persistent storage first
    const storedIdentity = this.loadFromStore(claim.workerId);

    if (storedIdentity) {
      if (storedIdentity.serviceIdentity !== claim.serviceIdentity) {
        return { accepted: false, reasonCode: "worker_identity.service_identity_mismatch" };
      }
      if (storedIdentity.mtlsPeerFingerprint !== claim.mtlsPeerFingerprint) {
        return { accepted: false, reasonCode: "worker_identity.mtls_mismatch" };
      }
      if (!storedIdentity.allowedNodeRunTenants.includes(claim.tenantId)) {
        return { accepted: false, reasonCode: "worker_identity.tenant_not_allowed" };
      }
      return { accepted: true, reasonCode: "worker_identity.accepted" };
    }

    return { accepted: false, reasonCode: "worker_identity.worker_unknown" };
  }

  private loadFromStore(workerId: string): WorkerServiceIdentity | null {
    if (!this.store) {
      return null;
    }
    try {
      const record = (this.store.worker as typeof this.store.worker & {
        getWorkerIdentity?: (workerId: string) => WorkerIdentityRecord | null;
      }).getWorkerIdentity?.(workerId);
      if (record) {
        return {
          workerId: record.workerId,
          serviceIdentity: record.serviceIdentity,
          mtlsPeerFingerprint: record.mtlsPeerFingerprint,
          allowedNodeRunTenants: JSON.parse(record.allowedNodeRunTenantsJson),
        };
      }
    } catch {
      // Storage lookup failure returns null
    }
    return null;
  }
}
