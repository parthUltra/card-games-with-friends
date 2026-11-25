import { getCollection } from "@/lib/db";
import { getGuestUserIdSet } from "@/lib/guest";
import { PokerEngine } from "@/lib/poker/engine";
import type { PokerLobbySettings } from "@/lib/games/registry";
import { generateLobbyCode } from "@/lib/types";
import type { LobbyDoc, MatchDoc, LeaderboardDoc, GameEventDoc } from "@/lib/types";
import { ObjectId, type Filter } from "mongodb";

export async function getLobby(code: string) {
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  return lobbies.findOne({ code: code.toUpperCase() });
}

export function engineFromLobby(lobby: LobbyDoc): PokerEngine | null {
  if (!lobby.engine) return null;
  return PokerEngine.deserialize(
    lobby.engine as unknown as ReturnType<PokerEngine["serialize"]>,
  );
}

/** Pause after a fold-out win / after a showdown before the next deal */
const FOLD_PAUSE_MS = 2500;
const SHOWDOWN_PAUSE_MS = 5000;
const MAX_WRITE_RETRIES = 5;

/**
 * Compare-and-set on `rev`: succeeds only if nobody wrote since `lobby` was read.
 * Docs created before `rev` existed match on its absence.
 */
export async function casLobby(lobby: LobbyDoc, patch: Partial<LobbyDoc>) {
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  const res = await lobbies.updateOne(
    { code: lobby.code, rev: lobby.rev ?? { $exists: false } } as Filter<LobbyDoc>,
    { $set: { ...patch, updatedAt: new Date() }, $inc: { rev: 1 } },
  );
  return res.matchedCount === 1;
}

type GameMutation = (engine: PokerEngine, now: number) => void;

/**
 * Advance timers / blinds / next hands, apply an optional mutation, and persist with
 * an optimistic revision check (retrying on conflict) so concurrent polls and actions
 * never overwrite each other. Records finished matches exactly once.
 */
export async function runLobbyGame(
  initial: LobbyDoc,
  mutate?: GameMutation,
): Promise<LobbyDoc> {
  let lobby: LobbyDoc | null = initial;
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
    if (!lobby || lobby.status !== "playing" || !lobby.engine) return lobby ?? initial;

    const engine = engineFromLobby(lobby)!;
    const now = Date.now();
    let blindLevelStartedAt = lobby.blindLevelStartedAt ?? now;
    if (
      engine.status !== "finished" &&
      now - blindLevelStartedAt >=
        (lobby.settings as PokerLobbySettings).blindIntervalMin * 60_000
    ) {
      engine.bumpBlindLevel();
      blindLevelStartedAt = now;
    }

    engine.tick(now);
    mutate?.(engine, now);

    let nextHandAt = lobby.nextHandAt ?? null;
    if (engine.status !== "waiting" && engine.status !== "showdown") {
      nextHandAt = null;
    } else if (!nextHandAt) {
      nextHandAt = now + (engine.status === "showdown" ? SHOWDOWN_PAUSE_MS : FOLD_PAUSE_MS);
    } else if (now >= nextHandAt) {
      engine.startHand(now);
      nextHandAt = null;
    }

    const snapshot = engine.serialize() as unknown as Record<string, unknown>;
    const finished = engine.status === "finished";
    if (
      JSON.stringify(snapshot) === JSON.stringify(lobby.engine) &&
      nextHandAt === (lobby.nextHandAt ?? null) &&
      blindLevelStartedAt === lobby.blindLevelStartedAt
    ) {
      return lobby; // nothing changed: skip the write
    }

    const patch: Partial<LobbyDoc> = { engine: snapshot, blindLevelStartedAt, nextHandAt };
    const persistMatch = finished && !lobby.matchPersisted;
    if (finished) {
      patch.status = "finished";
      patch.matchPersisted = true;
    }

    if (await casLobby(lobby, patch)) {
      // Only the writer that flipped matchPersisted records the match.
      // shortcut: a crash between the CAS and this insert loses the match record; use a transaction if that matters.
      if (persistMatch) await persistFinishedMatch(lobby, engine);
      return { ...lobby, ...patch, rev: (lobby.rev ?? 0) + 1, updatedAt: new Date() };
    }
    lobby = await getLobby(lobby.code); // someone else wrote first; redo on fresh state
  }
  throw new Error("Table is busy, try again");
}

export const tickLobbyGame = (lobby: LobbyDoc) => runLobbyGame(lobby);

async function persistFinishedMatch(lobby: LobbyDoc, engine: PokerEngine) {
  const startedAt = lobby.startedAt ? new Date(lobby.startedAt) : new Date();
  const endedAt = new Date();
  const gameId = lobby.gameId;
  const placements = engine.getPlacements();
  const guestIds = await getGuestUserIdSet(placements.map((p) => p.id));
  const registeredPlayers = placements
    .filter((p) => !guestIds.has(p.id))
    .map((p) => ({
      userId: p.id,
      name: p.name,
      avatarId: p.avatarId,
      place: p.place,
      finalStack: p.stack,
    }));

  if (registeredPlayers.length === 0) return;

  const matches = await getCollection<MatchDoc>("matches");
  const insert = await matches.insertOne({
    lobbyId: lobby._id ? String(lobby._id) : lobby.code,
    lobbyCode: lobby.code,
    gameId,
    lobbyName: (lobby.settings as PokerLobbySettings).lobbyName || "Match",
    players: registeredPlayers,
    settings: lobby.settings,
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
  });

  const users = await getCollection("user");
  const leaderboard = await getCollection<LeaderboardDoc>("leaderboard");
  const events = await getCollection<GameEventDoc>("game_events");

  for (const p of registeredPlayers) {
    const filter = ObjectId.isValid(p.userId)
      ? { _id: new ObjectId(p.userId) }
      : { id: p.userId };
    const inc: Record<string, number> = { statsPlayed: 1 };
    if (p.place === 1) inc.statsWins = 1;
    if (p.place <= 3) inc.statsTop3 = 1;
    await users.updateOne(filter, { $inc: inc });

    const lbInc: Record<string, number> = { played: 1 };
    if (p.place === 1) lbInc.wins = 1;
    if (p.place <= 3) lbInc.top3 = 1;
    await leaderboard.updateOne(
      { userId: p.userId, gameId },
      {
        $inc: lbInc,
        $set: {
          name: p.name,
          avatarId: p.avatarId,
          updatedAt: new Date(),
        },
        $setOnInsert: { userId: p.userId, gameId },
      },
      { upsert: true },
    );

    await events.insertOne({
      matchId: String(insert.insertedId),
      lobbyCode: lobby.code,
      gameId,
      userId: p.userId,
      type: "match_finish",
      payload: { place: p.place, finalStack: p.finalStack },
      at: endedAt,
    });
  }
}

/** Returns false if the lobby was no longer waiting (e.g. double-clicked start). */
export async function startPokerTournament(lobby: LobbyDoc) {
  const settings = lobby.settings as PokerLobbySettings;
  const engine = new PokerEngine({
    ...settings,
    players: lobby.players.map((p) => ({
      id: p.userId,
      name: p.name,
      avatarId: p.avatarId,
    })),
  });
  const now = Date.now();
  engine.startHand(now);
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  const res = await lobbies.updateOne(
    { code: lobby.code, status: "waiting" },
    {
      $set: {
        status: "playing",
        startedAt: new Date(now),
        blindLevelStartedAt: now,
        nextHandAt: null,
        engine: engine.serialize() as unknown as Record<string, unknown>,
        matchPersisted: false,
        updatedAt: new Date(now),
      },
      $inc: { rev: 1 },
    },
  );
  return res.matchedCount === 1;
}

export type LobbyHost = { userId: string; name: string; avatarId: string };

export async function createLobby(host: LobbyHost, settings: PokerLobbySettings) {
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  const now = new Date();
  // Retry on the unique-code index instead of check-then-insert
  for (let i = 0; ; i++) {
    const code = generateLobbyCode();
    try {
      await lobbies.insertOne({
        code,
        gameId: "poker",
        hostUserId: host.userId,
        status: "waiting",
        settings,
        players: [{ ...host, ready: true, joinedAt: now }],
        rev: 1,
        createdAt: now,
        updatedAt: now,
      });
      return code;
    } catch (err) {
      if (i >= 4 || (err as { code?: number }).code !== 11000) throw err;
    }
  }
}
