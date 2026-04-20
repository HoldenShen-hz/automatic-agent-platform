export function resolveInputModality(partType: string): "text" | "image" | "audio" | "document" | "unsupported" {
  switch (partType) {
    case "text":
    case "image":
    case "audio":
    case "document":
      return partType;
    default:
      return "unsupported";
  }
}
