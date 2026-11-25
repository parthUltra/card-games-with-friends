import Link from "next/link";
import { getCollection } from "@/lib/db";
import { getGame } from "@/lib/games/registry";
import type { MatchDoc } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

type Props = { searchParams: Promise<{ game?: string }> };

const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

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
    <div className="page-in">
      <header className="max-w-2xl">
        <p className="eyebrow">History</p>
        <h1 className="font-display mt-2 text-[28px] font-bold leading-tight md:text-[40px]">Past games</h1>
        <p className="mt-2 text-[var(--muted)]">
          Recent finished tables across the lounge. Your own results live on{" "}
          <Link href="/profile" className="link">
            your profile
          </Link>
          .
        </p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filter by game">
        <Link href="/history" className="chip" aria-current={!gameId ? "page" : undefined}>
          All
        </Link>
        <Link href="/history?game=poker" className="chip" aria-current={gameId === "poker" ? "page" : undefined}>
          Hold&apos;em
        </Link>
      </nav>

      {list.length === 0 ? (
        <div className="tile mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="font-display text-5xl text-[var(--brass)]/60" aria-hidden>
            ♣
          </span>
          <p className="mt-4 font-semibold">No finished games yet</p>
          <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">
            Host a poker night and play it to the last stack. Results show up here.
          </p>
          <Link href="/games/poker" className="btn btn-gold mt-6">
            Host a table
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {list.map((m) => {
            const winner = m.players.find((p) => p.place === 1);
            const gameName = getGame(m.gameId)?.name ?? m.gameId;
            const title = m.lobbyName || (m.settings as { lobbyName?: string })?.lobbyName || gameName;
            return (
              <li key={String(m._id)} className="tile flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{title}</p>
                  <p className="tnum mt-0.5 text-sm text-[var(--muted)]">
                    {gameName} · {m.players.length} players · {fmt.format(new Date(m.endedAt))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div className="hidden sm:block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Winner</p>
                    <p className="max-w-[10rem] truncate text-sm font-semibold text-[var(--brass-hi)]">
                      {winner?.name ?? "—"}
                    </p>
                  </div>
                  {winner && (
                    <Avatar
                      id={winner.avatarId}
                      size={36}
                      ring
                      alt={`Winner: ${winner.name}`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
