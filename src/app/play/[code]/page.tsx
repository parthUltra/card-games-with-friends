"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "@/components/PlayingCard";
import { CommunityBoard } from "@/components/CommunityBoard";
import { RaiseControls } from "@/components/RaiseControls";
import { SeatHud } from "@/components/SeatHud";
import { avatarSrc } from "@/lib/avatars";
import type { PokerPrivateView } from "@/lib/poker/engine";
import { handRankLabel } from "@/lib/poker/hand";

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();
  const [state, setState] = useState<PokerPrivateView | null>(null);
  const [raiseTo, setRaiseTo] = useState(0);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const [heroDealKey, setHeroDealKey] = useState("");
  const [acting, setActing] = useState(false);
  const lastActionRef = useRef<string>("");
  const raiseBoundsRef = useRef({ min: 0, max: 0 });
  const polling = useRef(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const ingest = (next: PokerPrivateView) => {
    setState(next);

    if (next.lastAction && next.lastAction !== lastActionRef.current) {
      lastActionRef.current = next.lastAction;
      setActionFlash(next.lastAction);
    }

    const min = next.legal?.minRaiseTo ?? 0;
    const max = next.legal?.maxRaiseTo ?? 0;
    if (
      min !== raiseBoundsRef.current.min ||
      max !== raiseBoundsRef.current.max
    ) {
      raiseBoundsRef.current = { min, max };
      if (next.legal?.canRaise) setRaiseTo(min);
    }
  };

  useEffect(() => {
    polling.current = true;
    let cancelled = false;

    (async () => {
      const { authClient } = await import("@/lib/auth-client");
      const { data } = await authClient.getSession();
      if (!data?.user) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      setMe(data.user.id);

      while (polling.current && !cancelled) {
        try {
          const res = await fetch(`/api/lobbies/${code}/game`);
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Could not join table");
            break;
          }
          if (data.state) ingest(data.state as PokerPrivateView);
          else if (data.status === "waiting") {
            router.replace(`/lobby/${code}`);
            break;
          }
        } catch {
          // retry
        }
        await new Promise((r) => setTimeout(r, 900));
      }
    })();

    return () => {
      cancelled = true;
      polling.current = false;
    };
  }, [code, router]);

  useEffect(() => {
    if (!actionFlash) return;
    const t = setTimeout(() => setActionFlash(null), 2200);
    return () => clearTimeout(t);
  }, [actionFlash]);

  const timerLeftSec = useMemo(() => {
    if (!state?.turnEndsAt) return null;
    return Math.max(0, Math.ceil((state.turnEndsAt - now) / 1000));
  }, [state, now]);

  const timerPct = useMemo(() => {
    if (!state?.turnEndsAt) return 0;
    const total = state.turnTimerSec * 1000;
    const left = Math.max(0, state.turnEndsAt - now);
    return Math.min(100, (left / total) * 100);
  }, [state, now]);

  const holeKey = state?.myHole.map((c) => `${c.rank}${c.suit}`).join("-") ?? "";
  const dealHero = Boolean(holeKey && holeKey !== heroDealKey);

  useEffect(() => {
    if (holeKey && holeKey !== heroDealKey) {
      setHeroDealKey(holeKey);
    }
  }, [holeKey, heroDealKey]);

  async function act(action: "fold" | "check" | "call" | "raise") {
    if (acting) return;
    setActing(true);
    try {
      const res = await fetch(`/api/lobbies/${code}/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          raiseTo: action === "raise" ? raiseTo : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
        return;
      }
      if (data.state) ingest(data.state as PokerPrivateView);
    } finally {
      setActing(false);
    }
  }

  if (error) {
    return <div className="panel p-6 text-[var(--danger)]">{error}</div>;
  }

  if (!state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="text-[var(--cream)]/70"
        >
          Connecting to the table…
        </motion.p>
      </div>
    );
  }

  if (state.status === "finished" && state.placements) {
    return (
      <div className="panel mx-auto max-w-lg p-6">
        <h1 className="font-display text-3xl font-bold">Tournament over</h1>
        <ol className="mt-6 space-y-3">
          {state.placements.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-black/20 p-3"
            >
              <span className="w-8 font-display text-xl text-[var(--gold)]">
                #{p.place}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarSrc(p.avatarId)}
                alt=""
                className="h-10 w-10 rounded-full"
              />
              <span className="font-semibold">{p.name}</span>
            </li>
          ))}
        </ol>
        <button
          className="btn btn-gold mt-6"
          type="button"
          onClick={() => router.push("/games")}
        >
          Back to games
        </button>
      </div>
    );
  }

  const opponents = state.players.filter((p) => p.id !== me);
  const mePlayer = state.players.find((p) => p.id === me);
  const isMyTurn = state.actingSeat === mePlayer?.seat;
  const actor = state.players.find((p) => p.seat === state.actingSeat);
  const showRaise = Boolean(state.legal.canRaise && isMyTurn);

  return (
    <div className="play-shell mx-auto flex max-w-5xl flex-col gap-3 pb-2">
      {/* Top status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-[var(--gold)]/15 px-2.5 py-1 font-semibold text-[var(--gold-soft)]">
            Hand #{state.handNumber}
          </span>
          <span className="text-[var(--cream)]/70">
            Blinds{" "}
            <strong className="text-[var(--cream)]">
              {state.smallBlind}/{state.bigBlind}
            </strong>
          </span>
          <span className="hidden text-[var(--cream)]/45 sm:inline">
            Level {state.blindLevel}
          </span>
        </div>
        <div className="text-right text-sm">
          {actor && state.status !== "waiting" && state.status !== "showdown" ? (
            <p>
              <span className="text-[var(--cream)]/55">Acting · </span>
              <span className="font-semibold text-[var(--gold)]">
                {actor.id === me ? "You" : actor.name}
              </span>
              {timerLeftSec !== null && (
                <span className="ml-2 tabular-nums text-[var(--cream)]/70">
                  {timerLeftSec}s
                </span>
              )}
            </p>
          ) : (
            <p className="text-[var(--cream)]/55">{state.message || "—"}</p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="felt-table relative overflow-hidden rounded-[1.75rem] md:rounded-[2.25rem]">
        <div className="pointer-events-none absolute inset-0 table-vignette" />

        <AnimatePresence>
          {actionFlash && (
            <motion.div
              key={actionFlash}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-[var(--gold)]/30 bg-black/70 px-4 py-1.5 text-sm font-semibold text-[var(--cream)] shadow-lg backdrop-blur"
            >
              {actionFlash}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative grid min-h-[380px] grid-rows-[auto_1fr_auto] gap-4 px-3 py-5 md:min-h-[460px] md:px-8 md:py-7">
          {/* Opponents */}
          <div className="flex flex-wrap items-start justify-center gap-3 md:gap-4">
            {opponents.map((p) => (
              <SeatHud
                key={p.id}
                player={p}
                active={state.actingSeat === p.seat}
                isDealer={state.dealerSeat === p.seat}
                reveal={state.status === "showdown"}
              />
            ))}
            {opponents.length === 0 && (
              <p className="text-sm text-[var(--cream)]/40">Waiting for seats…</p>
            )}
          </div>

          {/* Board + pot */}
          <div className="flex flex-col items-center justify-center gap-4">
            <CommunityBoard board={state.board} street={state.status} />
            <motion.div
              key={state.pot}
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              className="pot-chip flex items-center gap-2 rounded-full px-5 py-2"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cream)]/55">
                Pot
              </span>
              <span className="font-display text-xl font-bold tabular-nums text-[var(--gold)]">
                {state.pot.toLocaleString()}
              </span>
            </motion.div>

            {state.winners && state.winners.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-[var(--gold-soft)]"
              >
                {state.winners
                  .map((w) => {
                    const name =
                      state.players.find((p) => p.id === w.id)?.name ?? "Player";
                    return `${name} +${w.amount.toLocaleString()}`;
                  })
                  .join(" · ")}
              </motion.p>
            )}
          </div>

          {/* Spacer for hero bet chip near bottom of felt */}
          <div className="flex justify-center">
            {mePlayer && mePlayer.bet > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-full bg-black/55 px-3 py-1 text-xs font-semibold"
              >
                Your bet {mePlayer.bet.toLocaleString()}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Hero dock */}
      <div
        className={`action-dock panel space-y-3 p-4 md:p-5 ${
          isMyTurn ? "action-dock-live" : ""
        }`}
      >
        {isMyTurn && (
          <div className="h-1.5 overflow-hidden rounded-full bg-black/35">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)]"
              style={{ width: `${timerPct}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--cream)]/50">
                Your hand
                {mePlayer?.handName
                  ? ` · ${handRankLabel(mePlayer.handName as never)}`
                  : ""}
              </p>
              <div className="flex gap-2">
                {(state.myHole.length ? state.myHole : [null, null]).map(
                  (card, i) => (
                    <PlayingCard
                      key={card ? `${card.rank}${card.suit}` : `empty-${i}`}
                      card={card}
                      faceDown={!card}
                      size="xl"
                      deal={dealHero}
                      flipIn={dealHero}
                      delay={i * 0.12}
                    />
                  ),
                )}
              </div>
            </div>
            <div className="pb-1">
              <p className="text-[11px] uppercase tracking-wider text-[var(--cream)]/45">
                Stack
              </p>
              <p className="font-display text-2xl font-bold tabular-nums text-[var(--gold-soft)]">
                {(mePlayer?.stack ?? 0).toLocaleString()}
              </p>
              {mePlayer && state.dealerSeat === mePlayer.seat && (
                <p className="mt-1 text-xs text-[var(--cream)]/50">Dealer</p>
              )}
            </div>
          </div>

          <div className="w-full space-y-3 lg:max-w-md">
            {!isMyTurn && (
              <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-sm text-[var(--cream)]/55">
                Waiting for {actor?.name ?? "next player"}…
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                className="btn btn-danger !rounded-xl"
                disabled={!state.legal.canFold || !isMyTurn || acting}
                onClick={() => act("fold")}
                type="button"
              >
                Fold
              </button>
              {state.legal.canCheck ? (
                <button
                  className="btn btn-ghost !rounded-xl"
                  disabled={!isMyTurn || acting}
                  onClick={() => act("check")}
                  type="button"
                >
                  Check
                </button>
              ) : (
                <button
                  className="btn btn-ghost !rounded-xl"
                  disabled={!state.legal.canCall || !isMyTurn || acting}
                  onClick={() => act("call")}
                  type="button"
                >
                  Call {state.legal.callAmount.toLocaleString()}
                </button>
              )}
              {!showRaise && (
                <button
                  className="btn btn-gold !rounded-xl col-span-2 sm:col-span-1"
                  disabled
                  type="button"
                >
                  Raise
                </button>
              )}
            </div>

            <RaiseControls
              enabled={showRaise}
              minRaiseTo={state.legal.minRaiseTo}
              maxRaiseTo={state.legal.maxRaiseTo}
              pot={state.pot}
              callAmount={state.legal.callAmount}
              value={raiseTo}
              onChange={setRaiseTo}
              onRaise={() => act("raise")}
              disabled={!isMyTurn || acting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
