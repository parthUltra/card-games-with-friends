import Link from "next/link";
import { GAMES } from "@/lib/games/registry";
import { requireOnboarded } from "@/lib/session";
import { IconArrow } from "@/components/ui/icons";

const SUIT: Record<string, string> = { poker: "♠", blackjack: "♦", hearts: "♥" };

export default async function GamesPage() {
  await requireOnboarded();
  const [live, soon] = [GAMES.filter((g) => g.status === "live"), GAMES.filter((g) => g.status !== "live")];

  return (
    <div className="page-in">
      <header className="max-w-2xl">
        <p className="eyebrow">The lounge</p>
        <h1 className="font-display mt-2 text-[28px] font-bold leading-tight md:text-[40px]">Pick a table</h1>
        <p className="mt-2 text-[var(--muted)]">Each game keeps its own lobbies, history and standings.</p>
      </header>

      <div className="mt-8 grid gap-4">
        {live.map((game) => (
          <Link
            key={game.id}
            href={game.href}
            className="group relative overflow-hidden rounded-[20px] border border-[var(--brass)]/30 bg-gradient-to-br from-[var(--felt)] via-[#0d2e24] to-[var(--surface)] p-6 shadow-[var(--shadow-2)] transition-transform active:scale-[0.99] md:p-8"
          >
            <span
              aria-hidden
              className="font-display pointer-events-none absolute -right-4 -top-10 select-none text-[180px] leading-none text-white/[0.04] transition-transform duration-200 group-hover:-translate-y-1 md:text-[240px]"
            >
              {SUIT[game.id] ?? "♣"}
            </span>
            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="badge border-[var(--action)]/40 bg-[var(--action)]/10 text-[var(--action)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--action)]" aria-hidden /> Live
                </span>
                <h2 className="font-display mt-3 text-[28px] font-bold leading-tight md:text-[40px]">{game.name}</h2>
                <p className="mt-1 text-[var(--text)]/85">{game.tagline}</p>
                <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">{game.blurb}</p>
              </div>
              <span className="btn btn-gold btn-lg w-full md:w-auto">
                Open table <IconArrow className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          {soon.map((game) => (
            <div key={game.id} className="tile relative overflow-hidden p-5" aria-label={`${game.name}, coming soon`}>
              <span
                aria-hidden
                className="font-display absolute -right-2 -top-6 text-[110px] leading-none text-white/[0.03]"
              >
                {SUIT[game.id] ?? "♣"}
              </span>
              <span className="badge border-white/10 text-[var(--muted)]">Coming soon</span>
              <h2 className="font-display mt-3 text-xl font-bold">{game.name}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{game.tagline}</p>
              <p className="tnum mt-3 text-xs text-[var(--muted)]">
                {game.minPlayers}
                {game.minPlayers !== game.maxPlayers ? `–${game.maxPlayers}` : ""} players
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
