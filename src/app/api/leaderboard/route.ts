import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import type { LeaderboardDoc } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gameId = url.searchParams.get("gameId");

  // Prefer per-game leaderboard when a game is specified
  if (gameId) {
    const board = await getCollection<LeaderboardDoc>("leaderboard");
    const top = await board
      .find({ gameId: gameId as LeaderboardDoc["gameId"] })
      .sort({ wins: -1, top3: -1, played: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      gameId,
      leaders: top.map((u) => ({
        id: u.userId,
        name: u.name || "Player",
        avatarId: u.avatarId || "avatar_00",
        wins: u.wins || 0,
        top3: u.top3 || 0,
        played: u.played || 0,
      })),
    });
  }

  // Global: aggregate across better-auth user stats
  const users = await getCollection("user");
  const top = await users
    .find({ onboardingComplete: true })
    .project({
      name: 1,
      avatarId: 1,
      statsWins: 1,
      statsTop3: 1,
      statsPlayed: 1,
    })
    .sort({ statsWins: -1, statsTop3: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({
    gameId: null,
    leaders: top.map((u) => ({
      id: String(u._id),
      name: u.name || "Player",
      avatarId: u.avatarId || "avatar_00",
      wins: u.statsWins || 0,
      top3: u.statsTop3 || 0,
      played: u.statsPlayed || 0,
    })),
  });
}
