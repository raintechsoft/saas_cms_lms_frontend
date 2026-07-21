import type { ReactNode } from "react";

/** Shared Super Admin (ops console) UI primitives — distinct from campus teal. */

export const opsBtnPrimary =
  "inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50";

export const opsBtnDark =
  "inline-flex items-center justify-center rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-bold text-amber-400 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

export const opsBtnSecondary =
  "inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

export const opsLink = "font-semibold text-amber-800 hover:text-amber-950 hover:underline";

export const opsLinkMuted = "text-xs font-semibold text-amber-800 hover:text-amber-950";

/** Links sitting on zinc-950 panel headers */
export const opsLinkOnDark = "text-xs font-bold text-amber-300 hover:text-amber-200";

export function OpsPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
          {eyebrow ?? "Platform ops"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
        {description && <p className="mt-2 text-sm text-zinc-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function OpsPanel({
  title,
  code,
  action,
  children,
}: {
  title: string;
  code?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3.5">
        <div className="flex items-center gap-3">
          {code && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
              {code}
            </span>
          )}
          <h2 className="text-sm font-bold tracking-wide text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
