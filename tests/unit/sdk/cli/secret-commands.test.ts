import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  executeSecretCommand,
  generateAuthToken,
  loadAuthTokenConfig,
  resolveAuthTokenPath,
  verifyAuthToken,
} from "../../../../src/sdk/cli/secret-commands.js";
import { cleanupPath } from "../../../helpers/fs.js";

test("generateAuthToken stores salted hash and verifies token", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-secret-token-"));
  const previousEnv = {
    AA_SECRET_AUTH_TOKEN_PATH: process.env.AA_SECRET_AUTH_TOKEN_PATH,
    HOME: process.env.HOME,
  };

  try {
    const tokenPath = join(workspace, "secret-auth-token");
    process.env.AA_SECRET_AUTH_TOKEN_PATH = tokenPath;
    process.env.HOME = workspace;

    const { token } = generateAuthToken();
    const stored = readFileSync(tokenPath, "utf8").trim();
    assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{64}$/);

    const config = loadAuthTokenConfig({ AA_SECRET_AUTH_TOKEN_PATH: tokenPath, AA_SECRET_AUTH_TOKEN: token });
    assert.equal(verifyAuthToken(config, token), true);
    assert.equal(verifyAuthToken(config, `${token}x`), false);
  } finally {
    if (previousEnv.AA_SECRET_AUTH_TOKEN_PATH == null) {
      delete process.env.AA_SECRET_AUTH_TOKEN_PATH;
    } else {
      process.env.AA_SECRET_AUTH_TOKEN_PATH = previousEnv.AA_SECRET_AUTH_TOKEN_PATH;
    }
    if (previousEnv.HOME == null) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousEnv.HOME;
    }
    cleanupPath(workspace);
  }
});

test("loadAuthTokenConfig rejects symlinked auth token path", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-secret-symlink-"));
  try {
    const realPath = join(workspace, "real-token");
    const symlinkPath = join(workspace, "link-token");
    symlinkSync(realPath, symlinkPath);

    assert.throws(
      () => loadAuthTokenConfig({ AA_SECRET_AUTH_TOKEN_PATH: symlinkPath }),
      /secret\.symlink_path_denied/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("generate-token writes raw token to AA_SECRET_OUTPUT_PATH instead of stdout payload", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-secret-generate-"));
  const tokenPath = join(workspace, "secret-auth-token");
  const outputPath = join(workspace, "generated-token.txt");
  const previousEnv = {
    AA_SECRET_AUTH_TOKEN_PATH: process.env.AA_SECRET_AUTH_TOKEN_PATH,
    AA_SECRET_OUTPUT_PATH: process.env.AA_SECRET_OUTPUT_PATH,
    HOME: process.env.HOME,
  };

  try {
    process.env.AA_SECRET_AUTH_TOKEN_PATH = tokenPath;
    process.env.AA_SECRET_OUTPUT_PATH = outputPath;
    process.env.HOME = workspace;

    const result = await executeSecretCommand(
      "generate-token",
      { dbPath: join(workspace, "runtime.db"), action: "generate-token" } as never,
      { authTokenPath: resolveAuthTokenPath(), storedTokenHash: null, providedToken: null },
    );

    assert.equal(result.success, true);
    assert.equal(typeof readFileSync(outputPath, "utf8").trim(), "string");
    assert.equal((result.data as { token?: string }).token, undefined);
  } finally {
    if (previousEnv.AA_SECRET_AUTH_TOKEN_PATH == null) {
      delete process.env.AA_SECRET_AUTH_TOKEN_PATH;
    } else {
      process.env.AA_SECRET_AUTH_TOKEN_PATH = previousEnv.AA_SECRET_AUTH_TOKEN_PATH;
    }
    if (previousEnv.AA_SECRET_OUTPUT_PATH == null) {
      delete process.env.AA_SECRET_OUTPUT_PATH;
    } else {
      process.env.AA_SECRET_OUTPUT_PATH = previousEnv.AA_SECRET_OUTPUT_PATH;
    }
    if (previousEnv.HOME == null) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousEnv.HOME;
    }
    cleanupPath(workspace);
  }
});

test("generate-token requires auth before rotating an existing token", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-secret-rotate-"));
  const previousEnv = {
    AA_SECRET_AUTH_TOKEN_PATH: process.env.AA_SECRET_AUTH_TOKEN_PATH,
    AA_SECRET_OUTPUT_PATH: process.env.AA_SECRET_OUTPUT_PATH,
    HOME: process.env.HOME,
  };

  try {
    const tokenPath = join(workspace, "secret-auth-token");
    process.env.AA_SECRET_AUTH_TOKEN_PATH = tokenPath;
    process.env.AA_SECRET_OUTPUT_PATH = join(workspace, "token.txt");
    process.env.HOME = workspace;
    generateAuthToken();

    const result = await executeSecretCommand(
      "generate-token",
      { dbPath: join(workspace, "runtime.db"), action: "generate-token" } as never,
      { authTokenPath: tokenPath, storedTokenHash: readFileSync(tokenPath, "utf8").trim(), providedToken: null },
    );

    assert.equal(result.success, false);
    assert.match(result.errorCode ?? "", /secret\.auth_required/);
  } finally {
    if (previousEnv.AA_SECRET_AUTH_TOKEN_PATH == null) {
      delete process.env.AA_SECRET_AUTH_TOKEN_PATH;
    } else {
      process.env.AA_SECRET_AUTH_TOKEN_PATH = previousEnv.AA_SECRET_AUTH_TOKEN_PATH;
    }
    if (previousEnv.AA_SECRET_OUTPUT_PATH == null) {
      delete process.env.AA_SECRET_OUTPUT_PATH;
    } else {
      process.env.AA_SECRET_OUTPUT_PATH = previousEnv.AA_SECRET_OUTPUT_PATH;
    }
    if (previousEnv.HOME == null) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousEnv.HOME;
    }
    cleanupPath(workspace);
  }
});
