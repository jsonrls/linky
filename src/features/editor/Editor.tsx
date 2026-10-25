"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import "./editor.css";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import { CopyWork } from "@/components/CopyWork";
import { OtpForm } from "@/features/auth/OtpForm";
import { ProfileRenderer } from "@/features/public-profile/ProfileRenderer";
import { LinkIcon } from "@/features/profiles/link-platforms";
import { detectLinkPlatform } from "@/features/profiles/detect-link-platform";
import { api, RequestError, unresolvedRequest } from "@/lib/client-api";
import {
  publicationIssue,
  publicationStatus,
  type Profile,
  type Workspace,
  type Block,
  type EditableProfile,
} from "@/features/profiles/model";
import { useDraft } from "./useDraft";
import { TemplatePicker } from "./TemplatePicker";
import { MediaField } from "./MediaField";
import { ProfilePhoto } from "./ProfilePhoto";
import { useProfilePhoto } from "./useProfilePhoto";
import { resolveTemplate } from "@/features/public-profile/template-visuals";
import {
  choiceForLabel,
  LinkLabelField,
  type LinkLabelChoice,
} from "./LinkLabelField";
type Mutation = {
  kind: "publish" | "unpublish";
  operationId: string;
  expectedRevision: number;
};
type Modal =
  "publish" | "unpublish" | "reload" | "leave" | "reauth" | "success" | null;
const subscribeReady = () => () => {};
export function Editor({
  initial,
  workspace,
  email,
  back,
}: {
  initial: Profile;
  workspace: Workspace;
  email: string;
  back: string;
}) {
  const draft = useDraft(initial);
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const { profile, value } = draft;
  const photo = useProfilePhoto(profile.id, draft.change, draft.fail);
  const photoUnsaved =
    photo.changed && (draft.dirty || draft.saving || !!draft.failure);
  const [tab, setTab] = useState("content");
  const [identityOpen, setIdentityOpen] = useState(
    !initial.document.name.trim(),
  );
  const editPane = useRef<HTMLDivElement>(null);
  const contentTools = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toolbar = contentTools.current;
    const pane = editPane.current;
    if (!toolbar || !pane) return;
    const measure = () => {
      const height = toolbar.getBoundingClientRect().height;
      if (height)
        pane.style.setProperty("--content-toolbar-height", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [tab]);
  const [view, setView] = useState("edit");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [operationError, setOperationError] = useState("");
  const [invalidField, setInvalidField] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [pendingKind, setPendingKind] = useState<Mutation["kind"] | null>(null);
  const operation = useRef<Mutation | null>(null);
  const navigation = useRef("");
  const [undo, setUndo] = useState<{ block: Block; index: number } | null>(
    null,
  );
  const [linkChoices, setLinkChoices] = useState<
    Record<string, LinkLabelChoice>
  >({});
  const [automaticLinks, setAutomaticLinks] = useState<Record<string, boolean>>(
    {},
  );
  const publicUrl =
    typeof window === "undefined"
      ? `/@${profile.handle}`
      : `${window.location.origin}/@${profile.handle}`;
  const copy = JSON.stringify(
    { profileId: profile.id, expectedRevision: profile.revision, ...value },
    null,
    2,
  );
  const unchanged =
    !!profile.publicationId &&
    profile.publishedRevision === profile.revision &&
    !draft.dirty;
  function change(next: EditableProfile) {
    draft.change(next);
    setMessage("");
    setInvalidField(null);
  }
  function documentChange(patch: Partial<EditableProfile["document"]>) {
    change({ ...value, document: { ...value.document, ...patch } });
  }
  function updateBlock(id: string, patch: Partial<Block>) {
    documentChange({
      blocks: value.document.blocks.map((block) =>
        block.id === id ? ({ ...block, ...patch } as Block) : block,
      ),
    });
  }
  function updateLinkUrl(block: Extract<Block, { type: "link" }>, url: string) {
    const automatic = !!automaticLinks[block.id];
    const choice = linkChoices[block.id];
    // Loaded nonempty labels and every explicit choice belong to the author.
    const eligible = automatic || (!block.label && !choice?.selection);
    const detected = eligible ? detectLinkPlatform(url) : undefined;
    if (!eligible || (!detected && !automatic)) {
      updateBlock(block.id, { url });
      return;
    }
    const label = detected ?? "";
    updateBlock(block.id, { url, label });
    setLinkChoices((choices) => ({
      ...choices,
      [block.id]: { selection: label, customLabel: choice?.customLabel ?? "" },
    }));
    setAutomaticLinks((links) => ({ ...links, [block.id]: !!detected }));
    if (label !== block.label)
      setMessage(
        detected
          ? `${detected} selected from the URL. You can choose a different label.`
          : "Automatic platform choice cleared. Choose a platform or Custom.",
      );
  }
  function focusEditorElement(
    id: string,
    reveal = false,
    alignNewBlock = false,
  ) {
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (!element) return;
      const disclosure = element.closest("details");
      if (reveal) {
        let parent = element.parentElement;
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
          parent = parent.parentElement;
        }
      }
      if (alignNewBlock)
        disclosure
          ?.querySelector("summary")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
      element.focus({ preventScroll: true });
      if (!alignNewBlock)
        element.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }
  function add(type: "link" | "text") {
    const block: Block =
      type === "link"
        ? { id: crypto.randomUUID(), type, visible: true, label: "", url: "" }
        : { id: crypto.randomUUID(), type, visible: true, text: "" };
    documentChange({ blocks: [...value.document.blocks, block] });
    if (type === "link")
      setLinkChoices((choices) => ({
        ...choices,
        [block.id]: { selection: "", customLabel: "" },
      }));
    setMessage(`${type === "link" ? "Link" : "Text"} added at the end.`);
    focusEditorElement(
      `${type === "link" ? "url" : "text"}-${block.id}`,
      true,
      true,
    );
  }
  function move(index: number, direction: number) {
    const blocks = [...value.document.blocks];
    const [block] = blocks.splice(index, 1);
    blocks.splice(index + direction, 0, block);
    documentChange({ blocks });
    setMessage(
      `Block moved to position ${index + direction + 1} of ${blocks.length}.`,
    );
    focusEditorElement(`block-${block.id}`);
  }
  async function navigate(url: string) {
    if (busy || photo.pending.current) return;
    const saved = await draft.flush();
    if (saved) {
      window.location.assign(url);
    } else {
      navigation.current = url;
      setModal("leave");
    }
  }
  async function mutate(kind: "publish" | "unpublish") {
    if (busy || (kind === "publish" && (photo.pending.current || photoUnsaved)))
      return;
    if (operation.current && operation.current.kind !== kind) {
      setOperationError(
        `Resolve the previous ${operation.current.kind} request before starting a different action.`,
      );
      return;
    }
    setBusy(true);
    setOperationError("");
    try {
      if (!operation.current) {
        if (kind === "publish") {
          const invalid = publicationIssue(value.document);
          if (invalid) {
            setInvalidField(invalid);
            setTab(
              ["avatar-url", "cover-url"].includes(invalid.field)
                ? "appearance"
                : "content",
            );
            setView("edit");
            setModal(null);
            if (invalid.field === "public-name") setIdentityOpen(true);
            focusEditorElement(invalid.field, true);
            return;
          }
        }
        const saved = await draft.flush();
        if (!saved) {
          setOperationError(
            "Save your draft before continuing. Your edits remain in this tab.",
          );
          return;
        }
        operation.current = {
          kind,
          operationId: crypto.randomUUID(),
          expectedRevision: saved.revision,
        };
        setPendingKind(kind);
      }
      const pending = operation.current;
      await api<Profile>(`/api/profiles/${profile.id}/${pending.kind}`, {
        operationId: pending.operationId,
        expectedRevision: pending.expectedRevision,
      });
      // A receipt is historical. Re-read current availability before announcing it.
      const current = await api<Profile>(`/api/profiles/${profile.id}`);
      draft.publication(current);
      operation.current = null;
      setPendingKind(null);
      setUncertain(false);
      setMessage(
        current.publicationId
          ? "The published snapshot is available."
          : "Page unpublished. Your draft and handle are retained.",
      );
      setModal(current.publicationId ? "success" : null);
    } catch (error) {
      const failure = error as RequestError;
      const unknown = unresolvedRequest(error);
      setUncertain(unknown);
      setOperationError(
        unknown
          ? "Could not confirm the result. Check status to retry the original operation."
          : failure.message,
      );
      if (!unknown) {
        operation.current = null;
        setPendingKind(null);
      }
      if (failure.status === 401)
        draft.fail({ code: "unauthenticated", message: failure.message });
      if (failure.code === "revision_conflict")
        draft.fail({ code: failure.code, message: failure.message });
    } finally {
      setBusy(false);
    }
  }
  function reloadDraft(latest: Profile) {
    // Discard UI-only choices with the local draft, never on autosave receipts.
    setLinkChoices({});
    setAutomaticLinks({});
    setUndo(null);
    setIdentityOpen(!latest.document.name.trim());
    draft.reload(latest);
  }
  async function reload() {
    setBusy(true);
    try {
      const latest = await api<Profile>(`/api/profiles/${profile.id}`);
      reloadDraft(latest);
      if (!operation.current) {
        setUncertain(false);
        setOperationError("");
      }
      setModal(null);
      setMessage("Latest saved draft loaded.");
    } catch (error) {
      setOperationError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reauthenticated() {
    const session = await api<{ ownerId: string }>("/api/session");
    if (session.ownerId !== workspace.ownerId)
      throw new Error(
        "Sign in with the same account that owns this draft. Your work is still here.",
      );
    // A save may already have committed before the session was interrupted.
    // Replay its receipt before treating a newer revision as another tab's work.
    if (draft.pending.current && !(await draft.save(true))) {
      throw new Error(
        "Could not reconcile the interrupted save. Your local draft is retained; retry after restoring the session.",
      );
    }
    const latest = await api<Profile>(`/api/profiles/${profile.id}`);
    draft.resume(latest);
    draft.publication(latest);
    setModal(null);
    setMessage("Session restored. Your local draft is retained.");
  }
  function requestPublish() {
    if (photo.pending.current || photoUnsaved) return;
    if (operation.current) {
      setModal(operation.current.kind);
      return;
    }
    setOperationError("");
    setModal("publish");
  }
  const saveText = draft.failure
    ? "Could not save"
    : draft.saving
      ? "Saving…"
      : draft.dirty
        ? "Unsaved changes"
        : "All changes saved";
  return (
    <main id="main" className="editor-shell">
      <header className="editor-header">
        <a
          className="back-link"
          href={back}
          onClick={(event) => {
            event.preventDefault();
            void navigate(back);
          }}
        >
          ‹ Profiles
        </a>
        <div className="switcher">
          <label htmlFor="profile-switcher">Editing a profile</label>
          <select
            id="profile-switcher"
            value={profile.id}
            disabled={busy || photo.uploading}
            onChange={(event) =>
              void navigate(
                `/app/profiles/${event.target.value}/edit?back=${encodeURIComponent(back)}`,
              )
            }
          >
            {workspace.profiles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · /@{item.handle}
              </option>
            ))}
          </select>
        </div>
        <span className="save-state" role="status">
          {saveText}
        </span>
      </header>
      {draft.failure && (
        <div className="notice error" role="alert">
          <p>{draft.failure.message}</p>
          <div className="actions">
            {draft.failure.code === "unauthenticated" ? (
              <button onClick={() => setModal("reauth")}>
                Sign in to continue
              </button>
            ) : draft.failure.code === "revision_conflict" ? (
              <button onClick={() => setModal("reload")}>
                Reload latest draft
              </button>
            ) : (
              <button onClick={() => void draft.save()}>Retry save</button>
            )}
            <CopyWork value={copy} />
          </div>
        </div>
      )}
      <section className="publication-strip" aria-label="Publication">
        <div>
          <p
            className={
              profile.publicationId ? "status-published" : "status-draft"
            }
          >
            {publicationStatus({
              ...profile,
              revision: draft.dirty ? profile.revision + 1 : profile.revision,
            })}
          </p>
          <p className="muted">
            {unchanged
              ? "No unpublished changes."
              : "Draft edits stay private until you publish."}
          </p>
          {(draft.saving || photo.uploading || photoUnsaved) && (
            <p className="muted">
              {photo.uploading
                ? "Wait for the photo to finish uploading before publishing."
                : "Wait for the draft to finish saving before publishing."}
            </p>
          )}
        </div>
        <div className="actions">
          {profile.publicationId && (
            <a
              className="button quiet"
              href={`/@${profile.handle}`}
              target="_blank"
              rel="noopener"
            >
              View live<span className="sr-only"> (new tab)</span>
            </a>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              photo.uploading ||
              photoUnsaved ||
              draft.saving ||
              unchanged ||
              !!draft.failure ||
              !!pendingKind
            }
            onClick={requestPublish}
          >
            {profile.publicationId ? "Publish changes" : "Publish"}
          </button>
        </div>
      </section>
      <p className="sr-only" role="status">
        {message}
      </p>
      {operationError && !modal && (
        <div className="notice error" role="alert">
          <p>{operationError}</p>
          {uncertain && (
            <button
              onClick={() => setModal(operation.current?.kind || "publish")}
            >
              Check {pendingKind} status
            </button>
          )}
        </div>
      )}
      <div className="mobile-view-tabs" role="group" aria-label="Editor view">
        <button aria-pressed={view === "edit"} onClick={() => setView("edit")}>
          Edit
        </button>
        <button
          aria-pressed={view === "preview"}
          onClick={() => setView("preview")}
        >
          Private preview
        </button>
      </div>
      <div className="editor-columns" data-mobile-view={view}>
        <div className="edit-pane" ref={editPane}>
          <nav className="tabs" aria-label="Editor sections">
            {["content", "appearance", "settings"].map((item) => (
              <button
                key={item}
                aria-pressed={tab === item}
                onClick={() => setTab(item)}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </nav>
          <fieldset disabled={busy || !ready}>
            {tab === "content" && (
              <>
                <div className="content-toolbar" ref={contentTools}>
                  <h1>
                    Content{" "}
                    <span className="small muted">
                      {value.document.blocks.length}/100
                    </span>
                  </h1>
                  <div className="actions">
                    <button
                      id="add-content"
                      aria-describedby={
                        invalidField?.field === "add-content"
                          ? "content-error"
                          : undefined
                      }
                      onClick={() => add("link")}
                      disabled={value.document.blocks.length >= 100}
                    >
                      Add link
                    </button>
                    <button
                      onClick={() => add("text")}
                      disabled={value.document.blocks.length >= 100}
                    >
                      Add text
                    </button>
                  </div>
                  {invalidField?.field === "add-content" && (
                    <p id="content-error" className="field-error" role="alert">
                      {invalidField.message}
                    </p>
                  )}
                </div>
                <section className="edit-section identity-section">
                  <details
                    className="identity-disclosure"
                    open={identityOpen}
                    onToggle={(event) =>
                      setIdentityOpen(event.currentTarget.open)
                    }
                  >
                    <summary>
                      <span>Identity</span>
                      <strong>{value.document.name || "Add a name"}</strong>
                    </summary>
                    <div className="identity-body">
                      <Field
                        id="public-name"
                        error={
                          invalidField?.field === "public-name"
                            ? invalidField.message
                            : undefined
                        }
                        label="Public display name"
                        maxLength={80}
                        value={value.document.name}
                        required
                        onChange={(e) =>
                          documentChange({ name: e.target.value })
                        }
                        hint="Required to publish · up to 80 characters"
                      />
                      <div className="field">
                        <label htmlFor="profile-bio">Bio</label>
                        <textarea
                          id="profile-bio"
                          rows={3}
                          maxLength={300}
                          value={value.document.bio}
                          onChange={(e) =>
                            documentChange({ bio: e.target.value })
                          }
                          aria-describedby="profile-bio-hint"
                        />
                        <span id="profile-bio-hint" className="hint">
                          Up to 300 characters
                        </span>
                      </div>
                    </div>
                  </details>
                </section>
                <section
                  className="edit-section content-section"
                  aria-label="Content blocks"
                >
                  {undo && (
                    <div className="undo-row" role="status">
                      <span>Block removed from the draft.</span>
                      <button
                        onClick={() => {
                          const blocks = [...value.document.blocks];
                          blocks.splice(
                            Math.min(undo.index, blocks.length),
                            0,
                            undo.block,
                          );
                          documentChange({ blocks });
                          const restoredId = undo.block.id;
                          const position =
                            Math.min(undo.index, blocks.length - 1) + 1;
                          setUndo(null);
                          setMessage(
                            `Removed block restored at position ${position} of ${blocks.length}.`,
                          );
                          focusEditorElement(`block-${restoredId}`);
                        }}
                      >
                        Undo removal
                      </button>
                    </div>
                  )}
                  <ol className="block-list">
                    {value.document.blocks.map((block, index) => (
                      <li key={block.id}>
                        <details
                          className="block"
                          name={`content-blocks-${profile.id}`}
                        >
                          <summary id={`block-${block.id}`}>
                            <span className="block-type">
                              {String(index + 1).padStart(2, "0")} /{" "}
                              {block.type === "link" ? "Link" : "Text"}
                            </span>
                            {block.type === "link" && (
                              <LinkIcon label={block.label} />
                            )}
                            <strong>
                              {block.type === "link"
                                ? block.label || "Untitled link"
                                : block.text.split("\n")[0] || "Untitled text"}
                            </strong>
                            {!block.visible && (
                              <span className="small muted">Hidden</span>
                            )}
                          </summary>
                          <div className="block-body">
                            {block.type === "link" ? (
                              <>
                                <div className="link-fields">
                                  <Field
                                    id={`url-${block.id}`}
                                    error={
                                      invalidField?.field === `url-${block.id}`
                                        ? invalidField.message
                                        : undefined
                                    }
                                    label="Destination URL"
                                    value={block.url}
                                    type="url"
                                    maxLength={2048}
                                    onChange={(e) =>
                                      updateLinkUrl(block, e.target.value)
                                    }
                                    hint="HTTP(S) links. Recognized platforms fill the label."
                                  />
                                  <LinkLabelField
                                    id={block.id}
                                    error={
                                      invalidField?.field ===
                                      `label-${block.id}`
                                        ? invalidField.message
                                        : undefined
                                    }
                                    choice={
                                      linkChoices[block.id] ??
                                      choiceForLabel(block.label)
                                    }
                                    onChange={(choice, label) => {
                                      setAutomaticLinks((links) => ({
                                        ...links,
                                        [block.id]: false,
                                      }));
                                      setLinkChoices((choices) => ({
                                        ...choices,
                                        [block.id]: choice,
                                      }));
                                      updateBlock(block.id, {
                                        label,
                                      });
                                    }}
                                  />
                                </div>
                                <details className="media-disclosure">
                                  <summary>Link image (optional)</summary>
                                  <MediaField
                                    id={`image-${block.id}`}
                                    label="Link image URL"
                                    value={block.imageUrl}
                                    onChange={(imageUrl) =>
                                      updateBlock(block.id, { imageUrl })
                                    }
                                    error={
                                      invalidField?.field ===
                                      `image-${block.id}`
                                        ? invalidField.message
                                        : undefined
                                    }
                                  />
                                </details>
                              </>
                            ) : (
                              <Field
                                id={`text-${block.id}`}
                                error={
                                  invalidField?.field === `text-${block.id}`
                                    ? invalidField.message
                                    : undefined
                                }
                                label="Text content"
                                multiline
                                value={block.text}
                                maxLength={2000}
                                onChange={(e) =>
                                  updateBlock(block.id, {
                                    text: e.target.value,
                                  })
                                }
                                hint="Plain text · up to 2,000 characters"
                              />
                            )}
                            <div
                              className="block-actions"
                              role="group"
                              aria-label={`Block ${index + 1} actions`}
                            >
                              <button
                                disabled={index === 0}
                                onClick={() => move(index, -1)}
                              >
                                Move up
                              </button>
                              <button
                                disabled={
                                  index === value.document.blocks.length - 1
                                }
                                onClick={() => move(index, 1)}
                              >
                                Move down
                              </button>
                              <button
                                onClick={() => {
                                  updateBlock(block.id, {
                                    visible: !block.visible,
                                  });
                                  setMessage(
                                    `Block ${block.visible ? "hidden" : "shown"}.`,
                                  );
                                }}
                              >
                                {block.visible ? "Hide" : "Show"}
                              </button>
                              <button
                                className="danger"
                                onClick={() => {
                                  setUndo({ block, index });
                                  documentChange({
                                    blocks: value.document.blocks.filter(
                                      (item) => item.id !== block.id,
                                    ),
                                  });
                                  const adjacent =
                                    value.document.blocks[index + 1] ??
                                    value.document.blocks[index - 1];
                                  focusEditorElement(
                                    adjacent
                                      ? `block-${adjacent.id}`
                                      : "add-content",
                                  );
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ol>
                  {!value.document.blocks.length && (
                    <p className="notice">
                      No content blocks yet. Add a link or some text to begin.
                    </p>
                  )}
                </section>
              </>
            )}
            {tab === "appearance" && (
              <section className="edit-section">
                <h1>
                  <span className="section-number">01</span>Appearance
                </h1>
                <p className="muted section-note">
                  A quiet frame for your work. Every choice keeps your content
                  and its order.
                </p>
                <TemplatePicker
                  document={value.document}
                  onSelect={(template, name) => {
                    documentChange({
                      appearance: { ...value.document.appearance, template },
                    });
                    setMessage(
                      `${name} selected. Your content and images are unchanged.`,
                    );
                  }}
                />
                {resolveTemplate(value.document.appearance.template) !==
                  "original" && (
                  <p className="small muted section-note">
                    This template supplies its own colors. Your Original color
                    theme is saved.
                  </p>
                )}
                <details className="media-disclosure">
                  <summary>Profile images (optional)</summary>
                  <ProfilePhoto
                    name={value.document.name}
                    value={value.document.appearance.avatarUrl}
                    uploading={photo.uploading}
                    uploaded={photo.uploaded}
                    disabled={
                      busy ||
                      !!pendingKind ||
                      !!modal ||
                      draft.failure?.code === "unauthenticated"
                    }
                    blockedReason={
                      draft.failure?.code === "unauthenticated"
                        ? "Your session has expired. Cancel this adjustment and sign in to continue. Your current photo is unchanged."
                        : undefined
                    }
                    onUpload={(file, crop) => {
                      if (
                        busy ||
                        operation.current ||
                        modal ||
                        draft.failure?.code === "unauthenticated"
                      )
                        return;
                      setInvalidField(null);
                      void photo.upload(file, crop);
                    }}
                    onChange={(url) => {
                      if (
                        busy ||
                        photo.pending.current ||
                        operation.current ||
                        modal
                      )
                        return;
                      setInvalidField(null);
                      photo.setPhoto(url);
                    }}
                    error={
                      photo.error ||
                      (invalidField?.field === "avatar-url"
                        ? invalidField.message
                        : undefined)
                    }
                  />
                  <MediaField
                    id="cover-url"
                    label="Cover URL"
                    value={value.document.appearance.coverUrl}
                    onChange={(coverUrl) =>
                      documentChange({
                        appearance: { ...value.document.appearance, coverUrl },
                      })
                    }
                    error={
                      invalidField?.field === "cover-url"
                        ? invalidField.message
                        : undefined
                    }
                  />
                </details>
                {(
                  [
                    {
                      key: "theme",
                      label: "Color theme",
                      options: [
                        [
                          "warm",
                          "Cool white",
                          "White background, navy text, blue links.",
                        ],
                        [
                          "ink",
                          "Midnight navy",
                          "Navy background, cool white text, light blue links.",
                        ],
                      ],
                    },
                    {
                      key: "layout",
                      label: "Reading rhythm",
                      options: [
                        [
                          "editorial",
                          "Editorial",
                          "Room for each link and a generous pace.",
                        ],
                        [
                          "compact",
                          "Concise",
                          "A closer rhythm for a longer collection.",
                        ],
                      ],
                    },
                    {
                      key: "shape",
                      label: "Link corners",
                      options: [
                        ["soft", "Soft", "Curves suited to your template."],
                        [
                          "square",
                          "Square",
                          "Straight edges, like a printed index.",
                        ],
                      ],
                    },
                  ] as const
                )
                  .filter(
                    (group) =>
                      group.key !== "theme" ||
                      resolveTemplate(value.document.appearance.template) ===
                        "original",
                  )
                  .map((group) => (
                    <fieldset className="appearance-group" key={group.key}>
                      <legend>{group.label}</legend>
                      <div className="choice-list">
                        {group.options.map(([option, label, description]) => (
                          <label className="choice" key={option}>
                            <input
                              type="radio"
                              name={group.key}
                              value={option}
                              checked={
                                value.document.appearance[group.key] === option
                              }
                              onChange={() =>
                                documentChange({
                                  appearance: {
                                    ...value.document.appearance,
                                    [group.key]: option,
                                  },
                                })
                              }
                            />
                            <span>
                              <strong>{label}</strong>
                              <small>{description}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
              </section>
            )}
            {tab === "settings" && (
              <section className="edit-section">
                <h1>
                  <span className="section-number">01</span>Settings
                </h1>
                <Field
                  label="Owner-only label"
                  maxLength={80}
                  value={value.label}
                  onChange={(e) => change({ ...value, label: e.target.value })}
                  hint="Only visible in your workspace. Never shown on the public page."
                />
                <Field
                  label="Public handle"
                  value={value.handle}
                  maxLength={30}
                  readOnly={!!profile.firstPublishedAt}
                  onChange={(e) =>
                    change({ ...value, handle: e.target.value.toLowerCase() })
                  }
                  hint={
                    profile.firstPublishedAt
                      ? "Fixed after the first publication, even while unpublished."
                      : "3–30 lowercase letters, digits, or hyphens. Reserved only after a successful save."
                  }
                />
                <section className="settings-section">
                  <h2>Publication</h2>
                  <p>
                    {publicationStatus(profile)}. Your draft and handle remain
                    here when you unpublish.
                  </p>
                  {profile.publicationId ? (
                    <button
                      className="danger"
                      disabled={!!pendingKind}
                      onClick={() => {
                        setOperationError("");
                        setModal("unpublish");
                      }}
                    >
                      Unpublish
                    </button>
                  ) : (
                    <p>Use Publish above when you are ready.</p>
                  )}
                </section>
              </section>
            )}
          </fieldset>
        </div>
        <aside className="preview-pane" aria-label="Private draft preview">
          <div className="preview-heading">
            <h2>Draft preview</h2>
            <span className="small muted">Private</span>
          </div>
          <p className="small muted">
            Visitors still see the last published snapshot.
            <br />
            /@{value.handle}
          </p>
          <div className="preview-frame">
            <ProfileRenderer document={value.document} preview />
          </div>
        </aside>
      </div>
      {modal && (
        <Dialog
          title={
            modal === "publish"
              ? "Publish this page?"
              : modal === "unpublish"
                ? "Unpublish this page?"
                : modal === "reload"
                  ? "Reload the saved draft?"
                  : modal === "leave"
                    ? "Your changes have not saved"
                    : modal === "reauth"
                      ? "Sign in to keep editing"
                      : "Your published page"
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {modal === "reauth" ? (
            <>
              <p className="notice">
                Your unsaved work remains in this tab. Sign in with the same
                owner account to continue.
              </p>
              <CopyWork value={copy} />
              <OtpForm initialEmail={email} onVerified={reauthenticated} />
            </>
          ) : modal === "success" ? (
            <>
              <p>
                {profile.document.name} · /@{profile.handle}
              </p>
              <Field label="Public URL" readOnly value={publicUrl} />
              <CopyWork value={publicUrl} label="Copy link" />
              <div className="dialog-actions">
                <button data-safe-focus onClick={() => setModal(null)}>
                  Back to editing
                </button>
                <a
                  className="button primary"
                  href={`/@${profile.handle}`}
                  target="_blank"
                  rel="noopener"
                >
                  View live<span className="sr-only"> (new tab)</span>
                </a>
              </div>
            </>
          ) : modal === "leave" ? (
            <>
              <p>
                Your changes are still in this tab. Stay to retry saving, or
                explicitly discard them before leaving.
              </p>
              <CopyWork value={copy} />
              <div className="dialog-actions">
                <button data-safe-focus onClick={() => setModal(null)}>
                  Stay here
                </button>
                <button
                  onClick={() => {
                    reloadDraft(profile);
                    window.location.assign(navigation.current);
                  }}
                >
                  Discard & continue
                </button>
              </div>
            </>
          ) : modal === "reload" ? (
            <>
              <p>
                This tab’s unsaved changes will be discarded. Copy them before
                loading the latest saved version.
              </p>
              <CopyWork value={copy} />
              {operationError && <p role="alert">{operationError}</p>}
              <div className="dialog-actions">
                <button
                  data-safe-focus
                  onClick={() => setModal(null)}
                  disabled={busy}
                >
                  Keep editing
                </button>
                <button onClick={() => void reload()} disabled={busy}>
                  {busy ? "Loading…" : "Discard & reload"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                <strong>{value.document.name || "Untitled profile"}</strong>
                <br />
                /@{value.handle}
              </p>
              <p className="section-note">
                {modal === "publish"
                  ? "This publishes the saved draft as a new snapshot. The handle becomes fixed after the first publication. Later draft edits stay private."
                  : "Visitors will see an unavailable page. Your draft and handle stay here, and the published slot becomes available."}
              </p>
              {operationError && (
                <p className="notice error" role="alert">
                  {operationError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  data-safe-focus
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Keep editing
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    (modal === "publish" && (photo.uploading || photoUnsaved))
                  }
                  onClick={() => void mutate(modal)}
                >
                  {busy
                    ? "Please wait…"
                    : uncertain
                      ? `Check ${pendingKind || modal} status`
                      : modal === "publish"
                        ? "Publish snapshot"
                        : "Unpublish page"}
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </main>
  );
}
