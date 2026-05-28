import type { PropsWithChildren, ReactElement } from "react";
import type { PlatformAdapter } from "@aa/shared-types";
export declare function PlatformAdapterProvider({ adapter, children }: PropsWithChildren<{
    adapter: PlatformAdapter;
}>): ReactElement;
export declare function usePlatformAdapter(): PlatformAdapter;
