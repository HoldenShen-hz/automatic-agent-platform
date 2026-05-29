import { useSystemStatus } from "@aa/shared-state";
import { createSystemHealthSummary } from "@aa/ui-core";
export function useHealthVm() {
    const status = useSystemStatus();
    return {
        rows: createSystemHealthSummary(status).map((item) => ({ key: item.label, value: item.value })),
    };
}
