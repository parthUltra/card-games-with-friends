"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { avatarSrc } from "@/lib/avatars";
import { PokerLobbySettings } from "@/lib/games/registry";
import { PokerSettingsFields } from "@/components/PokerSettingsFields";

type LobbyPlayer = {
  userId: string;
  name: string;
  avatarId: string;
  ready: boolean;
};

type LobbyMsg = {
  type: "lobby";
  code: string;
  hostUserId: string;
  status: "waiting" | "playing" | "finished";
  settings: PokerLobbySettings;
  players: LobbyPlayer[];
  chat: { id: string; userId: string; name: string; text: string; at: number }[];
};

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();
  const [lobby, setLobby] = useState<LobbyMsg | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<PokerLobbySettings | null>(null);
  const polling = useRef(true);

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${code}`;
  }, [code]);

  const applyLobby = useCallback(
    (data: LobbyMsg) => {
      setLobby(data);
      // Finished tables show results + rematch on the play page
      if (data.status === "playing" || (data.status === "finished" && data.players.length > 0)) {
        router.push(`/play/${code}`);
      }
    },
    [code, router],
  );

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/lobbies/${code}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load lobby");
      return;
    }
    applyLobby(data);
  }, [applyLobby, code]);

  useEffect(() => {
    polling.current = true;
    let cancelled = false;

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
      if (!cancelled) applyLobby(joinData);

      while (polling.current && !cancelled) {
        await new Promise((r) => setTimeout(r, 1200));
        if (!polling.current || cancelled) break;
        try {
          await refresh();
        } catch {
          // keep trying
        }
      }
    })();

    return () => {
      cancelled = true;
      polling.current = false;
    };
  }, [applyLobby, code, refresh, router]);

  async function post(body: Record<string, unknown>) {
    setNotice(null);
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
    applyLobby(data);
    return data as LobbyMsg;
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim()) return;
    const text = chatText;
    setChatText("");
    await post({ action: "chat", text });
  }

  async function start() {
    if (await post({ action: "start" })) router.push(`/play/${code}`);
  }

  async function leave() {
    polling.current = false;
    await post({ action: "leave" });
    router.push("/games/poker");
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (draft && (await post({ action: "settings", settings: draft }))) setDraft(null);
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy link");
    }
  }

  if (error) {
    return (
      <div className="panel space-y-3 p-6">
        <p className="text-[var(--danger)]">{error}</p>
        <button className="btn btn-ghost" type="button" onClick={() => location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="panel p-6">
        <p className="text-[var(--cream)]/70">Connecting to lobby…</p>
        <p className="mt-2 text-xs text-[var(--cream)]/40">
          Syncing seats over the network…
        </p>
      </div>
    );
  }

  const isHost = me === lobby.hostUserId;
  const mine = lobby.players.find((p) => p.userId === me);

  if (me && !mine) {
    return (
      <div className="panel space-y-3 p-6">
        <p>{lobby.status === "waiting" ? "You are no longer in this lobby." : "This lobby has closed."}</p>
        <button className="btn btn-gold" type="button" onClick={() => router.push("/games/poker")}>
          Back to poker
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="panel space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--cream)]/45">
              Texas Hold&apos;em lobby
            </p>
            <h1 className="font-display mt-1 text-3xl font-bold">
              {lobby.settings.lobbyName}
            </h1>
            <p className="mt-1 text-sm text-[var(--cream)]/70">
              Code{" "}
              <span className="font-mono text-lg font-semibold text-[var(--gold)]">
                {lobby.code}
              </span>{" "}
              · {lobby.settings.startingStack} chips · blinds{" "}
              {lobby.settings.startingSmallBlind}/
              {lobby.settings.startingSmallBlind * 2} · timer{" "}
              {lobby.settings.turnTimerSec}s
            </p>
          </div>
          <button className="btn btn-ghost !py-2 !text-sm" onClick={copyInvite} type="button">
            {copied ? "Copied" : "Copy invite link"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: lobby.settings.maxPlayers }).map((_, i) => {
            const p = lobby.players[i];
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3"
              >
                {p ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarSrc(p.avatarId)}
                      alt=""
                      className="h-12 w-12 rounded-full"
                    />
                    <div>
                      <p className="font-semibold">
                        {p.name}
                        {p.userId === lobby.hostUserId ? " · Host" : ""}
                      </p>
                      <p className="text-xs text-[var(--cream)]/60">
                        {p.ready ? "Ready" : "Joined"}
                      </p>
                    </div>
                    {isHost && p.userId !== me && (
                      <button
                        className="btn btn-ghost ml-auto !px-3 !py-1 !text-xs"
                        type="button"
                        onClick={() => post({ action: "kick", userId: p.userId })}
                        aria-label={`Remove ${p.name}`}
                      >
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[var(--cream)]/40">Empty seat</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => post({ action: mine?.ready ? "unready" : "ready" })}
          >
            {mine?.ready ? "Not ready" : "I'm ready"}
          </button>
          {isHost && (
            <button
              className="btn btn-gold"
              type="button"
              onClick={start}
              disabled={lobby.players.length < 2}
            >
              Start tournament
            </button>
          )}
          {isHost && !draft && (
            <button className="btn btn-ghost" type="button" onClick={() => setDraft(lobby.settings)}>
              Edit settings
            </button>
          )}
          <button className="btn btn-danger ml-auto" type="button" onClick={leave}>
            Leave
          </button>
        </div>
        {notice && <p className="text-sm text-[var(--danger)]">{notice}</p>}
        {isHost && lobby.players.some((p) => !p.ready) && (
          <p className="text-xs text-[var(--cream)]/50">
            Not everyone is ready yet. You can still start.
          </p>
        )}

        {draft && (
          <form onSubmit={saveSettings} className="space-y-4 rounded-xl border border-[var(--line)] bg-black/20 p-4">
            <PokerSettingsFields
              settings={draft}
              setSettings={setDraft as React.Dispatch<React.SetStateAction<PokerLobbySettings>>}
            />
            <div className="flex gap-2">
              <button className="btn btn-gold" type="submit">Save settings</button>
              <button className="btn btn-ghost" type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="panel flex h-[420px] flex-col p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Table chat</h2>
        <div className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-black/20 p-3 text-sm">
          {lobby.chat.length === 0 && (
            <p className="text-[var(--cream)]/40">Say hi before the cards fly.</p>
          )}
          {lobby.chat.map((m) => (
            <p key={m.id}>
              <span className="font-semibold text-[var(--gold)]">{m.name}: </span>
              {m.text}
            </p>
          ))}
        </div>
        <form onSubmit={sendChat} className="mt-3 flex gap-2">
          <input
            className="input"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Message…"
          />
          <button className="btn btn-gold" type="submit">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
