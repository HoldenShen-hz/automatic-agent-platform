import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";

const execFileAsync = promisify(execFile);

function buildCliArgs(imports: string[] = []): string[] {
  return [
    ...imports.flatMap((modulePath) => ["--import", modulePath]),
    join(process.cwd(), "dist", "src", "sdk", "cli", "billing.js"),
  ];
}

function runCli<T>(env: NodeJS.ProcessEnv, options: { imports?: string[] } = {}): T {
  const stdout = execFileSync(process.execPath, buildCliArgs(options.imports), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  return JSON.parse(stdout) as T;
}

async function runCliAsync<T>(env: NodeJS.ProcessEnv, options: { imports?: string[] } = {}): Promise<T> {
  const { stdout } = await execFileAsync(process.execPath, buildCliArgs(options.imports), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  return JSON.parse(stdout) as T;
}

function createFetchMockModule(workspace: string): { modulePath: string; logPath: string } {
  const modulePath = join(workspace, "billing-fetch-mock.mjs");
  const logPath = join(workspace, "billing-fetch.log");
  createFile(modulePath, [
    "import { appendFileSync } from \"node:fs\";",
    "",
    "const scenario = process.env[\"AA_TEST_FETCH_SCENARIO\"] ?? \"\";",
    "const logPath = process.env[\"AA_TEST_FETCH_LOG_PATH\"] ?? \"\";",
    "",
    "function record(entry) {",
    "  if (logPath.length > 0) {",
    "    appendFileSync(logPath, `${entry}\\n`, \"utf8\");",
    "  }",
    "}",
    "",
    "function json(payload) {",
    "  return new Response(JSON.stringify(payload), {",
    "    status: 200,",
    "    headers: { \"content-type\": \"application/json\" },",
    "  });",
    "}",
    "",
    "globalThis.fetch = async (input, init = {}) => {",
    "  const request = input instanceof Request ? input : null;",
    "  const url = typeof input === \"string\"",
    "    ? input",
    "    : input instanceof URL",
    "      ? input.href",
    "      : (request?.url ?? \"\");",
    "  const method = String(init.method ?? request?.method ?? \"GET\").toUpperCase();",
    "  const body = typeof init.body === \"string\" ? init.body : \"\";",
    "  record(body.length > 0 ? body : `${method} ${new URL(url).pathname}`);",
    "  switch (scenario) {",
    "    case \"stripe_checkout\":",
    "      return json({",
    "        id: \"cs_live_test_123\",",
    "        url: \"https://checkout.stripe.test/session/cs_live_test_123\",",
    "        expires_at: 1770000000,",
    "      });",
    "    case \"stripe_auto_reconcile\":",
    "      if (url.includes(\"/checkout/sessions/\")) {",
    "        return json({",
    "          id: \"cs_auto_cli_123\",",
    "          status: \"complete\",",
    "          payment_status: \"paid\",",
    "        });",
    "      }",
    "      return json({",
    "        id: \"cs_auto_cli_123\",",
    "        url: \"https://checkout.stripe.test/session/cs_auto_cli_123\",",
    "        expires_at: 1770000000,",
    "      });",
    "    case \"paddle_checkout\":",
    "      return json({",
    "        data: {",
    "          id: \"txn_live_test_123\",",
    "          checkout: {",
    "            url: \"https://checkout.paddle.test/txn_live_test_123\",",
    "          },",
    "        },",
    "      });",
    "    default:",
    "      throw new Error(`Unexpected fetch scenario: ${scenario} ${method} ${url}`);",
    "  }",
    "};",
    "",
  ].join("\n"));
  return { modulePath, logPath };
}

function readRequestLog(logPath: string): string[] {
  try {
    return readFileSync(logPath, "utf8")
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  } catch {
    return [];
  }
}

test("billing CLI can create accounts, evaluate entitlements, record usage, and export summaries", () => {
  const workspace = createTempWorkspace("aa-billing-cli-");
  const dbPath = join(workspace, "billing-cli.db");
  const artifactRoot = join(workspace, "artifacts");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    db.close();

    const created = runCli<{ accountId: string; planId: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_account",
      AA_ACCOUNT_ID: "acct-cli-1",
      AA_OWNER_ID: "owner-cli-1",
      AA_WORKSPACE_ID: "workspace-cli-1",
      AA_PLAN_ID: "pro",
    });
    assert.equal(created.accountId, "acct-cli-1");
    assert.equal(created.planId, "pro");

    const decision = runCli<{ decision: { decisionType: string } }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "evaluate",
      AA_ACCOUNT_ID: "acct-cli-1",
      AA_FEATURE_KEY: "phase3.pmf_validation",
      AA_METRIC_TYPE: "task_execution",
      AA_REQUESTED_QUANTITY: "3",
      AA_EVALUATED_AT: "2026-04-08T11:00:00.000Z",
    });
    assert.equal(decision.decision.decisionType, "allow");

    const usage = runCli<{ usageEvent: { usageId: string }; quotaCounter: { usedQuantity: number } | null }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "usage",
      AA_ACCOUNT_ID: "acct-cli-1",
      AA_METRIC_TYPE: "task_execution",
      AA_QUANTITY: "3",
      AA_SOURCE: "runtime",
      AA_CAPTURED_AT: "2026-04-08T11:05:00.000Z",
    });
    assert.ok(usage.usageEvent.usageId.length > 0);
    assert.equal(usage.quotaCounter?.usedQuantity, 3);

    const summary = runCli<{ account: { accountId: string }; totals: { totalBilledUsd: number } }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "summary",
      AA_ACCOUNT_ID: "acct-cli-1",
    });
    assert.equal(summary.account.accountId, "acct-cli-1");
    assert.ok(summary.totals.totalBilledUsd > 0);

    const exported = runCli<{ jsonArtifact: { uri: string }; markdownArtifact: { uri: string } }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "export",
      AA_ACCOUNT_ID: "acct-cli-1",
      AA_ARTIFACT_ROOT: artifactRoot,
    });
    assert.match(exported.jsonArtifact.uri, /billing-summary-acct-cli-1/);
    assert.match(exported.markdownArtifact.uri, /billing-summary-acct-cli-1/);

    const db2 = new SqliteDatabase(dbPath);
    db2.migrate();
    const store2 = new AuthoritativeTaskStore(db2);
    assert.ok(store2.getBillingAccount("acct-cli-1"));
    assert.equal(store2.listUsageEventsForAccount("acct-cli-1", 10).length, 1);
    db2.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("billing CLI can create invoices, checkout sessions, and settle payment sessions", () => {
  const workspace = createTempWorkspace("aa-billing-cli-pay-");
  const dbPath = join(workspace, "billing-cli-pay.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    runCli({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_account",
      AA_ACCOUNT_ID: "acct-cli-pay-1",
      AA_OWNER_ID: "owner-cli-pay-1",
      AA_PLAN_ID: "pro",
    });
    runCli({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "usage",
      AA_ACCOUNT_ID: "acct-cli-pay-1",
      AA_METRIC_TYPE: "task_execution",
      AA_QUANTITY: "4",
      AA_TENANT_ID: "tenant-cli-pay-1",
      AA_CAPTURED_AT: "2026-04-08T11:05:00.000Z",
    });

    const invoice = runCli<{ invoiceId: string; status: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_invoice",
      AA_ACCOUNT_ID: "acct-cli-pay-1",
      AA_TENANT_ID: "tenant-cli-pay-1",
      AA_TAX_USD: "0.25",
      AA_CREATED_AT: "2026-04-08T12:00:00.000Z",
    });
    assert.equal(invoice.status, "open");

    const checkout = runCli<{ sessionId: string; status: string; checkoutUrl: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_checkout",
      AA_INVOICE_ID: invoice.invoiceId,
    });
    assert.equal(checkout.status, "pending");
    assert.match(checkout.checkoutUrl, /billing\.manual\.local\/checkout/);

    const settled = runCli<{ session: { status: string }; invoice: { status: string } }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "settle_payment",
      AA_PAYMENT_SESSION_ID: checkout.sessionId,
      AA_CREATED_AT: "2026-04-08T12:05:00.000Z",
    });
    assert.equal(settled.session.status, "paid");
    assert.equal(settled.invoice.status, "paid");
  } finally {
    cleanupPath(workspace);
  }
});

test("billing CLI can create a Stripe checkout session through the configured gateway", async () => {
  const workspace = createTempWorkspace("aa-billing-cli-stripe-");
  const dbPath = join(workspace, "billing-cli-stripe.db");
  const { modulePath, logPath } = createFetchMockModule(workspace);

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    await runCliAsync({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_account",
      AA_ACCOUNT_ID: "acct-cli-stripe-1",
      AA_OWNER_ID: "owner-cli-stripe-1",
      AA_PLAN_ID: "pro",
    });
    await runCliAsync({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "usage",
      AA_ACCOUNT_ID: "acct-cli-stripe-1",
      AA_METRIC_TYPE: "task_execution",
      AA_QUANTITY: "2",
      AA_CAPTURED_AT: "2026-04-08T11:05:00.000Z",
    });

    const invoice = await runCliAsync<{ invoiceId: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_invoice",
      AA_ACCOUNT_ID: "acct-cli-stripe-1",
      AA_CREATED_AT: "2026-04-08T12:00:00.000Z",
    });

    const checkout = await runCliAsync<{ gatewayKind: string; gatewaySessionRef: string; checkoutUrl: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_checkout",
      AA_INVOICE_ID: invoice.invoiceId,
      AA_PAYMENT_GATEWAY_KIND: "stripe",
      AA_STRIPE_SECRET_KEY: "sk_test_123",
      AA_BILLING_SUCCESS_URL: "https://app.example.com/billing/success",
      AA_BILLING_CANCEL_URL: "https://app.example.com/billing/cancel",
      AA_STRIPE_API_BASE_URL: "https://billing-mock.example/v1",
      AA_TEST_FETCH_SCENARIO: "stripe_checkout",
      AA_TEST_FETCH_LOG_PATH: logPath,
    }, { imports: [modulePath] });

    assert.equal(checkout.gatewayKind, "stripe");
    assert.equal(checkout.gatewaySessionRef, "cs_live_test_123");
    assert.equal(checkout.checkoutUrl, "https://checkout.stripe.test/session/cs_live_test_123");
    const requests = readRequestLog(logPath);
    assert.equal(requests.length, 1);
    assert.match(requests[0] ?? "", /client_reference_id=invoice_/);
    assert.match(requests[0] ?? "", /metadata%5Baccount_id%5D=acct-cli-stripe-1/);
  } finally {
    cleanupPath(workspace);
  }
});

test("billing CLI can create a Paddle checkout session through the configured gateway", async () => {
  const workspace = createTempWorkspace("aa-billing-cli-paddle-");
  const dbPath = join(workspace, "billing-cli-paddle.db");
  const { modulePath, logPath } = createFetchMockModule(workspace);

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    await runCliAsync({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_account",
      AA_ACCOUNT_ID: "acct-cli-paddle-1",
      AA_OWNER_ID: "owner-cli-paddle-1",
      AA_PLAN_ID: "pro",
    });
    await runCliAsync({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "usage",
      AA_ACCOUNT_ID: "acct-cli-paddle-1",
      AA_METRIC_TYPE: "task_execution",
      AA_QUANTITY: "2",
      AA_TENANT_ID: "tenant-cli-paddle-1",
      AA_CAPTURED_AT: "2026-04-08T11:05:00.000Z",
    });
    const invoice = await runCliAsync<{ invoiceId: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_invoice",
      AA_ACCOUNT_ID: "acct-cli-paddle-1",
      AA_TENANT_ID: "tenant-cli-paddle-1",
      AA_CREATED_AT: "2026-04-08T12:00:00.000Z",
    });

    const checkout = await runCliAsync<{ gatewayKind: string; gatewaySessionRef: string; checkoutUrl: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_checkout",
      AA_INVOICE_ID: invoice.invoiceId,
      AA_TENANT_ID: "tenant-cli-paddle-1",
      AA_PAYMENT_GATEWAY_KIND: "paddle",
      AA_PADDLE_API_KEY: "pdl_test_123",
      AA_BILLING_SUCCESS_URL: "https://app.example.com/billing/success",
      AA_BILLING_CANCEL_URL: "https://app.example.com/billing/cancel",
      AA_PADDLE_API_BASE_URL: "https://billing-mock.example",
      AA_TEST_FETCH_SCENARIO: "paddle_checkout",
      AA_TEST_FETCH_LOG_PATH: logPath,
    }, { imports: [modulePath] });

    assert.equal(checkout.gatewayKind, "paddle");
    assert.equal(checkout.gatewaySessionRef, "txn_live_test_123");
    assert.equal(checkout.checkoutUrl, "https://checkout.paddle.test/txn_live_test_123");
    const requests = readRequestLog(logPath);
    assert.equal(requests.length, 1);
    assert.match(requests[0] ?? "", /invoice_id/);
  } finally {
    cleanupPath(workspace);
  }
});

test("billing CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("billing.js", {
    AA_DB_PATH: "/tmp/billing-postgres.db",
    AA_BILLING_ACTION: "summary",
    AA_ACCOUNT_ID: "acct-postgres",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});

test("billing CLI reconciles a payment session by gateway reference", async () => {
  const workspace = createTempWorkspace("aa-billing-cli-reconcile-");
  const dbPath = join(workspace, "billing-cli-reconcile.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    await runCliAsync({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_account",
      AA_ACCOUNT_ID: "acct-cli-reconcile-1",
      AA_OWNER_ID: "owner-cli-reconcile-1",
      AA_PLAN_ID: "pro",
    });
    await runCliAsync({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "usage",
      AA_ACCOUNT_ID: "acct-cli-reconcile-1",
      AA_METRIC_TYPE: "task_execution",
      AA_QUANTITY: "1",
      AA_CAPTURED_AT: "2026-04-08T11:05:00.000Z",
    });
    const invoice = await runCliAsync<{ invoiceId: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_invoice",
      AA_ACCOUNT_ID: "acct-cli-reconcile-1",
      AA_CREATED_AT: "2026-04-08T12:00:00.000Z",
    });
    const checkout = runCli<{ gatewaySessionRef: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_checkout",
      AA_INVOICE_ID: invoice.invoiceId,
      AA_PAYMENT_GATEWAY_KIND: "manual",
    });

    const reconciled = runCli<{ session: { status: string }; invoice: { status: string } }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "reconcile_payment",
      AA_PAYMENT_GATEWAY_KIND: "manual",
      AA_GATEWAY_SESSION_REF: checkout.gatewaySessionRef,
      AA_PAYMENT_STATUS: "paid",
      AA_CREATED_AT: "2026-04-08T12:05:00.000Z",
    });

    assert.equal(reconciled.session.status, "paid");
    assert.equal(reconciled.invoice.status, "paid");
  } finally {
    cleanupPath(workspace);
  }
});

test("billing CLI auto-reconciles pending Stripe sessions within tenant scope", async () => {
  const workspace = createTempWorkspace("aa-billing-cli-auto-reconcile-");
  const dbPath = join(workspace, "billing-cli-auto-reconcile.db");
  const { modulePath, logPath } = createFetchMockModule(workspace);

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.close();

    runCli({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_account",
      AA_ACCOUNT_ID: "acct-cli-auto-1",
      AA_OWNER_ID: "owner-cli-auto-1",
      AA_PLAN_ID: "pro",
    });
    runCli({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "usage",
      AA_ACCOUNT_ID: "acct-cli-auto-1",
      AA_METRIC_TYPE: "task_execution",
      AA_QUANTITY: "1",
      AA_TENANT_ID: "tenant-cli-auto-1",
      AA_CAPTURED_AT: "2026-04-08T11:05:00.000Z",
    });
    const invoice = runCli<{ invoiceId: string }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_invoice",
      AA_ACCOUNT_ID: "acct-cli-auto-1",
      AA_TENANT_ID: "tenant-cli-auto-1",
      AA_CREATED_AT: "2026-04-08T12:00:00.000Z",
    });
    await runCliAsync({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "create_checkout",
      AA_INVOICE_ID: invoice.invoiceId,
      AA_TENANT_ID: "tenant-cli-auto-1",
      AA_PAYMENT_GATEWAY_KIND: "stripe",
      AA_STRIPE_SECRET_KEY: "sk_test_123",
      AA_BILLING_SUCCESS_URL: "https://app.example.com/billing/success",
      AA_BILLING_CANCEL_URL: "https://app.example.com/billing/cancel",
      AA_STRIPE_API_BASE_URL: "https://billing-mock.example/v1",
      AA_TEST_FETCH_SCENARIO: "stripe_auto_reconcile",
      AA_TEST_FETCH_LOG_PATH: logPath,
    }, { imports: [modulePath] });

    const reconciled = await runCliAsync<{
      scannedCount: number;
      reconciledCount: number;
      results: Array<{ reason: string; nextStatus: string | null }>;
    }>({
      AA_DB_PATH: dbPath,
      AA_BILLING_ACTION: "reconcile_pending",
      AA_TENANT_ID: "tenant-cli-auto-1",
      AA_PAYMENT_GATEWAY_KIND: "stripe",
      AA_STRIPE_SECRET_KEY: "sk_test_123",
      AA_BILLING_SUCCESS_URL: "https://app.example.com/billing/success",
      AA_BILLING_CANCEL_URL: "https://app.example.com/billing/cancel",
      AA_STRIPE_API_BASE_URL: "https://billing-mock.example/v1",
      AA_TEST_FETCH_SCENARIO: "stripe_auto_reconcile",
      AA_TEST_FETCH_LOG_PATH: logPath,
    }, { imports: [modulePath] });

    assert.equal(reconciled.scannedCount, 1);
    assert.equal(reconciled.reconciledCount, 1);
    assert.equal(reconciled.results[0]?.reason, "reconciled");
    assert.equal(reconciled.results[0]?.nextStatus, "paid");
    const requests = readRequestLog(logPath);
    assert.ok(requests.some((entry) => entry.includes("/v1/checkout/sessions/cs_auto_cli_123")));
  } finally {
    cleanupPath(workspace);
  }
});
