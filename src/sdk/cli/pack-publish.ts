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
import { CLI_EXIT_FAILURE, CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";

interface PackPublishOptions {
  manifest: string;
  registryUrl?: string;
  apiVersion?: string;
  bearerToken?: string;
  dryRun?: boolean;
}

function parseArgs(): PackPublishOptions {
  const args = process.argv.slice(2);
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
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
  }
  return opts;
}

interface PublishResult {
  published: boolean;
  packId: string;
  version: string;
  artifactId?: string;
  errors: string[];
  dryRun: boolean;
}

function resolveRegistryUrl(opts: PackPublishOptions): string {
  const registryUrl = opts.registryUrl ?? process.env["AA_REGISTRY_URL"] ?? "";
  if (registryUrl.trim().length === 0) {
    throw new Error("missing_registry_url:set AA_REGISTRY_URL or pass --registry-url");
  }
  return registryUrl;
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
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    }
  }
  return opts;
}

export async function publishPack(args = process.argv.slice(2)): Promise<PublishResult> {
  const opts = parseArgsFromValues(args);
  const result: PublishResult = { published: false, packId: "", version: "", errors: [], dryRun: opts.dryRun ?? false };

  try {
    const content = readFileSync(opts.manifest, "utf-8");
    const manifest: BusinessPackManifest = JSON.parse(content);
    const validated = validateBusinessPackManifest(manifest);

    result.packId = validated.packId;
    result.version = validated.version;

    if (opts.dryRun) {
      result.published = true;
      return result;
    }

    const registryUrl = resolveRegistryUrl(opts);
    const apiVersion = opts.apiVersion ?? "v1";
    const bearerToken = opts.bearerToken ?? process.env["AA_BEARER_TOKEN"] ?? "";

    if (!bearerToken) {
      result.errors.push("missing_bearer_token:set AA_BEARER_TOKEN or pass --bearer-token");
      return result;
    }

    const config: ApiClientConfig = {
      baseUrl: registryUrl,
      apiVersion,
      bearerToken,
    };

    const client = createApiClient(config);
    const response = await client.post<{ artifactId: string }>("/packs", validated);

    if (response.status >= 200 && response.status < 300) {
      result.published = true;
      result.artifactId = response.data.artifactId;
    } else {
      result.errors.push(`http_error:status=${response.status}`);
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
