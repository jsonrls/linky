(() => {
  "use strict";

  const STORAGE_KEY = "linky-warm-editorial-demo-v1";
  const app = document.querySelector("#app");
  const dialog = document.querySelector("#dialog");
  const feedback = document.querySelector("#feedback");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const id = () => globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ui = { query: "", filter: "all", tab: "content", mobile: "edit", review: "normal", openBlocks: new Set(["studio-link-1"]), undo: null };
  let saveTimer;
  let feedbackTimer;
  let dirty = false;
  let saveError = "";
  let conflict = false;
  let baseline = null;
  let dialogTrigger = null;
  let currentHash = location.hash || "#/profiles";

  function demoDraft(name, bio, prefix) {
    return {
      name, bio, appearance: { theme: "warm", layout: "editorial", shape: "soft" },
      blocks: [
        { id: `${prefix}-link-1`, type: "link", label: "Selected work", url: "https://example.com/work", visible: true },
        { id: `${prefix}-link-2`, type: "link", label: "Arrange a conversation", url: "https://example.com/conversation", visible: true },
        { id: `${prefix}-art`, type: "art", text: "Studies in everyday things", caption: "Demo artwork placeholder · no image uploaded", visible: true },
        { id: `${prefix}-text`, type: "text", text: "Thoughtful identities, printed matter, and small details.\nAn independent practice, open to good conversations.", visible: true },
        { id: `${prefix}-contact`, type: "contact", text: "A note to begin", label: "Send demo inquiry", visible: true }
      ]
    };
  }

  function initialState() {
    const studio = demoDraft("Mara Ellis", "Independent designer working across identity, print, and the spaces in between.", "studio");
    const journal = demoDraft("The Sunday Table", "Notes on food, familiar places, and gathering around a table.", "table");
    journal.blocks = journal.blocks.filter((block) => block.type === "link" || block.type === "text");
    journal.blocks[0].label = "Read the latest edition";
    journal.blocks[1].label = "Notes from the kitchen";
    journal.blocks[2].text = "A small collection of recipes and stories worth returning to. Fictional content for design review.";
    const project = demoDraft("Field Notes", "An unfinished collection of observations, objects, and ideas.", "field");
    project.blocks = project.blocks.slice(0, 1);
    const snapshot = clone(studio);
    snapshot.bio = "Independent designer. Identities, printed matter, and considered details.";
    return {
      version: 1, revision: 0,
      profiles: [
        { id: "mara", label: "Mara / independent practice", handle: "mara-ellis", draft: studio, snapshot, published: true, everPublished: true, edited: "Demo starting draft" },
        { id: "sunday", label: "Sunday / editorial project", handle: "sunday-table", draft: journal, snapshot: clone(journal), published: true, everPublished: true, edited: "Demo starting draft" },
        { id: "field", label: "Field / work in progress", handle: "field-notes", draft: project, snapshot: null, published: false, everPublished: false, edited: "Demo starting draft" }
      ]
    };
  }

  function validDraft(draft) {
    const text = (value, max) => typeof value === "string" && value.length <= max;
    return draft && text(draft.name, 80) && text(draft.bio, 300) &&
      ["warm", "ink"].includes(draft.appearance?.theme) &&
      ["editorial", "compact"].includes(draft.appearance?.layout) &&
      ["soft", "square"].includes(draft.appearance?.shape) &&
      Array.isArray(draft.blocks) && draft.blocks.length <= 30 &&
      draft.blocks.every((block) => text(block.id, 100) && typeof block.visible === "boolean" &&
        ["link", "art", "text", "contact"].includes(block.type) &&
        (block.label === undefined || text(block.label, 120)) &&
        (block.url === undefined || text(block.url, 2000)) &&
        (block.text === undefined || text(block.text, 2000)) &&
        (block.caption === undefined || text(block.caption, 300))) &&
      new Set(draft.blocks.map((block) => block.id)).size === draft.blocks.length;
  }

  function validState(value) {
    return value && value.version === 1 && Number.isSafeInteger(value.revision) && value.revision >= 0 &&
      Array.isArray(value.profiles) && value.profiles.length <= 30 &&
      value.profiles.every((profile) => typeof profile.id === "string" && profile.id.length <= 100 &&
        typeof profile.label === "string" && profile.label.length <= 80 &&
        typeof profile.handle === "string" && /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(profile.handle) &&
        typeof profile.published === "boolean" && typeof profile.everPublished === "boolean" &&
        validDraft(profile.draft) && (profile.snapshot === null || validDraft(profile.snapshot)) &&
        (!profile.published || profile.snapshot !== null)) &&
      new Set(value.profiles.map((profile) => profile.id)).size === value.profiles.length &&
      new Set(value.profiles.map((profile) => profile.handle)).size === value.profiles.length;
  }

  function load() {
    try {
      baseline = localStorage.getItem(STORAGE_KEY);
      if (baseline) {
        const stored = JSON.parse(baseline);
        if (!validState(stored)) throw new Error("Unrecognized demo data");
        return stored;
      }
    } catch {
      saveError = "Stored demo data could not be read. Use Reset demo to start again, or keep exploring in this tab.";
    }
    return initialState();
  }

  let state = load();
  let savedState = clone(state);

  function announce(message) {
    document.querySelector("#announcer").textContent = message;
  }

  function toast(message) {
    clearTimeout(feedbackTimer);
    feedback.innerHTML = `${escape(message)}<button type="button" data-action="dismiss-feedback" aria-label="Dismiss message">×</button>`;
    feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 7000);
  }

  function persist() {
    clearTimeout(saveTimer);
    if (ui.review === "save-error") {
      saveError = "Review state: browser save failed. Your edits remain in this tab; the published demo is unchanged.";
      updateSaveState();
      return false;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) !== baseline) {
        conflict = true;
        throw new Error("Another tab changed this demo. Reload the saved demo before continuing.");
      }
      state.revision += 1;
      const raw = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, raw);
      baseline = raw;
      savedState = clone(state);
      dirty = false;
      saveError = "";
      updateSaveState();
      return true;
    } catch (error) {
      saveError = conflict ? error.message : "Could not save to this browser. Your changes remain in this tab. Check browser storage and retry.";
      updateSaveState();
      return false;
    }
  }

  function markChanged(profile) {
    dirty = true;
    if (profile) profile.edited = "Edited in this demo session";
    clearTimeout(saveTimer);
    updateSaveState();
    saveTimer = setTimeout(persist, 450);
  }

  function route(hash = location.hash) {
    const parts = hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "edit") return { screen: "editor", profile: state.profiles.find((profile) => profile.id === parts[1]) };
    if (parts[0]?.startsWith("@")) return { screen: "public", profile: state.profiles.find((profile) => profile.handle === parts[0].slice(1)) };
    return { screen: "dashboard" };
  }

  function activeProfile() { return route(currentHash).profile; }
  function changed(profile) { return !profile.snapshot || JSON.stringify(profile.draft) !== JSON.stringify(profile.snapshot); }
  function publicationStatus(profile) {
    if (profile.published) return changed(profile) ? "Published demo · unpublished changes" : "Published demo";
    return profile.everPublished ? "Unpublished demo" : "Private draft";
  }
  function statusClass(profile) { return profile.published ? changed(profile) ? "status-changes" : "status-published" : "status-draft"; }
  function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0] || "").join("").toUpperCase() || "?"; }
  function demoURL(profile) { return `${location.href.split("#")[0]}#/@${profile.handle}`; }
  function safeURL(value) {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
    catch { return false; }
  }
  function field({ name, label, value, max = 80, multiline = false, hint = "", attrs = "" }) {
    const key = `field-${name.replace(/[^a-z0-9-]/gi, "-")}`;
    const description = hint && !attrs.includes("aria-describedby") ? `aria-describedby="${key}-hint"` : "";
    return `<div class="field"><label for="${key}">${escape(label)}</label>${multiline
      ? `<textarea id="${key}" name="${escape(name)}" maxlength="${max}" ${attrs} ${description}>${escape(value)}</textarea>`
      : `<input id="${key}" name="${escape(name)}" value="${escape(value)}" maxlength="${max}" ${attrs} ${description}>`}
      ${hint ? `<span class="hint" id="${key}-hint">${escape(hint)}</span>` : ""}</div>`;
  }

  function masthead() {
    return `<header class="masthead"><a class="wordmark" href="#/profiles" aria-label="Linky demo profiles">Linky<span class="small muted">&nbsp; / &nbsp;workspace</span></a><span class="account-label">Personal workspace<br>Demo account</span></header>`;
  }

  function reviewControls(screen) {
    const options = screen === "dashboard" ? [["normal", "Normal demo"], ["loading", "Loading list"], ["empty", "Empty workspace"], ["load-error", "List error"]] : [["normal", "Normal demo"], ["save-error", "Save failure"]];
    return `<details class="review-tools"><summary>Prototype review states</summary><label class="small" for="review-state">Show a bounded review state</label><select id="review-state">${options.map(([value, label]) => `<option value="${value}" ${ui.review === value ? "selected" : ""}>${label}</option>`).join("")}</select><p class="small muted" style="margin-top:12px">Visual review controls. These do not simulate a real service.</p></details>`;
  }

  function renderDashboard() {
    document.title = "Profiles · Linky design prototype";
    app.innerHTML = `<div class="shell">${masthead()}<main id="main" tabindex="-1"><div class="page-intro"><div><div class="eyebrow">01 / Your workspace</div><h1>Profiles</h1><p>A space for each part of your work.<br>Choose a page, make it yours, and share it.</p></div><button class="primary" data-action="create">Create profile</button></div>
      ${saveNotice()}
      <div class="search-tools"><div class="search-field"><label for="profile-search">Find a profile</label><input id="profile-search" type="search" placeholder="Name, owner label, or handle" value="${escape(ui.query)}"></div><div class="filters" role="group" aria-label="Filter profiles">${[["all", "All"], ["published", "Published"], ["private", "Not published"]].map(([value, label]) => `<button data-action="filter" data-value="${value}" aria-pressed="${ui.filter === value}">${label}</button>`).join("")}</div></div>
      <div id="profile-results"></div></main><footer class="page-footer"><p class="small muted">Fictional profiles for design review.<br>Publishing creates a snapshot in this browser only.</p><button class="quiet" data-action="reset">Reset demo</button>${reviewControls("dashboard")}</footer></div>`;
    renderProfileList();
  }

  function renderProfileList() {
    const target = document.querySelector("#profile-results");
    if (!target) return;
    if (ui.review === "loading") { target.innerHTML = `<div class="empty-state" role="status"><h2>Loading demo profiles…</h2><p>The list area stays available while profiles load.</p><button data-action="normal-state">Finish review state</button></div>`; return; }
    if (ui.review === "load-error") { target.innerHTML = `<div class="empty-state" role="alert"><h2>We couldn’t load the profiles</h2><p>This is a review state. Your browser demo data is still here.</p><button data-action="normal-state" class="primary">Retry demo list</button></div>`; return; }
    const query = ui.query.trim().toLowerCase();
    const profiles = ui.review === "empty" ? [] : state.profiles.filter((profile) =>
      `${profile.label} ${profile.draft.name} ${profile.handle}`.toLowerCase().includes(query) &&
      (ui.filter === "all" || (ui.filter === "published" ? profile.published : !profile.published)));
    const isEmpty = ui.review === "empty" || !state.profiles.length;
    if (!profiles.length) {
      target.innerHTML = `<div class="empty-state" role="status"><h2>${isEmpty ? "A page for your next chapter" : "No matching profiles"}</h2><p>${isEmpty ? "Each profile is its own page, with a name, links, and a little of your character." : "Try another name or handle, or clear your filters."}</p><button class="primary" data-action="${isEmpty ? "create" : "clear-filters"}">${isEmpty ? "Create your first profile" : "Clear filters"}</button>${ui.review === "empty" ? '<button class="quiet" data-action="normal-state">Return to demo profiles</button>' : ""}</div>`;
      return;
    }
    target.innerHTML = `<div class="list-caption"><span>${profiles.length} demo ${profiles.length === 1 ? "profile" : "profiles"}</span><span>Private drafts & published snapshots</span></div><ul class="profile-list">${profiles.map((profile) => `<li class="profile-row"><div class="initials" aria-hidden="true">${escape(initials(profile.draft.name))}</div><div><h2>${escape(profile.label || "Untitled profile")}</h2><div class="profile-meta"><span>Public name: ${escape(profile.draft.name || "Untitled profile")}</span><span>/@${escape(profile.handle)}</span></div><p class="profile-status ${statusClass(profile)}">${publicationStatus(profile)}</p><p class="small muted">${escape(profile.edited)}</p></div><div class="actions"><a class="button" href="#/edit/${escape(profile.id)}" aria-label="Edit ${escape(profile.draft.name)}">Edit profile</a>${profile.published ? `<a class="button quiet" href="#/@${escape(profile.handle)}">View live demo</a><button class="quiet" data-action="share" data-profile="${escape(profile.id)}">Share</button>` : '<span class="small muted">Share after demo publication</span>'}</div></li>`).join("")}</ul>`;
  }

  function saveNotice() {
    if (!saveError) return "";
    return `<div class="notice error" role="alert"><p>${escape(saveError)}</p><div class="actions">${conflict ? '<button data-action="reload-demo">Reload saved demo</button>' : '<button data-action="retry-save">Retry browser save</button>'}</div></div>`;
  }

  function publishStrip(profile) {
    const same = profile.published && !changed(profile);
    return `<div><p class="${statusClass(profile)}">${publicationStatus(profile)}</p><p class="muted">${same ? "No unpublished changes." : "Draft edits stay private until you publish a demo snapshot."}</p></div><div class="actions">${profile.published ? `<a class="button quiet" href="#/@${escape(profile.handle)}">View live demo</a>` : ""}<button class="primary" data-action="publish" ${same || dirty || saveError ? "disabled" : ""}>${profile.published ? "Publish demo changes" : "Publish demo"}</button></div>`;
  }

  function renderEditor(profile) {
    document.title = `${profile.draft.name || "Untitled"} · Draft editor · Linky demo`;
    app.innerHTML = `<div class="editor-shell"><header class="editor-header"><a class="back-link" href="#/profiles">‹ &nbsp; Profiles</a><div class="switcher"><label for="profile-switcher">Editing a demo profile</label><select id="profile-switcher" aria-describedby="active-profile-handle">${state.profiles.map((item) => `<option value="${escape(item.id)}" ${item.id === profile.id ? "selected" : ""}>${escape(item.label)} · /@${escape(item.handle)}</option>`).join("")}</select><p class="switcher-handle small muted" id="active-profile-handle">/@${escape(profile.handle)}</p></div><span class="save-state" id="save-status" role="status"></span></header>
      <div id="save-notice">${saveNotice()}</div><div class="publication-strip" id="publication-strip">${publishStrip(profile)}</div>
      <main id="main" tabindex="-1"><div class="mobile-view-tabs" role="group" aria-label="Editor view"><button data-action="mobile-view" data-value="edit" aria-pressed="${ui.mobile === "edit"}">Edit</button><button data-action="mobile-view" data-value="preview" aria-pressed="${ui.mobile === "preview"}">Private preview</button></div><div class="editor-columns" data-mobile-view="${ui.mobile}"><div class="edit-pane"><nav class="tabs" aria-label="Editor sections">${["content", "appearance", "settings"].map((tab) => `<button data-action="editor-tab" data-value="${tab}" aria-pressed="${ui.tab === tab}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join("")}</nav><div id="editor-content">${editorContent(profile)}</div></div><aside class="preview-pane" aria-label="Private draft preview"><div class="preview-heading"><h2>Draft preview</h2><span class="small muted">Private · demo</span></div><p class="small muted">Visitors still see the last published snapshot.<br><span id="preview-handle">/@${escape(profile.handle)}</span></p><div class="preview-frame" id="draft-preview">${renderProfile(profile.draft, true)}</div></aside></div></main><footer class="page-footer"><p class="small muted">Design prototype. No real publishing, uploads, payments, or inbox.</p>${reviewControls("editor")}</footer></div>`;
    updateSaveState();
  }

  function editorContent(profile) {
    if (ui.tab === "appearance") return appearanceEditor(profile);
    if (ui.tab === "settings") return settingsEditor(profile);
    return `<section class="edit-section" aria-labelledby="identity-heading"><div class="section-heading"><h1 id="identity-heading"><span class="section-number">01</span>Identity</h1></div><p class="small muted">Introduce the person or practice behind this page.</p>${field({ name: "name", label: "Public display name", value: profile.draft.name, max: 80, hint: "Required · up to 80 characters", attrs: 'data-draft="name" required' })}${field({ name: "bio", label: "Bio", value: profile.draft.bio, max: 300, multiline: true, hint: "Up to 300 characters", attrs: 'data-draft="bio"' })}<p class="small muted" style="margin-top:16px">Demo initials stand in for a profile image. Uploads are outside this prototype.</p></section><section class="edit-section" style="padding-top:0" aria-labelledby="blocks-heading"><div class="section-heading"><h2 id="blocks-heading"><span class="section-number">02</span>Content blocks</h2><button data-action="add-link" ${profile.draft.blocks.length >= 30 ? "disabled" : ""}>Add link</button></div><p class="small muted">Open a block to edit it. Order here becomes the reading order.</p><div id="undo-slot">${undoMarkup()}</div><ol class="block-list">${profile.draft.blocks.map((block, index) => blockEditor(block, index, profile.draft.blocks.length)).join("")}</ol>${!profile.draft.blocks.length ? '<div class="notice">No content blocks yet. Add a link to begin.</div>' : ""}</section>`;
  }

  function blockEditor(block, index, count) {
    const type = { link: "Link", art: "Artwork placeholder", text: "Text", contact: "Demo inquiry form" }[block.type];
    const title = block.label || block.text || "Untitled link";
    const attrs = `data-block="${escape(block.id)}"`;
    let fields = "";
    if (block.type === "link") fields = field({ name: `${block.id}-label`, label: "Link label", value: block.label, max: 120, attrs: `${attrs} data-key="label" required` }) + field({ name: `${block.id}-url`, label: "Destination URL", value: block.url, max: 2000, hint: "HTTP or HTTPS only. Demo destinations open an information dialog.", attrs: `${attrs} data-key="url" type="url" required` });
    if (block.type === "text") fields = field({ name: `${block.id}-text`, label: "Text content", value: block.text, max: 2000, multiline: true, hint: "Plain text · up to 2,000 characters", attrs: `${attrs} data-key="text"` });
    if (block.type === "art") fields = field({ name: `${block.id}-text`, label: "Placeholder title", value: block.text, max: 120, attrs: `${attrs} data-key="text"` }) + '<p class="small muted" style="margin-top:16px">A labeled placeholder reserves space for future artwork. No upload or generated image is included.</p>';
    if (block.type === "contact") fields = field({ name: `${block.id}-text`, label: "Form heading", value: block.text, max: 120, attrs: `${attrs} data-key="text"` }) + field({ name: `${block.id}-label`, label: "Demo submit label", value: block.label, max: 120, attrs: `${attrs} data-key="label"` }) + '<p class="small muted" style="margin-top:16px">Demo only. No messages are stored or delivered, and no paid entitlement is implied.</p>';
    return `<li><details class="block" data-block-id="${escape(block.id)}" ${ui.openBlocks.has(block.id) ? "open" : ""}><summary><span class="block-type">${String(index + 1).padStart(2, "0")} / ${type}</span><strong data-block-title="${escape(block.id)}">${escape(title.split("\n")[0])}</strong>${block.visible ? "" : '<span class="small muted">Hidden</span>'}</summary><div class="block-body">${fields}<div class="block-actions" role="group" aria-label="${escape(type)} block ${index + 1} actions"><button data-action="move-up" data-id="${escape(block.id)}" ${index === 0 ? "disabled" : ""}>Move up</button><button data-action="move-down" data-id="${escape(block.id)}" ${index === count - 1 ? "disabled" : ""}>Move down</button><button data-action="toggle-block" data-id="${escape(block.id)}">${block.visible ? "Hide" : "Show"}</button><button data-action="remove-block" data-id="${escape(block.id)}" class="danger">Remove</button></div></div></details></li>`;
  }

  function undoMarkup() { return ui.undo ? '<div class="undo-row" role="status"><span class="small">Block removed from the draft.</span><button data-action="undo">Undo removal</button></div>' : ""; }

  function appearanceEditor(profile) {
    const current = profile.draft.appearance;
    function choices(key, options) {
      return `<div class="choice-list">${options.map(([value, label, description]) => `<label class="choice"><input type="radio" name="${key}" value="${value}" data-appearance="${key}" ${current[key] === value ? "checked" : ""}><span><strong>${label}</strong><small>${description}</small></span></label>`).join("")}</div>`;
    }
    return `<section class="edit-section"><div class="section-heading"><h1><span class="section-number">01</span>Appearance</h1></div><p class="muted">A quiet frame for your work. Every choice keeps your content and its order.</p><fieldset style="margin-top:32px"><legend>Color theme</legend>${choices("theme", [["warm", "Warm paper", "Cream paper, dark ink, burnt orange."], ["ink", "Evening ink", "Dark ink, warm type, pale terracotta."]])}</fieldset><fieldset style="margin-top:32px"><legend>Reading rhythm</legend>${choices("layout", [["editorial", "Editorial", "Room for each link and a generous pace."], ["compact", "Concise", "A closer rhythm for a longer collection."]])}</fieldset><fieldset style="margin-top:32px"><legend>Link corners</legend>${choices("shape", [["soft", "Soft", "A subtle 8px curve."], ["square", "Square", "Straight edges, like a printed index."]])}</fieldset><p class="small muted" style="margin-top:32px">Georgia titles and humanist UI type anchor both themes. Custom colors and font uploads are outside this review.</p></section>`;
  }

  function settingsEditor(profile) {
    return `<section class="edit-section"><div class="section-heading"><h1><span class="section-number">01</span>Settings</h1></div>${field({ name: "owner-label", label: "Owner-only label", value: profile.label, max: 80, hint: "Visible in this demo workspace, never inside the public profile.", attrs: 'data-setting="label" required' })}${field({ name: "handle", label: "Public handle", value: profile.handle, max: 30, hint: profile.everPublished ? "Fixed after the first demo publication." : "3–30 lowercase letters, digits, or hyphens. Starts and ends with a letter or digit.", attrs: profile.everPublished ? "readonly" : 'data-setting="handle" pattern="[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])" required' })}<section class="settings-section"><h2>Publication</h2><p>${publicationStatus(profile)}. ${profile.published ? "Unpublishing makes the local public route unavailable. Your draft and handle stay here." : "This draft is available only in the demo editor. Publish a local snapshot when you are ready."}</p>${profile.published ? '<button class="danger" data-action="unpublish">Unpublish demo</button>' : '<p class="small">Use Publish demo above to create a local snapshot.</p>'}</section><section class="settings-section"><h2>Prototype boundaries</h2><p>All profiles are fictional. Uploads, payments, QR downloads, account access, and inquiry delivery are not connected.</p></section></section>`;
  }

  function renderProfile(draft, preview = false) {
    const visible = draft.blocks.filter((block) => block.visible);
    let linkNumber = 0;
    const contents = visible.map((block) => {
      if (block.type === "link") {
        linkNumber += 1;
        return `<button type="button" class="public-link" ${preview ? "disabled" : `data-action="destination" data-url="${escape(block.url)}" data-label="${escape(block.label)}"`}><span class="link-number" aria-hidden="true">${String(linkNumber).padStart(2, "0")}</span><span style="flex:1">${escape(block.label || "Untitled link")}</span><span class="link-mark" aria-hidden="true">↗</span></button>`;
      }
      if (block.type === "art") return `<figure class="public-art"><p class="demo-label">Artwork / demo placeholder</p><div class="serif">${escape(block.text)}</div><figcaption>${escape(block.caption || "Demo artwork placeholder · no image uploaded")}</figcaption></figure>`;
      if (block.type === "text") return `<p class="public-text">${escape(block.text)}</p>`;
      return contactForm(block, preview);
    }).join("");
    return `<div class="public-surface ${draft.appearance.theme === "ink" ? "theme-ink" : ""} ${draft.appearance.layout === "compact" ? "compact" : ""} ${draft.appearance.shape === "square" ? "square" : ""}"><article class="public-profile"><header><div class="initials" aria-hidden="true">${escape(initials(draft.name))}</div><p class="demo-label">Fictional profile · design demo</p><${preview ? "h2" : "h1"} class="public-name">${escape(draft.name || "Your name here")}</${preview ? "h2" : "h1"}><p class="public-bio">${escape(draft.bio)}</p></header><div class="public-links">${contents}</div>${!visible.length ? '<p class="public-text">No visible blocks. Add or show a block in the editor.</p>' : ""}<footer class="public-footnote">${preview ? "Private draft preview. Links and submissions are disabled." : "Made with Linky · local design demo. Destinations and inquiries are simulated."}</footer></article></div>`;
  }

  function contactForm(block, preview) {
    const prefix = preview ? "preview" : "inquiry";
    return `<section class="contact" aria-labelledby="${prefix}-heading"><h2 id="${prefix}-heading">${escape(block.text || "A note to begin")}</h2><p class="small hint" style="margin-top:12px">${preview ? "This form is inactive in the private preview." : "Try the demo form. Nothing is sent or stored."}</p><form id="${prefix}-form" ${preview ? "" : 'data-form="inquiry" novalidate'}><fieldset ${preview ? "disabled" : ""}><legend class="sr-only">Demo inquiry details</legend><div class="field"><label for="${prefix}-name">Name <span class="muted">(optional)</span></label><input id="${prefix}-name" name="name" maxlength="100" autocomplete="name"></div><div class="field"><label for="${prefix}-email">Email</label><input id="${prefix}-email" name="email" type="email" maxlength="254" autocomplete="email" required aria-describedby="${prefix}-email-error"><span id="${prefix}-email-error" class="field-error"></span></div><div class="field"><label for="${prefix}-message">Message</label><textarea id="${prefix}-message" name="message" maxlength="5000" required aria-describedby="${prefix}-message-error"></textarea><span id="${prefix}-message-error" class="field-error"></span></div><p class="small hint" style="margin-top:16px">Use fictional details. This prototype has no inbox or delivery service.</p><button class="primary" type="submit">${escape(block.label || "Send demo inquiry")}</button></fieldset></form></section>`;
  }

  function renderPublic(profile) {
    const available = profile?.published && profile.snapshot;
    document.title = available ? `${profile.snapshot.name} · Published design demo` : "Page unavailable · Linky demo";
    app.innerHTML = `<div class="public-shell"><header class="public-toolbar"><a class="back-link" href="#/profiles">‹ &nbsp; Demo workspace</a><span class="small muted">Published view · local demo</span></header><main id="main" tabindex="-1">${available ? `<div class="public-stage">${renderProfile(profile.snapshot)}</div>` : '<div class="empty-state"><p class="eyebrow">Local design demo</p><h1>This page is unavailable</h1><p>There is no published demo at this address.</p><a class="button" href="#/profiles">Back to demo profiles</a></div>'}</main></div>`;
  }

  function updateSaveState() {
    const status = document.querySelector("#save-status");
    if (status) status.textContent = saveError ? "Could not save" : dirty ? "Saving to this browser…" : "All changes saved in this browser";
    const notice = document.querySelector("#save-notice");
    if (notice) notice.innerHTML = saveNotice();
    const strip = document.querySelector("#publication-strip");
    const profile = activeProfile();
    if (strip && profile) strip.innerHTML = publishStrip(profile);
  }

  function updatePreview(profile) {
    const preview = document.querySelector("#draft-preview");
    if (preview) preview.innerHTML = renderProfile(profile.draft, true);
    for (const selector of ["#preview-handle", "#active-profile-handle"]) {
      const handle = document.querySelector(selector);
      if (handle) handle.textContent = `/@${profile.handle}`;
    }
  }

  function refreshEditor(focusSelector) {
    const profile = activeProfile();
    const content = document.querySelector("#editor-content");
    if (!profile || !content) return;
    content.innerHTML = editorContent(profile);
    updatePreview(profile);
    updateSaveState();
    if (focusSelector) content.querySelector(focusSelector)?.focus();
  }

  function render() {
    const selected = route(currentHash);
    if (selected.screen === "dashboard") renderDashboard();
    else if (selected.screen === "editor" && selected.profile) renderEditor(selected.profile);
    else renderPublic(selected.screen === "public" ? selected.profile : null);
  }

  function showDialog(title, body, actions = "") {
    if (dialog.open) dialog.close();
    dialogTrigger = document.activeElement;
    dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${escape(title)}</h2><button type="button" data-action="close-dialog" aria-label="Close dialog">×</button></div>${body}${actions ? `<div class="dialog-actions">${actions}</div>` : ""}`;
    dialog.showModal();
    dialog.querySelector("[autofocus]")?.focus();
  }

  function confirmDialog(title, text, action, label) {
    showDialog(title, `<p>${escape(text)}</p>`, `<button data-action="close-dialog" autofocus>Cancel</button><button class="primary" data-action="${action}">${escape(label)}</button>`);
  }

  function createDialog() {
    showDialog("A new page for your work", `<p class="muted">Create a private demo draft. Nothing is published yet.</p><form data-form="create" novalidate>${field({ name: "label", label: "Owner-only label", value: "", hint: "A client or project name for your workspace.", attrs: "required autofocus" })}${field({ name: "name", label: "Public display name", value: "", attrs: "required" })}${field({ name: "handle", label: "Public handle", value: "", max: 30, hint: "3–30 lowercase letters, digits, or hyphens.", attrs: 'required autocapitalize="none" spellcheck="false" aria-describedby="create-errors"' })}<div id="create-errors" class="field-error" role="alert" style="margin-top:16px"></div><div class="dialog-actions"><button type="button" data-action="close-dialog">Cancel</button><button class="primary" type="submit">Create demo draft</button></div></form>`);
  }

  function shareDialog(profile) {
    if (!profile?.published) { toast("Publish a demo snapshot before sharing."); return; }
    showDialog("Share the published demo", `<p>${escape(profile.snapshot.name)} · /@${escape(profile.handle)}</p><p class="small muted" style="margin-top:12px">This address opens the local snapshot in this browser. It is not a hosted public profile and does not transfer demo data to another device.</p>${field({ name: "share-url", label: "Local demo URL", value: demoURL(profile), max: 4000, attrs: "readonly" })}<p id="copy-result" class="small" role="status" style="margin-top:12px"></p>`, `<button data-action="copy-link" data-profile="${escape(profile.id)}" class="primary">Copy local demo URL</button><a class="button" data-close-dialog href="#/@${escape(profile.handle)}">View live demo</a>`);
  }

  function validatePublication(profile) {
    if (!profile.draft.name.trim()) return "Add a public display name before publishing.";
    const handleError = checkHandle(profile.handle, profile.id);
    if (handleError) return handleError;
    const blocks = profile.draft.blocks.filter((block) => block.visible);
    if (!blocks.length) return "Add or show at least one content block before publishing.";
    if (blocks.some((block) => block.type === "link" && (!block.label.trim() || !safeURL(block.url)))) return "Every visible link needs a label and a valid HTTP or HTTPS destination without credentials.";
    if (blocks.some((block) => ["text", "art", "contact"].includes(block.type) && !block.text.trim())) return "Add text to each visible content block before publishing.";
    return "";
  }

  function checkHandle(handle, ownId) {
    if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(handle)) return "Use 3–30 lowercase letters, digits, or hyphens. Start and end with a letter or digit.";
    if (["admin", "api", "app", "help", "support", "login", "settings", "profiles"].includes(handle)) return "This demo handle is reserved. Choose another.";
    if (state.profiles.some((profile) => profile.handle === handle && profile.id !== ownId)) return "This handle is already used in this browser demo. Choose another.";
    return "";
  }

  function requestNavigation(nextHash) {
    if (nextHash === currentHash) return;
    if (dirty && !persist()) {
      const switcher = document.querySelector("#profile-switcher");
      if (switcher) switcher.value = activeProfile().id;
      showDialog("Your changes have not saved", `<p>${escape(saveError)}</p><p class="small muted" style="margin-top:12px">Stay to keep editing, or discard this tab’s unsaved changes and continue.</p>`, `<button data-action="close-dialog" autofocus>Stay here</button><button data-action="discard-navigate" data-hash="${escape(nextHash)}">Discard & continue</button>`);
      history.replaceState(null, "", currentHash);
      return;
    }
    ui.undo = null;
    ui.review = "normal";
    currentHash = nextHash;
    if (location.hash !== nextHash) location.hash = nextHash;
    render();
    window.scrollTo(0, 0);
    document.querySelector("#main")?.focus({ preventScroll: true });
  }

  document.addEventListener("click", async (event) => {
    if (event.target.closest(".skip-link")) {
      event.preventDefault();
      document.querySelector("#main")?.focus();
      return;
    }
    const link = event.target.closest('a[href^="#/"]');
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      if (link.hasAttribute("data-close-dialog")) dialog.close();
      requestNavigation(link.getAttribute("href"));
      return;
    }
    const control = event.target.closest("[data-action]");
    if (!control || control.disabled) return;
    const action = control.dataset.action;
    const profile = activeProfile();
    if (action === "close-dialog") { dialog.close(); return; }
    if (action === "dismiss-feedback") { feedback.hidden = true; return; }
    if (action === "create") { createDialog(); return; }
    if (action === "filter") { ui.filter = control.dataset.value; renderDashboard(); document.querySelector(`[data-value="${ui.filter}"]`)?.focus(); return; }
    if (action === "clear-filters") { ui.filter = "all"; ui.query = ""; renderDashboard(); document.querySelector("#profile-search")?.focus(); return; }
    if (action === "normal-state") { ui.review = "normal"; render(); return; }
    if (action === "share") { shareDialog(state.profiles.find((item) => item.id === control.dataset.profile)); return; }
    if (action === "copy-link") {
      const item = state.profiles.find((entry) => entry.id === control.dataset.profile);
      try {
        await navigator.clipboard.writeText(demoURL(item));
        document.querySelector("#copy-result").textContent = "Local demo URL copied.";
      } catch {
        const input = dialog.querySelector('[name="share-url"]');
        input.focus(); input.select();
        document.querySelector("#copy-result").textContent = "Clipboard access is unavailable. The URL is selected; copy it using your keyboard or browser menu.";
      }
      return;
    }
    if (action === "reset") { confirmDialog("Reset this browser demo?", "Your local edits and new demo profiles will be replaced with the starting fictional profiles. This cannot be undone.", "confirm-reset", "Reset demo"); return; }
    if (action === "confirm-reset") {
      clearTimeout(saveTimer);
      try { localStorage.removeItem(STORAGE_KEY); baseline = null; }
      catch { toast("Browser storage could not be reset. Your current demo is retained."); return; }
      state = initialState(); savedState = clone(state); dirty = true; conflict = false; saveError = "";
      ui.query = ""; ui.filter = "all"; ui.review = "normal"; ui.undo = null;
      persist(); dialog.close(); currentHash = "#/profiles"; location.hash = currentHash; render(); toast("Demo reset to the starting fictional profiles."); return;
    }
    if (action === "retry-save") { ui.review = "normal"; if (persist()) { render(); toast("Demo changes saved in this browser."); } return; }
    if (action === "reload-demo") { confirmDialog("Reload the saved demo?", "This tab’s unsaved changes will be discarded. The latest browser demo will be loaded.", "confirm-reload", "Reload demo"); return; }
    if (action === "confirm-reload") { clearTimeout(saveTimer); conflict = false; saveError = ""; dirty = false; state = load(); savedState = clone(state); ui.review = "normal"; dialog.close(); render(); return; }
    if (action === "discard-navigate") { clearTimeout(saveTimer); state = clone(savedState); dirty = false; saveError = ""; dialog.close(); requestNavigation(control.dataset.hash); return; }
    if (action === "destination") { showDialog("Demo destination", `<p>${escape(control.dataset.label)}</p><p class="small muted" style="margin-top:12px">In the product, this would open the profile owner’s link. This design demo keeps you here.</p>${field({ name: "destination", label: "Example destination", value: control.dataset.url, max: 2000, attrs: "readonly" })}`, '<button data-action="close-dialog" autofocus>Back to profile</button>'); return; }
    if (!profile) return;
    if (action === "mobile-view") { ui.mobile = control.dataset.value; renderEditor(profile); document.querySelector(`[data-action="mobile-view"][data-value="${ui.mobile}"]`)?.focus(); return; }
    if (action === "editor-tab") { ui.tab = control.dataset.value; renderEditor(profile); document.querySelector(`[data-action="editor-tab"][data-value="${ui.tab}"]`)?.focus(); return; }
    if (action === "publish") {
      const error = validatePublication(profile);
      if (error) { showDialog("Check your draft", `<p>${escape(error)}</p>`, '<button data-action="close-dialog" autofocus>Back to editing</button>'); return; }
      confirmDialog("Publish a local demo snapshot?", "This copies the current draft to the published view in this browser only. It does not put a page on the internet.", "confirm-publish", "Publish demo snapshot"); return;
    }
    if (action === "confirm-publish") {
      const error = validatePublication(profile);
      if (error || dirty || saveError) { dialog.close(); toast(error || "Save your draft before publishing the demo."); return; }
      const previous = clone(profile);
      profile.snapshot = clone(profile.draft); profile.published = true; profile.everPublished = true; dirty = true;
      if (!persist()) { Object.assign(profile, previous); dialog.close(); renderEditor(profile); toast("Demo snapshot was not published. Your draft is retained."); return; }
      dialog.close(); renderEditor(profile); shareDialog(profile); announce("Local demo snapshot published. Nothing was published to the internet."); return;
    }
    if (action === "unpublish") { confirmDialog("Unpublish this demo page?", `/@${profile.handle} will show an unavailable page in this browser. Your draft and handle will be retained.`, "confirm-unpublish", "Unpublish demo"); return; }
    if (action === "confirm-unpublish") {
      profile.published = false; dirty = true;
      if (!persist()) { profile.published = true; dialog.close(); renderEditor(profile); toast("Could not save. The demo remains published."); return; }
      dialog.close(); renderEditor(profile); toast("Demo unpublished. The draft and handle are retained."); return;
    }
    if (action === "add-link") {
      if (profile.draft.blocks.length >= 30) { toast("This bounded demo supports up to 30 blocks per profile."); return; }
      const block = { id: id(), type: "link", label: "", url: "", visible: true };
      profile.draft.blocks.push(block); ui.openBlocks.add(block.id); markChanged(profile);
      refreshEditor(`[data-block="${block.id}"][data-key="label"]`); announce("New link added to the end of the draft."); return;
    }
    if (action === "undo") {
      if (!ui.undo || ui.undo.profileId !== profile.id) return;
      const restored = ui.undo.block;
      profile.draft.blocks.splice(ui.undo.index, 0, restored); ui.undo = null; ui.openBlocks.add(restored.id); markChanged(profile);
      refreshEditor(`[data-block-id="${restored.id}"] summary`); announce("Removed block restored."); return;
    }
    const index = profile.draft.blocks.findIndex((block) => block.id === control.dataset.id);
    if (index < 0) return;
    const block = profile.draft.blocks[index];
    if (action === "toggle-block") {
      block.visible = !block.visible; markChanged(profile); refreshEditor(`[data-action="toggle-block"][data-id="${block.id}"]`); announce(`Block ${block.visible ? "shown" : "hidden"} in the draft.`);
    }
    if (action === "remove-block") {
      ui.undo = { block: clone(block), index, profileId: profile.id }; profile.draft.blocks.splice(index, 1); markChanged(profile); refreshEditor('[data-action="undo"]'); announce("Block removed. Undo is available until another removal or navigation.");
    }
    if (action === "move-up" || action === "move-down") {
      const next = index + (action === "move-up" ? -1 : 1);
      if (next < 0 || next >= profile.draft.blocks.length) return;
      profile.draft.blocks.splice(index, 1); profile.draft.blocks.splice(next, 0, block); markChanged(profile);
      refreshEditor(`[data-block-id="${block.id}"] summary`); announce(`Block moved to position ${next + 1} of ${profile.draft.blocks.length}.`);
    }
  });

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (input.id === "profile-search") { ui.query = input.value; renderProfileList(); return; }
    if (input.closest("dialog")) return;
    const profile = activeProfile();
    if (!profile || route(currentHash).screen !== "editor") return;
    if (input.dataset.draft) profile.draft[input.dataset.draft] = input.value;
    else if (input.dataset.setting) {
      if (input.dataset.setting === "handle") {
        const value = input.value.toLowerCase();
        const error = checkHandle(value, profile.id);
        input.setCustomValidity(error);
        input.setAttribute("aria-invalid", String(Boolean(error)));
        // Invalid intermediate handles remain only in the field, never in saved demo routes.
        if (error) { input.reportValidity(); return; }
        profile.handle = value;
      } else profile.label = input.value;
    } else if (input.dataset.block) {
      const block = profile.draft.blocks.find((item) => item.id === input.dataset.block);
      if (!block) return;
      block[input.dataset.key] = input.value;
      if (input.dataset.key === "url") input.setCustomValidity(input.value && !safeURL(input.value) ? "Use a valid HTTP or HTTPS destination without credentials." : "");
      const title = document.querySelector(`[data-block-title="${block.id}"]`);
      if (title) title.textContent = (block.label || block.text || "Untitled link").split("\n")[0];
    } else return;
    markChanged(profile); updatePreview(profile);
  });

  document.addEventListener("change", (event) => {
    const input = event.target;
    if (input.id === "profile-switcher") { requestNavigation(`#/edit/${input.value}`); return; }
    if (input.id === "review-state") {
      ui.review = input.value;
      if (ui.review === "save-error") { dirty = true; persist(); }
      else if (dirty && saveError && !conflict) persist();
      render(); return;
    }
    if (input.dataset.appearance && input.checked) {
      const profile = activeProfile();
      profile.draft.appearance[input.dataset.appearance] = input.value;
      markChanged(profile); updatePreview(profile);
    }
  });

  document.addEventListener("toggle", (event) => {
    const blockId = event.target.dataset?.blockId;
    if (blockId) event.target.open ? ui.openBlocks.add(blockId) : ui.openBlocks.delete(blockId);
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form.dataset.form) return;
    event.preventDefault();
    if (form.dataset.form === "create") {
      const values = Object.fromEntries(new FormData(form));
      const handle = values.handle.trim().toLowerCase();
      let error = !values.label.trim() ? "Add an owner-only label." : !values.name.trim() ? "Add a public display name." : checkHandle(handle);
      if (state.profiles.length >= 30) error = "This bounded prototype supports up to 30 demo profiles. Reset the demo to start again.";
      if (error) {
        document.querySelector("#create-errors").textContent = error;
        const input = form.elements[!values.label.trim() ? "label" : !values.name.trim() ? "name" : "handle"];
        input.setAttribute("aria-invalid", "true"); input.focus(); return;
      }
      const profile = { id: id(), label: values.label.trim(), handle, draft: demoDraft(values.name.trim(), "", "new"), snapshot: null, published: false, everPublished: false, edited: "Created in this demo session" };
      profile.draft.blocks = [];
      state.profiles.unshift(profile); dirty = true; ui.review = "normal";
      if (!persist()) { state.profiles.shift(); document.querySelector("#create-errors").textContent = saveError; return; }
      dialog.close(); ui.tab = "content"; ui.mobile = "edit"; requestNavigation(`#/edit/${profile.id}`); toast("Private demo draft created. This handle is available in this browser demo."); return;
    }
    if (form.dataset.form === "inquiry") {
      const profile = activeProfile();
      if (!profile?.published) { toast("This demo page is no longer published. Your message remains in the form."); return; }
      const email = form.elements.email;
      const message = form.elements.message;
      const emailError = !email.value.trim() ? "Enter an email address." : !email.validity.valid ? "Enter a valid email address, such as name@example.com." : "";
      const messageError = !message.value.trim() ? "Write a message before submitting the demo." : "";
      email.setAttribute("aria-invalid", String(Boolean(emailError)));
      message.setAttribute("aria-invalid", String(Boolean(messageError)));
      document.querySelector("#inquiry-email-error").textContent = emailError;
      document.querySelector("#inquiry-message-error").textContent = messageError;
      if (emailError || messageError) { (emailError ? email : message).focus(); return; }
      form.innerHTML = '<div class="notice" role="status" tabindex="-1"><h3>Demo submission complete.</h3><p>Nothing was sent.</p><p class="small hint">Your inquiry details were not stored.</p><button type="button" class="primary" data-action="another-inquiry">Try another demo inquiry</button></div>';
      form.querySelector('[role="status"]').focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest('[data-action="another-inquiry"]')) return;
    const profile = activeProfile();
    const block = profile?.snapshot?.blocks.find((item) => item.type === "contact" && item.visible);
    const contact = document.querySelector(".public-profile .contact");
    if (block && contact) { contact.outerHTML = contactForm(block, false); document.querySelector("#inquiry-name")?.focus(); }
  });

  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    if (dialogTrigger?.isConnected) dialogTrigger.focus();
    dialog.replaceChildren();
  });
  window.addEventListener("hashchange", () => requestNavigation(location.hash || "#/profiles"));
  window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || event.newValue === baseline) return;
    conflict = true;
    saveError = "Another tab changed this browser demo. Reload the saved demo before making further changes.";
    clearTimeout(saveTimer);
    if (route(currentHash).screen === "editor") updateSaveState();
    else if (route(currentHash).screen === "dashboard") renderDashboard();
    toast("Another tab changed this demo. Reload the saved demo to continue.");
  });

  if (!location.hash) history.replaceState(null, "", currentHash);
  if (!baseline && !saveError) { dirty = true; persist(); }
  render();
})();
