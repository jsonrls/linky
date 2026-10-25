import { initials, type ProfileDocument } from "@/features/profiles/model";
import type { ProfileTemplateId } from "@/features/profiles/templates";
import { ProfileMedia } from "./ProfileMedia";

export function TemplateHeader({
  document,
  template,
  preview,
}: {
  document: ProfileDocument;
  template: ProfileTemplateId;
  preview: boolean;
}) {
  const Heading = preview ? "h2" : "h1";
  const name = (
    <Heading
      className="template-name"
      data-long-name={document.name.length > 24 || undefined}
    >
      {document.name || "Your name here"}
    </Heading>
  );
  const bio = document.bio ? (
    <p className="template-bio">{document.bio}</p>
  ) : null;
  const avatar = (
    <ProfileMedia
      avatar
      url={document.appearance.avatarUrl}
      className="template-avatar"
    />
  );
  const cover = (
    <ProfileMedia
      url={document.appearance.coverUrl}
      className="template-cover"
    />
  );
  switch (template) {
    case "electric-index":
      return (
        <header className="template-header">
          <div className="identity-split">
            {name}
            {avatar}
          </div>
          {bio}
          {cover}
        </header>
      );
    case "soft-motion":
      return (
        <header className="template-header">
          <div className="motion-intro">
            <div>
              {name}
              {bio}
            </div>
            {avatar}
          </div>
          {cover}
        </header>
      );
    case "contact-sheet":
      return (
        <header className="template-header">
          <div className="contact-masthead">
            {avatar}
            <div>
              {name}
              {bio}
            </div>
          </div>
          {cover}
        </header>
      );
    case "cobalt-objects":
      return (
        <header className="template-header">
          {name}
          {cover}
          <div className="cobalt-byline">
            {avatar}
            {bio}
          </div>
        </header>
      );
    case "studio-index":
      return (
        <header className="template-header">
          {name}
          <div className="studio-intro">
            {avatar}
            {bio}
            {cover}
          </div>
        </header>
      );
    case "sunday-kitchen":
      return (
        <header className="template-header">
          {cover}
          <div className="kitchen-identity">
            {name}
            {avatar}
            {bio}
          </div>
        </header>
      );
    case "quiet-cadence":
      return (
        <header className="template-header">
          {cover}
          <div className="quiet-identity">
            {avatar}
            <div>
              {name}
              {bio}
            </div>
          </div>
        </header>
      );
    case "lift-log":
      return (
        <header className="template-header">
          {name}
          <div className="training-intro">
            {avatar}
            {bio}
          </div>
          {cover}
        </header>
      );
    case "open-house":
      return (
        <header className="template-header">
          {cover}
          <div className="house-identity">
            {name}
            {avatar}
          </div>
          {bio}
        </header>
      );
    case "garden-dispatch":
      return (
        <header className="template-header">
          {cover}
          <div className="garden-identity">
            {avatar}
            {name}
            {bio}
          </div>
        </header>
      );
    case "night-shift":
      return (
        <header className="template-header">
          {name}
          {bio}
        </header>
      );
    case "route-postcard":
      return (
        <header className="template-header">
          <div className="postcard">{cover}</div>
          {avatar}
          {name}
          {bio}
        </header>
      );
    case "the-big-question":
      return (
        <header className="template-header">
          {bio}
          <div className={`question-byline ${document.bio ? "" : "no-bio"}`}>
            {avatar}
            {name}
          </div>
        </header>
      );
    case "objects-and-hands":
      return (
        <header className="template-header">
          <div className="objects-intro">
            <div>
              {name}
              {bio}
            </div>
            <div className="objects-images">
              {avatar}
              {cover}
            </div>
          </div>
        </header>
      );
    case "distance-club":
      return (
        <header className="template-header">
          <div className="club-identity">
            {avatar}
            {name}
          </div>
          {(bio || document.appearance.coverUrl) && (
            <div className="club-poster">
              {bio}
              {cover}
            </div>
          )}
        </header>
      );
    case "screening-room":
      return (
        <header className="template-header">
          {cover}
          {name}
          <div className="screening-byline">
            {avatar}
            {bio}
          </div>
        </header>
      );
    case "type-practice":
      return (
        <header className="template-header">
          <div className="specimen-intro">
            <span className="template-monogram" aria-hidden="true">
              {initials(document.name)}
            </span>
            <div>
              {avatar}
              {name}
              {bio}
            </div>
          </div>
          {cover}
        </header>
      );
    case "soft-power":
      return (
        <header className="template-header">
          <div className="power-byline">
            {name}
            {avatar}
          </div>
          {bio}
          {cover}
        </header>
      );
    case "culture-receipt":
      return (
        <header className="template-header">
          {avatar}
          {name}
          {bio}
          {cover}
        </header>
      );
    case "coastal-assembly":
      return (
        <header className="template-header">
          {name}
          {cover}
          <div className="coastal-byline">
            {avatar}
            {bio}
          </div>
        </header>
      );
    default:
      return null;
  }
}
