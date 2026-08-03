import Link from "next/link";
import { GAMES } from "@/lib/games/registry";
import { requireOnboarded } from "@/lib/session";

export default async function GamesPage() {
  await requireOnboarded();

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-bold md:text-5xl">The lounge</h1>
        <p className="mt-3 text-[var(--cream)]/70">
          Pick a table. Each game has its own lobbies, history, and leaderboard —
          start with Hold&apos;em tonight.
        </p>
      </header>

      <ul className="mt-10 divide-y divide-[var(--line)]/60 border-y border-[var(--line)]/60">
        {GAMES.map((game) => {
          const live = game.status === "live";
          return (
            <li key={game.id}>
              <div className="group flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                  <span
                    className="mt-1 h-12 w-1.5 shrink-0 rounded-full"
                    style={{ background: game.accent }}
                    aria-hidden
                  />
                  <div>
                    <div className="flex items-baseline gap-3">
                      <h2 className="font-display text-2xl font-bold">{game.name}</h2>
                      <span className="text-xs uppercase tracking-[0.16em] text-[var(--cream)]/45">
                        {live ? "Live" : "Coming soon"}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--cream)]/75">{game.tagline}</p>
                    <p className="mt-2 max-w-xl text-sm text-[var(--cream)]/50">
                      {game.blurb}
                    </p>
                    <p className="mt-2 text-xs text-[var(--cream)]/40">
                      {game.minPlayers}
                      {game.minPlayers !== game.maxPlayers
                        ? `–${game.maxPlayers}`
                        : ""}{" "}
                      players
                    </p>
                  </div>
                </div>
                {live ? (
                  <Link
                    href={game.href}
                    className="btn btn-gold shrink-0 self-start sm:self-center"
                  >
                    Open table
                  </Link>
                ) : (
                  <span className="btn btn-ghost shrink-0 self-start opacity-40 sm:self-center">
                    Soon
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-[var(--cream)]/45">
        Looking for results?{" "}
        <Link href="/history" className="text-[var(--gold-soft)] underline-offset-2 hover:underline">
          Past games
        </Link>{" "}
        and the{" "}
        <Link
          href="/leaderboard"
          className="text-[var(--gold-soft)] underline-offset-2 hover:underline"
        >
          leaderboard
        </Link>
        .
      </p>
    </div>
  );
}
