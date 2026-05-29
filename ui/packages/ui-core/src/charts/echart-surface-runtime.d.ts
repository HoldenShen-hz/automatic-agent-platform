import { type ReactElement } from "react";
import { type CoreDesignTokens } from "../design-tokens";
export interface EChartSurfaceRuntimeProps {
    readonly title: string;
    readonly values: readonly number[];
    readonly theme?: CoreDesignTokens;
}
export declare function EChartSurfaceRuntime({ title, values, theme }: EChartSurfaceRuntimeProps): ReactElement;
