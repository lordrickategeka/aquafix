import { cookies } from 'next/headers';
import { readFlash, FLASH_COOKIE_NAME } from '@/lib/flash';
import FlashToast from '@/components/flash-toast';
import { getSettings } from '@/lib/settings';
import BrandMark from '@/components/brand-mark';

export default async function AuthLayout({ children }) {
  const cookieStore = await cookies();
  const flash = readFlash(cookieStore.get(FLASH_COOKIE_NAME)?.value);
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen w-full flex-1">
      <FlashToast initial={flash} />

      <div className="hidden w-105 flex-none flex-col justify-between bg-brand-900 px-10 py-12 lg:flex">
        <div className="flex items-center gap-2.75">
          <BrandMark className="bg-brand-500" />
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold text-white">{settings.organisation_name}</div>
            <div className="text-[11px] text-[#6E9694]">{settings.tagline}</div>
          </div>
        </div>

        <div>
          <h2 className="text-[26px] font-semibold leading-snug tracking-[-.01em] text-white">
            Run the whole utility from one console.
          </h2>
          <p className="mt-3 max-w-[320px] text-[13px] leading-relaxed text-[#9BC0BE]">
            Meter readings, billing and arrears — shared by office and field staff.
          </p>
        </div>

        <div className="text-[11px] text-[#5C8785]">{settings.organisation_name}</div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center bg-canvas px-4 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.75 lg:hidden">
            <BrandMark className="bg-brand-600" />
            <div className="leading-tight">
              <div className="text-[13.5px] font-semibold text-ink">{settings.organisation_name}</div>
              <div className="text-[11px] text-muted">{settings.tagline}</div>
            </div>
          </div>

          <div className="rounded-[14px] border border-line bg-white p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
