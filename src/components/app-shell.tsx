"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useIsCompactViewport } from "@/lib/use-viewport";

const NAV_ITEMS = [
  { href: "/chat", label: "Chats", icon: "💬" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isCompact = useIsCompactViewport();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {!isCompact && (
        <aside className="flex w-56 shrink-0 flex-col border-r bg-surface p-4">
          <p className="mb-6 px-2 text-lg font-semibold">Nearby</p>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname.startsWith(item.href) ? "bg-accent text-accent-foreground" : "hover:bg-background"
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto pt-4 text-sm">
            <p className="truncate text-muted">{user?.displayName}</p>
            <button
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
              className="mt-2 text-sm text-danger"
            >
              Log out
            </button>
          </div>
        </aside>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>

      {isCompact && (
        <nav className="flex shrink-0 border-t bg-surface">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                pathname.startsWith(item.href) ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
