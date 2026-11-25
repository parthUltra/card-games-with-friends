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

  return (
    <>
    <div>
      <label className="label">Lobby name</label>
      <input
        className="input"
        value={settings.lobbyName}
        onChange={(e) =>
          setSettings((s) => ({ ...s, lobbyName: e.target.value }))
        }
      />
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Starting stack</label>
        <input
          className="input"
          type="number"
          min={500}
          max={100000}
          value={settings.startingStack}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              startingStack: Number(e.target.value),
            }))
          }
        />
      </div>
      <div>
        <label className="label">Max players</label>
        <select
          className="input"
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
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>

    <div>
      <label className="label">Turn timer</label>
      <div className="flex flex-wrap gap-2">
        {([15, 30, 45, 60] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn !py-2 !text-sm ${
              settings.turnTimerSec === t ? "btn-gold" : "btn-ghost"
            }`}
            onClick={() => setSettings((s) => ({ ...s, turnTimerSec: t }))}
          >
            {t}s
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="label">Blind schedule</label>
      <div className="flex flex-wrap gap-2">
        {(["casual", "standard", "turbo", "custom"] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`btn !py-2 !text-sm capitalize ${
              settings.blindPreset === p ? "btn-gold" : "btn-ghost"
            }`}
            onClick={() => applyPreset(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>

    {settings.blindPreset === "custom" && (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Starting SB</label>
          <input
            className="input"
            type="number"
            value={settings.startingSmallBlind}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                startingSmallBlind: Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="label">Increase every (min)</label>
          <input
            className="input"
            type="number"
            value={settings.blindIntervalMin}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                blindIntervalMin: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
    )}
    </>
  );
}
