export type CliEnv = Readonly<NodeJS.ProcessEnv>;

export function snapshotCliEnv(env: NodeJS.ProcessEnv): CliEnv {
  return Object.freeze({ ...env });
}

export function readCliProcessEnv(): CliEnv {
  return snapshotCliEnv(process.env);
}
