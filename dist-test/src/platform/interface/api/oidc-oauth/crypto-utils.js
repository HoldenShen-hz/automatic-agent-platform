export function rsaAlgToNode(alg) {
    switch (alg) {
        case "RS256": return "RSA-SHA256";
        case "RS384": return "RSA-SHA384";
        case "RS512": return "RSA-SHA512";
        default: return "RSA-SHA256";
    }
}
export function ecAlgToNode(alg) {
    switch (alg) {
        case "ES256": return "SHA256";
        case "ES384": return "SHA384";
        case "ES512": return "SHA512";
        default: return "SHA256";
    }
}
export function hmacAlgToNode(alg) {
    switch (alg) {
        case "HS256": return "sha256";
        case "HS384": return "sha384";
        case "HS512": return "sha512";
        default: return "sha256";
    }
}
//# sourceMappingURL=crypto-utils.js.map