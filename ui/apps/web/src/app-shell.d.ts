import type { ReactElement } from "react";
import { type FeatureModule } from "@aa/ui-core";
import type { FeatureGuardContext } from "@aa/shared-types";
import type { RESTClient, WSClient } from "@aa/shared-api-client";
export interface AuthContext extends Partial<FeatureGuardContext> {
    readonly userId?: string;
}
export interface FeatureSubPage {
    readonly id: string;
    readonly path: string;
    readonly label: string;
    readonly Component: () => ReactElement;
}
export interface WebAppShellProps {
    readonly features: readonly FeatureModule[];
    readonly client?: RESTClient;
    readonly wsClient?: WSClient;
    readonly wsUrl?: string;
    readonly wsToken?: string;
    readonly router?: "browser" | "memory";
    readonly initialEntries?: readonly string[];
    readonly authContext?: AuthContext;
    readonly startupBanner?: {
        readonly tone: "warning";
        readonly title: string;
        readonly message: string;
    };
}
export declare function WebAppShell({ features, client, wsClient, wsUrl, wsToken, router, initialEntries, authContext, startupBanner }: WebAppShellProps): ReactElement;
