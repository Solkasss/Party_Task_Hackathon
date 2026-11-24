"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type User = { id: string; email: string; name: string } | null;

export default function NavbarActions({ user }: { user: User }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Увійти
        </Link>
        <Link
          href="/register"
          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Реєстрація
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 font-medium">{user.name}</span>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-lg hover:border-gray-400 transition-colors"
      >
        Вийти
      </button>
    </div>
  );
}
