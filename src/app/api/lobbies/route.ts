import { NextResponse } from "next/server";
import { z } from "zod";
import { getCollection } from "@/lib/db";
import { requireSessionJson } from "@/lib/session-api";
import {
  BLIND_PRESETS,
  DEFAULT_POKER_SETTINGS,
  PokerLobbySettings,
} from "@/lib/games/registry";
import { generateLobbyCode, LobbyDoc } from "@/lib/types";

const createSchema = z.object({
  lobbyName: z.string().min(1).max(40).default("Poker Night"),
  startingStack: z.number().int().min(500).max(100000).default(5000),
  maxPlayers: z.union([
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]).default(6),
  turnTimerSec: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]).default(30),
  blindPreset: z
    .enum(["casual", "standard", "turbo", "custom"])
    .default("standard"),
  startingSmallBlind: z.number().int().min(1).max(5000).optional(),
  blindIntervalMin: z.number().int().min(1).max(30).optional(),
});

export async function POST(req: Request) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  if (!session.user.onboardingComplete) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });
  }

  const body = createSchema.parse(await req.json());
  const preset =
    body.blindPreset !== "custom"
      ? BLIND_PRESETS[body.blindPreset]
      : {
          startingSmallBlind:
            body.startingSmallBlind ?? DEFAULT_POKER_SETTINGS.startingSmallBlind,
          blindIntervalMin:
            body.blindIntervalMin ?? DEFAULT_POKER_SETTINGS.blindIntervalMin,
        };

  const settings: PokerLobbySettings = {
    lobbyName: body.lobbyName,
    startingStack: body.startingStack,
    maxPlayers: body.maxPlayers,
    turnTimerSec: body.turnTimerSec,
    blindPreset: body.blindPreset,
    startingSmallBlind: preset.startingSmallBlind,
    blindIntervalMin: preset.blindIntervalMin,
  };

  const lobbies = await getCollection<LobbyDoc>("lobbies");
  let code = generateLobbyCode();
  for (let i = 0; i < 5; i++) {
    const exists = await lobbies.findOne({ code });
    if (!exists) break;
    code = generateLobbyCode();
  }

  const now = new Date();
  const doc: LobbyDoc = {
    code,
    gameId: "poker",
    hostUserId: session.user.id,
    status: "waiting",
    settings,
    players: [
      {
        userId: session.user.id,
        name: session.user.name || session.user.email.split("@")[0],
        avatarId: session.user.avatarId || "avatar_00",
        ready: true,
        joinedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await lobbies.insertOne(doc);

  // Seed PartyKit room (best-effort; players also authenticate on connect)
  const partyHost =
    process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
  const partyUrl = partyHost.startsWith("http")
    ? `${partyHost}/parties/main/${code}`
    : `http://${partyHost}/parties/main/${code}`;
  try {
    await fetch(partyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostUserId: session.user.id,
        settings,
        players: doc.players.map((p) => ({
          userId: p.userId,
          name: p.name,
          avatarId: p.avatarId,
          ready: p.ready,
        })),
      }),
    });
  } catch {
    // Party server may not be up yet during local bootstrap
  }

  return NextResponse.json({ code, settings });
}
