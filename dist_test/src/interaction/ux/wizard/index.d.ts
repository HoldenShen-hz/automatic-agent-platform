import { z } from "zod";
export declare const WizardStepSchema: z.ZodObject<{
    stepId: z.ZodString;
    title: z.ZodString;
    completed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    completed: boolean;
    stepId: string;
    title: string;
}, {
    stepId: string;
    title: string;
    completed?: boolean | undefined;
}>;
export declare const WizardSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        stepId: z.ZodString;
        title: z.ZodString;
        completed: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        completed: boolean;
        stepId: string;
        title: string;
    }, {
        stepId: string;
        title: string;
        completed?: boolean | undefined;
    }>, "many">>;
    currentStepId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    currentStepId: string;
    steps: {
        completed: boolean;
        stepId: string;
        title: string;
    }[];
}, {
    sessionId: string;
    currentStepId: string;
    steps?: {
        stepId: string;
        title: string;
        completed?: boolean | undefined;
    }[] | undefined;
}>;
export type WizardStep = z.infer<typeof WizardStepSchema>;
export type WizardSession = z.infer<typeof WizardSessionSchema>;
export declare function canAdvanceWizard(session: WizardSession): boolean;
