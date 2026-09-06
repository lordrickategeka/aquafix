import Link from 'next/link';

/* Shared by the list screens. A server component — it renders links only — so
   callers can hand it a `linkFor` that builds hrefs carrying their own filters.

   Renders nothing for a single page. */
export default function Pagination({ page, pageCount, linkFor }) {
  if (pageCount <= 1) return null;

  const numbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    // Keep the row short: first, last, and a window around the current page.
    .filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1);

  const step = 'rounded-[7px] border border-line bg-[#F1F5F4] px-3 py-1.5 text-xs text-muted-deep hover:bg-[#E7EDEC]';
  const stepOff =
    'cursor-not-allowed rounded-[7px] border border-line-soft px-3 py-1.5 text-xs text-[#B6C2C0]';

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="font-mono text-[11.5px] text-muted">
        Page {page} of {pageCount}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={linkFor(page - 1)} className={step}>
            ← Previous
          </Link>
        ) : (
          <span className={stepOff}>← Previous</span>
        )}

        {numbers.map((n, index, shown) => (
          <span key={n} className="flex items-center gap-1.5">
            {index > 0 && n - shown[index - 1] > 1 ? (
              <span className="px-0.5 text-xs text-muted">…</span>
            ) : null}
            <Link
              href={linkFor(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`rounded-[7px] px-2.5 py-1.5 font-mono text-xs ${
                n === page
                  ? 'bg-brand-700 font-medium text-white'
                  : 'border border-line bg-[#F1F5F4] text-muted-deep hover:bg-[#E7EDEC]'
              }`}
            >
              {n}
            </Link>
          </span>
        ))}

        {page < pageCount ? (
          <Link href={linkFor(page + 1)} className={step}>
            Next →
          </Link>
        ) : (
          <span className={stepOff}>Next →</span>
        )}
      </div>
    </div>
  );
}
