import type { GovernanceDelegation } from "../delegation-registry/index.js";

export interface GovernanceActionScope {
  readonly orgNodeId: string;
  readonly domainId?: string;
  readonly capability: string;
}

export function matchesGovernanceScope(
  delegation: GovernanceDelegation,
  scope: GovernanceActionScope,
): boolean {
  const orgAllowed = delegation.orgNodeIds.length === 0 || delegation.orgNodeIds.includes(scope.orgNodeId);
  const domainAllowed = delegation.domainIds.length === 0 || scope.domainId == null || delegation.domainIds.includes(scope.domainId);
  const capabilityAllowed = delegation.capabilities.length === 0 || delegation.capabilities.includes(scope.capability);
  return orgAllowed && domainAllowed && capabilityAllowed;
}
