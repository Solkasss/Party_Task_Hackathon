import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import NavbarActions from "@/components/NavbarActions";

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left — brand + links */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-xl font-bold text-indigo-600 tracking-tight hover:text-indigo-700 transition-colors"
            >
              Тусовка
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Головна
            </Link>
            <Link
              href="/events/new"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Створити подію
            </Link>
            {user && (
              <Link
                href="/profile"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Мій профіль
              </Link>
            )}
          </div>

          {/* Right — auth actions */}
          <NavbarActions user={user} />
        </div>
      </div>
    </nav>
  );
}
