import type { AgentDTO } from "@aa/shared-types";
export interface AgentManagerVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly items: readonly {
        title: string;
        description: string;
    }[];
}
export declare function mapAgentManagerToVm(agents: readonly AgentDTO[]): AgentManagerVm;
export declare function useAgentManagerVm(): AgentManagerVm;
