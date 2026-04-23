import { useSystemStatus } from "@aa/shared-state";
import { createSystemHealthSummary } from "@aa/ui-core";

export interface HealthVm {
  readonly rows: readonly { key: string; value: string }[];
}

export function useHealthVm(): HealthVm {
  const status = useSystemStatus();
  return {
    rows: createSystemHealthSummary(status).map((item) => ({ key: item.label, value: item.value })),
  };
}
