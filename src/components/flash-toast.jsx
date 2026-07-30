'use client';

import { useEffect, useState } from 'react';

const TYPE_STYLES = {
  success:
    'border-emerald-600/20 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-950 dark:text-emerald-300',
  error:
    'border-red-600/20 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-950 dark:text-red-300',
  info: 'border-black/[.08] bg-white text-zinc-800 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-200',
};

export default function FlashToast({ initial }) {
  const [flash, setFlash] = useState(initial);

  useEffect(() => {
    if (!initial) return undefined;

    fetch('/api/flash', { method: 'DELETE' }).catch(() => {});

    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [initial]);

  if (!flash) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium shadow-sm ${
          TYPE_STYLES[flash.type] || TYPE_STYLES.info
        }`}
      >
        <span>{flash.message}</span>
        <button
          onClick={() => setFlash(null)}
          aria-label="Dismiss"
          className="text-current opacity-60 hover:opacity-100"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
