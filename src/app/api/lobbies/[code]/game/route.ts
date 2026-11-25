import { NextResponse } from "next/server";
import { requireSessionJson } from "@/lib/session-api";
import { getCollection } from "@/lib/db";
import { engineFromLobby, getLobby, runLobbyGame, tickDue, type RevProbe } from "@/lib/room-runtime";
import type { LobbyDoc } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

const ACTIONS = ["fold", "check", "call", "raise", "sit_out", "sit_in"] as const;
type Action = (typeof ACTIONS)[number];
const NO_STORE = { "Cache-Control": "no-store" };

function gamePayload(lobby: LobbyDoc, userId: string) {
  const engine = engineFromLobby(lobby);
  return {
    type: "game" as const,
    status: lobby.status,
    hostUserId: lobby.hostUserId,
    rematchCode: lobby.rematchCode ?? null,
    rev: lobby.rev ?? 0,
    serverNow: Date.now(),
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

export async function GET(req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  const userId = session.user.id;

  // Cheap poll: a small projection answers "nothing changed" without loading the engine or ticking.
  const since = Number(new URL(req.url).searchParams.get("since"));
  if (Number.isFinite(since) && since > 0) {
    const { code } = await ctx.params;
    const lobbies = await getCollection<LobbyDoc>("lobbies");
    const probe = (await lobbies.findOne(
      { code: code.toUpperCase() },
      {
        projection: {
          rev: 1, status: 1, nextHandAt: 1, blindLevelStartedAt: 1,
          "players.userId": 1, "settings.blindIntervalMin": 1,
          "engine.status": 1, "engine.actingSeat": 1, "engine.turnEndsAt": 1,
          "engine.players.seat": 1, "engine.players.sittingOut": 1,
        },
      },
    )) as RevProbe | null;
    if (
      probe &&
      probe.rev === since &&
      probe.players.some((p) => p.userId === userId) &&
      !tickDue(probe, Date.now())
    ) {
      return new Response(null, { status: 204, headers: NO_STORE });
    }
  }

  let lobby = await loadMember(ctx, userId);
  if (lobby instanceof NextResponse) return lobby;
  try {
    lobby = await runLobbyGame(lobby);
  } catch {
    // Contended tick: serve the last read state, the next poll catches up
  }
  return NextResponse.json(gamePayload(lobby, userId), { headers: NO_STORE });
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
  return NextResponse.json(gamePayload(lobby, userId), { headers: NO_STORE });
}
