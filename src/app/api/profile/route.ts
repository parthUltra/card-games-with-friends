import { NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSessionJson } from "@/lib/session-api";

const schema = z.object({
  name: z.string().min(2).max(24),
  avatarId: z.string().regex(/^avatar_\d{2}$/),
});

export async function PATCH(req: Request) {
  const session = await requireSessionJson();
  if (session instanceof NextResponse) return session;

  const body = schema.parse(await req.json());
  const result = await auth.api.updateUser({
    body: {
      name: body.name,
      avatarId: body.avatarId,
      onboardingComplete: true,
    },
    headers: await headers(),
  });

  if (!result) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
