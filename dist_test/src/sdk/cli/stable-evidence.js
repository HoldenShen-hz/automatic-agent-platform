import { createStableEvidenceBundle, } from "../../platform/shared/stability/stable-evidence-bundle.js";
import { loadStableEvidenceCliEnv } from "../../platform/control-plane/config-center/stable-cli-env.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_EVIDENCE",
    defaultDir: "data/stable-evidence/smoke",
    runner: createStableEvidenceBundle,
    failed: (report) => !report.summary.passed,
    prepare: () => {
        const envConfig = loadStableEvidenceCliEnv();
        return {
            outputDir: envConfig.outputDir,
            profileName: envConfig.profile,
            profileOverrides: {
                ...(envConfig.validationIterations !== null
                    ? { validationIterations: envConfig.validationIterations }
                    : {}),
                ...(envConfig.durationMs !== null
                    ? { soakDurationMs: envConfig.durationMs }
                    : {}),
                ...(envConfig.intervalMs !== null
                    ? { soakIntervalMs: envConfig.intervalMs }
                    : {}),
                ...(envConfig.iterationsPerCycle !== null
                    ? { soakIterationsPerCycle: envConfig.iterationsPerCycle }
                    : {}),
            },
        };
    },
});
//# sourceMappingURL=stable-evidence.js.map