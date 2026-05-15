import { dirname } from "node:path";

import { ConfigGovernanceService } from "../../five-plane-control-plane/config-center/config-governance-service.js";
import { resolveConfigEnvironment, resolveConfigRoot } from "../../five-plane-control-plane/config-center/runtime-env.js";
import {
  deriveProviderApiKeyEnvName as deriveProviderApiKeyEnvNameFromPool,
  deriveProviderApiKeySecretRefEnvName,
  deriveProviderApiKeySecretRefsJsonEnvName,
  deriveProviderApiKeysJsonEnvName,
  loadProviderCredentialRecordsFromEnv,
} from "../../model-gateway/provider-registry/provider-credential-pool.js";
import { loadModelMetadataRegistry } from "../../five-plane-control-plane/config-center/model-metadata-registry.js";
import { createWorkspaceWritePolicy, type SandboxPolicy } from "../../five-plane-control-plane/iam/sandbox-policy.js";
import { buildStorageBackendConfigIssues } from "../../five-plane-state-evidence/truth/storage-backend-config.js";
import { scanTrustedContextWorkspace } from "../../five-plane-control-plane/iam/trusted-context-scanner.js";
import type {
  ProviderReadinessResult,
  StartupConfigValidationResult,
  StartupConsistencyCheckerOptions,
} from "./startup-consistency-checker.js";

export interface StartupPreflightOptions {
  configRoot?: string;
  environment?: string;
  sandboxPolicy?: SandboxPolicy;
  contextSandboxPolicy?: SandboxPolicy;
  providerEnv?: NodeJS.ProcessEnv;
  providerSecretResolver?: ((secretRef: string) => string) | null;
}

/**
 * Resolves the config root path, defaulting to standard location if not specified.
 */
function normalizeConfigRoot(configRoot?: string): string {
  return resolveConfigRoot(configRoot != null ? { configRoot } : {});
}

/** Formats an error as a string, extracting message from Error instances. */
function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Derives the environment variable name for a provider's API key. */
export function deriveProviderApiKeyEnvName(providerId: string): string {
  return deriveProviderApiKeyEnvNameFromPool(providerId);
}

/** Derives the environment variable name for a provider's JSON API keys. */
export function deriveProviderApiKeysJsonEnvNameForStartup(providerId: string): string {
  return deriveProviderApiKeysJsonEnvName(providerId);
}

/** Derives the environment variable name for a provider's secret ref. */
export function deriveProviderApiKeySecretRefEnvNameForStartup(providerId: string): string {
  return deriveProviderApiKeySecretRefEnvName(providerId);
}

/** Derives the environment variable name for a provider's secret refs JSON. */
export function deriveProviderApiKeySecretRefsJsonEnvNameForStartup(providerId: string): string {
  return deriveProviderApiKeySecretRefsJsonEnvName(providerId);
}

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
export function buildDefaultStartupConfigValidator(
  options: StartupPreflightOptions = {},
): () => StartupConfigValidationResult {
  const configRoot = normalizeConfigRoot(options.configRoot);
  const resolveEnvOptions: { environment?: string; env?: NodeJS.ProcessEnv } = {};
  if (options.environment != null) {
    resolveEnvOptions.environment = options.environment;
  }
  if (options.providerEnv != null) {
    resolveEnvOptions.env = options.providerEnv;
  }
  const environment = resolveConfigEnvironment(resolveEnvOptions);
  const sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(configRoot);
  const workspaceRoot = dirname(configRoot);
  const contextSandboxPolicy = options.contextSandboxPolicy ?? createWorkspaceWritePolicy(workspaceRoot);
  const runtimeEnv = options.providerEnv ?? process.env;
  const governance = new ConfigGovernanceService({
    configRoot,
    sandboxPolicy,
  });

  /**
   * Validates configuration by:
   * 1. Loading the config bundle (fails if bundle has errors)
   * 2. Scanning trusted context workspace for policy violations
   * 3. Checking storage backend configuration
   */
  return () => {
    try {
      const bundle = governance.loadBundle(environment);
      const trustedContextReport = scanTrustedContextWorkspace(workspaceRoot, {
        sandboxPolicy: contextSandboxPolicy,
      });
      const trustedContextIssues = trustedContextReport.findings.map(
        (finding) => `${finding.code}:${finding.severity}:${finding.message}`,
      );
      const storageIssues = buildStorageBackendConfigIssues({
        environment,
        env: runtimeEnv,
        sandboxPolicy: contextSandboxPolicy,
      });
      const issues = [...bundle.issues, ...trustedContextIssues, ...storageIssues];
      return {
        ok: issues.length === 0,
        environment,
        configRoot: bundle.configRoot,
        issues,
        bundle: {
          ...bundle,
          issues,
        },
      };
    } catch (error) {
      return {
        ok: false,
        environment,
        configRoot,
        issues: [formatErrorMessage(error)],
        bundle: null,
      };
    }
  };
}

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
export function buildEnvironmentProviderReadinessProbe(
  options: StartupPreflightOptions = {},
): (configValidation: StartupConfigValidationResult | null) => ProviderReadinessResult[] {
  const providerEnv = options.providerEnv ?? process.env;
  const providerSecretResolver = options.providerSecretResolver ?? null;

  return (configValidation) => {
    if (!configValidation?.ok || configValidation.bundle == null) {
      return [];
    }

    const defaultProvider = configValidation.bundle.layers.providers?.defaultProvider;
    if (typeof defaultProvider !== "string" || defaultProvider.length === 0) {
      return [];
    }

    const modelRegistry = loadModelMetadataRegistry(
      configValidation.bundle.configRoot,
      createWorkspaceWritePolicy(configValidation.bundle.configRoot),
    );
    const providerMetadata = modelRegistry.providers[defaultProvider];
    if (providerMetadata == null) {
      return [
        {
          provider: defaultProvider,
          ready: false,
          reasonCode: "provider.registry_missing",
          message: `Default provider ${defaultProvider} is not present in the model metadata registry.`,
        },
      ];
    }

    const findings: ProviderReadinessResult[] = [];
    if (providerMetadata.status === "disabled") {
      findings.push({
        provider: defaultProvider,
        ready: false,
        reasonCode: "provider.disabled",
        message: `Default provider ${defaultProvider} is disabled in the model metadata registry.`,
      });
    }

    for (const authMethod of providerMetadata.authMethods) {
      if (authMethod !== "api_key") {
        continue;
      }

      const envName = deriveProviderApiKeyEnvName(defaultProvider);
      const jsonEnvName = deriveProviderApiKeysJsonEnvName(defaultProvider);
      const secretRefEnvName = deriveProviderApiKeySecretRefEnvName(defaultProvider);
      const secretRefsJsonEnvName = deriveProviderApiKeySecretRefsJsonEnvName(defaultProvider);

      let credentialsConfigured = false;
      try {
        credentialsConfigured = loadProviderCredentialRecordsFromEnv(defaultProvider, providerEnv, {
          secretResolver: providerSecretResolver,
        }).length > 0;
      } catch (error) {
        findings.push({
          provider: defaultProvider,
          ready: false,
          reasonCode: "provider.credentials_invalid",
          message: `Default provider ${defaultProvider} has invalid credential configuration in ${envName}, ${jsonEnvName}, ${secretRefEnvName}, or ${secretRefsJsonEnvName}: ${formatErrorMessage(error)}`,
        });
        continue;
      }

      if (!credentialsConfigured) {
        findings.push({
          provider: defaultProvider,
          ready: false,
          reasonCode: "provider.credentials_missing",
          message: `Default provider ${defaultProvider} requires ${envName}, ${jsonEnvName}, ${secretRefEnvName}, or ${secretRefsJsonEnvName} to be set before startup.`,
        });
      }
    }

    return findings;
  };
}

/**
 * Creates default startup consistency checker options from preflight options.
 *
 * Combines the config validator and provider readiness probe into a single
 * options object suitable for StartupConsistencyChecker.
 */
export function createDefaultStartupConsistencyCheckerOptions(
  options: StartupPreflightOptions = {},
): StartupConsistencyCheckerOptions {
  return {
    configValidator: buildDefaultStartupConfigValidator(options),
    providerReadinessProbe: buildEnvironmentProviderReadinessProbe(options),
  };
}
