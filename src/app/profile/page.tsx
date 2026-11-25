import { requireOnboarded } from "@/lib/session";
import { getCollection } from "@/lib/db";
import { getGame } from "@/lib/games/registry";
import { isGuestUser } from "@/lib/guest";
import { MatchDoc } from "@/lib/types";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";

const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function ProfilePage() {
  const session = await requireOnboarded();
  const user = session.user;
  const guest = isGuestUser(user);

  const matches = await getCollection<MatchDoc>("matches");
  const history = guest
    ? []
    : await matches
        .find({ "players.userId": user.id })
        .sort({ endedAt: -1 })
        .limit(15)
        .toArray();

  const stats = [
    ["Wins", user.statsWins ?? 0],
    ["Top 3", user.statsTop3 ?? 0],
    ["Played", user.statsPlayed ?? 0],
  ] as const;

  return (
    <div className="page-in grid gap-4 lg:grid-cols-[360px_1fr] lg:items-start lg:gap-6">
      <section className="panel overflow-hidden">
        <div className="relative bg-gradient-to-b from-[var(--felt)] to-transparent px-6 pb-2 pt-8 text-center">
          <Avatar id={user.avatarId} size={96} ring className="mx-auto" />
          <h1 className="font-display mt-4 truncate text-[28px] font-bold leading-tight">{user.name}</h1>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">{guest ? "Guest player" : user.email}</p>
        </div>
        <div className="p-5 pt-4">
          {guest ? (
            <p className="rounded-xl border border-[var(--brass)]/30 bg-[var(--brass)]/[0.06] px-4 py-3 text-sm text-[var(--text)]/85">
              Guest games and stats aren&apos;t saved.{" "}
              <Link href="/login" className="link font-semibold">
                Sign in with email
              </Link>{" "}
              to keep history and climb the leaderboard.
            </p>
          ) : (
            <dl className="tnum grid grid-cols-3 gap-2 text-center">
              {stats.map(([k, v]) => (
                <div key={k} className="tile p-3">
                  <dd className="font-display text-[28px] font-bold leading-none text-[var(--brass-hi)]">{v}</dd>
                  <dt className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{k}</dt>
                </div>
              ))}
            </dl>
          )}
          <Link href="/onboarding" className="btn btn-ghost mt-4 w-full">
            Edit name &amp; avatar
          </Link>
        </div>
      </section>

      <section className="panel p-5 md:p-6" aria-labelledby="mh">
        <h2 id="mh" className="text-lg font-semibold">
          Match history
        </h2>
        {guest || history.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
            <span className="font-display text-4xl text-[var(--brass)]/60" aria-hidden>
              ♥
            </span>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {guest ? "History is only kept for signed-in accounts." : "No tournaments yet. Your finishes will land here."}
            </p>
            {!guest && (
              <Link href="/games/poker" className="btn btn-gold mt-5">
                Find a table
              </Link>
            )}
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {history.map((m) => {
              const me = m.players.find((p) => p.userId === user.id);
              const won = me?.place === 1;
              return (
                <li key={String(m._id)} className="tile flex items-center gap-4 p-4">
                  <span
                    className={`font-display tnum grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold ${
                      won
                        ? "bg-[var(--brass)]/15 text-[var(--brass-hi)] ring-1 ring-[var(--brass)]/50"
                        : "bg-white/[0.04] text-[var(--muted)]"
                    }`}
                    aria-label={me?.place ? `Finished ${me.place}` : "No placement"}
                  >
                    {me?.place ? `#${me.place}` : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {m.lobbyName ||
                        (m.settings as { lobbyName?: string })?.lobbyName ||
                        getGame(m.gameId)?.name ||
                        "Match"}
                    </p>
                    <p className="tnum mt-0.5 text-sm text-[var(--muted)]">
                      {getGame(m.gameId)?.name ?? m.gameId} · {m.players.length} players · {fmt.format(new Date(m.endedAt))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
