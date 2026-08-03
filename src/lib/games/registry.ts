import type { GameId } from "@/lib/types";

export type PokerLobbySettings = {
  lobbyName: string;
  startingStack: number;
  maxPlayers: 2 | 3 | 4 | 5 | 6;
  turnTimerSec: 15 | 30 | 45 | 60;
  /** Small blind at level 1 */
  startingSmallBlind: number;
  /** Minutes between blind increases */
  blindIntervalMin: number;
  blindPreset: "casual" | "standard" | "turbo" | "custom";
};

export const DEFAULT_POKER_SETTINGS: PokerLobbySettings = {
  lobbyName: "Poker Night",
  startingStack: 5000,
  maxPlayers: 6,
  turnTimerSec: 30,
  startingSmallBlind: 25,
  blindIntervalMin: 5,
  blindPreset: "standard",
};

export const BLIND_PRESETS: Record<
  Exclude<PokerLobbySettings["blindPreset"], "custom">,
  Pick<PokerLobbySettings, "startingSmallBlind" | "blindIntervalMin">
> = {
  casual: { startingSmallBlind: 10, blindIntervalMin: 8 },
  standard: { startingSmallBlind: 25, blindIntervalMin: 5 },
  turbo: { startingSmallBlind: 50, blindIntervalMin: 3 },
};

export type GameDefinition = {
  id: GameId;
  name: string;
  tagline: string;
  blurb: string;
  minPlayers: number;
  maxPlayers: number;
  status: "live" | "coming_soon";
  href: string;
  /** Accent used on the games hub tile */
  accent: string;
  party?: string;
};

/**
 * Central game registry. New titles: add an entry here, then party handler + pages.
 * DB `games_catalog` mirrors status for ops; app code remains source of truth for routing.
 */
export const GAMES: GameDefinition[] = [
  {
    id: "poker",
    name: "Texas Hold'em",
    tagline: "Tournament night — 2 to 6 seats.",
    blurb: "Single-table sit-and-go with rising blinds, turn timers, and private invite links.",
    minPlayers: 2,
    maxPlayers: 6,
    status: "live",
    href: "/games/poker",
    accent: "#1a7a52",
    party: "poker",
  },
  {
    id: "blackjack",
    name: "Blackjack",
    tagline: "Hit soft 17s with the table.",
    blurb: "Dealer-vs-friends rounds are on the roadmap.",
    minPlayers: 2,
    maxPlayers: 6,
    status: "coming_soon",
    href: "/games",
    accent: "#8b2942",
  },
  {
    id: "hearts",
    name: "Hearts",
    tagline: "Pass left. Dump the queen.",
    blurb: "Classic trick-taking for exactly four. Coming later.",
    minPlayers: 4,
    maxPlayers: 4,
    status: "coming_soon",
    href: "/games",
    accent: "#2a4a7a",
  },
];

export function getGame(id: string) {
  return GAMES.find((g) => g.id === id);
}

export function liveGames() {
  return GAMES.filter((g) => g.status === "live");
}
