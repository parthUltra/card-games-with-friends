import { NextResponse } from "next/server";
import { z } from "zod";
import { getCollection } from "@/lib/db";
import {
  GameEventDoc,
  GameId,
  LeaderboardDoc,
  MatchDoc,
} from "@/lib/types";
import { ObjectId } from "mongodb";

const schema = z.object({
  lobbyCode: z.string(),
  gameId: z.enum(["poker", "blackjack", "hearts"]).default("poker"),
  players: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      avatarId: z.string(),
      place: z.number().int().min(1),
      finalStack: z.number().optional(),
    }),
  ),
  settings: z.record(z.string(), z.unknown()).or(z.any()),
  startedAt: z.string(),
  endedAt: z.string(),
});

export async function POST(req: Request) {
  const secret = req.headers.get("x-party-secret");
  if (
    !secret ||
    secret !== (process.env.PARTYKIT_TOKEN_SECRET || process.env.BETTER_AUTH_SECRET)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = schema.parse(await req.json());
  const gameId = body.gameId as GameId;
  const lobbies = await getCollection("lobbies");
  const lobby = await lobbies.findOne({ code: body.lobbyCode.toUpperCase() });

  const startedAt = new Date(body.startedAt);
  const endedAt = new Date(body.endedAt);
  const lobbyName =
    (body.settings as { lobbyName?: string })?.lobbyName ||
    `${gameId} match`;

  const matches = await getCollection<MatchDoc>("matches");
  const insert = await matches.insertOne({
    lobbyId: lobby?._id ? String(lobby._id) : body.lobbyCode,
    lobbyCode: body.lobbyCode.toUpperCase(),
    gameId,
    lobbyName,
    players: body.players,
    settings: body.settings as MatchDoc["settings"],
    startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
  });

  await lobbies.updateOne(
    { code: body.lobbyCode.toUpperCase() },
    { $set: { status: "finished", updatedAt: new Date() } },
  );

  const users = await getCollection("user");
  const leaderboard = await getCollection<LeaderboardDoc>("leaderboard");
  const events = await getCollection<GameEventDoc>("game_events");

  for (const p of body.players) {
    const filter = ObjectId.isValid(p.userId)
      ? { _id: new ObjectId(p.userId) }
      : { id: p.userId };
    const inc: Record<string, number> = { statsPlayed: 1 };
    if (p.place === 1) inc.statsWins = 1;
    if (p.place <= 3) inc.statsTop3 = 1;

    const result = await users.updateOne(filter, { $inc: inc });
    if (result.matchedCount === 0) {
      await users.updateOne(
        { _id: p.userId as unknown as ObjectId },
        { $inc: inc },
      );
    }

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
      lobbyCode: body.lobbyCode.toUpperCase(),
      gameId,
      userId: p.userId,
      type: "match_finish",
      payload: { place: p.place, finalStack: p.finalStack },
      at: endedAt,
    });
  }

  return NextResponse.json({ ok: true, matchId: String(insert.insertedId) });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const gameId = url.searchParams.get("gameId");
  const matches = await getCollection<MatchDoc>("matches");

  const filter: Record<string, unknown> = {};
  if (userId) filter["players.userId"] = userId;
  if (gameId) filter.gameId = gameId;

  const list = await matches
    .find(filter)
    .sort({ endedAt: -1 })
    .limit(40)
    .toArray();
  return NextResponse.json({ matches: list });
}
