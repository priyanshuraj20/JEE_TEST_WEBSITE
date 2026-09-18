"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const links = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/questions", label: "Question Bank" },
    { href: "/admin/tests/new", label: "+ New Test" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-blue-600 text-lg">JEE Admin</span>
          <div className="hidden sm:flex items-center gap-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          id="logout-btn"
          className="text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
      {/* Mobile nav */}
      <div className="sm:hidden flex gap-3 mt-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-xs font-medium ${pathname === l.href ? "text-blue-600" : "text-gray-600"}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
