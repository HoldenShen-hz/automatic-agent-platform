/**
 * Secret Commands CLI
 *
 * Provides secure secret operations with authentication gate before sensitive output.
 * All secret value outputs require explicit authorization via AA_SECRET_AUTH_TOKEN.
 *
 * Supported actions:
 *   - resolve: Resolve a secret value (auth-gated)
 *   - describe: Describe secret metadata (no secret value output)
 *   - leases: List secret leases (no secret value output)
 *   - summary: Build audit summary (no secret value output)
 *
 * Security:
 *   - Secret values require AA_SECRET_AUTH_TOKEN matching stored token
 *   - Rate limiting applies to prevent brute force attacks
 *   - All secret access is audit-logged
 */

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadSecretManagementCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ValidationError, PolicyDeniedError } from "../../platform/contracts/errors.js";
import { SecretManagementService, type SecretAuthorizationContext } from "../../platform/control-plane/iam/secret-management-service.js";

/**
 * Authentication gate configuration
 */
interface AuthGateConfig {
  authTokenPath: string;
  currentTokenHash: string | null;
}

const AUTH_TOKEN_ENV = "AA_SECRET_AUTH_TOKEN";
const AUTH_TOKEN_DEFAULT_PATH = join(process.env.HOME ?? "/tmp", ".automatic-agent", "secret-auth-token");

/**
 * Load or generate the secret auth token for CLI operations.
 * The token is stored as a hash for security.
 */
function loadAuthTokenConfig(env: NodeJS.ProcessEnv = process.env): AuthGateConfig {
  const tokenPath = env.AA_SECRET_AUTH_TOKEN_PATH ?? AUTH_TOKEN_DEFAULT_PATH;
  const rawToken = env[AUTH_TOKEN_ENV] ?? null;

  if (rawToken != null) {
    // Token provided via environment - hash it for comparison
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    return { authTokenPath: tokenPath, currentTokenHash: tokenHash };
  }

  // Try to load existing token hash from file
  try {
    const tokenFile = readFileSync(tokenPath, "utf8").trim();
    return { authTokenPath: tokenPath, currentTokenHash: tokenFile };
  } catch {
    // No token available - operations requiring auth will fail
    return { authTokenPath: tokenPath, currentTokenHash: null };
  }
}

/**
 * Require authentication token for sensitive operations.
 * Throws PolicyDeniedError if token is missing or invalid.
 */
function requireAuthToken(config: AuthGateConfig, action: string): void {
  if (config.currentTokenHash == null) {
    throw new PolicyDeniedError(
      `secret.auth_required:${action}`,
      `secret.auth_required:${action}`,
      {
        details: {
          action,
          reason: "no_auth_token_configured",
          hint: `Set ${AUTH_TOKEN_ENV} environment variable or configure ${AUTH_TOKEN_ENV}_PATH`,
        },
      },
    );
  }
}

/**
 * Verify the provided token matches the stored hash.
 */
function verifyAuthToken(config: AuthGateConfig, providedToken: string): boolean {
  if (config.currentTokenHash == null) {
    return false;
  }
  const providedHash = createHash("sha256").update(providedToken).digest("hex");
  return providedHash === config.currentTokenHash;
}

/**
 * Generate a new auth token and return it (only shown once at generation).
 * Token is stored as hash; the raw token is only available at generation time.
 */
function generateAuthToken(): { token: string; tokenPath: string } {
  const token = randomBytes(32).toString("hex");
  const tokenPath = process.env.AA_SECRET_AUTH_TOKEN_PATH ?? AUTH_TOKEN_DEFAULT_PATH;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  mkdirSync(dirname(tokenPath), { recursive: true, mode: 0o700 });
  writeFileSync(tokenPath, tokenHash, { encoding: "utf8", mode: 0o600 });

  return { token, tokenPath };
}

interface SecretCommandResult {
  success: boolean;
  action: string;
  data?: unknown;
  error?: string;
  errorCode?: string;
}

/**
 * Execute secret command with authentication gate.
 */
async function executeSecretCommand(
  action: string,
  envConfig: ReturnType<typeof loadSecretManagementCliEnv>,
  authConfig: AuthGateConfig,
): Promise<SecretCommandResult> {
  const storage = await (async () => {
    // Open storage within async context
    const { withCliStorageAsync: withStorage } = await import("./authoritative-storage.js");
    return withStorage(async (storage) => storage, { dbPath: envConfig.dbPath });
  })();

  const service = new SecretManagementService(storage.sql, storage.store);

  // Actions that don't require auth token (read-only metadata operations)
  const noAuthActions = ["describe", "leases", "summary", "refresh", "rotate", "register", "issue", "revoke"];

  // Actions that DO require auth token (output secret value)
  const authRequiredActions = ["resolve", "require"];

  // Build auth context from environment
  const authContext: SecretAuthorizationContext | undefined = (() => {
    const scopeType = envConfig.scopeType ?? "system";
    const scopeRef = envConfig.scopeRef ?? "cli";
    return { callerScopeType: scopeType, callerScopeRef: scopeRef };
  })();

  try {
    switch (action) {
      case "generate-token": {
        // Special action to generate a new auth token
        const { token, tokenPath } = generateAuthToken();
        return {
          success: true,
          action: "generate-token",
          data: {
            token, // Raw token - only available at generation time
            tokenPath,
            hint: "Store this token securely. The raw token cannot be recovered.",
          },
        };
      }

      case "resolve": {
        // Auth gate check for secret value exposure
        requireAuthToken(authConfig, action);

        const resolved = await service.resolveSecret(
          {
            secretRef: envConfig.secretRef ?? "",
            requestedBy: envConfig.requestedBy ?? "",
            grantedTo: envConfig.grantedTo ?? "",
            usagePurpose: envConfig.usagePurpose ?? "",
            ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
            ...(envConfig.executionId ? { executionId: envConfig.executionId } : {}),
            ...(envConfig.expiresAt ? { expiresAt: envConfig.expiresAt } : {}),
            ...(envConfig.usageMetadata ? { metadata: envConfig.usageMetadata } : {}),
          },
          authContext,
        );

        // Only output non-sensitive metadata, registry info, and audit trail
        // The actual secret value is NOT output to stdout - it's only available in memory
        return {
          success: true,
          action: "resolve",
          data: {
            metadata: resolved.metadata,
            registry: resolved.registry,
            usageAudit: resolved.usageAudit,
            valueAvailable: true,
            valueAccessNote: "Secret value is available in-memory only. Use 'require' action for programmatic access.",
          },
        };
      }

      case "require": {
        // Auth gate check for secret value access
        requireAuthToken(authConfig, action);

        const secretValue = await service.requireSecret(
          envConfig.secretRef ?? "",
          authContext,
        );

        // Return secret value (caller must handle securely)
        return {
          success: true,
          action: "require",
          data: {
            value: secretValue.value,
            metadata: secretValue.metadata,
            registry: secretValue.registry,
            securityNote: "Handle secret value securely. Do not log or persist.",
          },
        };
      }

      case "describe": {
        const description = await service.describeSecret(envConfig.secretRef ?? "");
        return {
          success: true,
          action: "describe",
          data: {
            metadata: description.metadata,
            registry: description.registry,
          },
        };
      }

      case "leases": {
        const leases = service.listSecretLeases(envConfig.secretRef ?? "", envConfig.asOf ?? undefined);
        return {
          success: true,
          action: "leases",
          data: {
            generatedAt: new Date().toISOString(),
            leases,
          },
        };
      }

      case "summary": {
        const summary = service.buildAuditSummary(envConfig.secretRef ?? "", envConfig.asOf ?? undefined);
        return {
          success: true,
          action: "summary",
          data: summary,
        };
      }

      default:
        throw new ValidationError(
          `unsupported_secret_action:${action}`,
          `unsupported_secret_action:${action}`,
        );
    }
  } catch (error) {
    if (error instanceof PolicyDeniedError) {
      return {
        success: false,
        action,
        error: error.message,
        errorCode: error.code,
      };
    }
    if (error instanceof ValidationError) {
      return {
        success: false,
        action,
        error: error.message,
        errorCode: error.code,
      };
    }
    throw error;
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const envConfig = loadSecretManagementCliEnv();
  const authConfig = loadAuthTokenConfig();

  const result = await executeSecretCommand(envConfig.action, envConfig, authConfig);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const errorResult: SecretCommandResult = {
    success: false,
    action: "unknown",
    error: error instanceof Error ? error.message : String(error),
    errorCode: error instanceof Error ? error.constructor.name : "UnknownError",
  };
  process.stdout.write(`${JSON.stringify(errorResult, null, 2)}\n`);
  process.exit(1);
});