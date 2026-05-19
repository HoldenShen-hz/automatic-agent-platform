declare module "web-vitals" {
  export interface Metric {
    name: string;
    value: number;
    rating: "good" | "needs-improvement" | "poor";
    delta: number;
    id: string;
    entries: PerformanceEntry[];
  }

  export function onLCP(callback: (metric: Metric) => void, options?: { reportAll?: boolean }): void;
  export function onFCP(callback: (metric: Metric) => void, options?: { reportAll?: boolean }): void;
  export function onCLS(callback: (metric: Metric) => void, options?: { reportAll?: boolean }): void;
  export function onINP(callback: (metric: Metric) => void, options?: { reportAll?: boolean }): void;
  export function onTTFB(callback: (metric: Metric) => void, options?: { reportAll?: boolean }): void;
}
