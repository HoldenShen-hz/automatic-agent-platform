export interface PatchGateCheckInput {
  readonly patchApplied: boolean;
  readonly targetedTestsPassed: boolean;
  readonly p2pPreserved: boolean;
  readonly changedPaths: readonly string[];
  readonly generatedCommands: readonly string[];
  readonly secretFindings: readonly string[];
  readonly evidenceRefs?: readonly string[];
}

export interface PatchGateReport {
  readonly allowed: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly summary: {
    readonly patchApplied: boolean;
    readonly targetedTestsPassed: boolean;
    readonly p2pPreserved: boolean;
  };
}

function isUnsafePath(path: string): boolean {
  return path.startsWith("/") || path.includes("..");
}

function isUnsafeCommand(command: string): boolean {
  return /(curl\s+.+\|\s*sh)|(rm\s+-rf\s+\/)|(sudo\s+)/i.test(command);
}

export function evaluatePatchGate(input: PatchGateCheckInput): PatchGateReport {
  const blockers = [];
  const warnings = [];
  if (!input.patchApplied) blockers.push("patch_apply_failed");
  if (!input.targetedTestsPassed) blockers.push("targeted_tests_failed");
  if (!input.p2pPreserved) blockers.push("p2p_preservation_failed");
  if (input.changedPaths.some((path) => isUnsafePath(path))) blockers.push("unsafe_file_path");
  if (input.generatedCommands.some((command) => isUnsafeCommand(command))) blockers.push("unsafe_generated_command");
  if (input.secretFindings.length > 0) blockers.push("secret_diff_detected");
  if (input.changedPaths.length > 25) warnings.push("large_patch_surface");
  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    evidenceRefs: input.evidenceRefs ?? [],
    summary: {
      patchApplied: input.patchApplied,
      targetedTestsPassed: input.targetedTestsPassed,
      p2pPreserved: input.p2pPreserved,
    },
  };
}
