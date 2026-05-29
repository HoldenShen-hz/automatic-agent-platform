import { type ReactElement } from "react";
import type { SystemStatusVM } from "@aa/shared-types";
export declare function SystemStatusBar({ status }: {
    status: SystemStatusVM;
}): ReactElement;
export declare function createSystemHealthSummary(status: SystemStatusVM): readonly {
    label: string;
    value: string;
}[];
