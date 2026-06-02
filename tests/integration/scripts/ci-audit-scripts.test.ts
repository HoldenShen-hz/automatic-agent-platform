import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const AUDIT_PUBLIC_ERROR_CODES = join(process.cwd(), "scripts", "ci", "audit-public-error-codes.mjs");
const AUDIT_SYNC_ASYNC_PAIRS = join(process.cwd(), "scripts", "ci", "audit-sync-async-service-pairs.mjs");

test("audit-public-error-codes distinguishes missing source root from real audit failures", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-audit-public-errors-"));
  const scriptPath = join(workspace, "scripts", "ci", "audit-public-error-codes.mjs");

  try {
    mkdirSync(join(workspace, "scripts", "ci"), { recursive: true });
    mkdirSync(join(workspace, "docs_zh", "contracts"), { recursive: true });
    copyFileSync(AUDIT_PUBLIC_ERROR_CODES, scriptPath);
    writeFileSync(join(workspace, "docs_zh", "contracts", "error_code_registry.md"), "`api.allowed`\n");

    const missingRoot = spawnSync("node", [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
    });
    assert.equal(missingRoot.status, 2, `${missingRoot.stdout}\n${missingRoot.stderr}`);

    mkdirSync(join(workspace, "src", "platform", "five-plane-interface"), { recursive: true });
    writeFileSync(
      join(workspace, "src", "platform", "five-plane-interface", "errors.ts"),
      'export const value = { code: "api.unregistered" };\n',
    );

    const auditFailure = spawnSync("node", [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
    });
    assert.equal(auditFailure.status, 1, `${auditFailure.stdout}\n${auditFailure.stderr}`);
    assert.match(auditFailure.stderr, /unregistered code api\.unregistered/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("audit-sync-async-service-pairs uses literal reference matching instead of regex expansion", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-audit-sync-async-"));
  const scriptPath = join(workspace, "scripts", "ci", "audit-sync-async-service-pairs.mjs");
  const pairFixtures = [
    {
      sync: "src/scale-ecosystem/runtime-services/human-takeover-service.ts",
      async: "src/scale-ecosystem/runtime-services/human-takeover-service-async.ts",
      asyncMirrorNeedle: "PlatformHumanTakeoverServiceAsync",
      syncBase: "human-takeover-service",
      asyncBase: "human-takeover-service-async",
    },
    {
      sync: "src/scale-ecosystem/runtime-services/execution-dispatch-service.ts",
      async: "src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts",
      asyncMirrorNeedle: "platform/five-plane-execution/dispatcher/execution-dispatch-service-async",
      syncBase: "execution-dispatch-service",
      asyncBase: "execution-dispatch-service-async",
    },
    {
      sync: "src/scale-ecosystem/runtime-services/execution-worker-handshake-service.ts",
      async: "src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts",
      asyncMirrorNeedle: "platform/five-plane-execution/worker-pool/execution-worker-handshake-service-async",
      syncBase: "execution-worker-handshake-service",
      asyncBase: "execution-worker-handshake-service-async",
    },
    {
      sync: "src/scale-ecosystem/runtime-services/execution-worker-writeback-service.ts",
      async: "src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts",
      asyncMirrorNeedle: "platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async",
      syncBase: "execution-worker-writeback-service",
      asyncBase: "execution-worker-writeback-service-async",
    },
    {
      sync: "src/scale-ecosystem/runtime-services/durable-event-bus.ts",
      async: "src/scale-ecosystem/runtime-services/durable-event-bus-async.ts",
      asyncMirrorNeedle: "platform/five-plane-state-evidence/events/durable-event-bus-async",
      syncBase: "durable-event-bus",
      asyncBase: "durable-event-bus-async",
    },
  ];

  try {
    mkdirSync(join(workspace, "scripts", "ci"), { recursive: true });
    mkdirSync(join(workspace, "tests"), { recursive: true });
    copyFileSync(AUDIT_SYNC_ASYNC_PAIRS, scriptPath);

    for (const fixture of pairFixtures) {
      mkdirSync(join(workspace, fixture.sync.split("/").slice(0, -1).join("/")), { recursive: true });
      mkdirSync(join(workspace, fixture.async.split("/").slice(0, -1).join("/")), { recursive: true });
      writeFileSync(join(workspace, fixture.sync), "export class StableService {}\n");
      writeFileSync(join(workspace, fixture.async), `${fixture.asyncMirrorNeedle}\n`);
      writeFileSync(
        join(workspace, "tests", `${fixture.syncBase}.test.ts`),
        `// references ${fixture.syncBase} and ${fixture.asyncBase} literally\n`,
      );
    }

    writeFileSync(
      join(workspace, "tests", "regex-noise.test.ts"),
      "// execution-dispatch-service|execution-dispatch-service-async should not be required as a regex\n",
    );

    const result = spawnSync("node", [scriptPath], {
      cwd: workspace,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /sync\/async service pair audit passed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
