import Link from "next/link";
import { avatarSrc } from "@/lib/avatars";
import { getCollection } from "@/lib/db";
import { getGame } from "@/lib/games/registry";
import type { LeaderboardDoc } from "@/lib/types";

const FILTERS = [
  { id: "", label: "All games" },
  { id: "poker", label: "Hold'em" },
] as const;

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
      .find({ onboardingComplete: true })
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
    : "Wins across every table you’ve sat at.";

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-bold md:text-5xl">Leaderboard</h1>
        <p className="mt-3 text-[var(--cream)]/70">{subtitle}</p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Leaderboard filter">
        {FILTERS.map((f) => {
          const active = (gameId || "") === f.id;
          const href = f.id ? `/leaderboard?game=${f.id}` : "/leaderboard";
          return (
            <Link
              key={f.id || "all"}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--gold)] text-[var(--ink)]"
                  : "border border-[var(--line)] text-[var(--cream)]/75 hover:border-[var(--gold)]"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-black/20">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wider text-[var(--cream)]/50">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Wins</th>
              <th className="hidden px-4 py-3 sm:table-cell">Top 3</th>
              <th className="px-4 py-3">Played</th>
            </tr>
          </thead>
          <tbody>
            {leaders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-[var(--cream)]/50">
                  No ranked players yet — finish a tournament.
                </td>
              </tr>
            )}
            {leaders.map((u, i) => (
              <tr
                key={u.id}
                className="border-b border-[var(--line)]/40 transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-display text-[var(--gold)]">
                  {i + 1}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarSrc(u.avatarId)}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                    {u.name}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">{u.wins}</td>
                <td className="hidden px-4 py-3 sm:table-cell">{u.top3}</td>
                <td className="px-4 py-3 text-[var(--cream)]/70">{u.played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
