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
export * as sessionManagement from "./session-management.js";
export * as mfaService from "./mfa-service.js";
export * as serviceAuth from "./service-auth.js";
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
export {
  createRestrictedExecPolicy,
  createScopedExternalAccessPolicy,
  createWorkspaceWritePolicy,
} from "./sandbox-policy.js";

export {
  // Session management exports
  createSession,
  validateAccessToken,
  refreshSession,
  revokeSession,
  revokeAllPrincipalSessions,
  getSession,
  getPrincipalSessions,
  extractBearerToken,
  getSessionStats,
  type Session,
  type AccessToken,
  type RefreshToken,
  type SessionStatus,
  type SessionValidationResult,
  type SessionValidationError,
} from "./session-management.js";

export {
  // MFA exports
  startMfaEnrollment,
  completeMfaEnrollment,
  getMfaCredentials,
  hasActiveMfa,
  createMfaChallenge,
  verifyMfaChallenge,
  disableMfa,
  operationRequiresMfa,
  DEFAULT_MFA_POLICY,
  type MfaCredential,
  type MfaEnrollmentChallenge,
  type MfaVerificationChallenge,
  type MfaEnrollmentSession,
  type MfaPolicy,
  type MfaMethod,
  type MfaChallengeType,
  type MfaEnrollmentStatus,
  type MfaVerificationStatus,
  type MfaVerificationResult,
} from "./mfa-service.js";

export {
  // Service auth exports
  registerServiceIdentity,
  getServiceIdentity,
  getServiceIdentityByName,
  updateServiceIdentityStatus,
  rotateServiceKey,
  issueServiceToken,
  validateServiceToken,
  revokeServiceToken,
  revokeAllServiceTokens,
  generateMtlsCertificate,
  getMtlsCertificate,
  revokeMtlsCertificate,
  getServiceCertificates,
  extractServiceAuth,
  getServiceAuthStats,
  type ServiceIdentity,
  type ServiceToken,
  type MtlsCertificate,
  type ServiceAuthResult,
  type ServiceAuthError,
  type ServiceIdentityStatus,
  type ServiceTokenType,
} from "./service-auth.js";

export {
  // Access model exports with hierarchy support
  capabilitiesForRole,
  getRoleInheritanceChain,
  type PlatformPrincipalType,
  type PlatformRole,
  type PlatformCapability,
  type AuthorizationAction,
  type AuthorizationContext,
  type PrincipalAccessProfile,
  type AuthorizationContextDecision,
} from "./access-model.js";
