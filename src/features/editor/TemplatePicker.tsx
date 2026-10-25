"use client";
import { useState } from "react";
import Image from "next/image";
import { Dialog } from "@/components/Dialog";
import { ProfileRenderer } from "@/features/public-profile/ProfileRenderer";
import {
  templateOptions,
  resolveTemplate,
} from "@/features/public-profile/template-visuals";
import type { ProfileDocument } from "@/features/profiles/model";
import type { ProfileTemplateId } from "@/features/profiles/templates";

export function TemplatePicker({
  document,
  onSelect,
}: {
  document: ProfileDocument;
  onSelect: (id: ProfileTemplateId, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = templateOptions.find(
    (item) => item.id === resolveTemplate(document.appearance.template),
  )!;
  return (
    <>
      <div className="current-template">
        {current.image ? (
          <Image
            src={current.image}
            width={44}
            height={64}
            sizes="44px"
            alt="Example design"
          />
        ) : (
          <span className="original-swatch" aria-hidden="true">
            Aa
          </span>
        )}
        <div>
          <span className="small muted">Template</span>
          <strong>{current.name}</strong>
        </div>
        <button type="button" onClick={() => setOpen(true)}>
          Change template
        </button>
      </div>
      {open && (
        <TemplateDialog
          document={document}
          onClose={() => setOpen(false)}
          onSelect={(id, name) => {
            onSelect(id, name);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
function TemplateDialog({
  document,
  onClose,
  onSelect,
}: {
  document: ProfileDocument;
  onClose: () => void;
  onSelect: (id: ProfileTemplateId, name: string) => void;
}) {
  const [candidate, setCandidate] = useState(
    resolveTemplate(document.appearance.template),
  );
  const [query, setQuery] = useState("");
  const options = templateOptions.filter((item) =>
    `${item.name} ${item.tags}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const selected = templateOptions.find((item) => item.id === candidate)!;
  return (
    <Dialog title="Choose a template" onClose={onClose}>
      <div className="template-picker">
        <div className="template-search">
          <label htmlFor="template-search">Search templates</label>
          <div className="actions">
            <input
              id="template-search"
              data-safe-focus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or style, e.g. bold"
            />
            {query && (
              <button onClick={() => setQuery("")}>Clear search</button>
            )}
          </div>
          <p className="small muted" role="status">
            {options.length} {options.length === 1 ? "template" : "templates"} ·
            thumbnails show example designs
          </p>
        </div>
        <div className="template-picker-body">
          <fieldset className="template-results">
            <legend className="sr-only">Template choices</legend>
            {options.map((item) => (
              <label className="template-option" key={item.id}>
                <input
                  type="radio"
                  name="template-candidate"
                  value={item.id}
                  checked={candidate === item.id}
                  onChange={() => setCandidate(item.id)}
                />
                {item.image ? (
                  <Image
                    src={item.image}
                    width={130}
                    height={200}
                    sizes="(max-width: 600px) 40vw, 130px"
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span className="original-swatch" aria-hidden="true">
                    Aa
                  </span>
                )}
                <strong>{item.name}</strong>
                <span className="small">Example design</span>
              </label>
            ))}
            {!options.length && (
              <p className="template-empty">
                No matching templates. Try a name or style such as “blue” or
                “minimal”.
              </p>
            )}
          </fieldset>
          <section
            className="candidate-preview"
            aria-label="Your content in the selected template"
          >
            <h3>{selected.name}</h3>
            <p className="small muted">Your content · temporary preview</p>
            <div className="candidate-frame">
              <ProfileRenderer
                document={{
                  ...document,
                  appearance: { ...document.appearance, template: candidate },
                }}
                preview
              />
            </div>
          </section>
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={() => onSelect(candidate, selected.name)}
          >
            Use template
          </button>
        </div>
      </div>
    </Dialog>
  );
}
