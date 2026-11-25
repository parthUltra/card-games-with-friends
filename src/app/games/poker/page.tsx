"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_POKER_SETTINGS, PokerLobbySettings } from "@/lib/games/registry";
import { PokerSettingsFields } from "@/components/PokerSettingsFields";

export default function PokerEntryPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [settings, setSettings] = useState<PokerLobbySettings>(DEFAULT_POKER_SETTINGS);

  async function createLobby(e: FormEvent) {
    e.preventDefault();
    setLoading("create");
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
        setLoading(null);
        return;
      }
      router.push(`/lobby/${data.code}`);
    } catch {
      setError("Something went wrong");
      setLoading(null);
    }
  }

  async function joinLobby(e: FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setLoading("join");
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
        setLoading(null);
        return;
      }
      router.push(`/lobby/${data.code || code}`);
    } catch {
      setError("Something went wrong");
      setLoading(null);
    }
  }

  // Keep the busy state until navigation lands so the button doesn't flash back.
  const busy = loading !== null;

  return (
    <div className="page-in">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)]">
        <Link href="/games" className="hover:text-[var(--text)]">
          Games
        </Link>
        <span aria-hidden> / </span>
        <span className="text-[var(--text)]">Texas Hold&apos;em</span>
      </nav>
      <h1 className="font-display mt-2 text-[28px] font-bold leading-tight md:text-[40px]">Texas Hold&apos;em</h1>
      <p className="mt-2 max-w-xl text-[var(--muted)]">
        Single-table tournament. Share a code, ready up, play until one stack remains.
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[#ff9b9e]">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
        {/* Join first on mobile: most people arrive with a code */}
        <form onSubmit={joinLobby} className="panel space-y-4 p-5 md:p-7 lg:order-2">
          <div>
            <h2 className="text-lg font-semibold">Join with a code</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Got an invite? Enter the six-character code.</p>
          </div>
          <label htmlFor="join-code" className="sr-only">
            Room code
          </label>
          <input
            id="join-code"
            className="input tnum text-center font-mono text-2xl font-semibold uppercase tracking-[0.35em]"
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={joinCode}
            maxLength={8}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button
            className="btn btn-ghost w-full"
            disabled={busy || !joinCode.trim()}
            aria-busy={loading === "join"}
            type="submit"
          >
            {loading === "join" && <span className="spinner" aria-hidden />}
            {loading === "join" ? "Joining…" : "Join table"}
          </button>
        </form>

        <form onSubmit={createLobby} className="panel space-y-5 p-5 md:p-7 lg:order-1">
          <div>
            <h2 className="text-lg font-semibold">Host a table</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">2–6 players · invite only</p>
          </div>

          <PokerSettingsFields settings={settings} setSettings={setSettings} />

          <button
            className="btn btn-gold btn-lg w-full"
            disabled={busy}
            aria-busy={loading === "create"}
            type="submit"
          >
            {loading === "create" && <span className="spinner" aria-hidden />}
            {loading === "create" ? "Opening table…" : "Create table"}
          </button>
        </form>
      </div>
    </div>
  );
}
