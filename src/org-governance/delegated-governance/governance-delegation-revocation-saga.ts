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
}

export class GovernanceDelegationRevocationSaga {
  public revoke(
    request: GovernanceDelegationRevocationRequest,
    completedAtMs: number,
  ): GovernanceDelegationRevocationReceipt {
    const elapsed = completedAtMs - request.requestedAtMs;
    return {
      delegationId: request.delegationId,
      frozenResourceIds: [...request.derivedResourceIds],
      revokedDerivedDelegationIds: [...(request.derivedDelegationIds ?? [])],
      revokeWithinSlo: elapsed <= 60_000,
      cascadeWithinSlo: elapsed <= 300_000 && (request.derivedDelegationIds?.length ?? 0) >= 0,
      completedAtMs,
    };
  }
}
