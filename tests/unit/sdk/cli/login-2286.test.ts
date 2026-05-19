import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  finishOAuthLogin,
  loadOAuthPkceConfig,
  resolveOAuthLoginStatePath,
  startOAuthLogin,
} from "../../../../src/sdk/cli/login.ts";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("2286: loadOAuthPkceConfig requires canonical OAuth PKCE env", () => {
  const config = loadOAuthPkceConfig({
    AA_OAUTH_AUTHORIZATION_URL: "https://idp.example.com/authorize",
    AA_OAUTH_TOKEN_URL: "https://idp.example.com/token",
    AA_OAUTH_CLIENT_ID: "cli-client",
    AA_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/callback",
    AA_OAUTH_SCOPES: "openid profile email",
  });

  assert.equal(config.clientId, "cli-client");
  assert.deepEqual(config.scopes, ["openid", "profile", "email"]);
});

test("2286: startOAuthLogin persists PKCE verifier and returns authorization URL", () => {
  const workspace = createTempWorkspace("aa-oauth-login-start-");
  const env = {
    HOME: workspace,
    AA_OAUTH_AUTHORIZATION_URL: "https://idp.example.com/authorize",
    AA_OAUTH_TOKEN_URL: "https://idp.example.com/token",
    AA_OAUTH_CLIENT_ID: "cli-client",
    AA_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/callback",
    AA_OAUTH_SCOPES: "openid profile email",
    AA_OAUTH_STATE: "state-fixed",
  };

  try {
    const result = startOAuthLogin(env);
    const statePath = resolveOAuthLoginStatePath(env);
    const stateRecord = JSON.parse(readFileSync(statePath, "utf8")) as { state: string; verifier: string };

    assert.equal(result.mode, "start");
    assert.equal(result.state, "state-fixed");
    assert.ok(result.authorizationUrl.includes("code_challenge="));
    assert.ok(result.authorizationUrl.includes("client_id=cli-client"));
    assert.ok(result.authorizationUrl.includes("redirect_uri=http%3A%2F%2F127.0.0.1%3A8787%2Fcallback"));
    assert.equal(stateRecord.state, "state-fixed");
    assert.ok(stateRecord.verifier.length > 10);
  } finally {
    cleanupPath(workspace);
  }
});

test("2286: finishOAuthLogin exchanges code, saves credentials, and clears pending state", async () => {
  const workspace = createTempWorkspace("aa-oauth-login-finish-");
  const env = {
    HOME: workspace,
    AA_OAUTH_AUTHORIZATION_URL: "https://idp.example.com/authorize",
    AA_OAUTH_TOKEN_URL: "https://idp.example.com/token",
    AA_OAUTH_CLIENT_ID: "cli-client",
    AA_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/callback",
    AA_OAUTH_SCOPES: "openid profile email",
    AA_OAUTH_STATE: "state-finish",
    AA_OAUTH_AUTH_CODE: "code-123",
    AA_CREDENTIALS_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  };
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_url, options) => {
    const body = options?.body;
    assert.ok(body instanceof URLSearchParams);
    assert.equal(body.get("code"), "code-123");
    return new Response(JSON.stringify({
      access_token: "access-token-123",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-token-123",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    startOAuthLogin(env);
    const statePath = resolveOAuthLoginStatePath(env);
    assert.equal(existsSync(statePath), true);

    const result = await finishOAuthLogin(env);
    const saved = JSON.parse(readFileSync(result.credentialsPath, "utf8")) as {
      version: string;
      ciphertext: string;
      iv: string;
    };

    assert.equal(result.mode, "finish");
    assert.equal(saved.version, "oauth-cred-v1");
    assert.ok(saved.ciphertext.length > 0);
    assert.ok(saved.iv.length > 0);
    assert.equal(existsSync(statePath), false);
  } finally {
    globalThis.fetch = originalFetch;
    cleanupPath(workspace);
  }
});

test("2286: finishOAuthLogin requires encrypted credential storage", async () => {
  const workspace = createTempWorkspace("aa-oauth-login-encryption-required-");

  try {
    await assert.rejects(
      () =>
        finishOAuthLogin({
          HOME: workspace,
          AA_OAUTH_AUTHORIZATION_URL: "https://idp.example.com/authorize",
          AA_OAUTH_TOKEN_URL: "https://idp.example.com/token",
          AA_OAUTH_CLIENT_ID: "cli-client",
          AA_OAUTH_REDIRECT_URI: "http://127.0.0.1:8787/callback",
          AA_OAUTH_SCOPES: "openid profile email",
          AA_OAUTH_AUTH_CODE: "code-123",
        }),
      /oauth\.invalid_login_state|oauth\.credentials_encryption_key_required/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("2286: package.json exposes an executable login script", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.login,
    "npm run build && node --enable-source-maps dist/src/sdk/cli/login.js",
  );
});
