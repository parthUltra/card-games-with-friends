import { NextResponse } from "next/server";
import { requireSessionJson } from "@/lib/session-api";
import { engineFromLobby, getLobby, runLobbyGame } from "@/lib/room-runtime";
import type { LobbyDoc } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

const ACTIONS = ["fold", "check", "call", "raise", "sit_out", "sit_in"] as const;
type Action = (typeof ACTIONS)[number];

function gamePayload(lobby: LobbyDoc, userId: string) {
  const engine = engineFromLobby(lobby);
  return {
    type: "game" as const,
    status: lobby.status,
    hostUserId: lobby.hostUserId,
    rematchCode: lobby.rematchCode ?? null,
    state: engine ? engine.toPrivate(userId) : null,
  };
}

async function loadMember(ctx: Ctx, userId: string): Promise<LobbyDoc | NextResponse> {
  const { code } = await ctx.params;
  const lobby = await getLobby(code);
  if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  if (!lobby.players.some((p) => p.userId === userId)) {
    return NextResponse.json({ error: "Not in lobby" }, { status: 403 });
  }
  return lobby;
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  let lobby = await loadMember(ctx, session.user.id);
  if (lobby instanceof NextResponse) return lobby;

  try {
    lobby = await runLobbyGame(lobby);
  } catch {
    // Contended tick: serve the last read state, the next poll catches up
  }
  return NextResponse.json(gamePayload(lobby, session.user.id));
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  const body = (await req.json().catch(() => ({}))) as { action?: string; raiseTo?: unknown };
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const raiseTo = typeof body.raiseTo === "number" && Number.isFinite(body.raiseTo) ? Math.floor(body.raiseTo) : undefined;

  let lobby = await loadMember(ctx, session.user.id);
  if (lobby instanceof NextResponse) return lobby;
  if (lobby.status !== "playing" || !lobby.engine) {
    return NextResponse.json({ error: "Game not active" }, { status: 400 });
  }

  const userId = session.user.id;
  try {
    lobby = await runLobbyGame(lobby, (engine, now) => {
      if (engine.status === "finished") return;
      if (action === "sit_out") engine.setSittingOut(userId, true);
      else if (action === "sit_in") engine.setSittingOut(userId, false);
      else engine.applyAction(userId, action, raiseTo, now);
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
  return NextResponse.json(gamePayload(lobby, userId));
}
