import {
  runStableDbWritabilityRehearsal,
  writeStableDbWritabilityRehearsalReport,
} from "../../platform/shared/stability/stable-db-writability-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_DB_WRITABILITY",
  defaultDir: "data/stable-db-writability",
  reportFilename: "stable-db-writability-report.json",
  runner: runStableDbWritabilityRehearsal,
  writer: writeStableDbWritabilityRehearsalReport,
});
