/**
 * @fileoverview Service Registry Bootstrap
 *
 * Registers core platform services in the ServiceRegistry.
 * This file should be imported early during application initialization
 * to ensure all services are properly registered before use.
 *
 * ## Registered Services
 *
 * | ID | Service | File |
 * |----|---------|------|
 * | network-egress-audit | NetworkEgressAuditService | control-plane/iam/network-egress-audit.ts |
 * | network-egress-policy | NetworkEgressPolicyService | control-plane/iam/network-egress-policy.ts |
 * | output-continuation | OutputContinuationService | execution/execution-engine/output-continuation-service.ts |
 * | delegation-audit | DelegationAuditService | orchestration/agent-delegation/delegation-audit-service.ts |
 * | delegation-governance | DelegationGovernanceService | orchestration/agent-delegation/delegation-governance-service.ts |
 */
export {};
