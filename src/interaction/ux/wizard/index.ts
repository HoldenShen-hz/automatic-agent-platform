import { z } from "zod";

export type WizardAnswers = Record<string, unknown>;
export type WizardStepCondition = (answers: WizardAnswers) => boolean;

export const WizardStepSchema = z.object({
  stepId: z.string().min(1),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  condition: z.custom<WizardStepCondition | undefined>((value) => value === undefined || typeof value === "function").optional(),
});

export const WizardSessionSchema = z.object({
  sessionId: z.string().min(1),
  steps: z.array(WizardStepSchema).default([]),
  currentStepId: z.string().min(1),
  answers: z.record(z.string(), z.unknown()).default({}),
  history: z.array(z.string().min(1)).default([]),
  visitedStepIds: z.array(z.string().min(1)).default([]),
  lastSavedAt: z.string().datetime().optional(),
  schemaVersion: z.number().int().min(1).default(1),
});

export type WizardStep = z.infer<typeof WizardStepSchema>;
export type WizardSession = z.infer<typeof WizardSessionSchema>;

function normalizeSession(session: WizardSession): WizardSession {
  const visitedStepIds = new Set<string>(session.visitedStepIds ?? []);
  visitedStepIds.add(session.currentStepId);
  for (const stepId of session.history ?? []) {
    visitedStepIds.add(stepId);
  }
  return WizardSessionSchema.parse({
    ...session,
    answers: session.answers ?? {},
    history: session.history ?? [],
    visitedStepIds: [...visitedStepIds],
  });
}

export function canAdvanceWizard(session: WizardSession): boolean {
  const normalized = normalizeSession(session);
  const current = normalized.steps.find((item) => item.stepId === normalized.currentStepId);
  return current?.completed ?? false;
}

export function canGoBackWizard(session: WizardSession): boolean {
  const normalized = normalizeSession(session);
  return normalized.history.length > 0;
}

export function goBackWizard(session: WizardSession): WizardSession | null {
  const normalized = normalizeSession(session);
  if (normalized.history.length === 0) {
    return null;
  }
  const history = [...normalized.history];
  const previousStepId = history.pop();
  if (previousStepId == null) {
    return null;
  }
  return {
    ...normalized,
    currentStepId: previousStepId,
    history,
  };
}

export function advanceWizard(session: WizardSession, nextStepId: string): WizardSession {
  const normalized = normalizeSession(session);
  return {
    ...normalized,
    currentStepId: nextStepId,
    history: [...normalized.history, normalized.currentStepId],
    visitedStepIds: [...new Set([...normalized.visitedStepIds, normalized.currentStepId, nextStepId])],
  };
}

export function advanceWizardToNextVisibleStep(session: WizardSession): WizardSession | null {
  const normalized = normalizeSession(session);
  const visibleSteps = getVisibleSteps(normalized);
  const currentIndex = visibleSteps.findIndex((step) => step.stepId === normalized.currentStepId);
  if (currentIndex < 0 || currentIndex >= visibleSteps.length - 1) {
    return null;
  }
  return advanceWizard(normalized, visibleSteps[currentIndex + 1]!.stepId);
}

export function recordWizardAnswer(
  session: WizardSession,
  key: string,
  value: unknown,
): WizardSession {
  const normalized = normalizeSession(session);
  return {
    ...normalized,
    answers: {
      ...normalized.answers,
      [key]: value,
    },
  };
}

export function saveWizardSession(session: WizardSession, savedAt = new Date().toISOString()): WizardSession {
  const normalized = normalizeSession(session);
  return {
    ...normalized,
    lastSavedAt: savedAt,
  };
}

export function getWizardProgress(session: WizardSession): {
  readonly completedSteps: number;
  readonly visibleSteps: number;
  readonly completionPercent: number;
  readonly visitedSteps: number;
} {
  const normalized = normalizeSession(session);
  const visibleSteps = getVisibleSteps(normalized);
  const completedSteps = visibleSteps.filter((step) => step.completed).length;
  return {
    completedSteps,
    visibleSteps: visibleSteps.length,
    completionPercent: visibleSteps.length === 0 ? 0 : Number(((completedSteps / visibleSteps.length) * 100).toFixed(2)),
    visitedSteps: normalized.visitedStepIds.length,
  };
}

export function serializeWizardSession(session: WizardSession): string {
  const normalized = normalizeSession(session);
  return JSON.stringify({
    ...normalized,
    steps: normalized.steps.map(({ condition: _condition, ...step }) => step),
  });
}

export function deserializeWizardSession(serialized: string, stepDefinitions: readonly WizardStep[] = []): WizardSession {
  const parsed = WizardSessionSchema.parse(JSON.parse(serialized));
  const definitionsById = new Map(stepDefinitions.map((step) => [step.stepId, step]));
  return normalizeSession({
    ...parsed,
    steps: parsed.steps.map((step) => ({
      ...step,
      condition: definitionsById.get(step.stepId)?.condition,
    })),
  });
}

export function getVisibleSteps(session: WizardSession): WizardStep[] {
  const normalized = normalizeSession(session);
  return normalized.steps.filter((step) => step.condition?.(normalized.answers) ?? true);
}
