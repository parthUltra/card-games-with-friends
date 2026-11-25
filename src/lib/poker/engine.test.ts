import { describe, expect, it } from "vitest";
import { PokerEngine, SIT_OUT_AFTER_TIMEOUTS } from "./engine";
import { DEFAULT_POKER_SETTINGS } from "../games/registry";

function table(n: number, stack = 1000) {
  return new PokerEngine({
    ...DEFAULT_POKER_SETTINGS,
    startingStack: stack,
    startingSmallBlind: 10,
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatarId: "a" })),
  });
}

const chips = (e: PokerEngine) => e.players.reduce((s, p) => s + p.stack, 0) + e.pot;
const actor = (e: PokerEngine) => e.players.find((p) => p.seat === e.actingSeat)!;

// Deterministic PRNG so failures reproduce
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

describe("poker engine", () => {
  it("never creates or loses chips over many random hands", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = rng(seed);
      const n = 2 + (seed % 5);
      const e = table(n, 500 + seed * 37);
      const total = chips(e);
      for (let hand = 0; hand < 60 && e.status !== "finished"; hand++) {
        e.startHand();
        let guard = 0;
        while (e.actingSeat !== null && guard++ < 200) {
          const p = actor(e);
          const legal = e.legalActions(p.id);
          const r = rand();
          if (r < 0.15 && legal.canFold) e.applyAction(p.id, "fold");
          else if (r < 0.55 && legal.canRaise)
            e.applyAction(p.id, "raise", legal.minRaiseTo + Math.floor(rand() * (legal.maxRaiseTo - legal.minRaiseTo + 1)));
          else e.applyAction(p.id, legal.canCheck ? "check" : "call");
          expect(chips(e)).toBe(total);
        }
        expect(e.actingSeat).toBeNull();
        expect(e.pot).toBe(0);
        expect(chips(e)).toBe(total);
      }
    }
  });

  it("rolls dead money from an all-folded level into the pot below", () => {
    const e = table(3);
    const [a, b, c] = e.players;
    a.totalBet = 100; // all-in, live
    b.totalBet = 300; // folded after over-betting
    b.folded = true;
    c.totalBet = 200; // live
    const pots = e.computeSidePots();
    expect(pots.reduce((s, p) => s + p.amount, 0)).toBe(600);
    expect(pots).toEqual([
      { amount: 300, eligible: ["p0", "p2"] },
      { amount: 300, eligible: ["p2"] },
    ]);
  });

  it("heads-up: dealer posts small blind and acts first preflop", () => {
    const e = table(2);
    e.startHand();
    const dealer = e.players.find((p) => p.seat === e.dealerSeat)!;
    expect(dealer.bet).toBe(10);
    expect(e.actingSeat).toBe(e.dealerSeat);
  });

  it("gives the big blind an option when everyone limps", () => {
    const e = table(3);
    e.startHand();
    e.applyAction(actor(e).id, "call"); // UTG
    e.applyAction(actor(e).id, "call"); // SB
    expect(e.status).toBe("preflop");
    expect(e.legalActions(actor(e).id).canCheck).toBe(true);
    e.applyAction(actor(e).id, "check");
    expect(e.status).toBe("flop");
  });

  it("sits a player out after repeated timeouts and auto-acts for them", () => {
    const e = table(3);
    e.startHand();
    const p = actor(e);
    for (let i = 0; i < SIT_OUT_AFTER_TIMEOUTS; i++) {
      // Rewind so p is acting again each loop
      e.actingSeat = p.seat;
      e.applyAction(p.id, "timeout");
    }
    expect(p.sittingOut).toBe(true);

    e.startHand();
    while (e.actingSeat !== null && actor(e).id !== p.id) e.applyAction(actor(e).id, "call");
    if (e.actingSeat !== null) {
      e.tick(Date.now()); // no need to wait for the timer
      expect(e.actingSeat === null || actor(e).id !== p.id).toBe(true);
    }

    e.setSittingOut(p.id, false);
    expect(p.sittingOut).toBe(false);
    expect(p.timeouts).toBe(0);
  });

  it("keeps hands revealed at showdown and logs the result", () => {
    const e = table(2);
    e.startHand();
    e.applyAction(actor(e).id, "call");
    e.applyAction(actor(e).id, "check");
    while (e.actingSeat !== null) e.applyAction(actor(e).id, "check");
    expect(["showdown", "finished"]).toContain(e.status);
    const pub = e.toPublic();
    expect(pub.players.every((p) => p.hole?.length === 2)).toBe(true);
    expect(pub.log.some((l) => l.text.includes("shows"))).toBe(true);
  });

  it("round-trips through serialize", () => {
    const e = table(3);
    e.startHand();
    e.applyAction(actor(e).id, "raise", 60);
    const copy = PokerEngine.deserialize(JSON.parse(JSON.stringify(e.serialize())));
    expect(copy.toPublic()).toEqual(e.toPublic());
  });
});
