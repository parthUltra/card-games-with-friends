import Link from "next/link";
import { getSession } from "@/lib/session";
import { Avatar } from "@/components/ui/Avatar";
import { HeaderLinks, HideOnPlay } from "@/components/ui/NavLinks";

export async function SiteHeader() {
  const session = await getSession();
  const user = session?.user as
    | { name?: string; avatarId?: string; onboardingComplete?: boolean }
    | undefined;

  return (
    <HideOnPlay>
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[var(--bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Card Games With Friends, home">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-[9px] border border-[var(--brass)]/50 bg-gradient-to-b from-[var(--felt-hi)] to-[var(--felt)] text-[15px] text-[var(--brass-hi)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform group-active:scale-95"
          >
            ♠
          </span>
          <span className="font-display text-[15px] font-bold leading-none tracking-tight md:text-base">
            Card Games <span className="text-[var(--brass)]">with Friends</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 md:gap-5">
          <HeaderLinks />
          {user ? (
            <Link
              href="/profile"
              className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-white/[0.05] md:pr-3"
              aria-label={`Profile: ${user.name || "you"}`}
            >
              <Avatar id={user.avatarId} size={32} />
              <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">
                {user.name || "Profile"}
              </span>
            </Link>
          ) : (
            <Link href="/login" className="btn btn-gold btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
    </HideOnPlay>
  );
}
