/**
 * Pack Publish CLI Command
 *
 * Publishes a validated pack to the platform registry per §22.3.
 *
 * Usage:
 *   AA_REGISTRY_URL=https://registry.internal.example npm run pack-publish -- --manifest ./pack.json
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateBusinessPackManifest, type BusinessPackManifest } from "../pack-sdk/pack-manifest.js";
import { createApiClient, type ApiClientConfig } from "../client-sdk/api-client.js";
import { readCliProcessEnv, type CliEnv } from "./cli-env.js";
import { readGuardedJsonFile, readGuardedTextFile } from "./cli-file-guards.js";
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";

const PACK_PUBLISH_MAX_ATTEMPTS = 4;
const PACK_PUBLISH_INITIAL_BACKOFF_MS = 250;

interface PackPublishOptions {
  manifest: string;
  registryUrl?: string;
  apiVersion?: string;
  bearerToken?: string;
  bearerTokenFile?: string;
  dryRun?: boolean;
}

function parseArgsFromValues(args: readonly string[]): PackPublishOptions {
  const opts: PackPublishOptions = { manifest: "", dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--manifest" && next !== undefined) {
      opts.manifest = next;
      i++;
    } else if (arg === "--registry-url" && next !== undefined) {
      opts.registryUrl = next;
      i++;
    } else if (arg === "--api-version" && next !== undefined) {
      opts.apiVersion = next;
      i++;
    } else if (arg === "--bearer-token" && next !== undefined) {
      opts.bearerToken = next;
      i++;
    } else if (arg === "--bearer-token-file" && next !== undefined) {
      opts.bearerTokenFile = next;
      i++;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
  }
  return opts;
}

function parseArgs(): PackPublishOptions {
  return parseArgsFromValues(process.argv.slice(2));
}

interface PublishResult {
  published: boolean;
  packId: string;
  version: string;
  artifactId?: string;
  errors: string[];
  dryRun: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryPublishStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function shouldRetryPublishError(error: unknown): boolean {
  if (error != null && typeof error === "object") {
    const retryable = Reflect.get(error, "retryable");
    const statusCode = Reflect.get(error, "statusCode");
    if (retryable === true) {
      return true;
    }
    if (typeof statusCode === "number" && shouldRetryPublishStatus(statusCode)) {
      return true;
    }
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("fetch failed")
    || message.includes("network")
    || message.includes("timeout")
    || message.includes("socket");
}

function resolveRegistryUrl(opts: PackPublishOptions, env: CliEnv): string {
  const registryUrl = opts.registryUrl ?? env["AA_REGISTRY_URL"] ?? "";
  if (registryUrl.trim().length === 0) {
    throw new Error("missing_registry_url:set AA_REGISTRY_URL or pass --registry-url");
  }
  return registryUrl;
}

function resolveBearerToken(opts: PackPublishOptions, env: CliEnv): string {
  if (opts.bearerTokenFile) {
    return readGuardedTextFile(opts.bearerTokenFile, "Bearer token file", 16 * 1024).trim();
  }
  return opts.bearerToken ?? env["AA_BEARER_TOKEN"] ?? "";
}

export async function publishPack(
  args = process.argv.slice(2),
  env: CliEnv = readCliProcessEnv(),
): Promise<PublishResult> {
  const opts = parseArgsFromValues(args);
  const result: PublishResult = { published: false, packId: "", version: "", errors: [], dryRun: opts.dryRun ?? false };

  try {
    const content = readGuardedJsonFile(opts.manifest, "Pack manifest");
    const manifest: BusinessPackManifest = JSON.parse(content);
    const validated = validateBusinessPackManifest(manifest);

    result.packId = validated.packId;
    result.version = validated.version;

    if (opts.dryRun) {
      result.published = true;
      return result;
    }

    const registryUrl = resolveRegistryUrl(opts, env);
    const apiVersion = opts.apiVersion ?? "v1";
    const bearerToken = resolveBearerToken(opts, env);

    if (!bearerToken) {
      result.errors.push("missing_bearer_token:set AA_BEARER_TOKEN, pass --bearer-token, or use --bearer-token-file");
      return result;
    }

    const config: ApiClientConfig = {
      baseUrl: registryUrl,
      apiVersion,
      bearerToken,
      principal: {
        subject: "pack-publish-cli",
      },
    };

    const client = createApiClient(config);
    let lastStatus: number | null = null;
    for (let attempt = 1; attempt <= PACK_PUBLISH_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await client.post<{ artifactId: string }>("/packs", validated);
        if (response.status >= 200 && response.status < 300) {
          result.published = true;
          result.artifactId = response.data.artifactId;
          return result;
        }
        lastStatus = response.status;
        if (!shouldRetryPublishStatus(response.status) || attempt === PACK_PUBLISH_MAX_ATTEMPTS) {
          result.errors.push(`http_error:status=${response.status}:attempt=${attempt}`);
          return result;
        }
        result.errors.push(`retryable_http_error:status=${response.status}:attempt=${attempt}`);
      } catch (error) {
        if (!shouldRetryPublishError(error) || attempt === PACK_PUBLISH_MAX_ATTEMPTS) {
          throw error;
        }
        result.errors.push(`retryable_network_error:attempt=${attempt}`);
      }
      const backoffMs = Math.min(
        PACK_PUBLISH_INITIAL_BACKOFF_MS * (2 ** (attempt - 1)),
        4_000,
      );
      await delay(backoffMs);
    }
    if (lastStatus != null) {
      result.errors.push(`http_error:status=${lastStatus}`);
    }
  } catch (err) {
    result.errors.push(`publish_failed:${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

export async function main(): Promise<number> {
  const opts = parseArgs();
  if (!opts.manifest) {
    process.stderr.write("Error: --manifest is required\n");
    return CLI_EXIT_FAILURE;
  }

  const result = await publishPack(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.published ? CLI_EXIT_SUCCESS : CLI_EXIT_FAILURE;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main);
}
