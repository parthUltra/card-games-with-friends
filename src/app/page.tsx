import Link from "next/link";
import { getSession } from "@/lib/session";
import { HeroFelt } from "@/components/HeroFelt";

export default async function HomePage() {
  const session = await getSession();

  return (
    <section className="relative -mx-4 -mt-6 overflow-hidden px-4 pb-16 pt-10 md:-mx-0 md:px-0 md:pt-14">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(212,160,23,0.16),transparent_55%)]" />
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[var(--felt-mid)]/30 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-[var(--gold)]/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-[clamp(2.75rem,8vw,5.5rem)] font-bold leading-[0.92] tracking-tight text-[var(--cream)]">
          Card Games
          <span className="mt-1 block text-[var(--gold)]">With Friends</span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-base text-[var(--cream)]/75 md:text-lg">
          Private tables. Invite links. Poker tonight — more games on the way.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {session?.user ? (
            <Link href="/games" className="btn btn-gold">
              Enter the lounge
            </Link>
          ) : (
            <Link href="/login" className="btn btn-gold">
              Sign in to play
            </Link>
          )}
          <Link href="/leaderboard" className="btn btn-ghost">
            Leaderboard
          </Link>
        </div>
      </div>

      <HeroFelt />
    </section>
  );
}
