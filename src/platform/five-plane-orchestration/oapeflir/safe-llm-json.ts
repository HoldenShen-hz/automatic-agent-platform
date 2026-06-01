export type GuardedJsonRoot = "object" | "array" | "any";

export interface GuardedJsonParseOptions {
  readonly root: GuardedJsonRoot;
  readonly maxBytes?: number;
  readonly maxDepth?: number;
  readonly maxKeys?: number;
}

export class GuardedJsonParseError extends Error {
  public constructor(
    public readonly code:
      | "json.fragment_missing"
      | "json.fragment_too_large"
      | "json.fragment_unbalanced"
      | "json.root_mismatch"
      | "json.too_deep"
      | "json.too_many_keys"
      | "json.parse_failed",
    message: string,
  ) {
    super(message);
    this.name = "GuardedJsonParseError";
  }
}

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_KEYS = 2_048;

export function parseGuardedJson<T>(raw: string, options: GuardedJsonParseOptions): T {
  ensureUtf8SizeWithinLimit(raw, options.maxBytes ?? DEFAULT_MAX_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new GuardedJsonParseError(
      "json.parse_failed",
      error instanceof Error ? error.message : "JSON parse failed",
    );
  }
  assertJsonRoot(parsed, options.root);
  assertJsonComplexity(parsed, options.maxDepth ?? DEFAULT_MAX_DEPTH, options.maxKeys ?? DEFAULT_MAX_KEYS);
  return parsed as T;
}

export function extractAndParseGuardedJson<T>(raw: string, options: GuardedJsonParseOptions): T {
  const fragment = extractJsonFragment(raw, options.root);
  if (fragment == null) {
    throw new GuardedJsonParseError("json.fragment_missing", "No JSON fragment found in model response");
  }
  return parseGuardedJson<T>(fragment, options);
}

function ensureUtf8SizeWithinLimit(raw: string, maxBytes: number): void {
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new GuardedJsonParseError("json.fragment_too_large", `JSON fragment exceeds ${maxBytes} bytes`);
  }
}

function assertJsonRoot(value: unknown, root: GuardedJsonRoot): void {
  if (root === "any") {
    return;
  }
  if (root === "array") {
    if (!Array.isArray(value)) {
      throw new GuardedJsonParseError("json.root_mismatch", "Expected JSON array");
    }
    return;
  }
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new GuardedJsonParseError("json.root_mismatch", "Expected JSON object");
  }
}

function assertJsonComplexity(value: unknown, maxDepth: number, maxKeys: number): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 1 }];
  let totalKeys = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }
    if (current.depth > maxDepth) {
      throw new GuardedJsonParseError("json.too_deep", `JSON depth exceeds ${maxDepth}`);
    }
    if (Array.isArray(current.value)) {
      for (const item of current.value) {
        if (item != null && typeof item === "object") {
          stack.push({ value: item, depth: current.depth + 1 });
        }
      }
      continue;
    }
    if (current.value != null && typeof current.value === "object") {
      const entries = Object.values(current.value as Record<string, unknown>);
      totalKeys += Object.keys(current.value as Record<string, unknown>).length;
      if (totalKeys > maxKeys) {
        throw new GuardedJsonParseError("json.too_many_keys", `JSON key count exceeds ${maxKeys}`);
      }
      for (const item of entries) {
        if (item != null && typeof item === "object") {
          stack.push({ value: item, depth: current.depth + 1 });
        }
      }
    }
  }
}

function extractJsonFragment(raw: string, root: GuardedJsonRoot): string | null {
  const candidates = root === "array"
    ? [{ open: "[", close: "]" }]
    : root === "object"
      ? [{ open: "{", close: "}" }]
      : [{ open: "{", close: "}" }, { open: "[", close: "]" }];
  for (const candidate of candidates) {
    const fragment = extractBalancedFragment(raw, candidate.open, candidate.close);
    if (fragment != null) {
      return fragment;
    }
  }
  return null;
}

function extractBalancedFragment(raw: string, open: string, close: string): string | null {
  const startIndex = raw.indexOf(open);
  if (startIndex < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < raw.length; index += 1) {
    const character = raw[index];
    if (character == null) {
      break;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }
    if (character === open) {
      depth += 1;
      continue;
    }
    if (character === close) {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(startIndex, index + 1);
      }
      continue;
    }
  }

  throw new GuardedJsonParseError("json.fragment_unbalanced", "JSON fragment is not balanced");
}
