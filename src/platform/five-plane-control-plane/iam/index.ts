export * as auditEventIntegrity from "./audit-event-integrity.js";
export * as auditIntegrityRepository from "./audit-integrity-repository.js";
export * as cveIntelligence from "./cve-intelligence-service.js";
export * as dataClassification from "./data-classification-service.js";
export * as externalSecretProvider from "./external-secret-provider.js";
export * as fieldEncryption from "./field-encryption.js";
export * as fileFreshness from "./file-freshness.js";
export * as managedSecretProvider from "./managed-secret-provider.js";
export * as networkEgressAudit from "./network-egress-audit.js";
export * as networkEgressPolicy from "./network-egress-policy.js";
export * as outboundUrlPolicy from "./outbound-url-policy.js";
export * as policyEngine from "./policy-engine.js";
export * as sandboxPolicy from "./sandbox-policy.js";
export * as secretManagementSupport from "./secret-management-support.js";
export * as threatModel from "./threat-model/index.js";
export * as trustedContextScanner from "./trusted-context-scanner.js";
export * as vaultHttpSecretProvider from "./vault-http-secret-provider.js";
export * as awsKmsHttpSecretProvider from "./aws-kms-http-secret-provider.js";
export * as gcpSecretManagerHttpSecretProvider from "./gcp-secret-manager-http-secret-provider.js";

export {
  EnvSecretProvider,
  deriveSecretEnvName,
  deriveSecretScope,
  maskSecretValue,
  validateSecretRef,
} from "./env-secret-provider.js";
export type {
  EnvSecretProviderOptions,
  ManagedSecretProvider,
  SecretProviderIssuedLease,
  SecretProviderMetadata,
  SecretProviderValue,
} from "./env-secret-provider.js";
export { SecretManagementService } from "./secret-management-service.js";
export type {
  SecretAuthorizationContext,
} from "./secret-management-service.js";
export {
  createRestrictedExecPolicy,
  createScopedExternalAccessPolicy,
  createWorkspaceWritePolicy,
} from "./sandbox-policy.js";
export {
  capabilitiesForRole,
  defaultRolesForPrincipalType,
  evaluateAuthorizationContext,
  inferCapabilitiesForAction,
  listPlatformPrincipalTypes,
  listPlatformRoles,
  resolvePrincipalAccessProfile,
  roleGrantsCapabilities,
} from "./access-model.js";
export type {
  AuthorizationAction,
  AuthorizationContext,
  AuthorizationContextDecision,
  AuthorizationEvaluationLayer,
  PlatformCapability,
  PlatformPrincipalType,
  PlatformRole,
  PrincipalAccessProfile,
} from "./access-model.js";
export {
  createSession,
  extractBearerToken,
  getPrincipalSessions,
  getSession,
  getSessionStats,
  refreshSession,
  revokeAllPrincipalSessions,
  revokeSession,
  validateAccessToken,
} from "./session-management.js";
export type {
  AccessToken,
  RefreshToken,
  Session,
  SessionStatus,
  SessionValidationError,
  SessionValidationResult,
} from "./session-management.js";
export {
  extractServiceAuth,
  generateMtlsCertificate,
  getMtlsCertificate,
  getServiceAuthStats,
  getServiceCertificates,
  getServiceIdentity,
  getServiceIdentityByName,
  issueServiceToken,
  registerServiceIdentity,
  revokeAllServiceTokens,
  revokeMtlsCertificate,
  revokeServiceToken,
  rotateServiceKey,
  updateServiceIdentityStatus,
  validateServiceToken,
} from "./service-auth.js";
export type {
  MtlsCertificate,
  ServiceAuthError,
  ServiceAuthResult,
  ServiceIdentity,
  ServiceIdentityStatus,
  ServiceToken,
  ServiceTokenType,
} from "./service-auth.js";
