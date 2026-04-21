declare const DIAGNOSTICS_KINDS: readonly ["snapshot", "debug", "incident", "remote-timeline", "repro", "export", "stalled-escalation", "stalled-escalation-export", "incident-export", "metrics"];
export interface DiagnosticsCliEnvConfig {
    dbPath: string | null;
    kind: typeof DIAGNOSTICS_KINDS[number];
    taskId: string | null;
    artifactRoot: string;
}
export declare function loadDiagnosticsCliEnv(env?: NodeJS.ProcessEnv): DiagnosticsCliEnvConfig;
export {};
