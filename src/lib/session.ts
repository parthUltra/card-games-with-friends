import { headers } from "next/headers";
import { auth, SessionUser } from "./auth";
import { redirect } from "next/navigation";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session as { user: SessionUser; session: { id: string } };
}

export async function requireOnboarded() {
  const session = await requireSession();
  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }
  return session;
}
