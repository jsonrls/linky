import { safeUrl } from "./model";
import { linkPlatforms } from "./link-platforms";

export function detectLinkPlatform(value: string): string | undefined {
  if (!safeUrl(value)) return undefined;
  const hostname = new URL(value).hostname;
  return linkPlatforms.find((platform) =>
    platform.domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ),
  )?.label;
}
