import { type ReactElement } from "react";
import { type CoreDesignTokens } from "../design-tokens";
export interface EChartSurfaceProps {
    readonly title: string;
    readonly values: readonly number[];
    readonly showTableFallback?: boolean;
    readonly theme?: CoreDesignTokens;
}
export declare function EChartSurface({ title, values, showTableFallback, theme }: EChartSurfaceProps): ReactElement;
