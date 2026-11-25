import { describe, expect, it } from "vitest";
import type { PlayerPublic, PokerPrivateView } from "@/lib/poker/engine";
import { actionBadge, applyOptimistic, placeSeats, pollDelay, raisePresets, seatsUntilHero, snapToBB } from "./logic";

const pl = (id: string, seat: number, over: Partial<PlayerPublic> = {}): PlayerPublic => ({
  id, name: id, avatarId: "avatar_01", seat, stack: 1000, bet: 0, totalBet: 0,
  folded: false, allIn: false, sittingOut: false, busted: false, holeCount: 2, ...over,
});

const view = (over: Partial<PokerPrivateView> = {}): PokerPrivateView => ({
  status: "flop", handNumber: 1, dealerSeat: 0, actingSeat: 1, board: [], pot: 300, sidePots: [],
  currentBet: 100, minRaise: 100, smallBlind: 25, bigBlind: 50, blindLevel: 1, turnEndsAt: null,
  turnTimerSec: 30, players: [pl("a", 0), pl("me", 1, { bet: 0 }), pl("c", 2)], log: [], myHole: [],
  legal: { canFold: true, canCheck: false, canCall: true, callAmount: 100, canRaise: true, minRaiseTo: 200, maxRaiseTo: 1000 },
  ...over,
});

describe("table logic", () => {
  it("rotates so the hero is first and opponents go clockwise", () => {
    const { hero, opponents } = placeSeats([pl("a", 0), pl("me", 1), pl("c", 2)], "me", false);
    expect(hero?.id).toBe("me");
    expect(opponents.map((o) => o.player.id)).toEqual(["c", "a"]);
    expect(opponents[0].pt).toEqual({ x: 18, y: 22 });
  });

  it("builds postflop pot presets clamped to legal bounds, ending in all-in", () => {
    const p = raisePresets(view());
    expect(p.at(-1)).toEqual({ label: "All-in", amount: 1000, allIn: true });
    // ½ pot: 100 + 0.5 * (300 + 100) = 300
    expect(p.find((x) => x.label === "½")?.amount).toBe(300);
    expect(p.every((x) => x.amount >= 200 && x.amount <= 1000)).toBe(true);
  });

  it("builds preflop BB presets", () => {
    const p = raisePresets(view({ status: "preflop" }));
    expect(p.map((x) => x.label)).toEqual(["2.5x", "3x", "4x", "All-in"]);
    expect(p[1].amount).toBe(200); // 3x50=150 clamped to min 200
  });

  it("snaps to the big blind but keeps ends reachable", () => {
    expect(snapToBB(237, 200, 1000, 50)).toBe(250);
    expect(snapToBB(990, 200, 1000, 50)).toBe(1000);
    expect(snapToBB(999, 210, 999, 50)).toBe(999);
  });

  it("applies an optimistic call and raise", () => {
    const c = applyOptimistic(view(), "me", "call", 0);
    expect(c.players[1]).toMatchObject({ bet: 100, stack: 900 });
    expect(c.pot).toBe(400);
    expect(c.actingSeat).toBeNull();
    const r = applyOptimistic(view(), "me", "raise", 5000);
    expect(r.players[1]).toMatchObject({ bet: 1000, stack: 0, allIn: true });
  });

  it("measures distance to the hero's turn and adapts polling", () => {
    const s = view({ actingSeat: 2 });
    expect(seatsUntilHero(s, "me")).toBe(2);
    expect(pollDelay({ state: s, meId: "me", hidden: false, unchangedMs: 0, errors: 0 })).toBe(600);
    expect(pollDelay({ state: s, meId: "me", hidden: true, unchangedMs: 0, errors: 0 })).toBe(15000);
    expect(pollDelay({ state: s, meId: "me", hidden: false, unchangedMs: 0, errors: 3 })).toBe(4000);
    expect(pollDelay({ state: view({ actingSeat: 0 }), meId: "me", hidden: false, unchangedMs: 120000, errors: 0 })).toBe(5000);
  });

  it("maps the last action to a seat badge", () => {
    expect(actionBadge("Maya raises to 300", "Maya")).toBe("Raise");
    expect(actionBadge("Maya raises to 300", "Bob")).toBeNull();
  });
});
