import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { ValidationError } from "../../platform/contracts/errors.js";
import { readTrimmedEnv } from "../../platform/five-plane-control-plane/config-center/runtime-env.js";

export interface OAuthPkceConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
}

interface PkcePair {
  verifier: string;
  challenge: string;
}

function generatePkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function buildAuthorizationUrl(config: OAuthPkceConfig, pkce: PkcePair, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
  });
  return `${config.authorizationUrl}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

function assertTokenResponse(payload: unknown): TokenResponse {
  if (payload == null || typeof payload !== "object") {
    throw new ValidationError("oauth.invalid_token_response", "oauth.invalid_token_response");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.access_token !== "string" || record.access_token.trim().length === 0) {
    throw new ValidationError("oauth.invalid_token_response", "oauth.invalid_token_response");
  }
  if (typeof record.token_type !== "string" || record.token_type.trim().length === 0) {
    throw new ValidationError("oauth.invalid_token_response", "oauth.invalid_token_response");
  }
  if (!Number.isFinite(record.expires_in) || Number(record.expires_in) <= 0) {
    throw new ValidationError("oauth.invalid_token_response", "oauth.invalid_token_response");
  }
  if (record.refresh_token !== undefined && typeof record.refresh_token !== "string") {
    throw new ValidationError("oauth.invalid_token_response", "oauth.invalid_token_response");
  }
  return {
    access_token: record.access_token,
    token_type: record.token_type,
    expires_in: Number(record.expires_in),
    ...(typeof record.refresh_token === "string" ? { refresh_token: record.refresh_token } : {}),
  };
}

async function exchangeCodeForTokens(config: OAuthPkceConfig, code: string, verifier: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!response.ok) {
    throw new ValidationError(
      "oauth.token_exchange_failed",
      `oauth.token_exchange_failed:${response.status}`,
    );
  }

  return assertTokenResponse(await response.json());
}

function resolveSecureCliHome(env: NodeJS.ProcessEnv = process.env): string {
  const explicitHome = readTrimmedEnv(env, "HOME");
  const fallbackHome = homedir().trim();
  const home = explicitHome ?? (fallbackHome.length > 0 ? fallbackHome : null);
  if (home == null) {
    throw new ValidationError("oauth.home_directory_required", "oauth.home_directory_required");
  }
  return home;
}

function saveOAuthTokens(tokens: {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
}, env: NodeJS.ProcessEnv = process.env): string {
  const credentialsPath = env.AA_CREDENTIALS_PATH ?? join(resolveSecureCliHome(env), ".automatic-agent", "credentials.json");
  mkdirSync(dirname(credentialsPath), { recursive: true, mode: 0o700 });
  const payload = JSON.stringify(tokens, null, 2);
  const encryptionKey = env.AA_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (encryptionKey == null || encryptionKey.length === 0) {
    throw new ValidationError(
      "oauth.credentials_encryption_key_required",
      "oauth.credentials_encryption_key_required",
    );
  }
  if (encryptionKey.length < MINIMUM_CREDENTIALS_ENCRYPTION_KEY_LENGTH) {
    throw new ValidationError(
      "oauth.credentials_encryption_key_too_short",
      "oauth.credentials_encryption_key_too_short",
    );
  }

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(encryptionKey, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const envelope = {
    version: "oauth-cred-v1",
    algorithm: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  writeFileSync(credentialsPath, JSON.stringify(envelope, null, 2), { encoding: "utf8", mode: 0o600 });
  return credentialsPath;
}

interface LoginStateRecord {
  state: string;
  verifier: string;
  createdAt: string;
}

const MINIMUM_CREDENTIALS_ENCRYPTION_KEY_LENGTH = 32;

export interface LoginStartResult {
  mode: "start";
  authorizationUrl: string;
  redirectUri: string;
  statePath: string;
  state: string;
}

export interface LoginFinishResult {
  mode: "finish";
  credentialsPath: string;
  tokenType: string;
  expiresIn: number;
}

function resolveAuthorizationCode(env: NodeJS.ProcessEnv = process.env): string {
  const codeFile = readTrimmedEnv(env, "AA_OAUTH_AUTH_CODE_FILE");
  if (codeFile != null) {
    const code = readFileSync(codeFile, "utf8").trim();
    if (code.length === 0) {
      throw new ValidationError("oauth.auth_code_required", "oauth.auth_code_required");
    }
    return code;
  }
  return requireEnv("AA_OAUTH_AUTH_CODE", env);
}

function hasAuthorizationCodeInput(env: NodeJS.ProcessEnv = process.env): boolean {
  return readTrimmedEnv(env, "AA_OAUTH_AUTH_CODE_FILE") != null || readTrimmedEnv(env, "AA_OAUTH_AUTH_CODE") != null;
}

function resolveReturnedState(env: NodeJS.ProcessEnv = process.env): string {
  const stateFile = readTrimmedEnv(env, "AA_OAUTH_CALLBACK_STATE_FILE");
  if (stateFile != null) {
    const state = readFileSync(stateFile, "utf8").trim();
    if (state.length === 0) {
      throw new ValidationError("oauth.callback_state_required", "oauth.callback_state_required");
    }
    return state;
  }
  return requireEnv("AA_OAUTH_CALLBACK_STATE", env);
}

function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = readTrimmedEnv(env, name);
  if (value == null) {
    throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
  }
  return value;
}

function parseScopes(raw: string): readonly string[] {
  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function loadOAuthPkceConfig(env: NodeJS.ProcessEnv = process.env): OAuthPkceConfig {
  const scopes = parseScopes(requireEnv("AA_OAUTH_SCOPES", env));
  if (scopes.length === 0) {
    throw new ValidationError("invalid_env:AA_OAUTH_SCOPES", "invalid_env:AA_OAUTH_SCOPES");
  }
  return {
    authorizationUrl: requireEnv("AA_OAUTH_AUTHORIZATION_URL", env),
    tokenUrl: requireEnv("AA_OAUTH_TOKEN_URL", env),
    clientId: requireEnv("AA_OAUTH_CLIENT_ID", env),
    redirectUri: requireEnv("AA_OAUTH_REDIRECT_URI", env),
    scopes,
  };
}

export function resolveOAuthLoginStatePath(env: NodeJS.ProcessEnv = process.env): string {
  return readTrimmedEnv(env, "AA_OAUTH_STATE_PATH")
    ?? join(resolveSecureCliHome(env), ".automatic-agent", "oauth-login-state.json");
}

function writeLoginState(statePath: string, record: LoginStateRecord): void {
  mkdirSync(dirname(statePath), { recursive: true, mode: 0o700 });
  writeFileSync(statePath, JSON.stringify(record, null, 2), { encoding: "utf8", mode: 0o600 });
}

function readLoginState(statePath: string): LoginStateRecord {
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as LoginStateRecord;
  } catch (error) {
    throw new ValidationError(
      "oauth.invalid_login_state",
      error instanceof Error ? `oauth.invalid_login_state:${statePath}` : "oauth.invalid_login_state",
    );
  }
}

export function startOAuthLogin(
  env: NodeJS.ProcessEnv = process.env,
  config: OAuthPkceConfig = loadOAuthPkceConfig(env),
): LoginStartResult {
  const pkce = generatePkcePair();
  const state = randomUUID();
  const authorizationUrl = buildAuthorizationUrl(config, pkce, state);
  const statePath = resolveOAuthLoginStatePath(env);

  writeLoginState(statePath, {
    state,
    verifier: pkce.verifier,
    createdAt: new Date().toISOString(),
  });

  return {
    mode: "start",
    authorizationUrl,
    redirectUri: config.redirectUri,
    statePath,
    state,
  };
}

export async function finishOAuthLogin(
  env: NodeJS.ProcessEnv = process.env,
  config: OAuthPkceConfig = loadOAuthPkceConfig(env),
): Promise<LoginFinishResult> {
  const code = resolveAuthorizationCode(env);
  const returnedState = resolveReturnedState(env);
  const statePath = resolveOAuthLoginStatePath(env);
  const pending = readLoginState(statePath);
  try {
    if (returnedState !== pending.state) {
      throw new ValidationError("oauth.state_mismatch", "oauth.state_mismatch");
    }
    const tokens = await exchangeCodeForTokens(config, code, pending.verifier);
    const credentialsPath = saveOAuthTokens({
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    }, env);
    return {
      mode: "finish",
      credentialsPath,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
    };
  } finally {
    try {
      unlinkSync(statePath);
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        // State is already absent; token exchange result should still be returned.
      } else {
        throw error;
      }
    }
  }
}

export async function main(): Promise<void> {
  const env = process.env;
  const result = !hasAuthorizationCodeInput(env)
    ? startOAuthLogin(env)
    : await finishOAuthLogin(env);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
