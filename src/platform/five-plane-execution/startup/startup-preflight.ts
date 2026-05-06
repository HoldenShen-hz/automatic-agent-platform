import { dirname } from "node:path";

import { ConfigGovernanceService } from "../../control-plane/config-center/config-governance-service.js";
import { ConfigDriftReconciler, type ConfigDriftSource } from "../../control-plane/config-center/config-drift-reconciler.js";
import { resolveConfigEnvironment, resolveConfigRoot } from "../../control-plane/config-center/runtime-env.js";
import type { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
import {
  deriveProviderApiKeyEnvName as deriveProviderApiKeyEnvNameFromPool,
  deriveProviderApiKeySecretRefEnvName,
  deriveProviderApiKeySecretRefsJsonEnvName,
  deriveProviderApiKeysJsonEnvName,
  loadProviderCredentialRecordsFromEnv,
} from "../../model-gateway/provider-registry/provider-credential-pool.js";
import { loadModelMetadataRegistry } from "../../control-plane/config-center/model-metadata-registry.js";
import { createWorkspaceWritePolicy, type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import { buildStorageBackendConfigIssues } from "../../state-evidence/truth/storage-backend-config.js";
import { scanTrustedContextWorkspace } from "../../control-plane/iam/trusted-context-scanner.js";
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
  configDriftEventBus?: DurableEventBus | null;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function flattenConfig(
  input: Record<string, unknown>,
  prefix = "",
): Record<string, string | number | boolean> {
  const flattened: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      flattened[path] = value;
      if (prefix === "") {
        flattened[key] = value;
      }
      continue;
    }
    if (isPlainObject(value)) {
      Object.assign(flattened, flattenConfig(value, path));
    }
  }
  return flattened;
}

function loadRuntimeOverridesFromEnv(env: NodeJS.ProcessEnv, prefix = "AA_"): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(prefix) || value == null) {
      continue;
    }
    const configKey = key
      .slice(prefix.length)
      .toLowerCase()
      .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    overrides[configKey] = value;
  }
  return overrides;
}

function buildRuntimeDriftIssues(
  bundle: NonNullable<StartupConfigValidationResult["bundle"]>,
  runtimeEnv: NodeJS.ProcessEnv,
  eventBus: DurableEventBus | null,
): string[] {
  const baselineValues = flattenConfig(
    Object.entries(bundle.layers).reduce<Record<string, unknown>>((accumulator, [layerName, layerConfig]) => {
      if (isPlainObject(layerConfig)) {
        accumulator[layerName] = layerConfig;
        Object.assign(accumulator, layerConfig);
      }
      return accumulator;
    }, {}),
  );
  const runtimeOverrides = Object.fromEntries(
    Object.entries(loadRuntimeOverridesFromEnv(runtimeEnv)).filter(
      ([key, value]) =>
        Object.prototype.hasOwnProperty.call(baselineValues, key)
        && (typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
    ),
  ) as Record<string, string | number | boolean>;
  if (Object.keys(runtimeOverrides).length === 0) {
    return [];
  }
  const reconciler = new ConfigDriftReconciler({
    eventBus,
    incidentSeverityThreshold: "warning",
  });
  const report = reconciler.reconcile({
    baseline: {
      sourceName: "defaults",
      values: baselineValues,
    } satisfies ConfigDriftSource,
    observed: [{
      sourceName: "runtime",
      values: runtimeOverrides,
    }],
    generatedAt: new Date().toISOString(),
  });

  return report.findings.map(
    (finding) => `config_drift.${finding.severity}:${finding.key}:expected=${String(finding.expectedValue)}:observed=${String(finding.observedValue)}`,
  );
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
      const driftIssues = buildRuntimeDriftIssues(bundle, runtimeEnv, options.configDriftEventBus ?? null);
      const issues = [...bundle.issues, ...trustedContextIssues, ...storageIssues, ...driftIssues];
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
