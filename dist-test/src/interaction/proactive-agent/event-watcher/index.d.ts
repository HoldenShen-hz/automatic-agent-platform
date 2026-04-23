export interface ProactiveEventInput {
    readonly source: string;
    readonly name: string;
    readonly payload?: Record<string, unknown>;
}
export declare function shouldConsumeProactiveEvent(event: ProactiveEventInput, expectedSource: string, expectedPattern: string): boolean;
