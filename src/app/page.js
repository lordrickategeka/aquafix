import { redirect } from "next/navigation";

// The app has no public landing page yet — start everyone at the login screen.
// Signed-in visitors are sent on to /dashboard by the proxy (src/proxy.js).
export default function Home() {
  redirect("/login");
}
