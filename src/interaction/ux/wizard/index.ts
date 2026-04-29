import { z } from "zod";

export const WizardStepSchema = z.object({
  stepId: z.string().min(1),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  /**
   * §44.2: Conditional step predicate.
   * Evaluated against current WizardSession answers to determine if step should be shown.
   * undefined means step is always shown.
   */
  condition: z.function().args(z.record(z.string(), z.unknown())).returns(z.boolean()).optional(),
});

export const WizardSessionSchema = z.object({
  sessionId: z.string().min(1),
  steps: z.array(WizardStepSchema).default([]),
  currentStepId: z.string().min(1),
  /**
   * §44.2: Answers collected from previous steps for conditional logic
   */
  answers: z.record(z.string(), z.unknown()).default({}),
  /**
   * §44.2: Step navigation history for back navigation
   */
  history: z.array(z.string()).default([]),
});

export type WizardStep = z.infer<typeof WizardStepSchema>;
export type WizardSession = z.infer<typeof WizardSessionSchema>;

export function canAdvanceWizard(session: WizardSession): boolean {
  const current = session.steps.find((item) => item.stepId === session.currentStepId);
  return current?.completed ?? false;
}

/**
 * §44.2: Check if wizard can navigate back (has history)
 */
export function canGoBackWizard(session: WizardSession): boolean {
  return session.history.length > 0;
}

/**
 * §44.2: Save session to serializable format for session storage
 */
export function serializeWizardSession(session: WizardSession): string {
  // Strip functions (conditions) before serializing - they cannot be persisted
  const storable = {
    sessionId: session.sessionId,
    steps: session.steps.map((step) => ({
      stepId: step.stepId,
      title: step.title,
      completed: step.completed,
      // conditions are not serializable - restore as undefined after deserialize
    })),
    currentStepId: session.currentStepId,
    answers: session.answers,
    history: session.history,
  };
  return JSON.stringify(storable);
}

/**
 * §44.2: Restore session from session storage format
 */
export function deserializeWizardSession(data: string, stepDefinitions: WizardStep[]): WizardSession {
  const parsed = JSON.parse(data);
  // Re-attach step condition functions from step definitions
  const steps = parsed.steps.map((storedStep: { stepId: string; title: string; completed: boolean }) => {
    const def = stepDefinitions.find((s) => s.stepId === storedStep.stepId);
    return {
      ...storedStep,
      condition: def?.condition,
    };
  });
  return WizardSessionSchema.parse({
    ...parsed,
    steps,
  });
}

/**
 * §44.2: Persist session to provided storage (sessionStorage/localStorage compatible)
 */
export function saveWizardSession(session: WizardSession, storage: Storage, key: string): void {
  storage.setItem(key, serializeWizardSession(session));
}

/**
 * §44.2: Restore session from storage
 */
export function restoreWizardSession(storage: Storage, key: string, stepDefinitions: WizardStep[]): WizardSession | null {
  const data = storage.getItem(key);
  if (!data) return null;
  try {
    return deserializeWizardSession(data, stepDefinitions);
  } catch {
    return null;
  }
}

/**
 * §44.2: Navigate back in wizard history
 */
export function goBackWizard(session: WizardSession): WizardSession | null {
  if (session.history.length === 0) return null;
  const previousStepId = session.history[session.history.length - 1];
  return {
    ...session,
    currentStepId: previousStepId,
    history: session.history.slice(0, -1),
  };
}

/**
 * §44.2: Advance to next step, pushing current to history
 */
export function advanceWizard(session: WizardSession, nextStepId: string): WizardSession {
  return {
    ...session,
    currentStepId: nextStepId,
    history: [...session.history, session.currentStepId],
  };
}

/**
 * §44.2: Get visible steps based on conditions evaluated against current answers
 */
export function getVisibleSteps(session: WizardSession): WizardStep[] {
  return session.steps.filter((step) => {
    if (!step.condition) return true;
    return step.condition(session.answers);
  });
}