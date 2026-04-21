import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import type { ProviderReadinessResult, StartupConfigValidationResult, StartupConsistencyCheckerOptions } from "./startup-consistency-checker.js";
export interface StartupPreflightOptions {
    configRoot?: string;
    environment?: string;
    sandboxPolicy?: SandboxPolicy;
    contextSandboxPolicy?: SandboxPolicy;
    providerEnv?: NodeJS.ProcessEnv;
    providerSecretResolver?: ((secretRef: string) => string) | null;
}
/** Derives the environment variable name for a provider's API key. */
export declare function deriveProviderApiKeyEnvName(providerId: string): string;
/** Derives the environment variable name for a provider's JSON API keys. */
export declare function deriveProviderApiKeysJsonEnvNameForStartup(providerId: string): string;
/** Derives the environment variable name for a provider's secret ref. */
export declare function deriveProviderApiKeySecretRefEnvNameForStartup(providerId: string): string;
/** Derives the environment variable name for a provider's secret refs JSON. */
export declare function deriveProviderApiKeySecretRefsJsonEnvNameForStartup(providerId: string): string;
/**
 * Builds a configuration validator for startup preflight checks.
 *
 * Creates a function that validates:
 * - Config bundle loads successfully from the governance service
 * - Trusted context workspace scan has no issues
 * - Storage backend is correctly configured
 *
 * Returns a validator function that can be called to perform the checks.
 */
export declare function buildDefaultStartupConfigValidator(options?: StartupPreflightOptions): () => StartupConfigValidationResult;
/**
 * Builds a provider readiness probe that checks if the default provider is configured.
 *
 * The probe verifies:
 * - The default provider exists in the model metadata registry
 * - The provider is not disabled
 * - Required API key credentials are configured in the environment
 *
 * Returns a function that accepts a config validation result and returns
 * provider readiness findings.
 */
export declare function buildEnvironmentProviderReadinessProbe(options?: StartupPreflightOptions): (configValidation: StartupConfigValidationResult | null) => ProviderReadinessResult[];
/**
 * Creates default startup consistency checker options from preflight options.
 *
 * Combines the config validator and provider readiness probe into a single
 * options object suitable for StartupConsistencyChecker.
 */
export declare function createDefaultStartupConsistencyCheckerOptions(options?: StartupPreflightOptions): StartupConsistencyCheckerOptions;
