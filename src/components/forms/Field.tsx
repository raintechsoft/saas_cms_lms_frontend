import type { ReactNode } from "react";

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + under-field error message. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className = "",
  children,
}: FieldProps) {
  return (
    <label className={`block ${className}`.trim()} htmlFor={htmlFor}>
      <span className="nx-label !mb-1.5 flex items-center gap-1 !normal-case !tracking-normal">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </span>
      <div className={error ? "field-control-invalid" : undefined}>{children}</div>
      {error ? <p className="field-error">{error}</p> : null}
      {!error && hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

/** Compact error line for forms that keep custom label markup. */
export function FieldError({ error }: { error?: string | null }) {
  if (!error) return null;
  return <p className="field-error">{error}</p>;
}
