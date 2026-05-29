import { useExplanationsQuery } from "@aa/shared-state";
export function mapExplanationsToVm(items) {
    return {
        items: items.map((item) => ({
            title: `${item.title} · ${item.evidenceCount} evidence`,
            description: item.summary,
        })),
    };
}
export function useExplainabilityVm() {
    return mapExplanationsToVm(useExplanationsQuery().data ?? []);
}
