import { readJsonBody } from "../http-server/utils.js";
import { sanitizeJsonValue } from "./sanitize.js";
export function readValidatedJsonBody(body, parser) {
    const parsed = readJsonBody(body);
    return parser(sanitizeJsonValue(parsed));
}
//# sourceMappingURL=input-validation.js.map