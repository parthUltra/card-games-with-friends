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

  return (
    <div className="mx-auto max-w-2xl pt-6">
      <div className="panel p-6 md:p-8">
        <h1 className="font-display text-3xl font-bold">Create your player</h1>
        <p className="mt-2 text-[var(--cream)]/70">
          Pick a display name and an avatar. You can change these later.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <div>
            <label className="label" htmlFor="name">
              Display name
            </label>
            <input
              id="name"
              className="input"
              required
              minLength={2}
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="AceHunter"
            />
          </div>
          <div>
            <p className="label">Avatar</p>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarId(a.id)}
                  className={`rounded-xl border p-1 transition ${
                    avatarId === a.id
                      ? "border-[var(--gold)] ring-2 ring-[var(--gold)]"
                      : "border-[var(--line)] opacity-80 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.src} alt={a.label} className="h-full w-full rounded-lg" />
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button className="btn btn-gold" disabled={loading} type="submit">
            {loading ? "Saving…" : "Enter the lobby hall"}
          </button>
        </form>
      </div>
    </div>
  );
}
