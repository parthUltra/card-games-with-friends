"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATARS } from "@/lib/avatars";
import { authClient } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) {
        router.replace("/login");
        return;
      }
      const u = data.user as { onboardingComplete?: boolean; name?: string; avatarId?: string };
      if (u.name) setName(u.name);
      if (u.avatarId) setAvatarId(u.avatarId);
    });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not save profile");
        return;
      }
      router.replace("/games");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const current = AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];

  return (
    <div className="page-in mx-auto max-w-2xl md:pt-4">
      <header className="mb-6">
        <p className="eyebrow">Your player</p>
        <h1 className="font-display mt-2 text-[28px] font-bold leading-tight md:text-[40px]">Who&apos;s sitting down?</h1>
        <p className="mt-2 text-[var(--muted)]">Pick a name and an avatar. You can change these later.</p>
      </header>
      <form onSubmit={onSubmit} className="panel space-y-6 p-5 md:p-7">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full ring-2 ring-[var(--brass)] ring-offset-2 ring-offset-[var(--surface)]"
          />
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="name">
              Display name
            </label>
            <input
              id="name"
              className="input"
              required
              minLength={2}
              maxLength={24}
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AceHunter"
            />
          </div>
        </div>
        <fieldset>
          <legend className="label">Avatar</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {AVATARS.map((a) => {
              const on = avatarId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarId(a.id)}
                  aria-pressed={on}
                  aria-label={a.label}
                  className={`aspect-square rounded-full p-0.5 transition-[transform,box-shadow,opacity] duration-150 active:scale-95 ${
                    on
                      ? "scale-105 shadow-[0_0_0_2px_var(--brass)]"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.src} alt="" className="h-full w-full rounded-full" />
                </button>
              );
            })}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-[#ff9b9e]">
            {error}
          </p>
        )}
        <button className="btn btn-gold btn-lg w-full sm:w-auto" disabled={loading} aria-busy={loading} type="submit">
          {loading && <span className="spinner" aria-hidden />}
          {loading ? "Saving…" : "Take a seat"}
        </button>
      </form>
    </div>
  );
}
