import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, SessionUser } from "@/lib/auth";

export async function requireSessionJson(): Promise<
  { user: SessionUser } | NextResponse
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user: session.user as SessionUser };
}
