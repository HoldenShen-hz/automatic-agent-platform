import {
  runStableCrossDivisionRecoveryDrill,
  writeStableCrossDivisionRecoveryDrillReport,
} from "../../platform/shared/stability/stable-cross-division-recovery-drill.js";
import { createStableCli } from "./stable-runner-factory.js";

createStableCli({
  envVar: "AA_STABLE_RECOVERY_DRILL",
  defaultDir: "data/stable-recovery-drill",
  reportFilename: "stable-recovery-drill-report.json",
  runner: runStableCrossDivisionRecoveryDrill,
  writer: writeStableCrossDivisionRecoveryDrillReport,
});
