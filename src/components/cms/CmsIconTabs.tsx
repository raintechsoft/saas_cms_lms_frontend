import type { ComponentType, ReactNode } from "react";

export type CmsIconTabTone =
  | "sky"
  | "indigo"
  | "violet"
  | "fuchsia"
  | "blue"
  | "cyan"
  | "teal"
  | "amber"
  | "orange"
  | "emerald"
  | "rose"
  | "slate"
  | "lime"
  | "purple";

const TONE_STYLES: Record<
  CmsIconTabTone,
  {
    chip: string;
    chipActive: string;
    iconWrap: string;
    iconActive: string;
    labelCls: string;
    labelActive: string;
  }
> = {
  sky: {
    chip: "border-sky-200/80 bg-gradient-to-br from-sky-50 to-sky-100/70 hover:from-sky-100 hover:to-sky-50",
    chipActive: "border-sky-400 bg-gradient-to-br from-sky-100 to-sky-200/80 ring-1 ring-sky-200",
    iconWrap: "bg-sky-500/15 text-sky-700",
    iconActive: "bg-sky-600 text-white",
    labelCls: "text-sky-900",
    labelActive: "text-sky-950",
  },
  indigo: {
    chip: "border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-indigo-100/70 hover:from-indigo-100 hover:to-indigo-50",
    chipActive: "border-indigo-400 bg-gradient-to-br from-indigo-100 to-indigo-200/80 ring-1 ring-indigo-200",
    iconWrap: "bg-indigo-500/15 text-indigo-700",
    iconActive: "bg-indigo-600 text-white",
    labelCls: "text-indigo-900",
    labelActive: "text-indigo-950",
  },
  violet: {
    chip: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-violet-100/70 hover:from-violet-100 hover:to-violet-50",
    chipActive: "border-violet-400 bg-gradient-to-br from-violet-100 to-violet-200/80 ring-1 ring-violet-200",
    iconWrap: "bg-violet-500/15 text-violet-700",
    iconActive: "bg-violet-600 text-white",
    labelCls: "text-violet-900",
    labelActive: "text-violet-950",
  },
  fuchsia: {
    chip: "border-fuchsia-200/80 bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/70 hover:from-fuchsia-100 hover:to-fuchsia-50",
    chipActive: "border-fuchsia-400 bg-gradient-to-br from-fuchsia-100 to-fuchsia-200/80 ring-1 ring-fuchsia-200",
    iconWrap: "bg-fuchsia-500/15 text-fuchsia-700",
    iconActive: "bg-fuchsia-600 text-white",
    labelCls: "text-fuchsia-900",
    labelActive: "text-fuchsia-950",
  },
  blue: {
    chip: "border-blue-200/80 bg-gradient-to-br from-blue-50 to-blue-100/70 hover:from-blue-100 hover:to-blue-50",
    chipActive: "border-blue-400 bg-gradient-to-br from-blue-100 to-blue-200/80 ring-1 ring-blue-200",
    iconWrap: "bg-blue-500/15 text-blue-700",
    iconActive: "bg-blue-600 text-white",
    labelCls: "text-blue-900",
    labelActive: "text-blue-950",
  },
  cyan: {
    chip: "border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-cyan-100/70 hover:from-cyan-100 hover:to-cyan-50",
    chipActive: "border-cyan-400 bg-gradient-to-br from-cyan-100 to-cyan-200/80 ring-1 ring-cyan-200",
    iconWrap: "bg-cyan-500/15 text-cyan-700",
    iconActive: "bg-cyan-600 text-white",
    labelCls: "text-cyan-900",
    labelActive: "text-cyan-950",
  },
  teal: {
    chip: "border-teal-200/80 bg-gradient-to-br from-teal-50 to-teal-100/70 hover:from-teal-100 hover:to-teal-50",
    chipActive: "border-teal-400 bg-gradient-to-br from-teal-100 to-teal-200/80 ring-1 ring-teal-200",
    iconWrap: "bg-teal-500/15 text-teal-700",
    iconActive: "bg-teal-600 text-white",
    labelCls: "text-teal-900",
    labelActive: "text-teal-950",
  },
  amber: {
    chip: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-amber-100/70 hover:from-amber-100 hover:to-amber-50",
    chipActive: "border-amber-400 bg-gradient-to-br from-amber-100 to-amber-200/80 ring-1 ring-amber-200",
    iconWrap: "bg-amber-500/15 text-amber-800",
    iconActive: "bg-amber-600 text-white",
    labelCls: "text-amber-950",
    labelActive: "text-amber-950",
  },
  orange: {
    chip: "border-orange-200/80 bg-gradient-to-br from-orange-50 to-orange-100/70 hover:from-orange-100 hover:to-orange-50",
    chipActive: "border-orange-400 bg-gradient-to-br from-orange-100 to-orange-200/80 ring-1 ring-orange-200",
    iconWrap: "bg-orange-500/15 text-orange-700",
    iconActive: "bg-orange-600 text-white",
    labelCls: "text-orange-900",
    labelActive: "text-orange-950",
  },
  emerald: {
    chip: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/70 hover:from-emerald-100 hover:to-emerald-50",
    chipActive: "border-emerald-400 bg-gradient-to-br from-emerald-100 to-emerald-200/80 ring-1 ring-emerald-200",
    iconWrap: "bg-emerald-500/15 text-emerald-700",
    iconActive: "bg-emerald-600 text-white",
    labelCls: "text-emerald-900",
    labelActive: "text-emerald-950",
  },
  rose: {
    chip: "border-rose-200/80 bg-gradient-to-br from-rose-50 to-rose-100/70 hover:from-rose-100 hover:to-rose-50",
    chipActive: "border-rose-400 bg-gradient-to-br from-rose-100 to-rose-200/80 ring-1 ring-rose-200",
    iconWrap: "bg-rose-500/15 text-rose-700",
    iconActive: "bg-rose-600 text-white",
    labelCls: "text-rose-900",
    labelActive: "text-rose-950",
  },
  slate: {
    chip: "border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/80 hover:from-slate-100 hover:to-slate-50",
    chipActive: "border-slate-400 bg-gradient-to-br from-slate-100 to-slate-200/80 ring-1 ring-slate-200",
    iconWrap: "bg-slate-500/15 text-slate-700",
    iconActive: "bg-slate-700 text-white",
    labelCls: "text-slate-800",
    labelActive: "text-slate-950",
  },
  lime: {
    chip: "border-lime-200/80 bg-gradient-to-br from-lime-50 to-lime-100/70 hover:from-lime-100 hover:to-lime-50",
    chipActive: "border-lime-400 bg-gradient-to-br from-lime-100 to-lime-200/80 ring-1 ring-lime-200",
    iconWrap: "bg-lime-500/15 text-lime-800",
    iconActive: "bg-lime-600 text-white",
    labelCls: "text-lime-950",
    labelActive: "text-lime-950",
  },
  purple: {
    chip: "border-purple-200/80 bg-gradient-to-br from-purple-50 to-purple-100/70 hover:from-purple-100 hover:to-purple-50",
    chipActive: "border-purple-400 bg-gradient-to-br from-purple-100 to-purple-200/80 ring-1 ring-purple-200",
    iconWrap: "bg-purple-500/15 text-purple-700",
    iconActive: "bg-purple-600 text-white",
    labelCls: "text-purple-900",
    labelActive: "text-purple-950",
  },
};

const TONE_CYCLE: CmsIconTabTone[] = [
  "sky",
  "indigo",
  "violet",
  "fuchsia",
  "blue",
  "cyan",
  "teal",
  "amber",
  "orange",
  "emerald",
  "rose",
  "lime",
  "purple",
  "slate",
];

export interface CmsIconTabItem<T extends string = string> {
  key: T;
  label: string;
  shortLabel?: string;
  icon: ComponentType<{ sx?: object }>;
  tone?: CmsIconTabTone;
  badge?: ReactNode;
}

export function CmsIconTabs<T extends string>({
  items,
  value,
  onChange,
  columnsClass = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7",
  ariaLabel = "Sections",
}: {
  items: Array<CmsIconTabItem<T>>;
  value: T;
  onChange: (key: T) => void;
  columnsClass?: string;
  ariaLabel?: string;
}) {
  return (
    <nav
      className="mt-3 shrink-0 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-2.5 shadow-sm"
      aria-label={ariaLabel}
    >
      <div className={`grid gap-2 ${columnsClass}`} role="tablist">
        {items.map((item, index) => {
          const Icon = item.icon;
          const active = value === item.key;
          const tone = TONE_STYLES[item.tone ?? TONE_CYCLE[index % TONE_CYCLE.length]!];
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              title={item.label}
              onClick={() => onChange(item.key)}
              className={`flex min-h-[50px] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left shadow-sm transition ${
                active ? `${tone.chipActive} shadow-md` : tone.chip
              }`}
            >
              <span
                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  active ? tone.iconActive : tone.iconWrap
                }`}
              >
                <Icon sx={{ fontSize: 17 }} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[11px] font-bold leading-snug ${
                    active ? tone.labelActive : tone.labelCls
                  }`}
                >
                  {item.shortLabel ?? item.label}
                </span>
              </span>
              {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
