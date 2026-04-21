export declare function analyzeCapacityTrend(samples: readonly number[]): {
    readonly average: number;
    readonly direction: "up" | "down" | "flat";
};
