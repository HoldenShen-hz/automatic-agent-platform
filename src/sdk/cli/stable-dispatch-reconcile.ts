import {
  runStableDispatchReconciliationRehearsal,
  writeStableDispatchReconciliationRehearsalReport,
} from "../../platform/shared/stability/stable-dispatch-reconciliation-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_DISPATCH_RECONCILE",
  defaultDir: "data/stable-dispatch-reconcile",
  reportFilename: "stable-dispatch-reconcile-report.json",
  runner: runStableDispatchReconciliationRehearsal,
  writer: writeStableDispatchReconciliationRehearsalReport,
});
