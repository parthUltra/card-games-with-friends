import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { requireSessionJson } from "@/lib/session-api";
import { LobbyDoc } from "@/lib/types";
import {
  getLobby,
  startPokerTournament,
  tickLobbyGame,
} from "@/lib/room-runtime";

type Ctx = { params: Promise<{ code: string }> };

function lobbyPayload(lobby: LobbyDoc, meId?: string) {
  return {
    type: "lobby" as const,
    code: lobby.code,
    gameId: lobby.gameId,
    hostUserId: lobby.hostUserId,
    status: lobby.status,
    settings: lobby.settings,
    players: lobby.players.map((p) => ({
      userId: p.userId,
      name: p.name,
      avatarId: p.avatarId,
      ready: p.ready,
      // HTTP path has no connection ids; treat members as online while waiting
      connectionId: meId && p.userId === meId ? "self" : "http",
    })),
    chat: lobby.chat || [],
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  let lobby: LobbyDoc | null = await getLobby(code);
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  }

  if (lobby.status === "playing") {
    lobby = await tickLobbyGame(lobby);
  }

  return NextResponse.json(lobbyPayload(lobby, session.user.id));
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  if (!session.user.onboardingComplete) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });
  }

  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    text?: string;
  };
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  let lobby = await lobbies.findOne({ code: code.toUpperCase() });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  }

  if (body.action === "join") {
    if (lobby.status === "finished") {
      return NextResponse.json({ error: "Lobby finished" }, { status: 400 });
    }
    if (lobby.status === "playing") {
      // Allow reconnect for existing players
      if (lobby.players.some((p) => p.userId === session.user.id)) {
        return NextResponse.json(lobbyPayload(lobby, session.user.id));
      }
      return NextResponse.json({ error: "Game already started" }, { status: 400 });
    }
    if (lobby.players.some((p) => p.userId === session.user.id)) {
      return NextResponse.json(lobbyPayload(lobby, session.user.id));
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
    lobby = (await getLobby(code))!;
    return NextResponse.json(lobbyPayload(lobby, session.user.id));
  }

  if (body.action === "ready") {
    await lobbies.updateOne(
      { code: lobby.code, "players.userId": session.user.id },
      { $set: { "players.$.ready": true, updatedAt: new Date() } },
    );
    lobby = (await getLobby(code))!;
    return NextResponse.json(lobbyPayload(lobby, session.user.id));
  }

  if (body.action === "chat") {
    const text = (body.text || "").trim().slice(0, 200);
    if (!text) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }
    const member = lobby.players.find((p) => p.userId === session.user.id);
    if (!member) {
      return NextResponse.json({ error: "Not in lobby" }, { status: 403 });
    }
    const msg = {
      id: crypto.randomUUID(),
      userId: session.user.id,
      name: member.name,
      text,
      at: Date.now(),
    };
    await lobbies.updateOne(
      { code: lobby.code },
      {
        $push: { chat: { $each: [msg], $slice: -50 } },
        $set: { updatedAt: new Date() },
      },
    );
    lobby = (await getLobby(code))!;
    return NextResponse.json(lobbyPayload(lobby, session.user.id));
  }

  if (body.action === "start") {
    if (lobby.hostUserId !== session.user.id) {
      return NextResponse.json({ error: "Only host can start" }, { status: 403 });
    }
    if (lobby.players.length < 2) {
      return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });
    }
    if (lobby.status !== "waiting") {
      return NextResponse.json(lobbyPayload(lobby, session.user.id));
    }
    await startPokerTournament(lobby);
    lobby = (await getLobby(code))!;
    return NextResponse.json(lobbyPayload(lobby, session.user.id));
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
