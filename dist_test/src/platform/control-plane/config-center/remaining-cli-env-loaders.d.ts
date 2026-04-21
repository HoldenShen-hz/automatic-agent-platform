export * from "./remaining-cli-env-support.js";
import type { MemoryProviderQuery } from "../../state-evidence/memory/memory-provider.js";
import type { StructuredMemoryContent } from "../../state-evidence/memory/memory-schema.js";
import { type ControlPlaneBalancerCliEnvConfig, type DeploymentExecutionCliEnvConfig, type EnterpriseCapabilityCliEnvConfig, type GatewayTargetsCliEnvConfig, type InspectCliEnvConfig, type MarketplaceCliEnvConfig, type MemoryCliEnvConfig, type ModelRoutingCliEnvConfig, type OpsGovernanceCliEnvConfig, type SecretManagementCliEnvConfig, type ShadowSnapshotCliEnvConfig, type SkillCreatorCliEnvConfig, type TenantPlatformCliEnvConfig, type WorkerRegisterCliEnvConfig } from "./remaining-cli-env-support.js";
export declare function loadTenantPlatformCliEnv(env?: NodeJS.ProcessEnv): TenantPlatformCliEnvConfig;
/**
 * Loads enterprise capability CLI configuration from environment variables.
 * Supports capability readiness registration and verification.
 */
export declare function loadEnterpriseCapabilityCliEnv(env?: NodeJS.ProcessEnv): EnterpriseCapabilityCliEnvConfig;
/**
 * Loads marketplace CLI configuration from environment variables.
 * Supports package registration, review workflow, and publication management.
 */
export declare function loadMarketplaceCliEnv(env?: NodeJS.ProcessEnv): MarketplaceCliEnvConfig;
/**
 * Loads deployment execution CLI configuration from environment variables.
 * Supports deployment runs with local or simulated runners.
 */
export declare function loadDeploymentExecutionCliEnv(env?: NodeJS.ProcessEnv, cwd?: string): DeploymentExecutionCliEnvConfig;
/**
 * Loads control plane balancer CLI configuration from environment variables.
 * Supports coordinator heartbeat, dispatch selection, and queue management.
 */
export declare function loadControlPlaneBalancerCliEnv(env?: NodeJS.ProcessEnv): ControlPlaneBalancerCliEnvConfig;
/**
 * Loads ops governance CLI configuration from environment variables.
 * Supports operational governance reporting and exports.
 */
export declare function loadOpsGovernanceCliEnv(env?: NodeJS.ProcessEnv): OpsGovernanceCliEnvConfig;
/**
 * Loads secret management CLI configuration from environment variables.
 * Supports secret registration, rotation, leasing, and revocation.
 */
export declare function loadSecretManagementCliEnv(env?: NodeJS.ProcessEnv): SecretManagementCliEnvConfig;
/**
 * Loads worker registration CLI configuration from environment variables.
 * Supports worker challenge issuance and completion handshake.
 */
export declare function loadWorkerRegisterCliEnv(env?: NodeJS.ProcessEnv): WorkerRegisterCliEnvConfig;
export declare function loadGatewayTargetsCliEnv(env?: NodeJS.ProcessEnv): GatewayTargetsCliEnvConfig;
export declare function loadInspectCliEnv(env?: NodeJS.ProcessEnv): InspectCliEnvConfig;
export declare function loadSkillCreatorCliEnv(env?: NodeJS.ProcessEnv): SkillCreatorCliEnvConfig;
export declare function loadShadowSnapshotCliEnv(env?: NodeJS.ProcessEnv): ShadowSnapshotCliEnvConfig;
export declare function loadMemoryCliEnv(env?: NodeJS.ProcessEnv): MemoryCliEnvConfig;
export declare function buildMemoryProviderQuery(config: MemoryCliEnvConfig): MemoryProviderQuery;
export declare function buildStructuredMemoryContentFromCliEnv(config: MemoryCliEnvConfig): StructuredMemoryContent | undefined;
export declare function loadModelRoutingCliEnv(env?: NodeJS.ProcessEnv): ModelRoutingCliEnvConfig;
