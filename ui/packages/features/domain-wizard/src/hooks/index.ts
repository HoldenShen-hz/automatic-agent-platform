import { useDomainConfigsQuery } from "@aa/shared-state";

export interface DomainWizardVm {
  readonly items: readonly { title: string; description: string }[];
}

export function useDomainWizardVm(): DomainWizardVm {
  const domains = useDomainConfigsQuery().data ?? [];
  return {
    items: domains.map((domain) => ({
      title: domain.displayName,
      description: `owner ${domain.owner} · drill ${domain.defaultDrillDepth}`,
    })),
  };
}
