export interface TriggerEvent {
  readonly eventId: string;
  readonly triggerId: string;
  readonly type: string;
  readonly timestamp: string;
  readonly context: Record<string, unknown>;
}

export interface ProactiveAction {
  readonly triggerId: string;
  readonly actionType: string;
  readonly actionMode: "auto_execute" | "suggest" | "silent_record";
}
