import { useExplanationsQuery } from "@aa/shared-state";
import type { ExplanationDTO } from "@aa/shared-types";

export interface ExplainabilityVm {
  readonly items: readonly { title: string; description: string }[];
}

export function mapExplanationsToVm(items: readonly ExplanationDTO[]): ExplainabilityVm {
  return {
    items: items.map((item) => ({
      title: `${item.title} · ${item.evidenceCount} evidence`,
      description: item.summary,
    })),
  };
}

export function useExplainabilityVm(): ExplainabilityVm {
  return mapExplanationsToVm(useExplanationsQuery().data ?? []);
}
