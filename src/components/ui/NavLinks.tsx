"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHistory, IconSpade, IconTrophy, IconUser } from "./icons";

export const NAV = [
  { href: "/games", label: "Play", Icon: IconSpade, match: ["/games", "/lobby"] },
  { href: "/history", label: "History", Icon: IconHistory, match: ["/history"] },
  { href: "/leaderboard", label: "Leaderboard", Icon: IconTrophy, match: ["/leaderboard"] },
  { href: "/profile", label: "Profile", Icon: IconUser, match: ["/profile", "/onboarding"] },
];

function isActive(path: string, match: string[]) {
  return match.some((m) => path === m || path.startsWith(`${m}/`));
}

/** Desktop header links (md+). */
export function HeaderLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV.slice(0, 3).map((n) => {
        const active = isActive(path, n.match);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {n.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-[13px] h-px bg-[var(--brass)]" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar; hidden on the table (/play) and on md+. */
export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/play")) return null;
  return (
    <>
      <div className="h-20 md:hidden" aria-hidden />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[var(--bg)]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
          {NAV.map(({ href, label, Icon, match }) => {
            const active = isActive(path, match);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                    active ? "text-[var(--brass-hi)]" : "text-[var(--muted)]"
                  }`}
                >
                  <Icon className="h-[22px] w-[22px]" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Renders children everywhere except the full-screen table (/play). */
export function HideOnPlay({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  return path.startsWith("/play") ? null : <>{children}</>;
}
