import { NextResponse } from "next/server";
import { requireSessionJson } from "@/lib/session-api";
import {
  engineFromLobby,
  getLobby,
  saveLobby,
  tickLobbyGame,
} from "@/lib/room-runtime";
import type { LobbyDoc } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  let lobby: LobbyDoc | null = await getLobby(code);
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  }
  if (!lobby.players.some((p) => p.userId === session.user.id)) {
    return NextResponse.json({ error: "Not in lobby" }, { status: 403 });
  }

  if (lobby.status === "playing") {
    lobby = await tickLobbyGame(lobby);
  }

  const engine = engineFromLobby(lobby);
  if (!engine) {
    return NextResponse.json({
      type: "game",
      status: lobby.status,
      state: null,
    });
  }

  return NextResponse.json({
    type: "game",
    status: lobby.status,
    state: engine.toPrivate(session.user.id),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "fold" | "check" | "call" | "raise";
    raiseTo?: number;
  };

  let lobby: LobbyDoc | null = await getLobby(code);
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  }
  if (lobby.status !== "playing" || !lobby.engine) {
    return NextResponse.json({ error: "Game not active" }, { status: 400 });
  }
  if (!lobby.players.some((p) => p.userId === session.user.id)) {
    return NextResponse.json({ error: "Not in lobby" }, { status: 403 });
  }

  lobby = await tickLobbyGame(lobby);
  let engine = engineFromLobby(lobby);
  if (!engine) {
    return NextResponse.json({ error: "No engine" }, { status: 400 });
  }

  if (body.action && engine.status !== "finished") {
    const before = engine.status;
    engine.applyAction(session.user.id, body.action, body.raiseTo, Date.now());
    const after = engine.status as string;
    const patch: Partial<LobbyDoc> = {
      engine: engine.serialize() as unknown as Record<string, unknown>,
    };
    if (after === "waiting" && before !== "waiting") {
      patch.nextHandAt = Date.now() + 2500;
    }
    await saveLobby(lobby.code, patch);
    lobby = { ...lobby, ...patch, updatedAt: new Date() };

    if (after === "finished") {
      lobby = await tickLobbyGame(lobby);
      engine = engineFromLobby(lobby) ?? engine;
    }
  }

  return NextResponse.json({
    type: "game",
    status: lobby.status,
    state: engine.toPrivate(session.user.id),
  });
}
