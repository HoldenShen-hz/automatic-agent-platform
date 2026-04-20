import {
  runStableDbQueueDisconnectRehearsal,
  writeStableDbQueueDisconnectRehearsalReport,
} from "../../platform/shared/stability/stable-db-queue-disconnect-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_DB_QUEUE_DISCONNECT",
  defaultDir: "data/stable-db-queue-disconnect",
  reportFilename: "stable-db-queue-disconnect-report.json",
  runner: runStableDbQueueDisconnectRehearsal,
  writer: writeStableDbQueueDisconnectRehearsalReport,
});
