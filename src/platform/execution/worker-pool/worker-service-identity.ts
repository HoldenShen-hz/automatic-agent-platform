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

export class WorkerServiceIdentityRegistry {
  private readonly identities = new Map<string, WorkerServiceIdentity>();

  public register(identity: WorkerServiceIdentity): WorkerServiceIdentity {
    this.identities.set(identity.workerId, identity);
    return identity;
  }

  public evaluateClaim(claim: WorkerNodeRunClaim): WorkerIdentityDecision {
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
