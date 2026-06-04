export type AssuranceStep = {
  id: string;
  command: string;
  args: string[];
  required: boolean;
  rationale: string;
};

export type AssuranceStepResult = {
  id: string;
  required: boolean;
  ok?: boolean;
};

export const steps: AssuranceStep[];

export const notYetIntegratedAudits: unknown[];

export function buildAssuranceFullReport(results: AssuranceStepResult[]): {
  generatedAt: string;
  repoRoot: string;
  mode: "full";
  status: "pass" | "fail";
  executedSteps: AssuranceStepResult[];
  notYetIntegratedAudits: unknown[];
  notes: string[];
};
