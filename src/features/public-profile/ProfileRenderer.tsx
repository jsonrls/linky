import {
  initials,
  safeUrl,
  safeMediaUrl,
  type Block,
  type ProfileDocument,
} from "@/features/profiles/model";
import { LinkIcon } from "@/features/profiles/link-platforms";
import { ProfileMedia } from "./ProfileMedia";
import { TemplateHeader } from "./TemplateHeader";
import { resolveTemplate } from "./template-visuals";
import "./templates.css";

type LinkBlock = Extract<Block, { type: "link" }>;
export function ProfileRenderer({
  document,
  preview = false,
  previewContext = "private",
}: {
  document: ProfileDocument;
  preview?: boolean;
  previewContext?: "private" | "published";
}) {
  const blocks = document.blocks.filter((block) => block.visible);
  const template = resolveTemplate(document.appearance.template);
  const original = template === "original";
  const Heading = preview ? "h2" : "h1";
  const numbered = [
    "electric-index",
    "studio-index",
    "lift-log",
    "culture-receipt",
    "route-postcard",
  ].includes(template);
  let linkIndex = 0;
  function link(block: LinkBlock) {
    const index = linkIndex++;
    const disabled = preview || !safeUrl(block.url);
    return (
      <a
        key={block.id}
        data-block-id={block.id}
        data-first={index === 0 || undefined}
        className={original ? "button public-link" : "template-link"}
        href={disabled ? undefined : block.url}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
      >
        {numbered && (
          <span className="template-number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        <ProfileMedia url={block.imageUrl} className="template-link-image" />
        <span className="template-link-body">
          <LinkIcon label={block.label} />
          <span className="link-label">{block.label || "Untitled link"}</span>
          <span className="template-arrow" aria-hidden="true">
            ↗
          </span>
        </span>
      </a>
    );
  }
  // Consecutive links form a grid; text always terminates it without moving content.
  const groups: Array<Block | LinkBlock[]> = [];
  for (const block of blocks) {
    const previous = groups[groups.length - 1];
    if (block.type === "text") groups.push(block);
    else if (Array.isArray(previous)) previous.push(block);
    else groups.push([block]);
  }
  return (
    <div
      data-template={template}
      className={`public-surface ${original ? (document.appearance.theme === "ink" ? "theme-ink" : "") : `template-surface template-${template}`} ${document.appearance.layout === "compact" ? "compact" : ""} ${document.appearance.shape === "square" ? "square" : ""}`}
    >
      <article className={original ? "public-profile" : "template-profile"}>
        {original ? (
          <header>
            <ProfileMedia
              avatar
              url={document.appearance.avatarUrl}
              className="original-avatar"
              fallback={
                <div className="initials" aria-hidden="true">
                  {initials(document.name)}
                </div>
              }
            />
            <Heading className="public-name">
              {document.name || "Your name here"}
            </Heading>
            <p className="public-bio">{document.bio}</p>
            <ProfileMedia
              url={document.appearance.coverUrl}
              className="template-cover"
            />
          </header>
        ) : (
          <TemplateHeader
            document={document}
            template={template}
            preview={preview}
          />
        )}
        <div className={original ? "public-links" : "template-content"}>
          {original
            ? blocks.map((block) =>
                block.type === "text" ? (
                  <p
                    key={block.id}
                    className="public-text"
                    data-block-id={block.id}
                  >
                    {block.text}
                  </p>
                ) : (
                  link(block)
                ),
              )
            : groups.map((group) =>
                Array.isArray(group) ? (
                  <div className="template-link-group" key={group[0].id}>
                    {group.map(link)}
                  </div>
                ) : (
                  <p
                    className="template-text"
                    data-block-id={group.id}
                    key={group.id}
                  >
                    {group.type === "text" ? group.text : ""}
                  </p>
                ),
              )}
        </div>
        {preview && !blocks.length && (
          <p className="public-text">
            {previewContext === "published"
              ? "No links or text in this published version."
              : "Add or show a content block to begin."}
          </p>
        )}
        {template === "night-shift" && (
          <ProfileMedia
            avatar={
              !document.appearance.coverUrl ||
              !safeMediaUrl(document.appearance.coverUrl)
            }
            url={
              document.appearance.coverUrl &&
              safeMediaUrl(document.appearance.coverUrl)
                ? document.appearance.coverUrl
                : document.appearance.avatarUrl
            }
            className="template-closing"
          />
        )}
        {template === "the-big-question" && (
          <ProfileMedia
            url={document.appearance.coverUrl}
            className="template-closing"
          />
        )}
        <footer className="public-footnote">
          {preview
            ? previewContext === "published"
              ? "Published preview. Links are disabled."
              : "Private draft preview. Links are disabled."
            : "Made with Linky"}
        </footer>
      </article>
    </div>
  );
}
