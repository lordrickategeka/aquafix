export const FLASH_COOKIE_NAME = 'flash';

const FLASH_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 10,
  httpOnly: true,
  sameSite: 'lax',
};

// Usable as-is with both cookies().set(...) (Route Handlers/Server Functions)
// and NextResponse.cookies.set(...) (proxy.js) — both accept a single object.
export function buildFlashCookie(type, message) {
  return { name: FLASH_COOKIE_NAME, value: JSON.stringify({ type, message }), ...FLASH_COOKIE_OPTIONS };
}

export function readFlash(rawValue) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed?.message) return null;
    return { type: parsed.type || 'info', message: parsed.message };
  } catch {
    return null;
  }
}
