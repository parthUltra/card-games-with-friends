"use client";

import type { Dispatch, SetStateAction } from "react";
import { BLIND_PRESETS, PokerLobbySettings } from "@/lib/games/registry";

type Props = {
  settings: PokerLobbySettings;
  setSettings: Dispatch<SetStateAction<PokerLobbySettings>>;
};

/** Poker table settings inputs, shared by the create form and the lobby host editor. */
export function PokerSettingsFields({ settings, setSettings }: Props) {
  function applyPreset(preset: PokerLobbySettings["blindPreset"]) {
    if (preset === "custom") {
      setSettings((s) => ({ ...s, blindPreset: "custom" }));
      return;
    }
    setSettings((s) => ({
      ...s,
      blindPreset: preset,
      ...BLIND_PRESETS[preset],
    }));
  }

  const sb = settings.startingSmallBlind;

  return (
    <>
      <div>
        <label className="label" htmlFor="ps-name">
          Table name
        </label>
        <input
          id="ps-name"
          className="input"
          value={settings.lobbyName}
          maxLength={40}
          onChange={(e) => setSettings((s) => ({ ...s, lobbyName: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="ps-stack">
            Starting stack
          </label>
          <input
            id="ps-stack"
            className="input tnum"
            type="number"
            inputMode="numeric"
            min={500}
            max={100000}
            step={500}
            value={settings.startingStack}
            onChange={(e) => setSettings((s) => ({ ...s, startingStack: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="ps-max">
            Seats
          </label>
          <select
            id="ps-max"
            className="input tnum"
            value={settings.maxPlayers}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                maxPlayers: Number(e.target.value) as 2 | 3 | 4 | 5 | 6,
              }))
            }
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">Turn timer</legend>
        <div className="grid grid-cols-4 gap-2">
          {([15, 30, 45, 60] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="chip tnum"
              aria-pressed={settings.turnTimerSec === t}
              onClick={() => setSettings((s) => ({ ...s, turnTimerSec: t }))}
            >
              {t}s
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Blind schedule</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["casual", "standard", "turbo", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="chip capitalize"
              aria-pressed={settings.blindPreset === p}
              onClick={() => applyPreset(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="tnum mt-2 text-sm text-[var(--muted)]">
          Blinds start {sb}/{sb * 2}, rise every {settings.blindIntervalMin} min
        </p>
      </fieldset>

      {settings.blindPreset === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ps-sb">
              Starting SB
            </label>
            <input
              id="ps-sb"
              className="input tnum"
              type="number"
              inputMode="numeric"
              value={settings.startingSmallBlind}
              onChange={(e) => setSettings((s) => ({ ...s, startingSmallBlind: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="ps-int">
              Increase every (min)
            </label>
            <input
              id="ps-int"
              className="input tnum"
              type="number"
              inputMode="numeric"
              value={settings.blindIntervalMin}
              onChange={(e) => setSettings((s) => ({ ...s, blindIntervalMin: Number(e.target.value) }))}
            />
          </div>
        </div>
      )}
    </>
  );
}
