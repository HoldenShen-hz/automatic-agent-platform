import {
  runStableDispatchRehearsal,
  writeStableDispatchRehearsalReport,
} from "../../platform/shared/stability/stable-dispatch-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_DISPATCH",
  defaultDir: "data/stable-dispatch",
  reportFilename: "stable-dispatch-report.json",
  runner: runStableDispatchRehearsal,
  writer: writeStableDispatchRehearsalReport,
});
