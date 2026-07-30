import { cookies } from 'next/headers';
import { readFlash, FLASH_COOKIE_NAME } from '@/lib/flash';
import FlashToast from '@/components/flash-toast';

export default async function AuthLayout({ children }) {
  const cookieStore = await cookies();
  const flash = readFlash(cookieStore.get(FLASH_COOKIE_NAME)?.value);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <FlashToast initial={flash} />
      <div className="w-full max-w-sm rounded-2xl border border-black/[.08] bg-white p-8 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
        {children}
      </div>
    </div>
  );
}
