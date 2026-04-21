export interface PanicDirectiveInput {
    readonly scope: string;
    readonly reasonCode: string;
    readonly activeIncidents: number;
}
export declare function shouldEnterPanicMode(input: PanicDirectiveInput): boolean;
