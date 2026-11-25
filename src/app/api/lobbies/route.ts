import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireSessionJson } from "@/lib/session-api";
import { parsePokerSettings } from "@/lib/games/poker-settings";
import { createLobby } from "@/lib/room-runtime";

export async function POST(req: Request) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;
  if (!session.user.onboardingComplete) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });
  }

  let settings;
  try {
    settings = parsePokerSettings(await req.json());
  } catch (err) {
    const msg = err instanceof ZodError ? err.issues[0]?.message : "Invalid request";
    return NextResponse.json({ error: msg ?? "Invalid settings" }, { status: 400 });
  }

  const code = await createLobby(
    {
      userId: session.user.id,
      name: session.user.name || session.user.email.split("@")[0],
      avatarId: session.user.avatarId || "avatar_00",
    },
    settings,
  );
  return NextResponse.json({ code, settings });
}
