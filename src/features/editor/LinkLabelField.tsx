import { Field } from "@/components/Field";
import {
  linkPlatform,
  linkPlatforms,
} from "@/features/profiles/link-platforms";

export type LinkLabelChoice = { selection: string; customLabel: string };

export function choiceForLabel(label: string): LinkLabelChoice {
  return {
    selection: linkPlatform(label)?.label ?? "custom",
    customLabel: linkPlatform(label) ? "" : label,
  };
}

export function LinkLabelField({
  id,
  choice,
  error,
  onChange,
}: {
  id: string;
  choice: LinkLabelChoice;
  error?: string;
  onChange: (choice: LinkLabelChoice, label: string) => void;
}) {
  const custom = choice.selection === "custom";
  const selectId = custom ? `platform-${id}` : `label-${id}`;
  return (
    <>
      <div className="field">
        <label htmlFor={selectId}>Link label</label>
        <select
          id={selectId}
          value={choice.selection}
          aria-invalid={!custom && !!error}
          aria-describedby={!custom && error ? `${selectId}-error` : undefined}
          onChange={(event) => {
            const selection = event.target.value;
            onChange(
              { ...choice, selection },
              selection === "custom" ? choice.customLabel : selection,
            );
          }}
        >
          <option value="" disabled>
            Choose a platform
          </option>
          {linkPlatforms.map(({ label }) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {!custom && error && (
          <span id={`${selectId}-error`} className="field-error" role="alert">
            Choose a platform or Custom for this visible link.
          </span>
        )}
      </div>
      {custom && (
        <div className="custom-link-label">
          <Field
            id={`label-${id}`}
            label="Custom label"
            value={choice.customLabel}
            maxLength={120}
            error={error}
            hint="Up to 120 characters"
            onChange={(event) => {
              const customLabel = event.target.value;
              onChange({ selection: "custom", customLabel }, customLabel);
            }}
          />
        </div>
      )}
    </>
  );
}
