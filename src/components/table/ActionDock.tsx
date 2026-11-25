"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import { RaiseControls } from "@/components/RaiseControls";
import { CountUp } from "@/components/table/CountUp";
import { raisePresets, snapToBB, type HeroAction } from "@/components/table/logic";
import type { PlayerPublic, PokerPrivateView } from "@/lib/poker/engine";
import { handRankLabel, type HandRankName } from "@/lib/poker/hand";

export type PreAction = { kind: "checkfold" | "check" | "call" | "callany"; amount: number } | null;

type Props = {
  state: PokerPrivateView;
  me: PlayerPublic | null;
  isMyTurn: boolean;
  pending: boolean;
  /** Disable keyboard shortcuts (e.g. while a modal sheet is open) */
  shortcutsOff?: boolean;
  shakeKey: number;
  pre: PreAction;
  setPre: (p: PreAction) => void;
  onAct: (action: HeroAction, raiseTo?: number) => void;
  onSitIn: () => void;
};

const LIVE = new Set(["preflop", "flop", "turn", "river"]);
const tap = { scale: 0.96 };

export function ActionDock({ state, me, isMyTurn, pending, shortcutsOff, shakeKey, pre, setPre, onAct, onSitIn }: Props) {
  const { legal } = state;
  // Which turn the raise sheet was opened for; it closes itself when that turn is over
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [raiseTo, setRaiseTo] = useState(0);
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const controls = useAnimationControls();

  const presets = raisePresets(state);
  const min = legal.minRaiseTo;
  const max = legal.maxRaiseTo;
  const value = Math.max(min, Math.min(max, raiseTo));
  const verb: "Bet" | "Raise" = state.currentBet === 0 ? "Bet" : "Raise";
  const turnKey = isMyTurn ? `${state.handNumber}:${state.board.length}:${state.currentBet}` : null;
  const sheetOpen = sheetFor !== null && sheetFor === turnKey && legal.canRaise;
  const callLabel = legal.canCheck ? "Check" : `Call ${legal.callAmount.toLocaleString()}`;

  useEffect(() => {
    if (shakeKey) void controls.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.15 } });
  }, [shakeKey, controls]);
  useEffect(() => () => clearTimeout(armTimer.current), []);

  const closeSheet = () => {
    setSheetFor(null);
    setArmed(false);
  };
  const fire = (a: HeroAction, amt?: number) => {
    closeSheet();
    onAct(a, amt);
  };
  const primary = () => {
    if (!legal.canRaise) return;
    if (!sheetOpen) {
      setRaiseTo(presets[0]?.amount ?? min);
      setArmed(false);
      setSheetFor(turnKey);
      return;
    }
    if (value === max && !armed) {
      setArmed(true);
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    fire("raise", value);
  };
  const callOrCheck = () => (legal.canCheck ? fire("check") : legal.canCall ? fire("call") : undefined);

  // Desktop shortcuts; ignored while typing or with modifiers.
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !isMyTurn || pending || shortcutsOff) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("textarea, input:not([type=range]), [role=dialog]")) return;
    const k = e.key.toLowerCase();
    // Enter/Space on a focused button should press that button, not raise
    if ((k === "enter" || k === " ") && t?.closest("button")) return;
    if (k === "f" && legal.canFold) fire("fold");
    else if (k === "c") callOrCheck();
    else if (k === "r" || (k === "enter" && sheetOpen)) primary();
    else if (k === "escape" && sheetOpen) closeSheet();
    else if (sheetOpen && /^[1-5]$/.test(k) && presets[Number(k) - 1]) setRaiseTo(presets[Number(k) - 1].amount);
    else if (sheetOpen && (k === "arrowup" || k === "arrowdown") && t?.getAttribute("type") !== "range")
      setRaiseTo(snapToBB(value + (k === "arrowup" ? 1 : -1) * state.bigBlind, min, max, state.bigBlind));
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const inHand = !!me && LIVE.has(state.status) && !me.folded && !me.busted && me.holeCount > 0;
  const toCall = me ? Math.max(0, Math.min(state.currentBet - me.bet, me.stack)) : 0;
  const canPre = inHand && !isMyTurn && !me!.allIn && !me!.sittingOut;
  const togglePre = (kind: NonNullable<PreAction>["kind"]) =>
    setPre(pre?.kind === kind ? null : { kind, amount: toCall });

  const holeCards = state.myHole.length ? state.myHole : [];
  const handName = me?.handName && state.status === "showdown" ? handRankLabel(me.handName as HandRankName) : null;

  let idleText = "";
  if (me?.busted) idleText = "You're out — enjoy the show";
  else if (state.status === "showdown") idleText = "Showdown";
  else if (state.status === "waiting") idleText = "Next hand starting…";
  else if (me?.folded) idleText = "Folded · waiting for next hand";
  else if (me?.allIn) idleText = "You're all-in";

  return (
    <motion.section animate={controls} className={`dock ${isMyTurn ? "dock-live" : ""}`} aria-label="Your seat">
      <AnimatePresence>
        {sheetOpen && (
          <RaiseControls
            presets={presets}
            min={min}
            max={max}
            bigBlind={state.bigBlind}
            value={value}
            verb={verb}
            onChange={(n) => {
              setRaiseTo(n);
              setArmed(false);
            }}
          />
        )}
      </AnimatePresence>

      <div className="dock-inner">
        <div className="dock-hand">
          <div className={`hero-cards ${me?.folded ? "hero-cards-folded" : ""}`}>
            {holeCards.length
              ? holeCards.map((c, i) => (
                  <PlayingCard key={`${state.handNumber}-${c.rank}${c.suit}`} card={c} size="xl" deal delay={i * 0.06} dimmed={me?.folded} />
                ))
              : [0, 1].map((i) => <span key={i} className="hero-slot" aria-hidden />)}
          </div>
          <div className="hero-meta">
            <span className="hero-label">{handName ?? (me?.sittingOut ? "Sitting out" : "Stack")}</span>
            <CountUp value={me?.stack ?? 0} className="hero-stack" />
          </div>
        </div>

        <div className="dock-actions">
          {me?.sittingOut && !me.busted ? (
            <div className="dock-banner" role="status">
              <span>You&apos;re sitting out — hands are checked or folded for you.</span>
              <motion.button whileTap={tap} type="button" className="btn btn-action act-btn" disabled={pending} onClick={onSitIn}>
                I&apos;m back
              </motion.button>
            </div>
          ) : isMyTurn ? (
            <motion.div key="turn" className="act-row" initial={{ y: 12, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
              <motion.button whileTap={tap} type="button" className="act-btn act-fold" disabled={pending || !legal.canFold} onClick={() => fire("fold")}>
                Fold <kbd aria-hidden>F</kbd>
              </motion.button>
              <motion.button whileTap={tap} type="button" className="act-btn act-call" disabled={pending || !(legal.canCheck || legal.canCall)} onClick={callOrCheck}>
                {callLabel} <kbd aria-hidden>C</kbd>
              </motion.button>
              <motion.button
                whileTap={tap}
                type="button"
                className={`act-btn act-raise ${armed ? "act-armed" : ""}`}
                disabled={pending || !legal.canRaise}
                onClick={primary}
                aria-expanded={sheetOpen}
              >
                {!sheetOpen
                  ? verb
                  : armed
                    ? "Confirm all-in"
                    : value === max
                      ? `All-in ${value.toLocaleString()}`
                      : `${verb} ${value.toLocaleString()}`}{" "}
                <kbd aria-hidden>{sheetOpen ? "↵" : "R"}</kbd>
              </motion.button>
            </motion.div>
          ) : canPre ? (
            <div className="act-row" role="group" aria-label="Pre-select your next action">
              <PreToggle on={pre?.kind === "checkfold"} onClick={() => togglePre("checkfold")}>
                {toCall ? "Fold" : "Check/Fold"}
              </PreToggle>
              <PreToggle on={pre?.kind === (toCall ? "call" : "check")} onClick={() => togglePre(toCall ? "call" : "check")}>
                {toCall ? `Call ${toCall.toLocaleString()}` : "Check"}
              </PreToggle>
              <PreToggle on={pre?.kind === "callany"} onClick={() => togglePre("callany")}>
                Call any
              </PreToggle>
            </div>
          ) : (
            <p className="dock-idle">{idleText || "Waiting…"}</p>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function PreToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button whileTap={tap} type="button" className={`act-btn pre-btn ${on ? "pre-on" : ""}`} aria-pressed={on} onClick={onClick}>
      <span className="pre-box" aria-hidden>{on ? "✓" : ""}</span>
      {children}
    </motion.button>
  );
}
