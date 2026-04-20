import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  GatewayTargetAmbiguousError,
  GatewayTargetDirectoryService,
  GatewayTargetNotFoundError,
} from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import { runSingleTaskExecution } from "../../../../../src/platform/execution/execution-engine/single-task-execution.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("GatewayTargetDirectoryService", async () => {
  const workspace = createTempWorkspace("aa-gateway-targets-");
  const dbPath = join(workspace, "gateway-targets.db");

  try {
    const seeded = await runSingleTaskExecution({
      dbPath,
      title: "Gateway target seed",
      request: "Create a session-backed target candidate.",
    });
    const seededSession = seeded.session;
    assert.ok(seededSession);
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new GatewayTargetDirectoryService(store);

    store.insertMessage({
      id: newId("msg"),
      sessionId: seededSession.id,
      direction: "inbound",
      messageType: "user",
      content: "Need the finance review room to approve this change.",
      attachmentsJson: null,
      createdAt: nowIso(),
    });

    const registered = service.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-team",
      displayName: "Finance Team",
      aliases: ["finance", "fin"],
    });

    const listed = service.listTargets({ limit: 10 });
    assert.ok(listed.some((entry) => entry.targetId === registered.targetId));
    assert.ok(listed.some((entry) => entry.source === "session_history" && entry.sessionId === seededSession.id));

    const exact = service.resolveTarget({ query: "Finance Team", channel: "telegram" });
    assert.equal(exact.entry.targetId, registered.targetId);
    assert.equal(exact.matchedBy, "display_name_exact");

    const prefix = service.resolveTarget({ query: "cli :: gateway", channel: "cli" });
    assert.equal(prefix.entry.sessionId, seededSession.id);
    assert.match(prefix.entry.targetId, /^cli:session:/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("GatewayTargetDirectoryService", async () => {
  const workspace = createTempWorkspace("aa-gateway-targets-ambiguity-");
  const dbPath = join(workspace, "gateway-targets-ambiguity.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new GatewayTargetDirectoryService(store);

    service.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-east",
      displayName: "Finance East",
      aliases: ["finance"],
    });
    service.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "finance-west",
      displayName: "Finance West",
      aliases: ["finance-team"],
    });

    assert.throws(
      () => service.resolveTarget({ query: "fin", channel: "telegram" }),
      (error: unknown) => error instanceof GatewayTargetAmbiguousError,
    );
    assert.throws(
      () => service.resolveTarget({ query: "unknown-target", channel: "telegram" }),
      (error: unknown) => error instanceof GatewayTargetNotFoundError,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
