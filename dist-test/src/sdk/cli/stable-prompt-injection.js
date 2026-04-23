import { runStablePromptInjectionRedTeam, writeStablePromptInjectionRedTeamReport, } from "../../platform/shared/stability/stable-prompt-injection-red-team.js";
import { createStableCli } from "./stable-runner-factory.js";
createStableCli({
    envVar: "AA_STABLE_PROMPT_INJECTION",
    defaultDir: "data/stable-prompt-injection",
    reportFilename: "stable-prompt-injection-report.json",
    runner: runStablePromptInjectionRedTeam,
    writer: writeStablePromptInjectionRedTeamReport,
});
//# sourceMappingURL=stable-prompt-injection.js.map