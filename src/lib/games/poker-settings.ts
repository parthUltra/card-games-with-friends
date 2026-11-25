import { z } from "zod";
import { BLIND_PRESETS, DEFAULT_POKER_SETTINGS, PokerLobbySettings } from "./registry";

export const pokerSettingsSchema = z.object({
  lobbyName: z.string().trim().min(1).max(40).default("Poker Night"),
  startingStack: z.number().int().min(500).max(100000).default(5000),
  maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(6),
  turnTimerSec: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).default(30),
  blindPreset: z.enum(["casual", "standard", "turbo", "custom"]).default("standard"),
  startingSmallBlind: z.number().int().min(1).max(5000).optional(),
  blindIntervalMin: z.number().int().min(1).max(30).optional(),
});

/** Validate untrusted input into full lobby settings; throws ZodError on bad input. */
export function parsePokerSettings(input: unknown): PokerLobbySettings {
  const body = pokerSettingsSchema.parse(input);
  const preset =
    body.blindPreset !== "custom"
      ? BLIND_PRESETS[body.blindPreset]
      : {
          startingSmallBlind: body.startingSmallBlind ?? DEFAULT_POKER_SETTINGS.startingSmallBlind,
          blindIntervalMin: body.blindIntervalMin ?? DEFAULT_POKER_SETTINGS.blindIntervalMin,
        };
  return {
    lobbyName: body.lobbyName,
    startingStack: body.startingStack,
    maxPlayers: body.maxPlayers,
    turnTimerSec: body.turnTimerSec,
    blindPreset: body.blindPreset,
    ...preset,
  };
}
