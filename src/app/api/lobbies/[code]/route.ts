import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCollection } from "@/lib/db";
import { requireSessionJson } from "@/lib/session-api";
import { parsePokerSettings } from "@/lib/games/poker-settings";
import { LobbyDoc } from "@/lib/types";
import {
  createLobby,
  getLobby,
  runLobbyGame,
  startPokerTournament,
} from "@/lib/room-runtime";

type Ctx = { params: Promise<{ code: string }> };

function lobbyPayload(lobby: LobbyDoc) {
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
    })),
    chat: lobby.chat || [],
    rematchCode: lobby.rematchCode ?? null,
  };
}

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  let lobby: LobbyDoc | null = await getLobby(code);
  if (!lobby) return err("Lobby not found", 404);

  if (lobby.status === "playing") {
    try {
      lobby = await runLobbyGame(lobby);
    } catch {
      // Contended tick; serve the last read state
    }
  }
  return NextResponse.json(lobbyPayload(lobby));
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  if (!session.user.onboardingComplete) return err("Complete onboarding first", 403);

  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    text?: string;
    userId?: string;
    settings?: unknown;
  };
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  const lobby = await getLobby(code);
  if (!lobby) return err("Lobby not found", 404);

  const me = session.user.id;
  const isMember = lobby.players.some((p) => p.userId === me);
  const isHost = lobby.hostUserId === me;
  const reply = async () => NextResponse.json(lobbyPayload((await getLobby(code))!));

  switch (body.action) {
    case "join": {
      if (isMember) return reply(); // reconnect
      if (lobby.status !== "waiting") return err("Game already started");
      if (lobby.kicked?.includes(me)) return err("The host removed you from this lobby", 403);
      // Guarded push: capacity, duplicates and kicks are checked atomically
      const res = await lobbies.updateOne(
        {
          code: lobby.code,
          status: "waiting",
          [`players.${lobby.settings.maxPlayers - 1}`]: { $exists: false },
          "players.userId": { $ne: me },
          kicked: { $ne: me },
        },
        {
          $push: {
            players: {
              userId: me,
              name: session.user.name || session.user.email.split("@")[0],
              avatarId: session.user.avatarId || "avatar_00",
              ready: false,
              joinedAt: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
        },
      );
      if (res.matchedCount === 0) return err("Lobby is full");
      return reply();
    }

    case "ready":
    case "unready": {
      if (lobby.status !== "waiting") return reply();
      await lobbies.updateOne(
        { code: lobby.code, "players.userId": me },
        { $set: { "players.$.ready": body.action === "ready", updatedAt: new Date() } },
      );
      return reply();
    }

    case "chat": {
      const text = (body.text || "").trim().slice(0, 200);
      if (!text) return err("Empty message");
      const member = lobby.players.find((p) => p.userId === me);
      if (!member) return err("Not in lobby", 403);
      await lobbies.updateOne(
        { code: lobby.code },
        {
          $push: {
            chat: {
              $each: [{ id: crypto.randomUUID(), userId: me, name: member.name, text, at: Date.now() }],
              $slice: -50,
            },
          },
          $set: { updatedAt: new Date() },
        },
      );
      return reply();
    }

    case "leave": {
      if (!isMember) return reply();
      if (lobby.status === "playing") {
        // Mid-game: keep the seat but blind out (auto check/fold) until they return
        await runLobbyGame(lobby, (engine) => engine.setSittingOut(me, true));
        return reply();
      }
      if (lobby.status === "finished") return reply();
      const remaining = lobby.players.filter((p) => p.userId !== me);
      await lobbies.updateOne(
        { code: lobby.code, status: "waiting" },
        {
          $pull: { players: { userId: me } },
          $set: {
            updatedAt: new Date(),
            ...(isHost && remaining.length ? { hostUserId: remaining[0].userId } : {}),
            ...(remaining.length === 0 ? { status: "finished" as const } : {}),
          },
        },
      );
      return reply();
    }

    case "kick": {
      if (!isHost) return err("Only the host can remove players", 403);
      if (lobby.status !== "waiting") return err("Players can only be removed before the game starts");
      if (!body.userId || body.userId === me) return err("Pick another player");
      await lobbies.updateOne(
        { code: lobby.code, status: "waiting" },
        {
          $pull: { players: { userId: body.userId } },
          $addToSet: { kicked: body.userId },
          $set: { updatedAt: new Date() },
        },
      );
      return reply();
    }

    case "settings": {
      if (!isHost) return err("Only the host can change settings", 403);
      if (lobby.status !== "waiting") return err("Settings are locked once the game starts");
      let settings;
      try {
        settings = parsePokerSettings(body.settings);
      } catch (e) {
        return err(e instanceof ZodError ? (e.issues[0]?.message ?? "Invalid settings") : "Invalid settings");
      }
      if (settings.maxPlayers < lobby.players.length) {
        return err(`There are already ${lobby.players.length} players seated`);
      }
      await lobbies.updateOne(
        { code: lobby.code, status: "waiting" },
        { $set: { settings, updatedAt: new Date() } },
      );
      return reply();
    }

    case "start": {
      if (!isHost) return err("Only host can start", 403);
      if (lobby.players.length < 2) return err("Need at least 2 players");
      if (lobby.status === "waiting") await startPokerTournament(lobby);
      return reply();
    }

    case "rematch": {
      if (!isMember) return err("Not in lobby", 403);
      if (lobby.status !== "finished") return err("Game is not over yet");
      if (!lobby.rematchCode) {
        const host = lobby.players.find((p) => p.userId === me)!;
        const newCode = await createLobby(
          { userId: host.userId, name: host.name, avatarId: host.avatarId },
          lobby.settings as Parameters<typeof createLobby>[1],
        );
        const claimed = await lobbies.updateOne(
          { code: lobby.code, rematchCode: { $exists: false } },
          { $set: { rematchCode: newCode, updatedAt: new Date() } },
        );
        // Lost the race to another player: drop ours, everyone joins theirs
        if (claimed.matchedCount === 0) await lobbies.deleteOne({ code: newCode });
      }
      return reply();
    }

    default:
      return err("Unknown action");
  }
}
