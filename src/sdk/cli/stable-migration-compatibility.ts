import {
  runStableMigrationCompatibilityRehearsal,
  writeStableMigrationCompatibilityRehearsalReport,
} from "../../platform/shared/stability/stable-migration-compatibility-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_MIGRATION_COMPATIBILITY",
  defaultDir: "data/stable-migration-compatibility",
  reportFilename: "stable-migration-compatibility-report.json",
  runner: runStableMigrationCompatibilityRehearsal,
  writer: writeStableMigrationCompatibilityRehearsalReport,
});
