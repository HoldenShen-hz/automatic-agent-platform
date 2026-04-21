import { runStableBackupRestoreRehearsal, writeStableBackupRestoreRehearsalReport, } from "../../platform/shared/stability/stable-backup-restore-rehearsal.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_RESTORE",
    defaultDir: "data/stable-restore",
    reportFilename: "stable-backup-restore-report.json",
    runner: runStableBackupRestoreRehearsal,
    writer: writeStableBackupRestoreRehearsalReport,
});
//# sourceMappingURL=stable-restore.js.map