/**
 * Pack Publish CLI Command
 *
 * Publishes a validated pack to the platform registry per §22.3.
 *
 * Usage:
 *   npx tsx src/sdk/cli/pack-publish.ts --manifest ./pack.json --registry-url https://api.example.com
 */

import { readFileSync } from "node:fs";
import { validateBusinessPackManifest, type BusinessPackManifest } from "../pack-sdk/pack-manifest.js";
import { createApiClient, type ApiClientConfig } from "../client-sdk/api-client.js";
import { createPrincipalRef } from "../../platform/contracts/executable-contracts/index.js";

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

async function main(): Promise<void> {
  const opts = parseArgs();
  if (!opts.manifest) {
    process.stderr.write("Error: --manifest is required\n");
    process.exit(1);
  }

  const result: PublishResult = { published: false, packId: "", version: "", errors: [], dryRun: opts.dryRun ?? false };

  try {
    const content = readFileSync(opts.manifest, "utf-8");
    const manifest: BusinessPackManifest = JSON.parse(content);
    const validated = validateBusinessPackManifest(manifest);

    result.packId = validated.packId;
    result.version = validated.version;

    if (opts.dryRun) {
      result.published = true;
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    // Publish to registry
    const registryUrl = opts.registryUrl ?? process.env["AA_REGISTRY_URL"] ?? "https://api.platform.example.com";
    const apiVersion = opts.apiVersion ?? "v1";
    const bearerToken = opts.bearerToken ?? process.env["AA_BEARER_TOKEN"] ?? "";

    if (!bearerToken) {
      result.errors.push("missing_bearer_token:set AA_BEARER_TOKEN or pass --bearer-token");
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exit(1);
    }

    const config: ApiClientConfig = {
      baseUrl: registryUrl,
      apiVersion,
      bearerToken,
      principal: createPrincipalRef({
        principalId: "sdk.pack-publish",
        tenantId: "platform",
        roles: ["operator"],
      }),
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

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.published ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
