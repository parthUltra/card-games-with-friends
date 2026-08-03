import Link from "next/link";
import { getCollection } from "@/lib/db";
import { getGame } from "@/lib/games/registry";
import type { MatchDoc } from "@/lib/types";

type Props = { searchParams: Promise<{ game?: string }> };

export default async function HistoryPage({ searchParams }: Props) {
  const { game } = await searchParams;
  const gameId = game === "poker" ? "poker" : undefined;

  const matches = await getCollection<MatchDoc>("matches");
  const filter: { gameId?: MatchDoc["gameId"] } = gameId ? { gameId } : {};
  const list = await matches
    .find(filter)
    .sort({ endedAt: -1 })
    .limit(40)
    .toArray();

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-bold md:text-5xl">Past games</h1>
        <p className="mt-3 text-[var(--cream)]/70">
          Recent finished tables across the lounge. Your personal history lives on
          your profile.
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/history"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            !gameId
              ? "bg-[var(--gold)] text-[var(--ink)]"
              : "border border-[var(--line)] text-[var(--cream)]/75"
          }`}
        >
          All
        </Link>
        <Link
          href="/history?game=poker"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            gameId === "poker"
              ? "bg-[var(--gold)] text-[var(--ink)]"
              : "border border-[var(--line)] text-[var(--cream)]/75"
          }`}
        >
          Hold&apos;em
        </Link>
      </nav>

      <ul className="mt-8 space-y-3">
        {list.length === 0 && (
          <li className="rounded-2xl border border-[var(--line)] bg-black/20 px-5 py-10 text-[var(--cream)]/50">
            No finished games yet. Host a poker night and close out a tournament.
          </li>
        )}
        {list.map((m) => {
          const winner = m.players.find((p) => p.place === 1);
          const gameName = getGame(m.gameId)?.name ?? m.gameId;
          const title =
            m.lobbyName ||
            (m.settings as { lobbyName?: string })?.lobbyName ||
            gameName;
          return (
            <li
              key={String(m._id)}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-black/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-display text-lg font-semibold">{title}</p>
                <p className="text-sm text-[var(--cream)]/55">
                  {gameName} · {m.players.length} players ·{" "}
                  {new Date(m.endedAt).toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-[var(--gold-soft)]">
                Winner: {winner?.name ?? "—"}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-[var(--cream)]/45">
        <Link href="/profile" className="text-[var(--gold-soft)] hover:underline">
          Your match history →
        </Link>
      </p>
    </div>
  );
}
