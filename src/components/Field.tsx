import { useId, type InputHTMLAttributes } from "react";
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  multiline?: boolean;
  error?: string;
};
export function Field({ label, hint, multiline, error, id, ...props }: Props) {
  const generated = useId();
  const fieldId = id || generated;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {multiline ? (
        <textarea
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={`${fieldId}-hint`}
        />
      ) : (
        <input
          {...props}
          id={fieldId}
          aria-invalid={!!error}
          aria-describedby={`${fieldId}-hint`}
        />
      )}
      <span
        id={`${fieldId}-hint`}
        className={error ? "field-error" : "hint"}
        role={error ? "alert" : undefined}
      >
        {error || hint}
      </span>
    </div>
  );
}
