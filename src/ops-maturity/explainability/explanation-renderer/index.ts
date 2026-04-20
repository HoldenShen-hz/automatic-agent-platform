export function renderStageExplanation(stage: string, summary: string, evidenceIds: readonly string[]): string {
  return `${stage}: ${summary}${evidenceIds.length > 0 ? ` [evidence=${evidenceIds.join(",")}]` : ""}`;
}
