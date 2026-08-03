import { ObjectId } from "mongodb";
import type { PokerLobbySettings } from "./games/registry";

/** Registered game ids — extend as new games ship. */
export type GameId = "poker" | "blackjack" | "hearts";

export type LobbyStatus = "waiting" | "playing" | "finished";

export type LobbyPlayer = {
  userId: string;
  name: string;
  avatarId: string;
  ready: boolean;
  joinedAt: Date;
};

/** Common lobby fields shared across games; game-specific knobs live alongside. */
export type GameLobbySettings = {
  lobbyName: string;
  maxPlayers: number;
} & Record<string, unknown>;

export type LobbyChatMessage = {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
};

export type LobbyDoc = {
  _id?: ObjectId;
  code: string;
  gameId: GameId;
  hostUserId: string;
  status: LobbyStatus;
  settings: PokerLobbySettings | GameLobbySettings;
  players: LobbyPlayer[];
  chat?: LobbyChatMessage[];
  /** Serialized PokerEngine snapshot while a table is active */
  engine?: Record<string, unknown> | null;
  startedAt?: Date | null;
  blindLevelStartedAt?: number | null;
  /** When set, deal the next hand after this epoch ms */
  nextHandAt?: number | null;
  matchPersisted?: boolean;
  createdAt: Date;
  updatedAt: Date;
  inviteExpiresAt?: Date;
};

export type MatchPlayerResult = {
  userId: string;
  name: string;
  avatarId: string;
  place: number;
  /** Optional chip / score snapshot at finish */
  finalStack?: number;
};

export type MatchDoc = {
  _id?: ObjectId;
  lobbyId: string;
  lobbyCode: string;
  gameId: GameId;
  /** Display name of the table / match */
  lobbyName: string;
  players: MatchPlayerResult[];
  settings: PokerLobbySettings | GameLobbySettings;
  startedAt: Date;
  endedAt: Date;
  /** Duration in ms for stats UIs */
  durationMs?: number;
};

/** Per-user, per-game leaderboard row (supports many games). */
export type LeaderboardDoc = {
  _id?: ObjectId;
  userId: string;
  gameId: GameId;
  name: string;
  avatarId: string;
  wins: number;
  top3: number;
  played: number;
  updatedAt: Date;
};

export type GameEventDoc = {
  _id?: ObjectId;
  matchId?: string;
  lobbyCode?: string;
  gameId: GameId;
  userId?: string;
  type: string;
  payload?: Record<string, unknown>;
  at: Date;
};

export function generateLobbyCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
