export interface GovernanceDelegationRevocationRequest {
  readonly delegationId: string;
  readonly requestedAtMs: number;
  readonly derivedResourceIds: readonly string[];
  readonly derivedDelegationIds?: readonly string[];
}

export interface GovernanceDelegationRevocationReceipt {
  readonly delegationId: string;
  readonly frozenResourceIds: readonly string[];
  readonly revokedDerivedDelegationIds: readonly string[];
  readonly revokeWithinSlo: boolean;
  readonly cascadeWithinSlo: boolean;
  readonly completedAtMs: number;
  readonly sagaStages: readonly ("prepare" | "commit" | "compensate" | "audit")[];
  readonly compensationResourceIds: readonly string[];
}

export class GovernanceDelegationRevocationSaga {
  public revoke(
    request: GovernanceDelegationRevocationRequest,
    completedAtMs: number,
  ): GovernanceDelegationRevocationReceipt {
    const elapsed = completedAtMs - request.requestedAtMs;
    const compensationResourceIds = elapsed > 300_000 ? [...request.derivedResourceIds] : [];
    return {
      delegationId: request.delegationId,
      frozenResourceIds: [...request.derivedResourceIds],
      revokedDerivedDelegationIds: [...(request.derivedDelegationIds ?? [])],
      revokeWithinSlo: elapsed <= 60_000,
      cascadeWithinSlo: elapsed <= 300_000 && (request.derivedDelegationIds?.length ?? 0) >= 0,
      completedAtMs,
      sagaStages: compensationResourceIds.length > 0
        ? ["prepare", "commit", "compensate", "audit"]
        : ["prepare", "commit", "audit"],
      compensationResourceIds,
    };
  }
}
