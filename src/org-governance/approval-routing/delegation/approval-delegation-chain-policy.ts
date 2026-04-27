export interface ApprovalDelegationChain {
  readonly chainId: string;
  readonly delegateActorIds: readonly string[];
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export interface ApprovalDelegationChainDecision {
  readonly allowed: boolean;
  readonly reasonCode:
    | "approval_delegation.allowed"
    | "approval_delegation.chain_too_long"
    | "approval_delegation.total_wait_exceeded";
}

export class ApprovalDelegationChainPolicy {
  public constructor(
    private readonly maxDelegationChainLength: number,
    private readonly maxTotalApprovalWaitMs: number,
  ) {}

  public evaluate(chain: ApprovalDelegationChain): ApprovalDelegationChainDecision {
    if (chain.delegateActorIds.length > this.maxDelegationChainLength) {
      return { allowed: false, reasonCode: "approval_delegation.chain_too_long" };
    }
    if (chain.expiresAtMs - chain.createdAtMs > this.maxTotalApprovalWaitMs) {
      return { allowed: false, reasonCode: "approval_delegation.total_wait_exceeded" };
    }
    return { allowed: true, reasonCode: "approval_delegation.allowed" };
  }
}
