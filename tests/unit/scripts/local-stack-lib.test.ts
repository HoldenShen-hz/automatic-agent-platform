import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  buildLocalStackChildEnv,
  classifyPortListeners,
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
      VITE_API_BASE_URL: "http://127.0.0.1:4000/api",
    },
  );

  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.AA_DB_PATH, "/repo/data/sqlite/dev.db");
  assert.equal(env.VITE_API_BASE_URL, "http://127.0.0.1:4000/api");
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
