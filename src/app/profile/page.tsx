import { requireOnboarded } from "@/lib/session";
import { avatarSrc } from "@/lib/avatars";
import { getCollection } from "@/lib/db";
import { getGame } from "@/lib/games/registry";
import { MatchDoc } from "@/lib/types";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await requireOnboarded();
  const user = session.user;
  const matches = await getCollection<MatchDoc>("matches");
  const history = await matches
    .find({ "players.userId": user.id })
    .sort({ endedAt: -1 })
    .limit(15)
    .toArray();

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="panel p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(user.avatarId)}
          alt=""
          className="mx-auto h-28 w-28 rounded-full border-2 border-[var(--gold)]"
        />
        <h1 className="font-display mt-4 text-3xl font-bold">{user.name}</h1>
        <p className="text-sm text-[var(--cream)]/60">{user.email}</p>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/25 p-3">
            <p className="font-display text-2xl text-[var(--gold)]">
              {user.statsWins ?? 0}
            </p>
            <p className="text-xs uppercase tracking-wide opacity-60">Wins</p>
          </div>
          <div className="rounded-xl bg-black/25 p-3">
            <p className="font-display text-2xl text-[var(--gold)]">
              {user.statsTop3 ?? 0}
            </p>
            <p className="text-xs uppercase tracking-wide opacity-60">Top 3</p>
          </div>
          <div className="rounded-xl bg-black/25 p-3">
            <p className="font-display text-2xl text-[var(--gold)]">
              {user.statsPlayed ?? 0}
            </p>
            <p className="text-xs uppercase tracking-wide opacity-60">Played</p>
          </div>
        </div>
        <Link href="/onboarding" className="btn btn-ghost mt-6 w-full">
          Edit avatar / name
        </Link>
      </div>

      <div className="panel p-6">
        <h2 className="font-display text-2xl font-bold">Match history</h2>
        <div className="mt-4 space-y-3">
          {history.length === 0 && (
            <p className="text-[var(--cream)]/50">No tournaments yet.</p>
          )}
          {history.map((m) => {
            const me = m.players.find((p) => p.userId === user.id);
            return (
              <div
                key={String(m._id)}
                className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-black/20 px-4 py-3"
              >
                <div>
                  <p className="font-semibold">
                    {m.lobbyName ||
                      (m.settings as { lobbyName?: string })?.lobbyName ||
                      getGame(m.gameId)?.name ||
                      "Match"}
                  </p>
                  <p className="text-xs text-[var(--cream)]/50">
                    {getGame(m.gameId)?.name ?? m.gameId} ·{" "}
                    {new Date(m.endedAt).toLocaleString()}
                  </p>
                </div>
                <p className="font-display text-xl text-[var(--gold)]">
                  #{me?.place ?? "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
