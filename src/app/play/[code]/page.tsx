"use client";

import "../table.css";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { CommunityBoard } from "@/components/CommunityBoard";
import { cardLabel } from "@/components/PlayingCard";
import { SeatHud } from "@/components/SeatHud";
import { useToast } from "@/components/ui/Toast";
import { ActionDock, type PreAction } from "@/components/table/ActionDock";
import { CountUp } from "@/components/table/CountUp";
import { FinishedScreen } from "@/components/table/FinishedScreen";
import { HandLogSheet } from "@/components/table/HandLogSheet";
import { Countdown } from "@/components/table/TurnRing";
import { buzz, isMuted, setMuted, sfx, subscribeMuted, unlockAudio } from "@/components/table/feedback";
import {
  BOARD_PT, HERO_PT, POT_PT, actionBadge, applyOptimistic, betPt, placeSeats, pollDelay, type HeroAction, type Pt,
} from "@/components/table/logic";
import type { PokerPrivateView } from "@/lib/poker/engine";
import { handRankLabel, type HandRankName } from "@/lib/poker/hand";

type Payload = {
  status: string;
  rev: number;
  serverNow: number;
  rematchCode: string | null;
  state: PokerPrivateView | null;
};
type View = { state: PokerPrivateView; skew: number; rematchCode: string | null };

const PENDING_LABEL: Record<HeroAction, string> = { fold: "Fold", check: "Check", call: "Call", raise: "Raise" };

const subscribeWide = (fn: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();

  const [view, setView] = useState<View | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [pending, setPending] = useState<HeroAction | "sit_in" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [pre, setPreState] = useState<PreAction>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 768px)").matches, () => false);
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);

  // Mutable mirror of what the poll loop and async actions need, so they never read stale closures.
  const live = useRef({
    state: null as PokerPrivateView | null,
    rev: 0,
    me: null as string | null,
    pre: null as PreAction,
    pending: false,
    lastChange: 0,
    kick: (() => {}) as (ms: number) => void,
  });

  const setPre = useCallback((p: PreAction) => {
    live.current.pre = p;
    setPreState(p);
  }, []);

  const toast = useToast();
  const showToast = useCallback((text: string) => toast(text, "error"), [toast]);

  const mySeatOf = (s: PokerPrivateView) => s.players.find((p) => p.id === live.current.me)?.seat;

  /** Apply a server payload: replace state wholesale, then derive sounds/haptics/announcements from the diff. */
  const applyPayload = useCallback(
    (data: Payload) => {
      if (data.status === "waiting") {
        router.replace(`/lobby/${code}`);
        return;
      }
      const next = data.state;
      if (!next) return;
      const prev = live.current.state;
      if (data.rev !== live.current.rev) live.current.lastChange = Date.now();
      live.current.rev = data.rev;
      live.current.state = next;
      setView({ state: next, skew: data.serverNow - Date.now(), rematchCode: data.rematchCode });

      const meId = live.current.me;
      const seat = mySeatOf(next);
      const myTurn = seat !== undefined && next.actingSeat === seat;
      const wasMyTurn = !!prev && seat !== undefined && prev.actingSeat === seat;
      const mine = next.players.find((p) => p.id === meId);
      const toCall = mine ? Math.max(0, Math.min(next.currentBet - mine.bet, mine.stack)) : 0;

      // Pre-actions: drop stale ones (amount changed / new hand), fire on our turn.
      let p = live.current.pre;
      if (p && (prev?.handNumber !== next.handNumber || (p.kind !== "callany" && p.kind !== "checkfold" && p.amount !== toCall))) {
        p = null;
        setPre(null);
      }
      if (!prev) return;

      let say = "";
      if (next.handNumber !== prev.handNumber) sfx.card();
      if (next.board.length > prev.board.length) {
        sfx.card();
        const street = next.board.length === 3 ? "Flop" : next.board.length === 4 ? "Turn" : "River";
        say = `${street}: ${next.board.slice(prev.board.length).map(cardLabel).join(", ")}`;
      } else if (next.pot > prev.pot) sfx.chip();
      if (next.lastAction && next.lastAction !== prev.lastAction && !say) say = next.lastAction;

      if (next.winners?.length && !prev.winners?.length) {
        if (next.winners.some((w) => w.id === meId)) {
          sfx.win();
          buzz([20, 30, 60]);
        }
      }

      if (myTurn && !wasMyTurn) {
        if (p) {
          const { legal } = next;
          const choice: HeroAction | null =
            p.kind === "checkfold" ? (legal.canCheck ? "check" : "fold")
            : p.kind === "check" ? (legal.canCheck ? "check" : null)
            : legal.canCheck ? "check" : "call";
          setPre(null);
          if (choice) {
            void act(choice);
            return;
          }
        }
        sfx.turn();
        buzz([15, 40, 15]);
        const secs = next.turnEndsAt ? Math.max(0, Math.round((next.turnEndsAt - data.serverNow) / 1000)) : null;
        setAssertive(`Your turn. ${next.legal.canCheck ? "Check available" : `${next.legal.callAmount} to call`}${secs ? `, ${secs} seconds` : ""}.`);
        return;
      }
      if (say) setPolite(say);
    },
    // act is stable enough: it only reads `live` and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, router, setPre],
  );

  /** Optimistic action: predict locally, POST, replace with server truth or roll back with a shake + toast. */
  async function act(action: HeroAction | "sit_in", raiseTo?: number) {
    const L = live.current;
    if (L.pending || !L.state || !L.me) return;
    unlockAudio();
    buzz(10);
    const before = L.state;
    L.pending = true;
    setPending(action);
    if (action !== "sit_in") {
      if (action !== "fold" && action !== "check") sfx.chip();
      const guess = applyOptimistic(before, L.me, action, raiseTo ?? 0);
      L.state = guess;
      setView((v) => (v ? { ...v, state: guess } : v));
    }
    try {
      const res = await fetch(`/api/lobbies/${code}/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, raiseTo: action === "raise" ? raiseTo : undefined }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      L.pending = false;
      applyPayload(data as Payload);
    } catch (err) {
      L.state = before;
      setView((v) => (v ? { ...v, state: before } : v));
      setShakeKey((k) => k + 1);
      buzz([30, 40, 30]);
      showToast((err as Error).message || "Connection problem — try again");
    } finally {
      L.pending = false;
      setPending(null);
      L.kick(250); // follow-up poll picks up whatever happened next
    }
  }

  // Poll loop: setTimeout chain with adaptive delay, cheap ?since= polls, focus refetch, error backoff.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let errors = 0;
    const L = live.current;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(run, ms);
    };
    L.kick = (ms) => schedule(ms);

    async function run() {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const since = L.rev && L.state ? `?since=${L.rev}` : "";
        // Timeout so a stalled request (network switch) can never wedge the loop.
        const res = await fetch(`/api/lobbies/${code}/game${since}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (res.status === 401) return router.replace("/login");
        if (res.status === 403 || res.status === 404) {
          const d = await res.json().catch(() => ({}));
          setFatal(d.error || "Could not join table");
          stopped = true;
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        if (res.status !== 204) {
          const data = (await res.json()) as Payload;
          if (!L.pending) applyPayload(data);
        }
        errors = 0;
        setReconnecting(false);
      } catch {
        errors++;
        if (errors >= 2) setReconnecting(true);
      } finally {
        inFlight = false;
      }
      let d = pollDelay({ state: L.state, meId: L.me, hidden: document.hidden, unchangedMs: Date.now() - L.lastChange, errors });
      // Wake right after a turn deadline so timeouts show up promptly.
      const ends = L.state?.turnEndsAt;
      if (ends && !errors) {
        const left = ends - Date.now();
        if (left > -3000) d = Math.min(d, Math.max(150, left + 200));
      }
      schedule(d);
    }

    const wake = () => {
      if (!document.hidden) schedule(0);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    (async () => {
      const { authClient } = await import("@/lib/auth-client");
      const { data } = await authClient.getSession();
      if (stopped) return;
      if (!data?.user) return router.replace("/login");
      L.me = data.user.id;
      setMe(data.user.id);
      L.lastChange = Date.now();
      schedule(0);
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, [code, router, applyPayload]);

  const state = view?.state ?? null;
  const mePlayer = state?.players.find((p) => p.id === me) ?? null;
  const isMyTurn = !!state && !!mePlayer && state.actingSeat === mePlayer.seat && !pending;

  // Tab title shows when it's your turn.
  useEffect(() => {
    const base = "Poker table · Card Games With Friends";
    document.title = isMyTurn ? "● Your turn" : base;
    return () => {
      document.title = base;
    };
  }, [isMyTurn]);

  const actor = state?.players.find((p) => p.seat === state.actingSeat) ?? null;

  async function lobbyAction(action: "leave" | "rematch") {
    const res = await fetch(`/api/lobbies/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || "Something went wrong");
      return null;
    }
    return data as { rematchCode: string | null };
  }

  async function leaveTable() {
    if (!leaveArmed) {
      setLeaveArmed(true);
      setTimeout(() => setLeaveArmed(false), 3000);
      return;
    }
    live.current.kick = () => {};
    await lobbyAction("leave");
    router.push("/games/poker");
  }

  async function rematch() {
    const target = view?.rematchCode ?? (await lobbyAction("rematch"))?.rematchCode;
    if (target) router.push(`/lobby/${target}`);
  }

  const toggleMute = () => {
    unlockAudio();
    setMuted(!muted);
  };

  if (fatal) {
    return (
      <div className="tbl">
        <div className="finish">
          <div className="finish-card">
            <p className="finish-kicker">Can&apos;t open table</p>
            <p style={{ margin: "12px 0 20px" }}>{fatal}</p>
            <button className="btn btn-gold" type="button" onClick={() => router.push("/games")}>
              Back to games
            </button>
          </div>
        </div>
      </div>
    );
  }

  const finished = state?.status === "finished" && state.placements;
  const totalMs = (state?.turnTimerSec ?? 30) * 1000;
  const clock = { endsAt: state?.turnEndsAt ?? null, totalMs, skew: view?.skew ?? 0 };
  const reveal = state?.status === "showdown";
  // Side pots can list the same winner twice: merge per player.
  const winners = [...(state?.winners ?? []).reduce((m, w) => {
    const prev = m.get(w.id);
    return m.set(w.id, { ...w, amount: (prev?.amount ?? 0) + w.amount, handName: prev?.handName ?? w.handName });
  }, new Map<string, { id: string; amount: number; handName?: string }>()).values()];
  const winnerIds = new Set(winners.map((w) => w.id));
  const seats = state ? placeSeats(state.players, me, wide) : null;
  const posOf = new Map<string, Pt>();
  if (seats) {
    if (seats.hero) posOf.set(seats.hero.id, HERO_PT);
    seats.opponents.forEach((o) => posOf.set(o.player.id, o.pt));
  }

  const statusLine = (() => {
    if (!state) return "Connecting…";
    if (state.status === "showdown") return "Showdown";
    if (state.status === "waiting") return state.message || "Next hand starting…";
    if (!actor) return state.message || "";
    return null;
  })();

  return (
    <MotionConfig reducedMotion="user">
      <div className="tbl">
        <header className="tbl-bar">
          <button
            type="button"
            className={`icon-btn ${leaveArmed ? "leave-armed" : ""}`}
            onClick={leaveTable}
            aria-label={leaveArmed ? "Confirm leave table" : "Leave table"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className={leaveArmed ? "" : "bar-label"}>{leaveArmed ? "Leave?" : "Leave"}</span>
          </button>

          <div className="bar-mid">
            {state && (
              <div className="bar-meta">
                Hand <b>#{state.handNumber}</b> · Blinds <b>{state.smallBlind}/{state.bigBlind}</b> · Lv {state.blindLevel}
                {state.status !== "waiting" && state.status !== "finished" && <> · {state.status[0].toUpperCase() + state.status.slice(1)}</>}
              </div>
            )}
            <div className="bar-status" aria-hidden>
              {statusLine ?? (
                <>
                  {actor?.id === me ? <span className="you">● Your turn</span> : <>{actor?.name} to act</>}
                  <Countdown endsAt={state?.turnEndsAt ?? null} skew={view?.skew ?? 0} />
                </>
              )}
            </div>
          </div>

          <div className="bar-right">
            <button type="button" className="icon-btn" onClick={() => setLogOpen(true)} aria-label="Open hand log" aria-haspopup="dialog">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </button>
            <button type="button" className="icon-btn" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute sounds" : "Mute sounds"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {muted ? <path d="M23 9l-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" />}
              </svg>
            </button>
          </div>
        </header>

        <AnimatePresence>
          {reconnecting && (
            <motion.div className="reconnect" role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <i /> Reconnecting…
            </motion.div>
          )}
        </AnimatePresence>

        {finished ? (
          <FinishedScreen
            placements={state.placements!}
            meId={me}
            rematchCode={view?.rematchCode ?? null}
            error={null}
            onRematch={rematch}
            onBack={() => router.push("/games")}
          />
        ) : (
          <>
            <div className="tbl-stage">
              <div className="felt-box">
                <div className="felt">
                  <span className="felt-mark">Texas Hold&apos;em</span>
                  {!state && (
                    <motion.p className="felt-msg" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                      Connecting to the table…
                    </motion.p>
                  )}
                </div>

                {state && seats && (
                  <>
                    <div className="at pot" style={{ left: `${POT_PT.x}%`, top: `${POT_PT.y}%` }} aria-label={`Pot ${state.pot}`}>
                      {state.pot > 0 && <motion.div className="pot-pill" key={state.handNumber} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                        <span className="tchip chip-gold" aria-hidden />
                        <span className="pot-label">Pot</span>
                        <CountUp value={state.pot} className="amt" />
                      </motion.div>}
                    </div>

                    <div className="at" style={{ left: `${BOARD_PT.x}%`, top: `${BOARD_PT.y}%` }}>
                      <CommunityBoard board={state.board} />
                    </div>

                    <AnimatePresence>
                      {winners.length && (reveal || state.status === "waiting") ? (
                        <motion.div
                          key={`win-${state.handNumber}`}
                          className="layer win-layer"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        >
                          <div className="at win-banner" style={{ left: "50%", top: "64%" }} role="status">
                          {winners.map((w, i) => {
                            const name = w.id === me ? "You" : (state.players.find((p) => p.id === w.id)?.name ?? "Player");
                            return (
                              <span key={w.id}>
                                {i > 0 && " · "}
                                {name} {w.id === me ? "win" : "wins"} <b>{w.amount.toLocaleString()}</b>
                                {w.handName ? ` · ${handRankLabel(w.handName as HandRankName)}` : ""}
                              </span>
                            );
                          })}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {/* Bets sit between seat and pot; on street end they slide into the pot. */}
                    <AnimatePresence>
                      {state.players.map((p) => {
                        const at = posOf.get(p.id);
                        if (!at || p.bet <= 0) return null;
                        const b = betPt(at);
                        return (
                          <motion.div
                            key={`bet-${p.id}-${state.handNumber}`}
                            className="layer"
                            initial={{ opacity: 0, x: `${(at.x - b.x) * 0.6}%`, y: `${(at.y - b.y) * 0.6}%` }}
                            animate={{ opacity: 1, x: "0%", y: "0%" }}
                            exit={{ opacity: 0, x: `${POT_PT.x - b.x}%`, y: `${POT_PT.y - b.y}%`, transition: { duration: 0.25 } }}
                            transition={{ type: "spring", stiffness: 600, damping: 40 }}
                          >
                            <div className="at" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
                              <BetChip amount={p.bet} bb={state.bigBlind} />
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {/* Pot flies to each winner. */}
                    <AnimatePresence>
                      {winners.map((w) => {
                        const to = posOf.get(w.id);
                        if (!to) return null;
                        return (
                          <motion.div
                            key={`fly-${state.handNumber}-${w.id}`}
                            className="layer"
                            initial={{ x: "0%", y: "0%", opacity: 1 }}
                            animate={{ x: `${to.x - POT_PT.x}%`, y: `${to.y - POT_PT.y}%`, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25, opacity: { delay: 0.3, duration: 0.2 } }}
                          >
                            <div className="at" style={{ left: `${POT_PT.x}%`, top: `${POT_PT.y}%` }}>
                              <BetChip amount={w.amount} bb={state.bigBlind} />
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {seats.opponents.map(({ player, pt }) => (
                      <div key={player.id} className="at seat" style={{ left: `${pt.x}%`, top: `${pt.y}%` }}>
                        <SeatHud
                          player={player}
                          active={state.actingSeat === player.seat}
                          idle={state.actingSeat != null && state.actingSeat !== player.seat}
                          isDealer={state.dealerSeat === player.seat}
                          reveal={reveal}
                          winner={winnerIds.has(player.id)}
                          badge={actionBadge(state.lastAction, player.name)}
                          clock={clock}
                          big={wide}
                        />
                      </div>
                    ))}
                    {seats.hero && (
                      <div className="at seat seat-hero" style={{ left: `${HERO_PT.x}%`, top: `${HERO_PT.y}%` }}>
                        <SeatHud
                          isHero
                          player={seats.hero}
                          active={state.actingSeat === seats.hero.seat}
                          idle={false}
                          isDealer={state.dealerSeat === seats.hero.seat}
                          reveal={reveal}
                          winner={winnerIds.has(seats.hero.id)}
                          badge={pending && pending !== "sit_in" ? PENDING_LABEL[pending] : actionBadge(state.lastAction, seats.hero.name)}
                          clock={clock}
                          big={wide}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {state && (
              <ActionDock
                state={state}
                me={mePlayer}
                isMyTurn={isMyTurn}
                pending={!!pending}
                shakeKey={shakeKey}
                pre={pre}
                setPre={setPre}
                onAct={(a, amt) => void act(a, amt)}
                onSitIn={() => void act("sit_in")}
              />
            )}
          </>
        )}


        <div className="sr-only" aria-live="polite">{polite}</div>
        <div className="sr-only" aria-live="assertive">{assertive}</div>

        <HandLogSheet open={logOpen} onClose={() => setLogOpen(false)} log={state?.log ?? []} />
      </div>
    </MotionConfig>
  );
}

function BetChip({ amount, bb }: { amount: number; bb: number }) {
  const tone = amount >= bb * 20 ? "chip-black" : amount >= bb * 5 ? "chip-blue" : amount >= bb ? "chip-green" : "";
  return (
    <span className="chip-stack">
      <span className={`tchip ${tone}`} aria-hidden />
      {amount.toLocaleString()}
    </span>
  );
}
