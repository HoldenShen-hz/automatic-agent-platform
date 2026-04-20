import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  listActiveGovernanceDelegations,
  type GovernanceDelegation,
} from "./delegation-registry/index.js";
import {
  matchesGovernanceScope,
  type GovernanceActionScope,
} from "./scope-manager/index.js";

export interface DelegationResolution {
  readonly allowed: boolean;
  readonly delegationId: string | null;
  readonly reasonCodes: readonly string[];
}

export class DelegatedGovernanceService {
  private readonly delegations: readonly GovernanceDelegation[];

  public constructor(delegations: readonly GovernanceDelegation[]) {
    this.delegations = delegations;
  }

  public resolve(granteeId: string, scope: GovernanceActionScope, now = nowIso()): DelegationResolution {
    const active = listActiveGovernanceDelegations(this.delegations, now)
      .filter((item) => item.granteeId === granteeId);
    const matched = active.find((item) => matchesGovernanceScope(item, scope)) ?? null;
    return {
      allowed: matched != null,
      delegationId: matched?.delegationId ?? null,
      reasonCodes: matched == null
        ? ["delegated_governance.scope_not_granted"]
        : ["delegated_governance.scope_granted"],
    };
  }
}
