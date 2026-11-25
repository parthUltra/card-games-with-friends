import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LobbyDoc } from "./types";

// Minimal in-memory stand-in for the lobbies collection: enough to exercise the rev CAS.
const store = new Map<string, LobbyDoc>();
const persisted: string[] = [];

vi.mock("@/lib/db", () => ({
  getCollection: async (name: string) => {
    if (name === "lobbies")
      return {
        findOne: async ({ code }: { code: string }) => structuredClone(store.get(code) ?? null),
        updateOne: async (filter: { code: string; rev?: number | { $exists: false } }, update: { $set: Partial<LobbyDoc>; $inc: { rev: number } }) => {
          const doc = store.get(filter.code);
          const revOk = typeof filter.rev === "object" ? doc?.rev === undefined : doc?.rev === filter.rev;
          if (!doc || !revOk) return { matchedCount: 0 };
          store.set(filter.code, { ...doc, ...update.$set, rev: (doc.rev ?? 0) + update.$inc.rev });
          return { matchedCount: 1 };
        },
      };
    // Match/leaderboard writes: just record that a match was persisted
    return {
      insertOne: async () => { persisted.push(name); return { insertedId: "m1" }; },
      updateOne: async () => ({ matchedCount: 1 }),
      find: () => ({ toArray: async () => [] }),
    };
  },
}));
vi.mock("@/lib/guest", () => ({ getGuestUserIdSet: async () => new Set<string>() }));

const { runLobbyGame, tickDue } = await import("./room-runtime");
const { PokerEngine } = await import("./poker/engine");
const { DEFAULT_POKER_SETTINGS } = await import("./games/registry");

function seed(rev: number | null = 1) {
  const engine = new PokerEngine({
    ...DEFAULT_POKER_SETTINGS,
    players: [
      { id: "a", name: "A", avatarId: "x" },
      { id: "b", name: "B", avatarId: "x" },
    ],
  });
  engine.startHand();
  const lobby: LobbyDoc = {
    code: "ABC",
    gameId: "poker",
    hostUserId: "a",
    status: "playing",
    settings: DEFAULT_POKER_SETTINGS,
    players: [],
    engine: engine.serialize() as unknown as Record<string, unknown>,
    blindLevelStartedAt: Date.now(),
    rev: rev ?? undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.set("ABC", lobby);
  return structuredClone(lobby);
}

const actingId = (l: LobbyDoc) => {
  const e = (l.engine as unknown as { players: { id: string; seat: number }[]; actingSeat: number });
  return e.players.find((p) => p.seat === e.actingSeat)!.id;
};

describe("runLobbyGame", () => {
  beforeEach(() => {
    store.clear();
    persisted.length = 0;
  });

  it("does not write when nothing changed", async () => {
    const stale = seed();
    await runLobbyGame(stale);
    expect(store.get("ABC")!.rev).toBe(1);
  });

  it("re-applies an action on fresh state instead of overwriting a concurrent write", async () => {
    const stale = seed();
    const first = actingId(stale);
    // Another request folds first...
    await runLobbyGame(structuredClone(stale), (e) => e.applyAction(first, "fold"));
    expect(store.get("ABC")!.rev).toBe(2);
    // ...then a request holding the stale copy tries to call; it must retry against rev 2
    let calls = 0;
    await runLobbyGame(stale, (e) => {
      calls++;
      e.applyAction(first, "call");
    });
    expect(calls).toBe(2);
    const engine = store.get("ABC")!.engine as unknown as { log: { text: string }[] };
    expect(engine.log.some((l) => l.text.endsWith("folds"))).toBe(true);
    expect(engine.log.some((l) => l.text.includes("calls"))).toBe(false);
  });

  it("works on lobbies created before rev existed", async () => {
    const legacy = seed(null);
    await runLobbyGame(legacy, (e) => e.applyAction(actingId(legacy), "fold"));
    expect(store.get("ABC")!.rev).toBe(1);
  });

  it("persists a finished match exactly once", async () => {
    const lobby = seed();
    const winnerTakesAll = (e: InstanceType<typeof PokerEngine>) => {
      // Force a bust: give everything to one player and settle
      const [a, b] = e.players;
      a.stack += b.stack + e.pot;
      b.stack = 0;
      e.pot = 0;
      e.settleBusts();
    };
    await runLobbyGame(structuredClone(lobby), winnerTakesAll);
    await runLobbyGame(lobby, winnerTakesAll); // stale racer
    expect(store.get("ABC")!.status).toBe("finished");
    expect(persisted.filter((n) => n === "matches")).toHaveLength(1);
  });

  // The cheap-poll 204 path skips runLobbyGame whenever tickDue is false, so the two must agree.
  it("tickDue agrees with whether a tick would write", async () => {
    const now = Date.now();
    const cases: [string, (l: LobbyDoc) => void][] = [
      ["mid-turn, nothing due", () => {}],
      ["turn expired", (l) => { (l.engine as { turnEndsAt: number }).turnEndsAt = now - 1; }],
      ["blinds due", (l) => { l.blindLevelStartedAt = now - 60 * 60_000; }],
      ["acting player sitting out", (l) => {
        const e = l.engine as unknown as { players: { seat: number; sittingOut: boolean }[]; actingSeat: number };
        e.players.find((p) => p.seat === e.actingSeat)!.sittingOut = true;
      }],
    ];
    for (const [name, mutate] of cases) {
      store.clear();
      const lobby = seed();
      mutate(lobby);
      store.set("ABC", structuredClone(lobby));
      const due = tickDue(lobby, Date.now());
      await runLobbyGame(lobby);
      expect({ name, wrote: store.get("ABC")!.rev !== 1 }).toEqual({ name, wrote: due });
    }
  });
});
