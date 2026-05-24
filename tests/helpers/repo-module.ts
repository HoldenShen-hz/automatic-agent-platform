import { pathToFileURL } from "node:url";

import { resolveRepoPath } from "./repo-root.js";

export async function loadRepoModule<TModule = Record<string, unknown>>(
  ...segments: string[]
): Promise<TModule> {
  return import(pathToFileURL(resolveRepoPath(...segments)).href) as Promise<TModule>;
}
