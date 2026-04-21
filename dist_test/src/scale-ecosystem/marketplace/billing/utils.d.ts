import type { BillingAccountSummary } from "./types.js";
export declare function assertIdentifier(value: string, code: string): string;
export declare function assertPositiveNumber(value: number, code: string): number;
export declare function roundCurrency(value: number): number;
export declare function monthWindow(at: string): {
    start: string;
    end: string;
    periodId: string;
};
export declare function buildBillingMarkdown(summary: BillingAccountSummary): string;
