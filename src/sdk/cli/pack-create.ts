/**
 * Pack Create CLI Command
 *
 * Creates a new business pack manifest with the required fields per §22.3.
 *
 * Usage:
 *   npx tsx src/sdk/cli/pack-create.ts --pack-id my-pack --domain my-domain --owner me
 */

import { validateBusinessPackManifest, type BusinessPackManifest } from "../pack-sdk/pack-manifest.js";
import { newId } from "../../platform/contracts/types/ids.js";

interface PackCreateOptions {
  packId: string;
  domain: string;
  owner: string;
  version?: string;
  capabilities?: string[];
  tools?: string[];
  output?: string;
}

function parseArgs(): PackCreateOptions {
  const args = process.argv.slice(2);
  const opts: PackCreateOptions = {
    packId: "",
    domain: "",
    owner: "",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pack-id" && i + 1 < args.length) opts.packId = args[++i];
    else if (args[i] === "--domain" && i + 1 < args.length) opts.domain = args[++i];
    else if (args[i] === "--owner" && i + 1 < args.length) opts.owner = args[++i];
    else if (args[i] === "--version" && i + 1 < args.length) opts.version = args[++i];
    else if (args[i] === "--capabilities" && i + 1 < args.length) opts.capabilities = args[++i].split(",");
    else if (args[i] === "--tools" && i + 1 < args.length) opts.tools = args[++i].split(",");
    else if (args[i] === "--output" && i + 1 < args.length) opts.output = args[++i];
  }
  return opts;
}

function buildManifest(opts: PackCreateOptions): BusinessPackManifest {
  const manifest: BusinessPackManifest = {
    packId: opts.packId,
    version: opts.version ?? "1.0.0",
    domainId: opts.domain,
    owner: opts.owner,
    capabilities: (opts.capabilities ?? ["core"]).map((cap) => ({
      capabilityKey: cap.trim(),
      maturity: "experimental",
      requiredContracts: [],
    })),
    tools: opts.tools ?? [],
  };
  return manifest;
}

function main(): void {
  const opts = parseArgs();
  if (!opts.packId || !opts.domain || !opts.owner) {
    process.stderr.write("Error: --pack-id, --domain, and --owner are required\n");
    process.exit(1);
  }

  const manifest = buildManifest(opts);
  const validated = validateBusinessPackManifest(manifest);

  const output = opts.output
    ? JSON.stringify(validated, null, 2)
    : JSON.stringify({ packId: validated.packId, version: validated.version, domainId: validated.domainId }, null, 2);

  process.stdout.write(`${output}\n`);
}

main();