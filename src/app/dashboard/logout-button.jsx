"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full border border-black/[.08] 
          px-5 py-2 text-sm font-medium transition-colors
          hover:bg-black/[.04]
          dark:border-white/[.145] 
          dark:hover:bg-[#1a1a1a]"
    >
      Log out
    </button>
  );
}
