import {
  FaBehance,
  FaBluesky,
  FaDiscord,
  FaDribbble,
  FaFacebook,
  FaFacebookMessenger,
  FaGithub,
  FaInstagram,
  FaLine,
  FaLink,
  FaLinkedin,
  FaMastodon,
  FaMedium,
  FaPatreon,
  FaPinterest,
  FaReddit,
  FaSignalMessenger,
  FaSnapchat,
  FaSoundcloud,
  FaSpotify,
  FaTelegram,
  FaThreads,
  FaTiktok,
  FaTumblr,
  FaTwitch,
  FaVimeo,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { SiKick, SiSubstack } from "react-icons/si";
import type { IconType } from "react-icons";

type LinkPlatform = {
  label: string;
  Icon: IconType;
  domains: readonly string[];
  color: string;
  background?: string;
};

// Exact labels are the persisted contract; custom labels are never normalized.
// Solid colors: https://github.com/simple-icons/simple-icons/blob/develop/data/simple-icons.json
// LinkedIn: the 13.0.0 dataset and https://brand.linkedin.com/in-logo (blue on white).
export const linkPlatforms: readonly LinkPlatform[] = [
  {
    label: "Behance",
    domains: ["behance.net"],
    Icon: FaBehance,
    color: "#1769FF",
  },
  {
    label: "Bluesky",
    domains: ["bsky.app", "bsky.social"],
    Icon: FaBluesky,
    color: "#1185FE",
  },
  {
    label: "Discord",
    domains: ["discord.com", "discord.gg"],
    Icon: FaDiscord,
    color: "#5865F2",
  },
  {
    label: "Dribbble",
    domains: ["dribbble.com"],
    Icon: FaDribbble,
    color: "#EA4C89",
  },
  {
    label: "Facebook",
    domains: ["facebook.com"],
    Icon: FaFacebook,
    color: "#0866FF",
  },
  {
    label: "GitHub",
    domains: ["github.com"],
    Icon: FaGithub,
    color: "#181717",
  },
  {
    label: "Instagram",
    domains: ["instagram.com"],
    Icon: FaInstagram,
    color: "#FF0069",
  },
  {
    label: "Kick",
    domains: ["kick.com"],
    Icon: SiKick,
    color: "#000000",
    background: "#53FC19",
  },
  { label: "LINE", domains: ["line.me"], Icon: FaLine, color: "#00C300" },
  {
    label: "LinkedIn",
    domains: ["linkedin.com"],
    Icon: FaLinkedin,
    color: "#0A66C2",
  },
  {
    label: "Mastodon",
    domains: ["mastodon.social", "mastodon.online"],
    Icon: FaMastodon,
    color: "#6364FF",
  },
  {
    label: "Medium",
    domains: ["medium.com"],
    Icon: FaMedium,
    color: "#000000",
  },
  {
    label: "Messenger",
    domains: ["messenger.com"],
    Icon: FaFacebookMessenger,
    color: "#0866FF",
  },
  {
    label: "Patreon",
    domains: ["patreon.com"],
    Icon: FaPatreon,
    color: "#000000",
  },
  {
    label: "Pinterest",
    domains: ["pinterest.com"],
    Icon: FaPinterest,
    color: "#BD081C",
  },
  {
    label: "Reddit",
    domains: ["reddit.com"],
    Icon: FaReddit,
    color: "#FF4500",
  },
  {
    label: "Signal",
    domains: ["signal.org"],
    Icon: FaSignalMessenger,
    color: "#3B45FD",
  },
  {
    label: "Snapchat",
    domains: ["snapchat.com"],
    Icon: FaSnapchat,
    color: "#000000",
    background: "#FFFC00",
  },
  {
    label: "SoundCloud",
    domains: ["soundcloud.com"],
    Icon: FaSoundcloud,
    color: "#FF5500",
  },
  {
    label: "Spotify",
    domains: ["spotify.com"],
    Icon: FaSpotify,
    color: "#1ED760",
  },
  {
    label: "Substack",
    domains: ["substack.com"],
    Icon: SiSubstack,
    color: "#FF6719",
  },
  {
    label: "Telegram",
    domains: ["telegram.org", "t.me", "telegram.me"],
    Icon: FaTelegram,
    color: "#26A5E4",
  },
  {
    label: "Threads",
    domains: ["threads.net", "threads.com"],
    Icon: FaThreads,
    color: "#000000",
  },
  {
    label: "TikTok",
    domains: ["tiktok.com"],
    Icon: FaTiktok,
    color: "#000000",
  },
  {
    label: "Tumblr",
    domains: ["tumblr.com"],
    Icon: FaTumblr,
    color: "#36465D",
  },
  { label: "Twitch", domains: ["twitch.tv"], Icon: FaTwitch, color: "#9146FF" },
  { label: "Vimeo", domains: ["vimeo.com"], Icon: FaVimeo, color: "#1AB7EA" },
  {
    label: "WhatsApp",
    domains: ["whatsapp.com", "wa.me"],
    Icon: FaWhatsapp,
    color: "#25D366",
  },
  {
    label: "X",
    domains: ["x.com", "twitter.com"],
    Icon: FaXTwitter,
    color: "#000000",
  },
  {
    label: "YouTube",
    domains: ["youtube.com", "youtu.be"],
    Icon: FaYoutube,
    color: "#FF0000",
  },
];

export function linkPlatform(label: string) {
  return linkPlatforms.find((platform) => platform.label === label);
}

export function LinkIcon({ label }: { label: string }) {
  const platform = linkPlatform(label);
  const Icon = platform?.Icon ?? FaLink;
  return (
    <Icon
      className={`link-icon${platform ? " link-icon-brand" : ""}`}
      style={
        platform
          ? { color: platform.color, backgroundColor: platform.background }
          : undefined
      }
      size={22}
      aria-hidden="true"
      focusable="false"
    />
  );
}
