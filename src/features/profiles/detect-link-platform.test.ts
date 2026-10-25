import { describe, expect, it } from "vitest";
import { detectLinkPlatform } from "./detect-link-platform";

describe("platform detection", () => {
  it.each([
    ["behance.net", "Behance"],
    ["bsky.app", "Bluesky"],
    ["discord.com", "Discord"],
    ["dribbble.com", "Dribbble"],
    ["facebook.com", "Facebook"],
    ["github.com", "GitHub"],
    ["instagram.com", "Instagram"],
    ["kick.com", "Kick"],
    ["line.me", "LINE"],
    ["linkedin.com", "LinkedIn"],
    ["mastodon.social", "Mastodon"],
    ["medium.com", "Medium"],
    ["messenger.com", "Messenger"],
    ["patreon.com", "Patreon"],
    ["pinterest.com", "Pinterest"],
    ["reddit.com", "Reddit"],
    ["signal.org", "Signal"],
    ["snapchat.com", "Snapchat"],
    ["soundcloud.com", "SoundCloud"],
    ["spotify.com", "Spotify"],
    ["substack.com", "Substack"],
    ["telegram.org", "Telegram"],
    ["threads.com", "Threads"],
    ["tiktok.com", "TikTok"],
    ["tumblr.com", "Tumblr"],
    ["twitch.tv", "Twitch"],
    ["vimeo.com", "Vimeo"],
    ["whatsapp.com", "WhatsApp"],
    ["x.com", "X"],
    ["youtube.com", "YouTube"],
    ["youtu.be", "YouTube"],
    ["twitter.com", "X"],
    ["wa.me", "WhatsApp"],
    ["t.me", "Telegram"],
    ["telegram.me", "Telegram"],
    ["discord.gg", "Discord"],
    ["threads.net", "Threads"],
    ["bsky.social", "Bluesky"],
    ["mastodon.online", "Mastodon"],
  ])("recognizes %s", (host, label) => {
    expect(detectLinkPlatform(`https://${host}/a?ref=example#bio`)).toBe(label);
  });

  it("accepts case-insensitive hosts, HTTP and boundary-separated subdomains", () => {
    expect(detectLinkPlatform("HTTP://WWW.INSTAGRAM.COM/person")).toBe(
      "Instagram",
    );
    expect(detectLinkPlatform("https://open.spotify.com/artist/123")).toBe(
      "Spotify",
    );
    expect(detectLinkPlatform("https://writer.substack.com/p/article")).toBe(
      "Substack",
    );
  });

  it.each([
    "http://instagram.com.evil.com",
    "https://notinstagram.com/",
    "https://instagram.com@evil.com",
    "https://name:secret@instagram.com/",
    "https://evil.com/instagram.com",
    "https://evil.com/?url=https://instagram.com",
    "https://instagram-com.example",
    "https://instagrаm.com/",
    "ftp://instagram.com/",
    "instagram.com/person",
    "https://",
    "https://instagram.com:99999/",
    "https://instagram.com/white space",
    "https://instagram.com\\@evil.com/",
    "https://127.0.0.1/",
    "https://my-mastodon.example/@person",
    "https://newsletter.example/",
    "https://github.io/",
    "",
  ])("leaves unknown or invalid URL generic: %s", (url) => {
    expect(detectLinkPlatform(url)).toBeUndefined();
  });
});
