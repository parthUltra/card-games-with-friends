"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PartySocket from "partysocket";
import { avatarSrc } from "@/lib/avatars";
import { PokerLobbySettings } from "@/lib/games/registry";

type LobbyPlayer = {
  userId: string;
  name: string;
  avatarId: string;
  ready: boolean;
  connectionId?: string;
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
  const [socket, setSocket] = useState<PartySocket | null>(null);

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${code}`;
  }, [code]);

  const connect = useCallback(async () => {
    // Ensure membership in Mongo
    await fetch(`/api/lobbies/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join" }),
    });

    const tokenRes = await fetch(`/api/lobbies/${code}/token`, { method: "POST" });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      setError(tokenData.error || "Could not connect");
      return;
    }

    const host = tokenData.host || process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    const ws = new PartySocket({
      host,
      room: code,
      query: { token: tokenData.token },
    });

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.type === "lobby") {
        setLobby(msg);
        if (msg.status === "playing") {
          router.push(`/play/${code}`);
        }
      }
      if (msg.type === "error") setError(msg.message);
    });

    setSocket(ws);
    // decode user from token payload is awkward; get session
    const sessionRes = await fetch("/api/auth/get-session").catch(() => null);
    // better-auth session endpoint
  }, [code, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { authClient } = await import("@/lib/auth-client");
      const { data } = await authClient.getSession();
      if (!data?.user) {
        router.replace(`/login`);
        return;
      }
      if (!cancelled) setMe(data.user.id);
      await connect();
    })();
    return () => {
      cancelled = true;
      socket?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!socket || !chatText.trim()) return;
    socket.send(JSON.stringify({ type: "chat", text: chatText }));
    setChatText("");
  }

  function ready() {
    socket?.send(JSON.stringify({ type: "ready" }));
  }

  function start() {
    socket?.send(JSON.stringify({ type: "start" }));
    router.push(`/play/${code}`);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
  }

  if (error) {
    return (
      <div className="panel p-6">
        <p className="text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!lobby) {
    return <p className="text-[var(--cream)]/70">Connecting to lobby…</p>;
  }

  const isHost = me === lobby.hostUserId;

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
            Copy invite link
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
                        {p.connectionId ? "" : " · offline"}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--cream)]/40">Empty seat</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-ghost" type="button" onClick={ready}>
            I&apos;m ready
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
        </div>
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
