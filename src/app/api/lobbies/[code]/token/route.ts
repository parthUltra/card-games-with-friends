import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { requireSessionJson } from "@/lib/session-api";
import { mintRoomToken } from "@/lib/room-token";
import { LobbyDoc } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;

  const { code } = await ctx.params;
  const lobbies = await getCollection<LobbyDoc>("lobbies");
  const lobby = await lobbies.findOne({ code: code.toUpperCase() });
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
  }
  const member = lobby.players.find((p) => p.userId === session.user.id);
  if (!member) {
    return NextResponse.json({ error: "Not in lobby" }, { status: 403 });
  }

  const token = await mintRoomToken({
    userId: session.user.id,
    lobbyCode: lobby.code,
    name: member.name,
    avatarId: member.avatarId,
  });

  return NextResponse.json({
    token,
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999",
    room: lobby.code,
  });
}
