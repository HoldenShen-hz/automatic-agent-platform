import assert from "node:assert/strict";
import test from "node:test";

import { loadTakeoverCliEnv } from "../../../../../src/platform/control-plane/config-center/takeover-cli-env.js";

test("takeover env loader parses tenant-scoped workflow repair inputs", () => {
  const config = loadTakeoverCliEnv({
    AA_DB_PATH: "/tmp/takeover.db",
    AA_TAKEOVER_ACTION: "write_step_output",
    AA_TAKEOVER_SESSION_ID: "takeover-1",
    AA_STEP_OUTPUT_JSON: "{\"ok\":true}",
    AA_STEP_INDEX: "2",
    AA_STEP_STATUS: "partial_success",
    AA_STEP_SUMMARY: "manual repair",
    AA_REASON_CODE: "takeover.manual_repair",
    AA_TENANT_ID: "tenant-1",
  });

  assert.equal(config.action, "write_step_output");
  assert.equal(config.takeoverSessionId, "takeover-1");
  assert.equal(config.stepIndex, 2);
  assert.equal(config.stepStatus, "partial_success");
  assert.equal(config.reasonCode, "takeover.manual_repair");
  assert.equal(config.tenantId, "tenant-1");
});

test("takeover env loader handles modify_input action", () => {
  const config = loadTakeoverCliEnv({
    AA_TAKEOVER_ACTION: "modify_input",
    AA_REASON_CODE: "takeover.modify_input",
  });

  assert.equal(config.action, "modify_input");
});

test("takeover env loader handles retry_execution action", () => {
  const config = loadTakeoverCliEnv({
    AA_TAKEOVER_ACTION: "retry_execution",
    AA_REASON_CODE: "takeover.retry",
  });

  assert.equal(config.action, "retry_execution");
});
