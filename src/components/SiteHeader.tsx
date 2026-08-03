import Link from "next/link";
import { getSession } from "@/lib/session";
import { avatarSrc } from "@/lib/avatars";

export async function SiteHeader() {
  const session = await getSession();
  const user = session?.user as
    | { name?: string; avatarId?: string; onboardingComplete?: boolean }
    | undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)]/80 bg-[rgba(6,38,28,0.88)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-[var(--cream)] md:text-xl"
        >
          Card Games <span className="text-[var(--gold)]">With Friends</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm md:gap-5">
          <Link
            href="/games"
            className="text-[var(--cream)]/75 transition hover:text-[var(--cream)]"
          >
            Games
          </Link>
          <Link
            href="/history"
            className="hidden text-[var(--cream)]/75 transition hover:text-[var(--cream)] sm:inline"
          >
            History
          </Link>
          <Link
            href="/leaderboard"
            className="text-[var(--cream)]/75 transition hover:text-[var(--cream)]"
          >
            Rankings
          </Link>
          {user ? (
            <Link
              href="/profile"
              className="flex items-center gap-2 text-[var(--cream)]/90 transition hover:text-[var(--cream)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarSrc(user.avatarId)}
                alt=""
                className="h-8 w-8 rounded-full border border-[var(--line)]"
              />
              <span className="hidden sm:inline">{user.name || "Profile"}</span>
            </Link>
          ) : (
            <Link href="/login" className="btn btn-gold !py-2 !text-sm">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
