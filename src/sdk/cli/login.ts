import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import { ValidationError } from "../../platform/contracts/errors.js";
import { readTrimmedEnv } from "../../platform/control-plane/config-center/runtime-env.js";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  generatePkcePair,
  saveOAuthTokens,
  type OAuthPkceConfig,
} from "./index.js";

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
