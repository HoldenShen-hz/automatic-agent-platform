import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../src/platform/contracts/errors.js";
import { FieldEncryptionService } from "../../../src/platform/compliance/encryption/index.js";
import { DataLineageService } from "../../../src/platform/compliance/lineage/index.js";
import { GcpSecretManagerHttpSecretProvider } from "../../../src/platform/control-plane/iam/gcp-secret-manager-http-secret-provider.js";
import { AwsKmsHttpSecretProvider } from "../../../src/platform/control-plane/iam/aws-kms-http-secret-provider.js";
import { createWebFetchTool } from "../../../src/platform/execution/tool-executor/web-fetch.js";
import { extractSearchResults } from "../../../src/platform/execution/tool-executor/web-search.js";
import { ShadowSnapshotService } from "../../../src/platform/execution/tool-executor/shadow-snapshot-service.js";
import { SkillGovernanceService } from "../../../src/platform/execution/tool-executor/skill-governance-service.js";
import { EditSnapshotService } from "../../../src/platform/execution/tool-executor/edit-snapshot-service.js";

function createMockStore(capture?: { sql?: string; params?: unknown[] }) {
  const connection = {
    exec: () => {},
    prepare: (sql: string) => ({
      run: (..._args: unknown[]) => {},
      get: () => ({}),
      all: (...params: unknown[]) => {
        if (capture) {
          capture.sql = sql;
          capture.params = params;
        }
        return [];
      },
    }),
  };
  return {
    withConnection: <T>(work: (db: typeof connection) => T): T => work(connection),
  };
}

test("R23-20/R23-29: FieldEncryptionService uses authenticated encryption and longer fingerprints", () => {
  const service = new FieldEncryptionService();
  const result = service.protectRecord({
    record: { secret: "top-secret" },
    rules: [{ fieldPath: "secret", classification: "restricted" }],
    keyRef: "kms-key-ref",
  });

  const ciphertext = result.protectedFields[0]!.ciphertext;
  const parts = ciphertext.split(":");
  assert.equal(parts[0], "enc");
  assert.equal(parts.length, 5);
  assert.ok(parts[1]!.length >= 32);
  assert.notEqual(parts[4], Buffer.from("top-secret", "utf8").toString("base64"));
  assert.equal(service.revealField({ ciphertext, keyRef: "kms-key-ref" }), "top-secret");
});

test("R23-21/R23-26: GCP Secret provider parses secret name correctly and rejects traversal segments", async () => {
  let requestedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    requestedUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        name: "projects/my-project/secrets/my-secret/versions/latest",
        payload: { data: Buffer.from("decoded-secret").toString("base64") },
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const provider = new GcpSecretManagerHttpSecretProvider({
      env: {
        AA_GCP_PROJECT_ID: "my-project",
        AA_GCP_TOKEN: "test-token",
      },
    });

    const result = await provider.requireSecret("secret://my-secret/versions/latest");
    assert.equal(result.value, "decoded-secret");
    assert.ok(requestedUrl.includes("/secrets/my-secret/versions/latest:access"));

    await assert.rejects(
      () => provider.requireSecret("secret://../evil/versions/latest"),
      /gcp\.invalid_secret_ref|gcp\.invalid_secret/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R23-22/R23-23: WebFetch blocks non-http protocols and hostnames resolving to internal addresses", async () => {
  const tool = createWebFetchTool();

  const fileResult = await tool.execute({ url: "file:///etc/passwd" });
  assert.equal(fileResult.status, "blocked");
  assert.equal(fileResult.errorCode, "INTERNAL_NETWORK_BLOCKED");

  const localhostResult = await tool.execute({ url: "http://localhost:8080/healthz" });
  assert.equal(localhostResult.status, "blocked");
  assert.ok(
    localhostResult.errorCode === "INTERNAL_NETWORK_BLOCKED"
      || localhostResult.errorCode === "DNS_REBINDING_BLOCKED",
  );
});

test("R23-24/R23-25: AWS KMS provider signs with date scope and sends base64 CiphertextBlob", async () => {
  const ciphertext = Buffer.from("ciphertext").toString("base64");
  let authorization = "";
  let body = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    authorization = headers.Authorization;
    body = String(init?.body ?? "");
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        Plaintext: Buffer.from("decrypted-secret-value", "utf8").toString("base64"),
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const provider = new AwsKmsHttpSecretProvider({
      env: {
        AA_AWS_ACCESS_KEY_ID: "AKIA_TEST",
        AA_AWS_SECRET_ACCESS_KEY: "secret",
        AA_AWS_REGION: "us-east-1",
        AA_AWS_KMS_KEY_ARN: "arn:aws:kms:us-east-1:123456:key/test-key-id",
        AA_KMS_CIPHERTEXT_TEST_KEY_ID: ciphertext,
      },
    });

    const result = await provider.requireSecret("secret://kms/test-key-id");
    assert.equal(result.value, "decrypted-secret-value");
    assert.match(authorization, /Credential=AKIA_TEST\/\d{8}\/us-east-1\/kms\/aws4_request/);
    assert.ok(body.includes(`"CiphertextBlob":"${ciphertext}"`));
    assert.equal(body.includes('"B"'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("R23-27: ShadowSnapshotService rejects untrusted gitBinary overrides", () => {
  assert.throws(
    () =>
      new ShadowSnapshotService({
        workspaceRoot: process.cwd(),
        shadowRoot: process.cwd(),
        gitBinary: "/tmp/evil/git",
      }),
    ValidationError,
  );
});

test("R23-28: extractSearchResults skips malformed URLs instead of throwing", () => {
  const html = `
    <a class="result__a" href="https://example.com/ok">Good</a>
    <a class="result__snippet">Good snippet</a>
    <a class="result__a" href="https://%zz">Broken</a>
    <a class="result__snippet">Broken snippet</a>
  `;

  const results = extractSearchResults(html, 10);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.url, "https://example.com/ok");
});

test("R23-30: SkillGovernanceService escapes LIKE wildcards in tag filters", () => {
  const capture: { sql?: string; params?: unknown[] } = {};
  const service = new SkillGovernanceService(createMockStore(capture) as any);

  service.listSkills({ tag: "ops%_core" });

  assert.equal(capture.sql?.includes("tags_json LIKE ? ESCAPE") ?? false, true);
  assert.deepEqual(capture.params, ["%ops\\%\\_core%"]);
});

test("R23-31: EditSnapshotService bounds per-step and per-session history", () => {
  const service = new EditSnapshotService("session-bounded");

  for (let i = 0; i < 250; i++) {
    service.recordEdit({
      stepId: "step-hot",
      filePath: `/tmp/${i}.ts`,
      previousContent: `old-${i}`,
      newContent: `new-${i}`,
    });
  }
  assert.equal(service.getHistory("step-hot").length, 200);
  assert.equal(service.getHistory("step-hot")[0]!.previousContent, "old-50");

  for (let i = 0; i < 105; i++) {
    service.recordEdit({
      stepId: `step-${i}`,
      filePath: `/tmp/step-${i}.ts`,
      previousContent: "old",
      newContent: "new",
    });
  }
  assert.equal(service.getHistory("step-0").length, 0);
  assert.equal(service.getHistory("step-104").length, 1);
});

test("R23-32: DataLineageService deep-clones nested metadata", () => {
  const service = new DataLineageService();
  const metadata = { nested: { risk: "high" } };
  const edge = service.recordEdge({
    sourceRef: "task-1",
    targetRef: "artifact-1",
    kind: "derived_from",
    actorRef: "agent-1",
    metadata,
  });

  metadata.nested.risk = "low";
  (edge.metadata.nested as { risk: string }).risk = "mutated";

  const stored = service.listEdges()[0]!;
  assert.equal((stored.metadata.nested as { risk: string }).risk, "high");
});
