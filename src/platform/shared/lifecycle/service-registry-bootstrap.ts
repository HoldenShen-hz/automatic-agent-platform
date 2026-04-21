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

import { ServiceRegistry } from "./service-registry.js";
import { NetworkEgressAuditService } from "../../control-plane/iam/network-egress-audit.js";
import { NetworkEgressPolicyService, loadNetworkEgressPolicyConfigFromEnv } from "../../control-plane/iam/network-egress-policy.js";
import { OutputContinuationService } from "../../execution/execution-engine/output-continuation-service.js";
import { DelegationAuditService } from "../../orchestration/agent-delegation/delegation-audit-service.js";
import { DelegationGovernanceService } from "../../orchestration/agent-delegation/delegation-governance-service.js";

const registry = ServiceRegistry.getInstance();

// Register network egress audit service
registry.register("network-egress-audit", {
  init: () => new NetworkEgressAuditService(),
});

// Register network egress policy service (depends on audit service)
registry.register("network-egress-policy", {
  init: () => new NetworkEgressPolicyService(loadNetworkEgressPolicyConfigFromEnv()),
  dependsOn: ["network-egress-audit"],
});

// Register output continuation service
registry.register("output-continuation", {
  init: () => new OutputContinuationService(),
  teardown: (instance) => instance.clearRecords(),
});

// Register delegation audit service
registry.register("delegation-audit", {
  init: () => new DelegationAuditService(),
});

// Register delegation governance service
registry.register("delegation-governance", {
  init: () => new DelegationGovernanceService(),
});
