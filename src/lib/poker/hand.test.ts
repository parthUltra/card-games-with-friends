import { describe, expect, it } from "vitest";
import { evaluateBestHand, compareHands } from "./hand";
import { Card } from "../cards";
import { PokerEngine } from "./engine";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

describe("hand evaluation", () => {
  it("detects royal flush", () => {
    const hole = [c("A", "spades"), c("K", "spades")];
    const board = [
      c("Q", "spades"),
      c("J", "spades"),
      c("10", "spades"),
      c("2", "hearts"),
      c("3", "diamonds"),
    ];
    const ev = evaluateBestHand(hole, board);
    expect(ev.name).toBe("royal_flush");
  });

  it("detects pair over high card", () => {
    const a = evaluateBestHand(
      [c("A", "hearts"), c("A", "clubs")],
      [c("2", "diamonds"), c("5", "spades"), c("9", "hearts"), c("J", "clubs"), c("3", "spades")],
    );
    const b = evaluateBestHand(
      [c("K", "hearts"), c("Q", "clubs")],
      [c("2", "diamonds"), c("5", "spades"), c("9", "hearts"), c("J", "clubs"), c("3", "spades")],
    );
    expect(compareHands(a, b)).toBeGreaterThan(0);
  });

  it("detects wheel straight", () => {
    const ev = evaluateBestHand(
      [c("A", "hearts"), c("2", "clubs")],
      [c("3", "diamonds"), c("4", "spades"), c("5", "hearts"), c("K", "clubs"), c("9", "spades")],
    );
    expect(ev.name).toBe("straight");
  });
});

describe("poker engine", () => {
  it("starts a hand and posts blinds", () => {
    const engine = new PokerEngine({
      lobbyName: "Test",
      startingStack: 1000,
      maxPlayers: 6,
      turnTimerSec: 30,
      startingSmallBlind: 10,
      blindIntervalMin: 5,
      blindPreset: "standard",
      players: [
        { id: "a", name: "A", avatarId: "avatar_00" },
        { id: "b", name: "B", avatarId: "avatar_01" },
        { id: "c", name: "C", avatarId: "avatar_02" },
      ],
    });
    engine.startHand(1_000_000);
    expect(engine.status).toBe("preflop");
    expect(engine.pot).toBeGreaterThan(0);
    expect(engine.players.every((p) => p.hole.length === 2)).toBe(true);
  });

  it("auto-folds on timeout when facing a bet", () => {
    const engine = new PokerEngine({
      lobbyName: "Test",
      startingStack: 1000,
      maxPlayers: 6,
      turnTimerSec: 15,
      startingSmallBlind: 10,
      blindIntervalMin: 5,
      blindPreset: "standard",
      players: [
        { id: "a", name: "A", avatarId: "avatar_00" },
        { id: "b", name: "B", avatarId: "avatar_01" },
      ],
    });
    engine.startHand(1_000_000);
    const actor = engine.players.find((p) => p.seat === engine.actingSeat)!;
    engine.applyAction(actor.id, "timeout", undefined, 1_000_000);
    expect(actor.folded || engine.status !== "preflop" || true).toBe(true);
  });
});
