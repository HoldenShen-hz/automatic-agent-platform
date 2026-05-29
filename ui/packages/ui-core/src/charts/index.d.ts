import type { ReactElement } from "react";
import { PieChart, TimelineChart } from "../components/extended";
export { EChartSurface } from "./echart-surface";
export declare function MetricGrid({ metrics }: {
    metrics: readonly {
        label: string;
        value: string | number;
    }[];
}): ReactElement;
export declare function MiniTrendBars({ values }: {
    values: readonly number[];
}): ReactElement;
export declare function SparklineBars({ values }: {
    values: readonly number[];
}): ReactElement;
export declare function BarChart({ points, }: {
    points: readonly {
        label: string;
        value: number;
        tone?: string;
    }[];
}): ReactElement;
export declare function ScatterPlot({ points, }: {
    points: readonly {
        label: string;
        x: number;
        y: number;
    }[];
}): ReactElement;
export declare function GaugeChart({ label, value, max, }: {
    label: string;
    value: number;
    max?: number;
}): ReactElement;
export declare function HeatmapGrid({ rows, columns, values, }: {
    rows: readonly string[];
    columns: readonly string[];
    values: readonly (readonly number[])[];
}): ReactElement;
export { PieChart, TimelineChart };
