import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { requireSessionJson } from "@/lib/session-api";
import { LobbyDoc } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { code } = await ctx.params;
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  const lobby = await lobbies.findOne({ code: code.toUpperCase() });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  }
  return NextResponse.json({
    code: lobby.code,
    gameId: lobby.gameId,
    hostUserId: lobby.hostUserId,
    status: lobby.status,
    settings: lobby.settings,
    players: lobby.players,
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  if (!session.user.onboardingComplete) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });
  }

  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  const lobby = await lobbies.findOne({ code: code.toUpperCase() });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  }

  if (body.action === "join") {
    if (lobby.status !== "waiting") {
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }
    if (lobby.players.some((p) => p.userId === session.user.id)) {
      return NextResponse.json({ ok: true, code: lobby.code });
    }
    if (lobby.players.length >= lobby.settings.maxPlayers) {
      return NextResponse.json({ error: "Lobby is full" }, { status: 400 });
    }
    await lobbies.updateOne(
      { code: lobby.code },
      {
        $push: {
          players: {
            userId: session.user.id,
            name: session.user.name || session.user.email.split("@")[0],
            avatarId: session.user.avatarId || "avatar_00",
            ready: false,
            joinedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      },
    );
    return NextResponse.json({ ok: true, code: lobby.code });
  }

  if (body.action === "ready") {
    await lobbies.updateOne(
      { code: lobby.code, "players.userId": session.user.id },
      { $set: { "players.$.ready": true, updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "start") {
    if (lobby.hostUserId !== session.user.id) {
      return NextResponse.json({ error: "Only host can start" }, { status: 403 });
    }
    if (lobby.players.length < 2) {
      return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });
    }
    await lobbies.updateOne(
      { code: lobby.code },
      { $set: { status: "playing", updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
