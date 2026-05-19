import { ValidationError } from "../../contracts/errors.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";

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
  // R13-19 fix: In-memory fallback when no store is provided
  private readonly memoryStore: Map<string, WorkerServiceIdentity>;

  public constructor(store?: AuthoritativeTaskStore) {
    this.store = store ?? null;
    this.memoryStore = new Map();
  }

  public register(identity: WorkerServiceIdentity): WorkerServiceIdentity {
    const existingVerified = this.loadVerifiedWorkerSnapshot(identity.workerId);
    if (
      existingVerified != null
      && existingVerified.mtlsPeerFingerprint !== identity.mtlsPeerFingerprint
    ) {
      throw new ValidationError(
        "worker_identity.verified_identity_overwrite_denied",
        `Cannot overwrite verified worker identity fingerprint for ${identity.workerId}.`,
      );
    }

    // R13-19 fix: Store in memory map for coordinator restarts
    this.memoryStore.set(identity.workerId, identity);

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

  private loadVerifiedWorkerSnapshot(workerId: string): { mtlsPeerFingerprint: string } | null {
    if (!this.store) {
      return null;
    }
    try {
      const snapshot = (this.store.worker as typeof this.store.worker & {
        getWorkerSnapshot?: (workerId: string) => unknown;
      }).getWorkerSnapshot?.(workerId);
      if (snapshot == null || typeof snapshot !== "object") {
        return null;
      }
      const record = snapshot as {
        registrationVerifiedAt?: unknown;
        mtlsPeerFingerprint?: unknown;
      };
      if (typeof record.registrationVerifiedAt === "string" && typeof record.mtlsPeerFingerprint === "string") {
        return { mtlsPeerFingerprint: record.mtlsPeerFingerprint };
      }
    } catch {
      return null;
    }
    return null;
  }

  public evaluateClaim(claim: WorkerNodeRunClaim): WorkerIdentityDecision {
    // R13-19 fix: Check in-memory store first (for coordinator restarts without persistent store)
    const memoryIdentity = this.memoryStore.get(claim.workerId);
    if (memoryIdentity) {
      if (memoryIdentity.serviceIdentity !== claim.serviceIdentity) {
        return { accepted: false, reasonCode: "worker_identity.service_identity_mismatch" };
      }
      if (memoryIdentity.mtlsPeerFingerprint !== claim.mtlsPeerFingerprint) {
        return { accepted: false, reasonCode: "worker_identity.mtls_mismatch" };
      }
      if (!memoryIdentity.allowedNodeRunTenants.includes(claim.tenantId)) {
        return { accepted: false, reasonCode: "worker_identity.tenant_not_allowed" };
      }
      return { accepted: true, reasonCode: "worker_identity.accepted" };
    }

    // R13-19 fix: Try to load from persistent storage as fallback
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
