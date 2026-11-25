"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PokerLobbySettings } from "@/lib/games/registry";
import { PokerSettingsFields } from "@/components/PokerSettingsFields";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { IconChat, IconCheck, IconShare, IconX } from "@/components/ui/icons";

type LobbyPlayer = {
  userId: string;
  name: string;
  avatarId: string;
  ready: boolean;
};

type ChatMsg = { id: string; userId: string; name: string; text: string; at: number };

type LobbyMsg = {
  type: "lobby";
  code: string;
  hostUserId: string;
  status: "waiting" | "playing" | "finished";
  settings: PokerLobbySettings;
  players: LobbyPlayer[];
  chat: ChatMsg[];
};

type Busy = "ready" | "start" | "leave" | "settings" | "chat" | `kick:${string}` | null;

const POLL_MS = 1200;
const AFTER_ACTION_MS = 250;

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();
  const toast = useToast();
  const [lobby, setLobby] = useState<LobbyMsg | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<PokerLobbySettings | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChat, setSeenChat] = useState(0);
  const polling = useRef(true);
  // Bumped around every action so a poll that started earlier can't overwrite fresher state.
  const actionSeq = useRef(0);
  const pollSoon = useRef<(ms: number) => void>(() => {});

  const applyLobby = useCallback(
    (data: LobbyMsg) => {
      setLobby(data);
      // Finished tables show results + rematch on the play page
      if (data.status === "playing" || (data.status === "finished" && data.players.length > 0)) {
        // replace, not push: Back from the table must not bounce through this page again
        router.replace(`/play/${code}`);
      }
    },
    [code, router],
  );

  const refresh = useCallback(async () => {
    const seq = actionSeq.current;
    const res = await fetch(`/api/lobbies/${code}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      // Gone or no longer a member: stop polling. Anything else is transient; keep the last good view.
      if (res.status === 403 || res.status === 404) {
        polling.current = false;
        setError(data.error || "Could not load lobby");
      }
      return;
    }
    setError(null);
    if (seq === actionSeq.current) applyLobby(data);
  }, [applyLobby, code]);

  useEffect(() => {
    polling.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!cancelled && polling.current) timer = setTimeout(tick, ms);
    };
    async function tick() {
      // Paused while the tab is hidden; visibilitychange/focus restarts it.
      if (cancelled || !polling.current || document.hidden || inFlight) return;
      inFlight = true;
      try {
        await refresh();
      } catch {
        // keep trying
      } finally {
        inFlight = false;
      }
      schedule(POLL_MS);
    }
    const onWake = () => {
      if (!document.hidden) schedule(0);
    };

    (async () => {
      const { authClient } = await import("@/lib/auth-client");
      const { data } = await authClient.getSession();
      if (!data?.user) {
        router.replace(`/login`);
        return;
      }
      if (cancelled) return;
      setMe(data.user.id);

      const joinRes = await fetch(`/api/lobbies/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      const joinData = await joinRes.json();
      if (!joinRes.ok) {
        setError(joinData.error || "Could not join lobby");
        return;
      }
      if (cancelled) return;
      applyLobby(joinData);
      setSeenChat(joinData.chat?.length ?? 0);
      pollSoon.current = schedule;
      document.addEventListener("visibilitychange", onWake);
      window.addEventListener("focus", onWake);
      schedule(POLL_MS);
    })();

    return () => {
      cancelled = true;
      polling.current = false;
      clearTimeout(timer);
      pollSoon.current = () => {};
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [applyLobby, code, refresh, router]);

  async function post(body: Record<string, unknown>, kind: Busy) {
    setNotice(null);
    setBusy(kind);
    actionSeq.current++;
    try {
      const res = await fetch(`/api/lobbies/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || "Something went wrong");
        return null;
      }
      actionSeq.current++;
      applyLobby(data);
      return data as LobbyMsg;
    } catch {
      setNotice("Network hiccup. Try again.");
      return null;
    } finally {
      setBusy(null);
      pollSoon.current(AFTER_ACTION_MS);
    }
  }

  async function toggleReady() {
    // One request at a time: a double tap must not race ready/unready and roll back to stale state
    if (!lobby || !me || busy === "ready") return;
    const prev = lobby;
    const next = !lobby.players.find((p) => p.userId === me)?.ready;
    // Optimistic: flip now, roll back if the server refuses.
    setLobby({ ...lobby, players: lobby.players.map((p) => (p.userId === me ? { ...p, ready: next } : p)) });
    if (!(await post({ action: next ? "ready" : "unready" }, "ready"))) setLobby(prev);
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim()) return;
    const text = chatText;
    setChatText("");
    await post({ action: "chat", text }, "chat");
  }

  async function start() {
    if (await post({ action: "start" }, "start")) router.replace(`/play/${code}`);
  }

  async function leave() {
    polling.current = false;
    await post({ action: "leave" }, "leave");
    router.push("/games/poker");
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (draft && (await post({ action: "settings", settings: draft }, "settings"))) {
      setDraft(null);
      toast("Table settings updated", "success");
    }
  }

  async function share() {
    const url = `${window.location.origin}/join/${code}`;
    const name = lobby?.settings.lobbyName || "Poker";
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `Join my poker table "${name}" (code ${code})`, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied", "success");
    } catch {
      toast(`Couldn't copy. The code is ${code}`, "error");
    }
  }

  function closeChat() {
    setChatOpen(false);
    if (lobby) setSeenChat(lobby.chat.length);
  }

  if (error) {
    return (
      <div className="page-in mx-auto max-w-md pt-6">
        <div className="panel space-y-4 p-6 text-center">
          <p className="font-display text-xl font-bold">Can&apos;t open this table</p>
          <p role="alert" className="text-sm text-[#ff9b9e]">
            {error}
          </p>
          <div className="flex justify-center gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => location.reload()}>
              Retry
            </button>
            <button className="btn btn-gold" type="button" onClick={() => router.push("/games/poker")}>
              Back to poker
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lobby) return <LobbySkeleton />;

  const isHost = me === lobby.hostUserId;
  const mine = lobby.players.find((p) => p.userId === me);

  if (me && !mine) {
    return (
      <div className="page-in mx-auto max-w-md pt-6">
        <div className="panel space-y-4 p-6 text-center">
          <p className="font-display text-xl font-bold">
            {lobby.status === "waiting" ? "You are no longer in this lobby." : "This lobby has closed."}
          </p>
          <button className="btn btn-gold" type="button" onClick={() => router.push("/games/poker")}>
            Back to poker
          </button>
        </div>
      </div>
    );
  }

  const { settings } = lobby;
  const readyCount = lobby.players.filter((p) => p.ready).length;
  const canStart = lobby.players.length >= 2;
  const unread = chatOpen ? 0 : Math.max(0, lobby.chat.length - seenChat);

  const chat = (
    <ChatBody
      chat={lobby.chat}
      me={me}
      text={chatText}
      setText={setChatText}
      onSend={sendChat}
      sending={busy === "chat"}
    />
  );

  return (
    <div className="page-in grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-6">
      <div className="min-w-0 space-y-4">
        {/* Header: name + big room code */}
        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between md:p-6">
            <div className="min-w-0">
              <p className="eyebrow">Texas Hold&apos;em · Lobby</p>
              <h1 className="font-display mt-2 truncate text-[28px] font-bold leading-tight md:text-[40px]">
                {settings.lobbyName}
              </h1>
            </div>
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1 rounded-2xl border border-[var(--brass)]/40 bg-black/30 px-4 py-2 md:flex-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Room code</p>
                <p
                  className="tnum font-mono text-[28px] font-bold leading-tight tracking-[0.18em] text-[var(--brass-hi)]"
                  aria-label={`Room code ${lobby.code.split("").join(" ")}`}
                >
                  {lobby.code}
                </p>
              </div>
              <button type="button" onClick={share} className="btn btn-gold h-auto px-5" aria-label="Share invite link">
                <IconShare className="h-5 w-5" />
                <span>Share</span>
              </button>
            </div>
          </div>
          <dl className="tnum grid grid-cols-4 border-t border-white/[0.07] text-center">
            {[
              ["Stack", settings.startingStack.toLocaleString()],
              ["Blinds", `${settings.startingSmallBlind}/${settings.startingSmallBlind * 2}`],
              ["Timer", `${settings.turnTimerSec}s`],
              ["Seats", `${lobby.players.length}/${settings.maxPlayers}`],
            ].map(([k, v], i) => (
              <div key={k} className={`px-1 py-3 ${i ? "border-l border-white/[0.07]" : ""}`}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{k}</dt>
                <dd className="mt-0.5 text-sm font-semibold md:text-base">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Seats */}
        <section aria-labelledby="seats-h">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="seats-h" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Seats
            </h2>
            <p className="tnum text-sm text-[var(--muted)]" aria-live="polite">
              {readyCount} of {lobby.players.length} ready
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: settings.maxPlayers }).map((_, i) => {
              const p = lobby.players[i];
              if (!p) {
                return (
                  <li
                    key={`empty-${i}`}
                    className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] p-3 text-center"
                  >
                    <span className="tnum grid h-12 w-12 place-items-center rounded-full border border-dashed border-white/15 text-sm text-[var(--muted)]">
                      {i + 1}
                    </span>
                    <span className="text-xs text-[var(--muted)]">Waiting for player…</span>
                  </li>
                );
              }
              const host = p.userId === lobby.hostUserId;
              const you = p.userId === me;
              const kicking = busy === `kick:${p.userId}`;
              return (
                <motion.li
                  key={p.userId}
                  layout
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className={`relative flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-colors duration-200 ${
                    p.ready
                      ? "border-[var(--action)]/45 bg-[var(--action)]/[0.06]"
                      : "border-white/[0.09] bg-[var(--surface-2)]/70"
                  }`}
                >
                  {isHost && !you && (
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 grid h-11 w-11 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--danger)] disabled:opacity-40"
                      onClick={() => post({ action: "kick", userId: p.userId }, `kick:${p.userId}`)}
                      disabled={kicking}
                      aria-label={`Remove ${p.name}`}
                      title={`Remove ${p.name}`}
                    >
                      {kicking ? <span className="spinner" /> : <IconX className="h-4 w-4" />}
                    </button>
                  )}
                  <Avatar id={p.avatarId} size={48} ring={you} />
                  <p className="w-full truncate px-5 text-sm font-semibold">
                    {p.name}
                    {you && <span className="font-normal text-[var(--muted)]"> (you)</span>}
                  </p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {host && <span className="badge border-[var(--brass)]/45 text-[var(--brass-hi)]">Host</span>}
                    {p.ready ? (
                      <span className="badge bg-[var(--action)] text-[#04140c]">
                        Ready <IconCheck className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="badge border-white/15 text-[var(--muted)]">Not ready</span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </section>

        {/* Host settings editor */}
        <AnimatePresence initial={false}>
          {draft && (
            <motion.form
              key="settings"
              onSubmit={saveSettings}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2 }}
              className="panel space-y-5 p-5 md:p-6"
              aria-label="Edit table settings"
            >
              <h2 className="text-lg font-semibold">Table settings</h2>
              <PokerSettingsFields
                settings={draft}
                setSettings={setDraft as React.Dispatch<React.SetStateAction<PokerLobbySettings>>}
              />
              <div className="flex gap-2">
                <button
                  className="btn btn-gold flex-1 sm:flex-none"
                  type="submit"
                  disabled={busy === "settings"}
                  aria-busy={busy === "settings"}
                >
                  {busy === "settings" && <span className="spinner" aria-hidden />}
                  Save settings
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Action dock: sticks above the bottom tab bar on mobile */}
        <section
          aria-label="Your actions"
          className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 space-y-2.5 rounded-[20px] border border-white/[0.11] bg-[var(--surface)]/95 p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl md:static md:bg-[var(--surface)]/85 md:p-4 md:shadow-[var(--shadow-1)]"
        >
          {notice && (
            <p role="alert" className="rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-sm text-[#ff9b9e]">
              {notice}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="btn btn-ghost btn-lg relative w-14 shrink-0 !px-0 lg:hidden"
              aria-label={`Open chat${unread ? `, ${unread} new` : ""}`}
            >
              <IconChat className="h-5 w-5" />
              {unread > 0 && (
                <span className="tnum absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brass)] px-1 text-[11px] font-bold text-[var(--ink)]">
                  {unread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={toggleReady}
              aria-pressed={!!mine?.ready}
              className={`btn btn-lg min-w-0 flex-1 ${
                mine?.ready ? "btn-ghost !border-[var(--action)]/60 !text-[var(--action)]" : "btn-action"
              }`}
            >
              {mine?.ready ? (
                <>
                  <IconCheck className="h-5 w-5" /> Ready
                </>
              ) : (
                "I'm ready"
              )}
            </button>
            {isHost && (
              <button
                className="btn btn-gold btn-lg min-w-0 flex-1"
                type="button"
                onClick={start}
                disabled={!canStart || busy === "start"}
                aria-busy={busy === "start"}
              >
                {busy === "start" && <span className="spinner" aria-hidden />}
                {busy === "start" ? "Dealing…" : "Start game"}
              </button>
            )}
          </div>
          <p className="tnum text-center text-xs text-[var(--muted)]">
            {isHost
              ? !canStart
                ? "Need at least 2 players. Share the code."
                : readyCount < lobby.players.length
                  ? "Not everyone is ready yet. You can still start."
                  : "Everyone's ready. Deal them in."
              : mine?.ready
                ? "Waiting for host to start…"
                : "Tap ready when you're set. The host starts the game."}
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {isHost && !draft && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDraft(lobby.settings)}>
              Edit settings
            </button>
          )}
          <button
            className="btn btn-danger btn-sm ml-auto"
            type="button"
            onClick={leave}
            disabled={busy === "leave"}
            aria-busy={busy === "leave"}
          >
            {busy === "leave" && <span className="spinner" aria-hidden />}
            Leave table
          </button>
        </div>
      </div>

      {/* Desktop chat column */}
      <aside className="panel hidden h-[560px] flex-col p-4 lg:sticky lg:top-20 lg:flex" aria-label="Table chat">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Table chat</h2>
        {chat}
      </aside>

      {/* Mobile chat drawer */}
      <AnimatePresence>
        {chatOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeChat}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Table chat"
              className="absolute inset-x-0 bottom-0 flex h-[72dvh] flex-col rounded-t-3xl border-t border-white/10 bg-[var(--surface)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 500, damping: 42 }}
              onKeyDown={(e) => e.key === "Escape" && closeChat()}
            >
              <div className="mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-white/15" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Table chat</h2>
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/[0.06]"
                  onClick={closeChat}
                  aria-label="Close chat"
                >
                  <IconX className="h-5 w-5" />
                </button>
              </div>
              {chat}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatBody({
  chat,
  me,
  text,
  setText,
  onSend,
  sending,
}: {
  chat: ChatMsg[];
  me: string | null;
  text: string;
  setText: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  sending: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  return (
    <>
      <div
        ref={scroller}
        className="flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-xl bg-black/25 p-3 text-sm"
        aria-live="polite"
      >
        {chat.length === 0 && <p className="py-8 text-center text-[var(--muted)]">Say hi before the cards fly.</p>}
        {chat.map((m) => {
          const mineMsg = m.userId === me;
          return (
            <div key={m.id} className={`flex flex-col ${mineMsg ? "items-end" : "items-start"}`}>
              {!mineMsg && <span className="mb-0.5 px-1 text-xs font-semibold text-[var(--brass)]">{m.name}</span>}
              <p
                className={`max-w-[85%] break-words rounded-2xl px-3 py-2 ${
                  mineMsg ? "rounded-br-md bg-[var(--felt-hi)] text-[var(--ivory)]" : "rounded-bl-md bg-[var(--surface-2)]"
                }`}
              >
                {m.text}
              </p>
            </div>
          );
        })}
      </div>
      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          aria-label="Chat message"
          maxLength={280}
        />
        <button className="btn btn-gold" type="submit" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </>
  );
}

function LobbySkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-6" aria-busy="true">
      <p className="sr-only" role="status">
        Connecting to lobby…
      </p>
      <div className="space-y-4">
        <div className="panel space-y-4 p-5 md:p-6">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-9 w-56" />
          <div className="skeleton h-14 w-full md:w-64" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[132px] rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-24 rounded-[20px]" />
      </div>
      <div className="skeleton hidden h-[560px] rounded-[20px] lg:block" />
    </div>
  );
}
