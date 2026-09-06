'use client';

import { usePathname } from 'next/navigation';

// Mirrors the nav: each route names itself in the bar above the content.
const PAGES = [
  ['/dashboard/consumers', 'Consumer registry', 'Accounts, meters and balances'],
  ['/dashboard/zones', 'Zones', 'The areas you supply'],
  ['/dashboard/readings', 'Meter readings', 'Capture, review exceptions, approve for billing'],
  ['/dashboard/cycles', 'Reading cycles', 'The periods readings are collected in'],
  ['/dashboard/tariffs', 'Tariff schedules', 'What water costs, per category'],
  ['/dashboard/billing', 'Billing', 'Generate, review and dispatch bills'],
  ['/dashboard/arrears', 'Arrears', 'Outstanding balances by age'],
  ['/dashboard/settings', 'Settings', 'Organisation name and bill wording'],
  ['/dashboard/admin', 'Users, roles & permissions', 'Who may do what in the console'],
  ['/dashboard', 'Operations overview', null],
];

export default function Header({ consumers, cycle, org, onMenu }) {
  const pathname = usePathname();
  const [, title, staticSub] = PAGES.find(([href]) => pathname.startsWith(href)) || PAGES.at(-1);

  // A single consumer's profile names the account rather than the section.
  const account = pathname.match(/^\/dashboard\/consumers\/(.+)$/)?.[1];
  const heading = account ? decodeURIComponent(account) : title;
  const subtitle = account
    ? 'Account profile, bills and readings'
    : (staticSub ?? `${org ?? ''} · ${Number(consumers).toLocaleString()} connections`.replace(/^ · /, ''));

  return (
    <header className="flex h-14.5 flex-none items-center gap-3 border-b border-line bg-white px-4 sm:gap-4 sm:px-6">
      {/* The drawer toggle exists only while the sidebar is hidden. */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="-ml-1 grid h-9 w-9 flex-none place-items-center rounded-lg text-[17px] text-muted-deep hover:bg-[#F1F5F4] lg:hidden"
      >
        ☰
      </button>

      <div className="min-w-0 shrink truncate text-[15px] font-semibold tracking-[-0.01em] sm:shrink-0 sm:text-base sm:whitespace-nowrap">
        {heading}
      </div>
      <div className="hidden shrink overflow-hidden border-l border-line pl-4 text-xs text-ellipsis whitespace-nowrap text-[#7A8B89] md:block">
        {subtitle}
      </div>

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <label className="hidden max-w-57.5 min-w-30 flex-1 items-center gap-1.75 rounded-[7px] border border-line bg-[#F1F5F4] px-2.75 py-1.75 opacity-60 lg:flex">
          <span className="text-xs text-[#9AA9A7]">⌕</span>
          <input
            disabled
            placeholder="Search account, meter, name…"
            className="w-full cursor-not-allowed bg-transparent text-[12.5px] outline-none placeholder:text-[#9AA9A7]"
          />
        </label>
        {cycle ? (
          <div className="flex flex-none items-center gap-1.5 rounded-[7px] border border-line bg-[#F1F5F4] px-2 py-1.5 font-mono text-[11px] whitespace-nowrap text-muted-deep sm:px-2.5 sm:py-1.75 sm:text-[11.5px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                cycle.status === 'open' ? 'bg-ok-dot' : 'bg-warn-dot'
              }`}
            />
            Cycle {cycle.period} · {cycle.status}
          </div>
        ) : null}
      </div>
    </header>
  );
}
