import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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
    throw new ValidationError("oauth.token_exchange_failed", `Token exchange failed: ${response.statusText}`);
  }

  return response.json() as Promise<TokenResponse>;
}

function saveOAuthTokens(tokens: {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
}, env: NodeJS.ProcessEnv = process.env): string {
  const credentialsPath = env.AA_CREDENTIALS_PATH ?? join(env.HOME ?? "/tmp", ".automatic-agent", "credentials.json");
  mkdirSync(dirname(credentialsPath), { recursive: true, mode: 0o700 });
  const payload = JSON.stringify(tokens, null, 2);
  const encryptionKey = env.AA_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (encryptionKey != null && encryptionKey.length > 0) {
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
  if (env.NODE_ENV === "production") {
    throw new ValidationError("oauth.credentials_encryption_key_required", "oauth.credentials_encryption_key_required");
  }
  writeFileSync(credentialsPath, payload, { encoding: "utf8", mode: 0o600 });
  return credentialsPath;
}

interface LoginStateRecord {
  state: string;
  verifier: string;
  createdAt: string;
}

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
    ?? join(env.HOME ?? "/tmp", ".automatic-agent", "oauth-login-state.json");
}

function writeLoginState(statePath: string, record: LoginStateRecord): void {
  mkdirSync(dirname(statePath), { recursive: true, mode: 0o700 });
  writeFileSync(statePath, JSON.stringify(record, null, 2), { encoding: "utf8", mode: 0o600 });
}

function readLoginState(statePath: string): LoginStateRecord {
  return JSON.parse(readFileSync(statePath, "utf8")) as LoginStateRecord;
}

export function startOAuthLogin(
  env: NodeJS.ProcessEnv = process.env,
  config: OAuthPkceConfig = loadOAuthPkceConfig(env),
): LoginStartResult {
  const pkce = generatePkcePair();
  const state = env.AA_OAUTH_STATE ?? randomUUID();
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
  const code = requireEnv("AA_OAUTH_AUTH_CODE", env);
  const statePath = resolveOAuthLoginStatePath(env);
  const pending = readLoginState(statePath);
  const tokens = await exchangeCodeForTokens(config, code, pending.verifier);
  const credentialsPath = saveOAuthTokens({
    accessToken: tokens.access_token,
    tokenType: tokens.token_type,
    expiresIn: tokens.expires_in,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
  }, env);
  unlinkSync(statePath);
  return {
    mode: "finish",
    credentialsPath,
    tokenType: tokens.token_type,
    expiresIn: tokens.expires_in,
  };
}

export async function main(): Promise<void> {
  const env = process.env;
  const result = readTrimmedEnv(env, "AA_OAUTH_AUTH_CODE") == null
    ? startOAuthLogin(env)
    : await finishOAuthLogin(env);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
