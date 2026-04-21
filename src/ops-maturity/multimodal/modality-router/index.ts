export function resolveInputModality(partType: string): "text" | "image" | "audio" | "document" | "video" | "unsupported" {
  switch (partType) {
    case "text":
    case "image":
    case "audio":
    case "document":
    case "video":
      return partType;
    default:
      return "unsupported";
  }
}
