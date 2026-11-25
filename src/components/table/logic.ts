import type { PlayerPublic, PokerPrivateView } from "@/lib/poker/engine";

export type Pt = { x: number; y: number };
export type HeroAction = "fold" | "check" | "call" | "raise";

const P = (x: number, y: number): Pt => ({ x, y });

/** Opponent positions (% of felt box), clockwise from the hero's left. Index = opponent count. */
const PORTRAIT: Pt[][] = [
  [],
  [P(50, 8)],
  [P(18, 22), P(82, 22)],
  [P(12, 28), P(50, 7), P(88, 28)],
  [P(9, 70), P(14, 22), P(86, 22), P(91, 70)],
  [P(8, 70), P(10, 30), P(50, 7), P(90, 30), P(92, 70)],
];
const WIDE: Pt[][] = [
  [],
  [P(50, 9)],
  [P(24, 13), P(76, 13)],
  [P(8, 50), P(50, 9), P(92, 50)],
  [P(7, 62), P(26, 11), P(74, 11), P(93, 62)],
  [P(6, 64), P(14, 20), P(50, 8), P(86, 20), P(94, 64)],
];
export const HERO_PT: Pt = P(50, 91);
export const POT_PT: Pt = P(50, 38);
export const BOARD_PT: Pt = P(50, 51);
const CENTER: Pt = P(50, 48);

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export const betPt = (seat: Pt) => lerp(seat, CENTER, 0.38);

/** Players ordered clockwise starting with the hero (index 0), each with a table position. */
export function placeSeats(players: PlayerPublic[], meId: string | null, wide: boolean) {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const i = Math.max(0, sorted.findIndex((p) => p.id === meId));
  const rotated = [...sorted.slice(i), ...sorted.slice(0, i)];
  const hasHero = rotated[0]?.id === meId;
  const opps = hasHero ? rotated.slice(1) : rotated;
  const preset = (wide ? WIDE : PORTRAIT)[Math.min(opps.length, 5)];
  return {
    hero: hasHero ? rotated[0] : null,
    opponents: opps.map((p, k) => ({ player: p, pt: preset[k] ?? CENTER })),
  };
}

export type Preset = { label: string; amount: number; allIn?: boolean };

/** Raise-to presets: preflop BB multiples, postflop pot fractions; always ends with All-in. */
export function raisePresets(s: Pick<PokerPrivateView, "status" | "bigBlind" | "pot" | "currentBet" | "legal">): Preset[] {
  const { minRaiseTo: min, maxRaiseTo: max, callAmount } = s.legal;
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const base =
    s.status === "preflop"
      ? [2.5, 3, 4].map((m) => ({ label: `${m}x`, amount: clamp(m * s.bigBlind) }))
      : ([["⅓", 1 / 3], ["½", 1 / 2], ["¾", 3 / 4], ["Pot", 1]] as const).map(([label, f]) => ({
          label,
          amount: clamp(s.currentBet + f * (s.pot + callAmount)),
        }));
  return [...base.filter((p) => p.amount < max), { label: "All-in", amount: max, allIn: true }];
}

/** Snap a slider value to the big blind grid, keeping min/max reachable. */
export function snapToBB(v: number, min: number, max: number, bb: number) {
  if (v >= max) return max;
  if (v <= min) return min;
  return Math.max(min, Math.min(max, Math.round(v / bb) * bb));
}

/** Local prediction of an action so the UI responds before the server does. Server state replaces it wholesale. */
export function applyOptimistic(s: PokerPrivateView, meId: string, action: HeroAction, raiseTo: number): PokerPrivateView {
  let pay = 0;
  const players = s.players.map((p) => {
    if (p.id !== meId) return p;
    if (action === "fold") return { ...p, folded: true };
    if (action === "check") return p;
    const target = action === "call" ? p.bet + s.legal.callAmount : Math.min(raiseTo, p.bet + p.stack);
    pay = Math.max(0, Math.min(p.stack, target - p.bet));
    return { ...p, bet: p.bet + pay, stack: p.stack - pay, allIn: p.stack - pay === 0 };
  });
  const me = players.find((p) => p.id === meId);
  return {
    ...s,
    players,
    pot: s.pot + pay,
    currentBet: Math.max(s.currentBet, me?.bet ?? 0),
    actingSeat: null,
    turnEndsAt: null,
    legal: { ...s.legal, canFold: false, canCheck: false, canCall: false, canRaise: false },
  };
}

const LIVE = new Set(["preflop", "flop", "turn", "river"]);

/** How many live players act before the hero (0 = hero is acting). Infinity if the hero is not in the hand. */
export function seatsUntilHero(s: PokerPrivateView, meId: string | null) {
  if (s.actingSeat == null || !LIVE.has(s.status)) return Infinity;
  const live = [...s.players].filter((p) => !p.folded && !p.busted && !p.allIn).sort((a, b) => a.seat - b.seat);
  const a = live.findIndex((p) => p.seat === s.actingSeat);
  const h = live.findIndex((p) => p.id === meId);
  if (a < 0 || h < 0) return Infinity;
  return (h - a + live.length) % live.length;
}

/** Adaptive poll interval per research: tight near the hero's turn, relaxed when idle or hidden. */
export function pollDelay(opts: {
  state: PokerPrivateView | null;
  meId: string | null;
  hidden: boolean;
  unchangedMs: number;
  errors: number;
}) {
  if (opts.errors > 0) return [1000, 2000, 4000, 10000][Math.min(opts.errors - 1, 3)];
  if (opts.hidden) return 15000;
  const s = opts.state;
  if (!s || s.status === "finished") return 2000;
  let d = seatsUntilHero(s, opts.meId) <= 2 ? 600 : 1000;
  if (opts.unchangedMs > 30000) d = Math.min(5000, d * Math.pow(1.5, Math.floor((opts.unchangedMs - 30000) / 10000) + 1));
  return d;
}

const VERB: [RegExp, string][] = [
  [/ folds$/, "Fold"],
  [/ checks$/, "Check"],
  [/ calls \d+$/, "Call"],
  [/ raises to \d+$/, "Raise"],
  [/ posts \d+$/, "Blind"],
];

/** Short seat badge ("Raise", "Call"…) when the engine's last action belongs to this player. */
export function actionBadge(lastAction: string | undefined, name: string) {
  if (!lastAction?.startsWith(`${name} `)) return null;
  for (const [re, label] of VERB) if (re.test(lastAction)) return label;
  return null;
}
