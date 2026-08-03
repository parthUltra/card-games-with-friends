import { Card, RANK_VALUE, Rank } from "../cards";

export type HandRankName =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush"
  | "royal_flush";

const HAND_RANK_ORDER: HandRankName[] = [
  "high_card",
  "pair",
  "two_pair",
  "three_of_a_kind",
  "straight",
  "flush",
  "full_house",
  "four_of_a_kind",
  "straight_flush",
  "royal_flush",
];

export type EvaluatedHand = {
  name: HandRankName;
  rankIndex: number;
  /** Tie-breakers high to low */
  kickers: number[];
};

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function straightHigh(values: number[]): number | null {
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  // Wheel: A-2-3-4-5
  if (
    uniq.includes(14) &&
    uniq.includes(5) &&
    uniq.includes(4) &&
    uniq.includes(3) &&
    uniq.includes(2)
  ) {
    return 5;
  }
  for (let i = 0; i <= uniq.length - 5; i++) {
    let ok = true;
    for (let j = 0; j < 4; j++) {
      if (uniq[i + j] - 1 !== uniq[i + j + 1]) {
        ok = false;
        break;
      }
    }
    if (ok) return uniq[i];
  }
  return null;
}

function evaluateFive(cards: Card[]): EvaluatedHand {
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const sHigh = straightHigh(values);
  const isStraight = sHigh !== null;

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  let name: HandRankName = "high_card";
  let kickers: number[] = values;

  if (isStraight && isFlush) {
    name = sHigh === 14 ? "royal_flush" : "straight_flush";
    kickers = [sHigh!];
  } else if (byCount[0][1] === 4) {
    name = "four_of_a_kind";
    kickers = [byCount[0][0], byCount[1][0]];
  } else if (byCount[0][1] === 3 && byCount[1]?.[1] === 2) {
    name = "full_house";
    kickers = [byCount[0][0], byCount[1][0]];
  } else if (isFlush) {
    name = "flush";
    kickers = values;
  } else if (isStraight) {
    name = "straight";
    kickers = [sHigh!];
  } else if (byCount[0][1] === 3) {
    name = "three_of_a_kind";
    kickers = [byCount[0][0], ...byCount.slice(1).map((x) => x[0])];
  } else if (byCount[0][1] === 2 && byCount[1]?.[1] === 2) {
    name = "two_pair";
    const pairs = [byCount[0][0], byCount[1][0]].sort((a, b) => b - a);
    kickers = [...pairs, byCount[2][0]];
  } else if (byCount[0][1] === 2) {
    name = "pair";
    kickers = [byCount[0][0], ...byCount.slice(1).map((x) => x[0])];
  }

  return {
    name,
    rankIndex: HAND_RANK_ORDER.indexOf(name),
    kickers,
  };
}

export function evaluateBestHand(hole: Card[], board: Card[]): EvaluatedHand {
  const all = [...hole, ...board];
  if (all.length < 5) {
    // pad with nothing — shouldn't happen at showdown
    const vals = all.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
    return { name: "high_card", rankIndex: 0, kickers: vals };
  }
  const fives = combinations(all, 5);
  let best = evaluateFive(fives[0]);
  for (let i = 1; i < fives.length; i++) {
    const ev = evaluateFive(fives[i]);
    if (compareHands(ev, best) > 0) best = ev;
  }
  return best;
}

/** Positive if a > b */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rankIndex !== b.rankIndex) return a.rankIndex - b.rankIndex;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const av = a.kickers[i] ?? 0;
    const bv = b.kickers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function handRankLabel(name: HandRankName): string {
  return name
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function rankLabel(rank: Rank): string {
  return rank;
}
