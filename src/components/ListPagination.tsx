type ListPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  maxButtons?: number;
};

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = "items",
  maxButtons = 5,
}: ListPaginationProps) {
  if (total <= 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const windowSize = Math.min(maxButtons, pageCount);
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pageCount, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-[12px] text-slate-500">
        Showing {from} to {to} of {total.toLocaleString()} {label}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >       
          Previous
        </button>
        {start > 1 ? (
          <>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
              onClick={() => onPageChange(1)}
            >
              1
            </button>
            {start > 2 ? <span className="px-1 text-slate-400">…</span> : null}
          </>
        ) : null}
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            className={`grid size-8 place-items-center rounded-lg text-[12px] font-semibold ${
              page === n ? "bg-[#6366f1] text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}
        {end < pageCount ? (
          <>
            {end < pageCount - 1 ? <span className="px-1 text-slate-400">…</span> : null}
            <button
              type="button"
              className="grid min-w-8 place-items-center rounded-lg px-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
              onClick={() => onPageChange(pageCount)}
            >
              {pageCount}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
