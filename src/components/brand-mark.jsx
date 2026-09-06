import Image from 'next/image';

/* The AquaFix mark on a rounded tile, as it appears beside the organisation
   name in the sidebar and on both sign-in layouts.

   The knockout is used rather than the original green: the tile underneath is
   brand teal, and the logo's forest green on teal reads as a mistake. On light
   surfaces — the browser tab, a printed sheet — /logo.png keeps its own colour.

   alt is empty on purpose. The organisation name sits next to it in text every
   place this is used, so announcing the mark as well would just repeat it. */
export default function BrandMark({ size = 34, className = '' }) {
  // /logo-white.png is trimmed to the artwork, so this ratio is the whole of
  // the tile's padding. At 34px the mark is dense enough that the usual
  // generous inset turned it to mush.
  const inner = Math.round(size * 0.82);

  return (
    <div
      className={`grid flex-none place-items-center rounded-[9px] ${className}`}
      style={{ width: size, height: size }}
    >
      <Image src="/logo-white.png" alt="" width={inner} height={inner} priority />
    </div>
  );
}
