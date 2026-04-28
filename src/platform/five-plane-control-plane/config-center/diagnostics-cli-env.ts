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
] as const;

export interface DiagnosticsCliEnvConfig {
  dbPath: string | null;
  kind: typeof DIAGNOSTICS_KINDS[number];
  taskId: string | null;
  artifactRoot: string;
}

function readKind(env: NodeJS.ProcessEnv): DiagnosticsCliEnvConfig["kind"] {
  const kind = readTrimmedEnv(env, "AA_DIAGNOSTICS_KIND");
  if (kind == null) {
    throw new ValidationError("missing_env:AA_DIAGNOSTICS_KIND", "missing_env:AA_DIAGNOSTICS_KIND");
  }
  if (!DIAGNOSTICS_KINDS.includes(kind as DiagnosticsCliEnvConfig["kind"])) {
    throw new ValidationError(`unknown_diagnostics_kind:${kind}`, `unknown_diagnostics_kind:${kind}`);
  }
  return kind as DiagnosticsCliEnvConfig["kind"];
}

function readArtifactRoot(env: NodeJS.ProcessEnv): string {
  const fromEnv = readTrimmedEnv(env, "AA_ARTIFACT_ROOT");
  if (fromEnv != null) {
    return fromEnv;
  }
  const artifactRoot = `${process.cwd()}/data/artifacts`;
  mkdirSync(artifactRoot, { recursive: true });
  return artifactRoot;
}

export function loadDiagnosticsCliEnv(env: NodeJS.ProcessEnv = process.env): DiagnosticsCliEnvConfig {
  return {
    dbPath: readTrimmedEnv(env, "AA_DB_PATH") ?? null,
    kind: readKind(env),
    taskId: readTrimmedEnv(env, "AA_TASK_ID") ?? null,
    artifactRoot: readArtifactRoot(env),
  };
}
