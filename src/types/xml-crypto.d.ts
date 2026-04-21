declare module "xml-crypto" {
  export class SignedXml {
    constructor(options?: { signatureAlgorithm?: string });
    loadSignature(signature: string | object): void;
    checkSignature(xml: string | object): boolean;
    getSignature(): string;
    signDocument(options?: { appendToNode?: string }): void;
  }
}
