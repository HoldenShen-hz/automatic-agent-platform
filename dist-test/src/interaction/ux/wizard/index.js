import { z } from "zod";
export const WizardStepSchema = z.object({
    stepId: z.string().min(1),
    title: z.string().min(1),
    completed: z.boolean().default(false),
});
export const WizardSessionSchema = z.object({
    sessionId: z.string().min(1),
    steps: z.array(WizardStepSchema).default([]),
    currentStepId: z.string().min(1),
});
export function canAdvanceWizard(session) {
    const current = session.steps.find((item) => item.stepId === session.currentStepId);
    return current?.completed ?? false;
}
//# sourceMappingURL=index.js.map