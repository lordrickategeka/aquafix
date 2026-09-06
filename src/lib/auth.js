import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { COOKIE_NAME } from "@/lib/constants";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export async function setSessionCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/* Two ways in, one token. The browser gets an httpOnly cookie it cannot read;
   the Flutter app, which has no cookie jar worth trusting on a shared handset,
   sends the same JWT as a bearer token. When the header is present it is the
   credential — falling back to the cookie behind a bad header would only hide
   an expired mobile session behind whatever browser tab shared the device. */
export async function getSessionUser() {
  const headerList = await headers();
  const authorization = headerList.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return verifyToken(authorization.slice(7).trim());
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
