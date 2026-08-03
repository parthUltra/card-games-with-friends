"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AVATARS } from "@/lib/avatars";

const QUICK_GUESTS = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enterAsGuest(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a guest name");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: anonErr } = await authClient.signIn.anonymous();
      if (anonErr) {
        setError(anonErr.message || "Guest sign-in failed");
        return;
      }
      const avatarId =
        AVATARS[Math.floor(Math.random() * AVATARS.length)]?.id ?? "avatar_00";
      const { error: updErr } = await authClient.updateUser({
        name: trimmed.slice(0, 24),
        avatarId,
        onboardingComplete: true,
      } as { name: string });
      if (updErr) {
        setError(updErr.message || "Could not set guest profile");
        return;
      }
      router.replace("/games");
      router.refresh();
    } catch {
      setError("Guest sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGuestSubmit(e: FormEvent) {
    e.preventDefault();
    await enterAsGuest(guestName);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/onboarding",
      });
      if (err) {
        setError(err.message || "Could not send link");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-10">
      <div className="panel mb-4 space-y-4 p-6 md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
            Jump in
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold">Play as guest</h1>
          <p className="mt-2 text-sm text-[var(--cream)]/70">
            No email needed. Guest games and stats are not saved — sign in with
            email to keep your history and leaderboard.
          </p>
        </div>

        <form onSubmit={onGuestSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="guestName">
              Display name
            </label>
            <input
              id="guestName"
              className="input"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="AceHunter"
              maxLength={24}
              autoFocus
            />
          </div>
          <button className="btn btn-gold w-full" disabled={loading} type="submit">
            {loading ? "Entering…" : "Continue as guest"}
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {QUICK_GUESTS.map((name) => (
            <button
              key={name}
              type="button"
              className="btn btn-ghost !py-2 !text-sm"
              disabled={loading}
              onClick={() => enterAsGuest(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      </div>

      <div className="panel p-6 md:p-8">
        <h2 className="font-display text-2xl font-bold">Or sign in with email</h2>
        <p className="mt-2 text-[var(--cream)]/70">
          Magic link login. Finishing a tournament as a signed-in player updates
          your profile, history, and rankings.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-[var(--line)] bg-black/20 p-4">
            <p className="font-semibold text-[var(--gold)]">Check your email</p>
            <p className="mt-2 text-sm text-[var(--cream)]/75">
              We sent a sign-in link to <strong>{email}</strong>. In local
              development without Resend, the link is printed in the server
              console.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}
            <button className="btn btn-ghost w-full" disabled={loading} type="submit">
              {loading ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
