export const CLI_ENTRYPOINTS = [
  "acceptance-readiness",
  "api-server",
  "authoritative-storage",
  "authoritative-storage-admin",
  "billing",
  "channel-gateway",
  "compliance-program",
  "control-plane-balancer",
  "data-plane",
  "deployment-execution",
  "diagnostics",
  "dispatch-execution",
  "dispatch-reconcile",
  "dlq-manager",
  "doctor",
  "drain-events",
  "enterprise-capability",
  "enterprise-governance",
  "environment-deployment",
  "evolution",
  "gateway-targets",
  "governance-bootstrap",
  "ha-program",
  "inspect",
  "knowledge-semantic-readiness",
  "lease-handover",
  "login",
  "marketplace",
  "memory",
  "migrate-sqlite-to-pg",
  "model-routing",
  "ops-governance",
  "ops-program",
  "orphan-cleanup",
  "perception",
  "pack-create",
  "pack-test",
  "pack-validate",
  "pack-publish",
  "phase1b-demo",
  "platform-operator",
  "pmf",
  "profile-home",
  "release-pipeline",
  "repair",
  "replay-events",
  "replay-recovery",
  "secret-management",
  "shadow-snapshot",
  "skill-creator",
  "stable-campaign",
  "stable-chaos",
  "stable-concurrency",
  "stable-db-queue-disconnect",
  "stable-db-writability",
  "stable-dispatch",
  "stable-dispatch-reconcile",
  "stable-evidence",
  "stable-gate",
  "stable-gray",
  "stable-lease",
  "stable-maintenance",
  "stable-migration-compatibility",
  "stable-package",
  "stable-prompt-injection",
  "stable-queue-delivery",
  "stable-recovery-drill",
  "stable-replay",
  "stable-restore",
  "stable-rollback",
  "stable-runner-factory",
  "stable-sequence",
  "stable-soak",
  "stable-upgrade",
  "stable-validate",
  "stable-worker-handshake",
  "stable-worker-writeback",
  "takeover",
  "task-board",
  "tenant-platform",
  "worker-handshake",
  "worker-register",
  "worker-writeback",
] as const;

export type CliEntrypoint = typeof CLI_ENTRYPOINTS[number];

// --- OAuth PKCE Login Command ---

import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface OAuthPkceConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Build OAuth authorization URL with PKCE
 */
export function buildAuthorizationUrl(config: OAuthPkceConfig, pkce: { verifier: string; challenge: string }, state: string): string {
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/**
 * Exchange authorization code for tokens with PKCE
 */
export async function exchangeCodeForTokens(
  config: OAuthPkceConfig,
  code: string,
  pkceVerifier: string,
): Promise<OAuthTokenResponse> {
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: pkceVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token exchange failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

/**
 * Perform PKCE OAuth login flow
 */
export async function performOAuthLogin(config: OAuthPkceConfig): Promise<{
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
}> {
  const pkce = generatePkcePair();
  const state = randomBytes(16).toString("base64url");
  const authUrl = buildAuthorizationUrl(config, pkce, state);

  console.log("Opening browser for OAuth login...");
  console.log(`Authorization URL: ${authUrl}`);

  // In CLI context, we provide instructions rather than opening browser
  // The user should copy the URL, authorize, and provide the callback URL
  console.log("\nPlease:");
  console.log("1. Open the authorization URL in your browser");
  console.log("2. Complete the authorization");
  console.log("3. Copy the 'code' parameter from the redirect URL");
  console.log("4. Provide it when prompted\n");

  // For automated/testing scenarios, allow code to be passed via environment
  const codeFromEnv = process.env.AA_OAUTH_AUTH_CODE;
  if (codeFromEnv) {
    const tokens = await exchangeCodeForTokens(config, codeFromEnv, pkce.verifier);
    return {
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    };
  }

  throw new Error("OAuth login requires AA_OAUTH_AUTH_CODE environment variable or interactive browser flow");
}

/**
 * Save OAuth tokens to secure storage
 */
export function saveOAuthTokens(tokens: {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
}, env: NodeJS.ProcessEnv = process.env): string {
  // Store in platform credentials file with proper permissions
  const homeDir = env.HOME ?? "/tmp";
  const credentialsDir = join(homeDir, ".automatic-agent");
  const credentialsPath = join(credentialsDir, "credentials.json");
  const credentials = {
    accessToken: tokens.accessToken,
    tokenType: tokens.tokenType,
    expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
  };

  // Ensure directory exists
  mkdirSync(credentialsDir, { recursive: true, mode: 0o700 });

  writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { encoding: "utf8", mode: 0o600 });
  console.log(`Tokens saved to ${credentialsPath}`);
  return credentialsPath;
}
