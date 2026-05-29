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

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { chmodSync, closeSync as closeFileSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { withCliStorageAsync } from "./authoritative-storage.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, isCliEntryPoint, runCliMain } from "./cli-exit.js";
import { loadSecretManagementCliEnv } from "../../platform/five-plane-control-plane/config-center/remaining-cli-env.js";
import { ValidationError, PolicyDeniedError } from "../../platform/contracts/errors.js";
import { SecretManagementService, type SecretAuthorizationContext } from "../../platform/five-plane-control-plane/iam/secret-management-service.js";

/**
 * Authentication gate configuration
 */
interface AuthGateConfig {
  authTokenPath: string;
  storedTokenHash: string | null;
  providedToken: string | null;
}

const AUTH_TOKEN_ENV = "AA_SECRET_AUTH_TOKEN";
const SECRET_OUTPUT_PATH_ENV = "AA_SECRET_OUTPUT_PATH";

function resolveSecureCliHome(env: NodeJS.ProcessEnv = process.env): string {
  const explicitHome = env.HOME?.trim();
  const fallbackHome = homedir().trim();
  const home = explicitHome && explicitHome.length > 0 ? explicitHome : fallbackHome.length > 0 ? fallbackHome : null;
  if (home == null) {
    throw new ValidationError("secret.home_directory_required", "secret.home_directory_required");
  }
  return home;
}

export function resolveAuthTokenPath(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.AA_SECRET_AUTH_TOKEN_PATH ?? join(resolveSecureCliHome(env), ".automatic-agent", "secret-auth-token"));
}

function assertPathIsNotSymlink(path: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) {
      throw new PolicyDeniedError("secret.symlink_path_denied", "secret.symlink_path_denied", {
        details: { path },
      });
    }
  } catch (error) {
    if (error instanceof PolicyDeniedError) {
      throw error;
    }
  }
}

function ensureSecureParentDirectory(path: string): string {
  const parent = dirname(path);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  chmodSync(parent, 0o700);
  return realpathSync(parent);
}

function writeSecureFile(path: string, contents: string): void {
  const targetPath = resolve(path);
  ensureSecureParentDirectory(targetPath);
  assertPathIsNotSymlink(targetPath);
  const fd = openSync(targetPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW, 0o600);
  try {
    writeFileSync(fd, contents, { encoding: "utf8" });
  } finally {
    closeFileSync(fd);
  }
  chmodSync(targetPath, 0o600);
}

function buildStoredTokenHash(token: string): string {
  const salt = randomBytes(16);
  const digest = scryptSync(token, salt, 32);
  return `${salt.toString("hex")}:${digest.toString("hex")}`;
}

function parseStoredTokenHash(storedTokenHash: string): { salt: Buffer; digest: Buffer } | null {
  const [saltHex, digestHex] = storedTokenHash.split(":");
  if (
    saltHex == null
    || digestHex == null
    || saltHex.length !== 32
    || digestHex.length !== 64
    || !/^[0-9a-f]+$/iu.test(saltHex)
    || !/^[0-9a-f]+$/iu.test(digestHex)
  ) {
    return null;
  }
  return {
    salt: Buffer.from(saltHex, "hex"),
    digest: Buffer.from(digestHex, "hex"),
  };
}

/**
 * Load or generate the secret auth token for CLI operations.
 * The token is stored as a hash for security.
 */
export function loadAuthTokenConfig(env: NodeJS.ProcessEnv = process.env): AuthGateConfig {
  const tokenPath = resolveAuthTokenPath(env);
  const rawToken = env[AUTH_TOKEN_ENV]?.trim() ?? null;

  try {
    assertPathIsNotSymlink(tokenPath);
    const tokenFile = readFileSync(tokenPath, "utf8").trim();
    return { authTokenPath: tokenPath, storedTokenHash: tokenFile, providedToken: rawToken };
  } catch (error) {
    if (error instanceof PolicyDeniedError) {
      throw error;
    }
    return { authTokenPath: tokenPath, storedTokenHash: null, providedToken: rawToken };
  }
}

/**
 * Require authentication token for sensitive operations.
 * Throws PolicyDeniedError if token is missing or invalid.
 */
function requireAuthToken(config: AuthGateConfig, action: string): void {
  if (config.storedTokenHash == null || config.providedToken == null || config.providedToken.length === 0) {
    throw new PolicyDeniedError(
      `secret.auth_required:${action}`,
      `secret.auth_required:${action}`,
      {
        details: {
          action,
          reason: "missing_or_unverified_auth_token",
          hint: `Set ${AUTH_TOKEN_ENV} environment variable or configure ${AUTH_TOKEN_ENV}_PATH`,
        },
      },
    );
  }
  if (!verifyAuthToken(config, config.providedToken)) {
    throw new PolicyDeniedError(
      `secret.auth_invalid:${action}`,
      `secret.auth_invalid:${action}`,
      {
        details: {
          action,
          reason: "token_verification_failed",
        },
      },
    );
  }
}

/**
 * Verify the provided token matches the stored hash.
 */
export function verifyAuthToken(config: AuthGateConfig, providedToken: string): boolean {
  if (config.storedTokenHash == null) {
    return false;
  }
  const parsed = parseStoredTokenHash(config.storedTokenHash);
  const expected = parsed?.digest ?? Buffer.alloc(32);
  const actual = parsed == null
    ? Buffer.alloc(32)
    : Buffer.from(scryptSync(providedToken, parsed.salt, 32));
  return timingSafeEqual(actual, expected);
}

/**
 * Generate a new auth token and return it (only shown once at generation).
 * Token is stored as hash; the raw token is only available at generation time.
 */
export function generateAuthToken(): { token: string; tokenPath: string } {
  const token = randomBytes(32).toString("hex");
  const tokenPath = resolveAuthTokenPath(process.env);
  const tokenHash = buildStoredTokenHash(token);
  writeSecureFile(tokenPath, tokenHash);

  return { token, tokenPath };
}

function resolveSecretOutputPath(env: NodeJS.ProcessEnv = process.env): string {
  const outputPath = env[SECRET_OUTPUT_PATH_ENV]?.trim() ?? null;
  if (outputPath == null || outputPath.length === 0) {
    throw new ValidationError(
      "secret.output_path_required",
      `secret.output_path_required:${SECRET_OUTPUT_PATH_ENV}`,
    );
  }
  return outputPath;
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
export async function executeSecretCommand(
  action: string,
  envConfig: ReturnType<typeof loadSecretManagementCliEnv>,
  authConfig: AuthGateConfig,
): Promise<SecretCommandResult> {
  try {
    if (action === "generate-token") {
      if (authConfig.storedTokenHash != null) {
        requireAuthToken(authConfig, action);
      }
      const { token, tokenPath } = generateAuthToken();
      const outputPath = resolveSecretOutputPath(process.env);
      writeSecureFile(outputPath, `${token}\n`);
      return {
        success: true,
        action: "generate-token",
        data: {
          tokenPath,
          outputPath,
          hint: "Raw token was written to AA_SECRET_OUTPUT_PATH and is not echoed to stdout.",
        },
      };
    }

    return await withCliStorageAsync(async (storage) => {
      const service = new SecretManagementService(storage.sql, storage.store);
      const authContext: SecretAuthorizationContext = {
        callerScopeType: envConfig.scopeType ?? "system",
        callerScopeRef: envConfig.scopeRef ?? "cli",
      };

      switch (action) {
        case "resolve": {
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
          return {
            success: true,
            action: "resolve",
            data: {
              metadata: resolved.metadata,
              registry: resolved.registry,
              usageAudit: resolved.usageAudit,
              valueAvailable: true,
              valueAccessNote: "Use the require action with AA_SECRET_OUTPUT_PATH to materialize the secret value.",
            },
          };
        }

        case "require": {
          requireAuthToken(authConfig, action);
          const secretValue = await service.requireSecret(
            envConfig.secretRef ?? "",
            authContext,
          );
          const outputPath = resolveSecretOutputPath(process.env);
          writeSecureFile(outputPath, secretValue.value);
          return {
            success: true,
            action: "require",
            data: {
              outputPath,
              metadata: secretValue.metadata,
              registry: secretValue.registry,
              valueSha256: createHash("sha256").update(secretValue.value).digest("hex"),
            },
          };
        }

        case "describe": {
          requireAuthToken(authConfig, action);
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
          requireAuthToken(authConfig, action);
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
          requireAuthToken(authConfig, action);
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
    }, { dbPath: envConfig.dbPath });
  } catch (error) {
    if (error instanceof PolicyDeniedError || error instanceof ValidationError) {
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
async function main(): Promise<number> {
  const envConfig = loadSecretManagementCliEnv();
  const authConfig = loadAuthTokenConfig();

  const result = await executeSecretCommand(envConfig.action, envConfig, authConfig);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.success ? CLI_EXIT_SUCCESS : CLI_EXIT_FAILURE;
}

if (isCliEntryPoint(import.meta.url)) {
  void runCliMain(main, {
    onError: (error) => {
      const errorResult: SecretCommandResult = {
        success: false,
        action: "unknown",
        error: error instanceof Error ? error.message : String(error),
        errorCode: "secret.command_failed",
      };
      process.stdout.write(`${JSON.stringify(errorResult, null, 2)}\n`);
    },
  });
}
