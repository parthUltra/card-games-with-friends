"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BLIND_PRESETS,
  DEFAULT_POKER_SETTINGS,
  PokerLobbySettings,
} from "@/lib/games/registry";

export default function PokerEntryPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PokerLobbySettings>(DEFAULT_POKER_SETTINGS);

  async function createLobby(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create lobby");
        return;
      }
      router.push(`/lobby/${data.code}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function joinLobby(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lobbies/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not join");
        return;
      }
      router.push(`/lobby/${data.code || code}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: PokerLobbySettings["blindPreset"]) {
    if (preset === "custom") {
      setSettings((s) => ({ ...s, blindPreset: "custom" }));
      return;
    }
    setSettings((s) => ({
      ...s,
      blindPreset: preset,
      ...BLIND_PRESETS[preset],
    }));
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cream)]/45">
        <Link href="/games" className="hover:text-[var(--gold-soft)]">
          Games
        </Link>{" "}
        / Texas Hold&apos;em
      </p>
      <h1 className="font-display text-4xl font-bold md:text-5xl">
        Texas Hold&apos;em
      </h1>
      <p className="mt-2 max-w-xl text-[var(--cream)]/70">
        Single-table tournament. Share a code, ready up, play until one stack
        remains.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={createLobby} className="panel space-y-5 p-6 md:p-7">
          <div>
            <h2 className="font-display text-2xl font-bold">Host a table</h2>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              2–6 players · invite-only
            </p>
          </div>

          <div>
            <label className="label">Lobby name</label>
            <input
              className="input"
              value={settings.lobbyName}
              onChange={(e) =>
                setSettings((s) => ({ ...s, lobbyName: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Starting stack</label>
              <input
                className="input"
                type="number"
                min={500}
                max={100000}
                value={settings.startingStack}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    startingStack: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Max players</label>
              <select
                className="input"
                value={settings.maxPlayers}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    maxPlayers: Number(e.target.value) as 2 | 3 | 4 | 5 | 6,
                  }))
                }
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Turn timer</label>
            <div className="flex flex-wrap gap-2">
              {([15, 30, 45, 60] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn !py-2 !text-sm ${
                    settings.turnTimerSec === t ? "btn-gold" : "btn-ghost"
                  }`}
                  onClick={() => setSettings((s) => ({ ...s, turnTimerSec: t }))}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Blind schedule</label>
            <div className="flex flex-wrap gap-2">
              {(["casual", "standard", "turbo", "custom"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn !py-2 !text-sm capitalize ${
                    settings.blindPreset === p ? "btn-gold" : "btn-ghost"
                  }`}
                  onClick={() => applyPreset(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {settings.blindPreset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Starting SB</label>
                <input
                  className="input"
                  type="number"
                  value={settings.startingSmallBlind}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      startingSmallBlind: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">Increase every (min)</label>
                <input
                  className="input"
                  type="number"
                  value={settings.blindIntervalMin}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      blindIntervalMin: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button className="btn btn-gold w-full" disabled={loading} type="submit">
            {loading ? "Creating…" : "Create lobby"}
          </button>
        </form>

        <form onSubmit={joinLobby} className="panel h-fit space-y-4 p-6 md:p-7">
          <h2 className="font-display text-2xl font-bold">Join with code</h2>
          <p className="text-sm text-[var(--cream)]/60">
            Got an invite? Paste the six-character code.
          </p>
          <input
            className="input text-center font-mono text-2xl uppercase tracking-[0.35em]"
            placeholder="ABC123"
            value={joinCode}
            maxLength={8}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button className="btn btn-ghost w-full" disabled={loading} type="submit">
            Join lobby
          </button>
        </form>
      </div>
    </div>
  );
}
