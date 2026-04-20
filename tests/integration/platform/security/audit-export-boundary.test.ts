import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  AuditExportService,
  AUDIT_EXPORT_DDL,
} from "../../../../src/platform/control-plane/audit-export/audit-export-service.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "audit-boundary.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(AUDIT_EXPORT_DDL);
  return { workspace, db };
}

test("audit export service handles SQL injection in requestedBy field", () => {
  const h = createHarness("aa-audit-sqli-");
  try {
    const svc = new AuditExportService(h.db);
    const req = svc.requestExport({
      framework: "soc2",
      format: "json",
      windowStart: "2026-01-01",
      windowEnd: "2026-02-01",
      requestedBy: "'; DROP TABLE audit_exports; --",
    });
    assert.equal(req.requestedBy, "'; DROP TABLE audit_exports; --");
    const exports = svc.listExports();
    assert.equal(exports.length, 1);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("audit export service handles export with no events gracefully", () => {
  const h = createHarness("aa-audit-noevents-");
  try {
    const svc = new AuditExportService(h.db);
    const req = svc.requestExport({
      framework: "soc2",
      format: "json",
      windowStart: "2099-01-01",
      windowEnd: "2099-12-31",
      requestedBy: "test",
    });
    const generated = svc.generateExport(req.id);
    assert.equal(generated?.status, "completed");
    assert.equal(generated?.eventCount, 0);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("SOC2 package for nonexistent export returns null", () => {
  const h = createHarness("aa-audit-soc2-miss-");
  try {
    const svc = new AuditExportService(h.db);
    const pkg = svc.generateSoc2Package("aexport_nonexistent");
    assert.equal(pkg, null);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
