import { join } from "node:path";
import { createTempWorkspace } from "./tests/helpers/fs.js";

import { SqliteDatabase } from "./src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "./src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "./src/platform/shared/observability/health-service.js";
import { MetricsService } from "./src/platform/shared/observability/metrics-service.js";
import { InspectService } from "./src/platform/shared/observability/inspect-service.js";
import { runSingleTaskExecution } from "./src/platform/five-plane-execution/execution-engine/single-task-execution.js";

const workspace = createTempWorkspace("debug-stability-");
console.log("Workspace:", workspace);

const dbPath = join(workspace, "api.db");
runSingleTaskExecution({
  dbPath,
  title: "API seeded task",
  request: "Seed the minimal productized API baseline.",
});

const db = new SqliteDatabase(dbPath);
db.migrate();
const store = new AuthoritativeTaskStore(db);

const healthService = new HealthService(db, store);
const metricsService = new MetricsService(db, healthService);
const inspectService = new InspectService(store);

const report = healthService.getReport();
console.log("Health status:", report.status);
console.log("Findings:", JSON.stringify(report.findings, null, 2));
console.log("Worker health:", JSON.stringify(report.workerHealth, null, 2));
console.log("Queue governance:", JSON.stringify(report.queueGovernance, null, 2));
console.log("Memory RSS MB:", report.memoryRssMb);
console.log("Event loop lag:", report.eventLoopLagMs);
console.log("Active executions:", report.activeExecutions);
console.log("Queued tasks:", report.queuedTasks);
console.log("tier1AckBacklog:", report.tier1AckBacklog);
console.log("providerHealth:", report.providerHealth);

db.close();