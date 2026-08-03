import { getCollection } from "@/lib/db";
import { getGuestUserIdSet } from "@/lib/guest";
import { PokerEngine } from "@/lib/poker/engine";
import type { PokerLobbySettings } from "@/lib/games/registry";
import type { LobbyDoc, MatchDoc, LeaderboardDoc, GameEventDoc } from "@/lib/types";
import { ObjectId } from "mongodb";

export async function getLobby(code: string) {
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  return lobbies.findOne({ code: code.toUpperCase() });
}

export async function saveLobby(code: string, patch: Partial<LobbyDoc>) {
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  await lobbies.updateOne(
    { code: code.toUpperCase() },
    { $set: { ...patch, updatedAt: new Date() } },
  );
}

export function engineFromLobby(lobby: LobbyDoc): PokerEngine | null {
  if (!lobby.engine) return null;
  return PokerEngine.deserialize(
    lobby.engine as unknown as ReturnType<PokerEngine["serialize"]>,
  );
}

/** Advance timers / blinds / next hands, persist, and record finished matches. */
export async function tickLobbyGame(lobby: LobbyDoc): Promise<LobbyDoc> {
  if (lobby.status !== "playing" || !lobby.engine) return lobby;

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

  const before = engine.status;
  engine.tick(now);
  const status = engine.status;

  let nextHandAt = lobby.nextHandAt ?? null;

  if (status === "waiting") {
    if (before !== "waiting" && !nextHandAt) {
      nextHandAt = now + 2500;
    } else if (nextHandAt && now >= nextHandAt) {
      engine.startHand(now);
      nextHandAt = null;
    }
  } else {
    nextHandAt = null;
  }

  const patch: Partial<LobbyDoc> = {
    engine: engine.serialize() as unknown as Record<string, unknown>,
    blindLevelStartedAt,
    nextHandAt,
  };

  if (engine.status === "finished") {
    patch.status = "finished";
    if (!lobby.matchPersisted) {
      await persistFinishedMatch(lobby, engine);
      patch.matchPersisted = true;
    }
  }

  await saveLobby(lobby.code, patch);
  return { ...lobby, ...patch, updatedAt: new Date() };
}

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
  await saveLobby(lobby.code, {
    status: "playing",
    startedAt: new Date(now),
    blindLevelStartedAt: now,
    engine: engine.serialize() as unknown as Record<string, unknown>,
    matchPersisted: false,
  });
}
