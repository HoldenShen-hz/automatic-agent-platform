import { mkdirSync } from "node:fs";
import { ValidationError } from "../../contracts/errors.js";
import { readTrimmedEnv } from "./runtime-env.js";
const DIAGNOSTICS_KINDS = [
    "snapshot",
    "debug",
    "incident",
    "remote-timeline",
    "repro",
    "export",
    "stalled-escalation",
    "stalled-escalation-export",
    "incident-export",
    "metrics",
];
function readKind(env) {
    const kind = readTrimmedEnv(env, "AA_DIAGNOSTICS_KIND");
    if (kind == null) {
        throw new ValidationError("missing_env:AA_DIAGNOSTICS_KIND", "missing_env:AA_DIAGNOSTICS_KIND");
    }
    if (!DIAGNOSTICS_KINDS.includes(kind)) {
        throw new ValidationError(`unknown_diagnostics_kind:${kind}`, `unknown_diagnostics_kind:${kind}`);
    }
    return kind;
}
function readArtifactRoot(env) {
    const fromEnv = readTrimmedEnv(env, "AA_ARTIFACT_ROOT");
    if (fromEnv != null) {
        return fromEnv;
    }
    const artifactRoot = `${process.cwd()}/data/artifacts`;
    mkdirSync(artifactRoot, { recursive: true });
    return artifactRoot;
}
export function loadDiagnosticsCliEnv(env = process.env) {
    return {
        dbPath: readTrimmedEnv(env, "AA_DB_PATH") ?? null,
        kind: readKind(env),
        taskId: readTrimmedEnv(env, "AA_TASK_ID") ?? null,
        artifactRoot: readArtifactRoot(env),
    };
}
//# sourceMappingURL=diagnostics-cli-env.js.map