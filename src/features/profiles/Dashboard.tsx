"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/Dialog";
import { Field } from "@/components/Field";
import { CopyWork } from "@/components/CopyWork";
import { api, unresolvedRequest } from "@/lib/client-api";
import {
  selectDashboardProfiles,
  type PublishedPreview as PreviewState,
} from "./dashboard-selection";
import { PublishedPreview } from "./PublishedPreview";
import {
  createSchema,
  initials,
  publicationStatus,
  type Workspace,
  type Profile,
} from "./model";
const subscribeReady = () => () => {};
export function Dashboard({
  workspace,
  query,
  filter,
  selectedId,
  preview,
}: {
  workspace: Workspace;
  query: string;
  filter: string;
  selectedId?: string;
  preview: PreviewState;
}) {
  const router = useRouter();
  const enhanced = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false,
  );
  const [pending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const selectedPreviewButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1100px)");
    const closeOnDesktop = () => {
      if (!desktop.matches || !previewOpen) return;
      setPreviewOpen(false);
      requestAnimationFrame(() =>
        selectedPreviewButton.current?.focus({ preventScroll: true }),
      );
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [previewOpen]);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState({ label: "", name: "", handle: "" });
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const retry = useRef<{ operationId: string; body: typeof values } | null>(
    null,
  );
  const published = workspace.profiles.filter((p) => p.publicationId).length;
  const { profiles, selected } = selectDashboardProfiles(
    workspace.profiles,
    query,
    filter,
    selectedId,
  );
  const back = `/app/profiles?${new URLSearchParams({ q: query, filter, ...(selected ? { selected: selected.id } : {}) }).toString()}`;
  function navigate(event: FormEvent<HTMLFormElement>, openPreview = false) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const params = new URLSearchParams();
    new FormData(event.currentTarget, submitter).forEach((value, key) => {
      if (typeof value === "string") params.set(key, value);
    });
    if (openPreview && !window.matchMedia("(min-width: 1100px)").matches)
      setPreviewOpen(true);
    startTransition(() =>
      router.push(`/app/profiles?${params.toString()}`, { scroll: false }),
    );
  }
  function refreshPreview() {
    startTransition(() => router.refresh());
  }
  const previewBody = (
    <>
      <p className="desk-preview-help">
        {preview.status === "private"
          ? "This profile has no published version."
          : preview.status === "none"
            ? "Select a profile to inspect its published version."
            : "The last published version. Links are disabled."}
      </p>
      {selected && !pending && (
        <p className="desk-preview-owner">
          {selected.label} <span>/@{selected.handle}</span>
        </p>
      )}
      <div aria-busy={pending}>
        <PublishedPreview
          selected={selected}
          preview={preview}
          pending={pending}
          onRefresh={refreshPreview}
        />
      </div>
    </>
  );
  function update(key: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setAvailability("");
    setError("");
    retry.current = null;
  }
  async function create() {
    if (busy) return;
    setError("");
    if (!retry.current) {
      const parsed = createSchema.safeParse(values);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      retry.current = { operationId: crypto.randomUUID(), body: parsed.data };
    }
    setBusy(true);
    try {
      const profile = await api<Profile>("/api/profiles", retry.current);
      window.location.assign(
        `/app/profiles/${profile.id}/edit?back=${encodeURIComponent(back)}`,
      );
    } catch (error) {
      setError((error as Error).message);
      const unknown = unresolvedRequest(error);
      setUncertain(unknown);
      if (!unknown) retry.current = null;
      setBusy(false);
    }
  }
  async function check() {
    setBusy(true);
    try {
      const result = await api<{ available: boolean }>(
        `/api/profiles/handle?handle=${encodeURIComponent(values.handle)}`,
      );
      setAvailability(
        result.available
          ? "This handle is available. It is reserved only when creation succeeds."
          : "This handle is already in use.",
      );
    } catch (error) {
      setAvailability((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="shell profile-desk" data-enhanced={enhanced}>
      <section className="desk-index" aria-label="Profile workspace">
        <div className="page-intro">
          <div>
            <h1>Profiles</h1>
            <p>
              A space for each part of your work.
              <br />
              Choose a page, make it yours, and share it.
            </p>
          </div>
          <div className="desk-create">
            <button className="primary" onClick={() => setCreating(true)}>
              Create profile
            </button>
            <p className="small muted usage">
              {published} of {workspace.publishedLimit} published profiles
            </p>
          </div>
        </div>
        <div className="search-tools">
          <form
            className="search-field"
            action="/app/profiles"
            method="get"
            onSubmit={navigate}
          >
            <input type="hidden" name="filter" value={filter} />
            {selected && (
              <input type="hidden" name="selected" value={selected.id} />
            )}
            <label htmlFor="profile-search">Find a profile</label>
            <div className="actions">
              <input
                id="profile-search"
                name="q"
                type="search"
                key={query}
                defaultValue={query}
                placeholder="Name, owner label, or handle"
              />
              <button type="submit">Search</button>
            </div>
          </form>
          <form action="/app/profiles" method="get" onSubmit={navigate}>
            <input type="hidden" name="q" value={query} />
            {selected && (
              <input type="hidden" name="selected" value={selected.id} />
            )}
            <fieldset className="filters">
              <legend className="sr-only">Filter profiles</legend>
              {[
                ["all", "All"],
                ["published", "Published"],
                ["private", "Not published"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  name="filter"
                  value={value}
                  type="submit"
                  aria-pressed={filter === value}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </form>
        </div>
        <div className="desk-mobile-preview">
          <button disabled={!selected} onClick={() => setPreviewOpen(true)}>
            Show published preview
          </button>
          {!selected && (
            <p className="small muted">
              Choose a profile after adjusting your search or filters.
            </p>
          )}
        </div>
        {!profiles.length ? (
          <div className="empty-state">
            <h2>
              {workspace.profiles.length
                ? "No matching profiles"
                : "A page for your next chapter"}
            </h2>
            <p>
              {workspace.profiles.length
                ? "Try another name or handle, or clear your filters."
                : "Each profile is its own page, with a name, links, and a little of your character."}
            </p>
            {workspace.profiles.length ? (
              <a className="button" href="/app/profiles">
                Clear filters
              </a>
            ) : (
              <button className="primary" onClick={() => setCreating(true)}>
                Create your first profile
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="list-caption">
              <span>
                {profiles.length}{" "}
                {profiles.length === 1 ? "profile" : "profiles"}
              </span>
              <span>Private drafts & published snapshots</span>
            </div>
            <ul className="profile-list">
              {profiles.map((profile) => (
                <li
                  key={profile.id}
                  className={`profile-row${profile.id === selected?.id ? " is-selected" : ""}`}
                >
                  <div className="initials" aria-hidden="true">
                    {initials(profile.name)}
                  </div>
                  <div>
                    <h2>{profile.label}</h2>
                    <div className="profile-meta">
                      <span>
                        Public name: {profile.name || "Untitled profile"}
                      </span>
                      <span>/@{profile.handle}</span>
                    </div>
                    <p
                      className={`profile-status ${profile.publicationId ? "status-published" : "status-draft"}`}
                    >
                      {publicationStatus(profile)}
                    </p>
                    <p className="small muted">
                      Edited{" "}
                      {new Date(profile.updatedAt).toLocaleString("en", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </p>
                  </div>
                  <div className="actions">
                    <form
                      action="/app/profiles"
                      method="get"
                      onSubmit={(event) => navigate(event, true)}
                    >
                      <input type="hidden" name="q" value={query} />
                      <input type="hidden" name="filter" value={filter} />
                      <button
                        ref={
                          profile.id === selected?.id
                            ? selectedPreviewButton
                            : undefined
                        }
                        type="submit"
                        name="selected"
                        value={profile.id}
                        aria-pressed={profile.id === selected?.id}
                        aria-label={`${profile.id === selected?.id ? "Selected" : "Preview"}: ${profile.label}`}
                      >
                        {profile.id === selected?.id ? "Selected" : "Preview"}
                      </button>
                    </form>
                    <a
                      className="button"
                      href={`/app/profiles/${profile.id}/edit?back=${encodeURIComponent(back)}`}
                    >
                      Edit profile
                    </a>
                    {profile.publicationId && (
                      <a className="button quiet" href={`/@${profile.handle}`}>
                        View live
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <footer className="page-footer">
          <p className="small muted">
            Drafts don’t use published slots.
            <br />
            Draft edits stay private until you publish.
          </p>
        </footer>
      </section>
      <aside
        className="desk-preview"
        aria-label="Published preview"
        hidden={previewOpen}
      >
        <h2>Published preview</h2>
        {!previewOpen && previewBody}
      </aside>
      <p className="sr-only" role="status">
        {pending
          ? "Loading published preview…"
          : selected
            ? `${preview.status === "ready" ? "Published preview loaded" : "Preview updated"} for ${selected.label}`
            : "No profile selected"}
      </p>
      {previewOpen && (
        <Dialog
          title="Published preview"
          className="desk-preview-dialog"
          onClose={() => setPreviewOpen(false)}
        >
          {previewBody}
        </Dialog>
      )}
      {creating && (
        <Dialog
          title="A new page for your work"
          onClose={() => {
            if (!busy) setCreating(false);
          }}
        >
          <p className="muted">
            Create a private draft. Nothing is published yet.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <fieldset disabled={busy || uncertain}>
              <Field
                label="Owner-only label"
                value={values.label}
                maxLength={80}
                required
                onChange={(e) => update("label", e.target.value)}
                hint="A client or project name for your workspace."
              />
              <Field
                label="Public display name"
                value={values.name}
                maxLength={80}
                required
                onChange={(e) => update("name", e.target.value)}
              />
              <Field
                label="Public handle"
                value={values.handle}
                maxLength={30}
                autoCapitalize="none"
                spellCheck={false}
                required
                onChange={(e) => update("handle", e.target.value.toLowerCase())}
                hint="3–30 lowercase letters, digits, or hyphens."
              />
              <button type="button" onClick={() => void check()}>
                Check availability
              </button>
              <p className="small" role="status">
                {availability}
              </p>
            </fieldset>
            {error && (
              <div className="notice error" role="alert">
                <p>
                  {uncertain
                    ? "Could not confirm creation. Check status using the same request before trying a different handle."
                    : error}
                </p>
                <p>{uncertain ? error : ""}</p>
              </div>
            )}
            {uncertain && <CopyWork value={JSON.stringify(values, null, 2)} />}
            <div className="dialog-actions">
              <button
                type="button"
                data-safe-focus
                onClick={() => setCreating(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="primary" type="submit" disabled={busy}>
                {busy
                  ? "Creating…"
                  : uncertain
                    ? "Check creation status"
                    : "Create private draft"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
