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
    <div className="page-in mx-auto max-w-md pt-2 md:pt-8">
      <header className="mb-6 text-center">
        <p className="eyebrow">Take a seat</p>
        <h1 className="font-display mt-2 text-[28px] font-bold leading-tight md:text-[40px]">Join the game</h1>
      </header>

      <section className="panel space-y-5 p-5 md:p-7" aria-labelledby="guest-h">
        <div>
          <h2 id="guest-h" className="text-lg font-semibold">
            Play as guest
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            No email needed. Guest games and stats aren&apos;t saved.
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
              autoComplete="nickname"
              autoFocus
            />
          </div>
          <button className="btn btn-gold btn-lg w-full" disabled={loading} aria-busy={loading} type="submit">
            {loading && <span className="spinner" aria-hidden />}
            {loading ? "Entering…" : "Continue as guest"}
          </button>
        </form>

        <div>
          <p className="mb-2 text-xs text-[var(--muted)]">Or grab a quick name</p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_GUESTS.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                disabled={loading}
                onClick={() => enterAsGuest(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        {error && !sent && (
          <p role="alert" className="text-sm text-[#ff9b9e]">
            {error}
          </p>
        )}
      </section>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]" aria-hidden>
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      <section className="panel p-5 md:p-7" aria-labelledby="email-h">
        <h2 id="email-h" className="text-lg font-semibold">
          Sign in with email
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          We&apos;ll send a magic link. Signed-in players keep their history and rankings.
        </p>

        {sent ? (
          <div className="mt-5 rounded-xl border border-[var(--action)]/35 bg-[var(--action)]/[0.07] p-4" role="status">
            <p className="font-semibold text-[var(--action)]">Check your email</p>
            <p className="mt-1 text-sm text-[var(--text)]/80">
              We sent a sign-in link to <strong>{email}</strong>. In local development without Resend,
              the link is printed in the server console.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button className="btn btn-ghost w-full" disabled={loading} aria-busy={loading} type="submit">
              {loading && <span className="spinner" aria-hidden />}
              {loading ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
