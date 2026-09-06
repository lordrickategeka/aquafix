'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      title="Log out"
      aria-label="Log out"
      className="ml-auto grid h-7 w-7 flex-none place-items-center rounded-lg text-[13px] text-[#8FB5B3] transition-colors hover:bg-brand-800 hover:text-white"
    >
      ⏻
    </button>
  );
}
