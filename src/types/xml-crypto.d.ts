declare module "xml-crypto" {
  export interface SignedXmlOptions {
    signatureAlgorithm?: string;
    getCertFromKeyInfo?: (keyInfo: string | object) => string | null;
  }

  export class SignedXml {
    public validationErrors?: readonly string[];

    public constructor(options?: SignedXmlOptions);
    public loadSignature(signature: string): void;
    public checkSignature(xml: string): boolean;
  }
}
