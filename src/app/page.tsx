import Link from "next/link";
import { getSession } from "@/lib/session";
import { HeroFelt } from "@/components/HeroFelt";

const STEPS = [
  { n: "01", title: "Host a table", body: "Pick stacks, blinds and a turn timer. Takes ten seconds." },
  { n: "02", title: "Share the code", body: "Send a link to the group chat. Friends join from any phone." },
  { n: "03", title: "Play it out", body: "Rising blinds, side pots and a winner. Rematch in one tap." },
];

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="page-in">
      <section className="pt-4 text-center md:pt-10">
        <p className="eyebrow">Private poker nights</p>
        <h1 className="font-display mx-auto mt-4 max-w-4xl text-[clamp(2.5rem,8.5vw,4.5rem)] font-bold leading-[0.95]">
          Deal in your friends.
          <span className="block text-[var(--brass)]">Not strangers.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base text-[var(--muted)] md:text-lg">
          Texas Hold&apos;em tables for your group chat. One code, no downloads, plays great on a
          phone.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          {session?.user ? (
            <Link href="/games/poker" className="btn btn-gold btn-lg">
              Host or join a table
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-gold btn-lg">
                Play as guest
              </Link>
              <Link href="/login" className="btn btn-ghost btn-lg">
                Sign in with email
              </Link>
            </>
          )}
        </div>
      </section>

      <HeroFelt />

      <section className="mx-auto mt-16 grid max-w-4xl gap-3 md:mt-20 md:grid-cols-3" aria-label="How it works">
        {STEPS.map((s) => (
          <div key={s.n} className="tile p-5">
            <p className="tnum font-display text-sm font-bold text-[var(--brass)]">{s.n}</p>
            <h2 className="mt-2 text-base font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{s.body}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-sm text-[var(--muted)]">
        See who&apos;s on top in the{" "}
        <Link href="/leaderboard" className="link">
          leaderboard
        </Link>
        .
      </p>
    </div>
  );
}
