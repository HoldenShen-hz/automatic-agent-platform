import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  buildLocalStackChildEnv,
  classifyPortListeners,
  loadLocalStackProviderEnv,
  readLocalStackPort,
  resolveRequiredBinaryPath,
  resolveRequiredNpmCliPath,
} from "../../../scripts/dev/local-stack-lib.mjs";

test("readLocalStackPort rejects malformed and out-of-range port values", () => {
  assert.equal(readLocalStackPort({}, "AA_LOCAL_API_PORT", 4000), 4000);
  assert.equal(readLocalStackPort({ AA_LOCAL_API_PORT: "5173" }, "AA_LOCAL_API_PORT", 4000), 5173);
  assert.throws(
    () => readLocalStackPort({ AA_LOCAL_API_PORT: "123abc" }, "AA_LOCAL_API_PORT", 4000),
    /Invalid port/,
  );
  assert.throws(
    () => readLocalStackPort({ AA_LOCAL_API_PORT: "70000" }, "AA_LOCAL_API_PORT", 4000),
    /Invalid port/,
  );
});

test("buildLocalStackChildEnv strips secret-bearing variables while preserving safe overrides", () => {
  const apiBaseUrl = "https://control-plane.internal.example/api";
  const env = buildLocalStackChildEnv(
    {
      PATH: "/usr/bin",
      AA_DB_PATH: "/repo/data/sqlite/dev.db",
      AA_API_KEYS_JSON: "{\"root\":\"secret\"}",
      AA_SESSION_TOKEN: "secret",
      GITHUB_TOKEN: "secret",
      SSH_AUTH_SOCK: "/tmp/agent.sock",
    },
    {
      VITE_API_BASE_URL: apiBaseUrl,
    },
  );

  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.AA_DB_PATH, "/repo/data/sqlite/dev.db");
  assert.equal(env.VITE_API_BASE_URL, apiBaseUrl);
  assert.equal("AA_API_KEYS_JSON" in env, false);
  assert.equal("AA_SESSION_TOKEN" in env, false);
  assert.equal("GITHUB_TOKEN" in env, false);
  assert.equal("SSH_AUTH_SOCK" in env, false);
});

test("resolveRequiredBinaryPath and resolveRequiredNpmCliPath use explicit absolute paths", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-local-stack-lib-"));
  const nodeBinDir = join(workspace, "bin");
  const npmCliPath = join(workspace, "lib", "node_modules", "npm", "bin", "npm-cli.js");
  const psPath = join(workspace, "usr", "bin", "ps");

  mkdirSync(nodeBinDir, { recursive: true });
  mkdirSync(join(workspace, "lib", "node_modules", "npm", "bin"), { recursive: true });
  mkdirSync(join(workspace, "usr", "bin"), { recursive: true });
  writeFileSync(npmCliPath, "console.log('npm');\n");
  writeFileSync(psPath, "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(psPath, 0o755);

  try {
    assert.equal(resolveRequiredBinaryPath("ps", [psPath]), psPath);
    assert.equal(
      resolveRequiredNpmCliPath(join(nodeBinDir, "node"), {}),
      npmCliPath,
    );
    assert.equal(
      resolveRequiredNpmCliPath(join(nodeBinDir, "node"), { npm_execpath: npmCliPath }),
      npmCliPath,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("classifyPortListeners only marks tracked listener pids as managed", () => {
  assert.deepEqual(
    classifyPortListeners([101, 202, 303], [202, null, Number.NaN]),
    {
      managedPids: [202],
      unmanagedPids: [101, 303],
    },
  );
});

test("loadLocalStackProviderEnv reads local minimax config and lets process env override file values", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-local-provider-config-"));
  const configPath = join(workspace, "config", "providers", "local-dev.json");
  mkdirSync(join(workspace, "config", "providers"), { recursive: true });
  writeFileSync(configPath, JSON.stringify({
    minimax: {
      apiKey: "file-minimax-key",
      baseUrl: "https://api.minimaxi.com/v1",
    },
  }, null, 2));

  try {
    assert.deepEqual(loadLocalStackProviderEnv(workspace, {}), {
      env: {
        MINIMAX_API_KEY: "file-minimax-key",
        MINIMAX_API_BASE: "https://api.minimaxi.com/v1",
      },
      sourcePath: configPath,
    });

    assert.deepEqual(loadLocalStackProviderEnv(workspace, {
      MINIMAX_API_KEY: "env-minimax-key",
      MINIMAX_API_BASE: "https://override.example/v1",
    }), {
      env: {
        MINIMAX_API_KEY: "env-minimax-key",
        MINIMAX_API_BASE: "https://override.example/v1",
      },
      sourcePath: configPath,
    });
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
