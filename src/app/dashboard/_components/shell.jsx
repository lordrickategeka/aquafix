'use client';

import { useEffect, useState } from 'react';
import Sidebar from './sidebar';
import Header from './header';

/* Holds the one piece of state the sidebar and header share: whether the
   navigation drawer is open. On a phone the sidebar slides over the content;
   from lg upwards it is simply always there and the toggle disappears. */
export default function Shell({ sidebar, header, children }) {
  const [navOpen, setNavOpen] = useState(false);

  // A drawer that traps you is worse than no drawer.
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-ink">
      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-brand-900/40 lg:hidden"
        />
      ) : null}

      <Sidebar
        {...sidebar}
        // Closing on the click that navigates, rather than reacting to the
        // pathname afterwards, keeps it to a single render.
        onNavigate={() => setNavOpen(false)}
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header {...header} onMenu={() => setNavOpen(true)} />
        {/* min-w-0 matters: a flex item will not shrink below its content's
            min-width without it, so one wide table would push the whole
            console past the viewport instead of scrolling inside its card. */}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-10 sm:px-6 sm:pt-5.5">
          {children}
        </main>
      </div>
    </div>
  );
}
