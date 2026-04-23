export interface GeneratedBinding {
  readonly id: string;
  readonly source: string;
  readonly generatedAt: string;
}

export function createGeneratedBinding(id: string, source: string): GeneratedBinding {
  return {
    id,
    source,
    generatedAt: new Date().toISOString(),
  };
}
