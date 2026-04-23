export type StateCommandAction = "upsert" | "transition" | "append_event" | "delete";
export interface StateCommand {
    commandId: string;
    entityKind: string;
    entityId: string;
    action: StateCommandAction;
    expectedVersion: number | null;
    payload: Record<string, unknown>;
    emittedBy: string;
    createdAt: string;
}
export declare function createStateCommand(input: Omit<StateCommand, "commandId" | "createdAt"> & {
    commandId?: string;
    createdAt?: string;
}): StateCommand;
