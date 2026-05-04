/**
 * Federation Module
 * Cross-organization trust and capability delegation
 */

// Export gateway - TrustRelationship and TrustLevel from this file
// are the canonical types for the federation gateway
export {
  FederationGateway,
  createFederationGateway,
  type FederationGatewayConfig,
  type FederationOrg,
  TrustLevel,
  type TrustRelationship,
  type CapabilityGrant,
  type CapabilityPermission,
  type CapabilityConstraint,
  type DelegationRequest,
  type DelegationResult,
  type FederationEvent,
  type FederationRegionPriority,
  type FederationTopologyDiff,
  type FederationTopologyRegion,
  type FederationTopology,
  computeFederationTopologyDiff,
  type FederationCatalogEntry,
  type FederationCatalog,
  buildFederationCatalog,
} from "./federation-gateway.js";

export {
  FederationAudit,
  createFederationAudit,
  type FederationAuditRecord,
  type AuditAction,
  type ResourceType,
  type AuditStatus,
  type AuditQuery,
  type AuditSummary,
  type AuditRetentionPolicy,
} from "./federation-audit.js";

// TrustRelationshipManager has its own TrustRelationship type internally,
// but we only export the manager itself, not the internal types
export {
  TrustRelationshipManager,
  createTrustRelationshipManager,
} from "./trust-relationship.js";

export {
  CapabilityDelegation,
  createCapabilityDelegation,
} from "./capability-delegation.js";
