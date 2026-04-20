import {
  runStableRollbackRehearsal,
  writeStableRollbackRehearsalReport,
} from "../../platform/shared/stability/stable-rollback-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_ROLLBACK",
  defaultDir: "data/stable-rollback",
  reportFilename: "stable-rollback-report.json",
  runner: runStableRollbackRehearsal,
  writer: writeStableRollbackRehearsalReport,
});
