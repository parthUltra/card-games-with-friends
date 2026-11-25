import Link from "next/link";
import { getCollection } from "@/lib/db";
import { getGame } from "@/lib/games/registry";
import type { LeaderboardDoc } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";

const FILTERS = [
  { id: "", label: "All games" },
  { id: "poker", label: "Hold'em" },
] as const;

const MEDAL = ["#E8CD8E", "#C9CED6", "#C8895A"];

type Props = { searchParams: Promise<{ game?: string }> };

export default async function LeaderboardPage({ searchParams }: Props) {
  const { game } = await searchParams;
  const gameId = game === "poker" ? "poker" : null;

  let leaders: {
    id: string;
    name: string;
    avatarId: string;
    wins: number;
    top3: number;
    played: number;
  }[] = [];

  if (gameId) {
    const board = await getCollection<LeaderboardDoc>("leaderboard");
    const rows = await board
      .find({ gameId })
      .sort({ wins: -1, top3: -1, played: -1 })
      .limit(50)
      .toArray();
    leaders = rows.map((u) => ({
      id: u.userId,
      name: u.name || "Player",
      avatarId: u.avatarId || "avatar_00",
      wins: u.wins || 0,
      top3: u.top3 || 0,
      played: u.played || 0,
    }));
  } else {
    const users = await getCollection("user");
    const rows = await users
      .find({
        onboardingComplete: true,
        isAnonymous: { $ne: true },
        email: { $not: /@(guest\.local|localhost\.dev)$/i },
      })
      .project({
        name: 1,
        avatarId: 1,
        statsWins: 1,
        statsTop3: 1,
        statsPlayed: 1,
      })
      .sort({ statsWins: -1, statsTop3: -1 })
      .limit(50)
      .toArray();
    leaders = rows.map((u) => ({
      id: String(u._id),
      name: (u.name as string) || "Player",
      avatarId: (u.avatarId as string) || "avatar_00",
      wins: (u.statsWins as number) || 0,
      top3: (u.statsTop3 as number) || 0,
      played: (u.statsPlayed as number) || 0,
    }));
  }

  const subtitle = gameId
    ? `${getGame(gameId)?.name ?? gameId} standings`
    : "Wins across every table. Signed-in players only.";

  return (
    <div className="page-in">
      <header className="max-w-2xl">
        <p className="eyebrow">Rankings</p>
        <h1 className="font-display mt-2 text-[28px] font-bold leading-tight md:text-[40px]">Leaderboard</h1>
        <p className="mt-2 text-[var(--muted)]">{subtitle}</p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Leaderboard filter">
        {FILTERS.map((f) => {
          const active = (gameId || "") === f.id;
          const href = f.id ? `/leaderboard?game=${f.id}` : "/leaderboard";
          return (
            <Link key={f.id || "all"} href={href} className="chip" aria-current={active ? "page" : undefined}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      {leaders.length === 0 ? (
        <div className="tile mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="font-display text-5xl text-[var(--brass)]/60" aria-hidden>
            ♠
          </span>
          <p className="mt-4 font-semibold">No ranked players yet</p>
          <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">
            Finish a tournament while signed in with email to claim the first spot.
          </p>
          <Link href="/games/poker" className="btn btn-gold mt-6">
            Start a game
          </Link>
        </div>
      ) : (
        <div className="tile mt-6 overflow-hidden">
          <table className="tnum w-full text-left text-sm">
            <thead className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th scope="col" className="w-12 py-3 pl-4 pr-2 font-semibold">
                  #
                </th>
                <th scope="col" className="px-2 py-3 font-semibold">
                  Player
                </th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">
                  Wins
                </th>
                <th scope="col" className="hidden px-2 py-3 text-right font-semibold sm:table-cell">
                  Top 3
                </th>
                <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">
                  Played
                </th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((u, i) => (
                <tr key={u.id} className="border-b border-white/[0.05] last:border-0 transition-colors hover:bg-white/[0.03]">
                  <td className="py-3 pl-4 pr-2">
                    <span
                      className="font-display grid h-7 w-7 place-items-center rounded-full text-sm font-bold"
                      style={
                        i < 3
                          ? { background: `${MEDAL[i]}22`, color: MEDAL[i], boxShadow: `inset 0 0 0 1px ${MEDAL[i]}66` }
                          : { color: "var(--muted)" }
                      }
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar id={u.avatarId} size={36} />
                      <span className="truncate font-medium">{u.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right text-base font-semibold text-[var(--brass-hi)]">{u.wins}</td>
                  <td className="hidden px-2 py-3 text-right sm:table-cell">{u.top3}</td>
                  <td className="py-3 pl-2 pr-4 text-right text-[var(--muted)]">{u.played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
