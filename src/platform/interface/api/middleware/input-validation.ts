import { readJsonBody } from "../http-server/utils.js";
import { sanitizeJsonValue } from "./sanitize.js";

export function readValidatedJsonBody<T>(
  body: string | null | undefined,
  parser: (payload: unknown) => T,
): T {
  const parsed = readJsonBody(body);
  return parser(sanitizeJsonValue(parsed));
}
