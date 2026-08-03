import type * as Party from "partykit/server";
import { PokerEngine } from "../src/lib/poker/engine";
import type { PokerLobbySettings } from "../src/lib/games/registry";
import { jwtVerify } from "jose";

type ChatMessage = { id: string; userId: string; name: string; text: string; at: number };

type RoomPlayer = {
  userId: string;
  name: string;
  avatarId: string;
  connectionId?: string;
  ready: boolean;
};

type LobbySnapshot = {
  hostUserId: string;
  settings: PokerLobbySettings;
  status: "waiting" | "playing" | "finished";
  players: RoomPlayer[];
  chat: ChatMessage[];
  engine: PokerEngine | null;
  startedAt: string | null;
  blindLevelStartedAt: number | null;
};

type ClientMessage =
  | { type: "hello"; token: string }
  | { type: "chat"; text: string }
  | { type: "ready" }
  | { type: "start" }
  | { type: "action"; action: "fold" | "check" | "call" | "raise"; raiseTo?: number }
  | { type: "sync" };

function tokenSecret() {
  return new TextEncoder().encode(
    process.env.PARTYKIT_TOKEN_SECRET ||
      process.env.BETTER_AUTH_SECRET ||
      "dev-party-secret",
  );
}

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, tokenSecret());
  return {
    userId: String(payload.userId),
    lobbyCode: String(payload.lobbyCode),
    name: String(payload.name),
    avatarId: String(payload.avatarId ?? "avatar_00"),
  };
}

export default class PokerRoom implements Party.Server {
  roomState: LobbySnapshot;
  tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
    this.roomState = {
      hostUserId: "",
      settings: {
        lobbyName: "Poker Night",
        startingStack: 5000,
        maxPlayers: 6,
        turnTimerSec: 30,
        startingSmallBlind: 25,
        blindIntervalMin: 5,
        blindPreset: "standard",
      },
      status: "waiting",
      players: [],
      chat: [],
      engine: null,
      startedAt: null,
      blindLevelStartedAt: null,
    };
  }

  async onStart() {
    const stored = await this.room.storage.get<LobbySnapshot>("state");
    if (stored) {
      this.roomState = {
        ...stored,
        engine: null,
      };
    }
    this.ensureTicker();
  }

  ensureTicker() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.onTick(), 500);
  }

  async persistMeta() {
    const { engine, ...rest } = this.roomState;
    await this.room.storage.put("state", rest);
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    this.ensureTicker();
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    if (token) {
      try {
        await this.authenticate(conn, token);
      } catch {
        conn.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        conn.close();
        return;
      }
    }
    this.sendLobby(conn);
  }

  async authenticate(conn: Party.Connection, token: string) {
    const identity = await verifyToken(token);
    if (identity.lobbyCode.toUpperCase() !== this.room.id.toUpperCase()) {
      throw new Error("Lobby mismatch");
    }
    conn.setState({ userId: identity.userId });

    let player = this.roomState.players.find((p) => p.userId === identity.userId);
    if (!player) {
      if (this.roomState.status !== "waiting") throw new Error("Game in progress");
      if (this.roomState.players.length >= this.roomState.settings.maxPlayers) {
        throw new Error("Full");
      }
      player = {
        userId: identity.userId,
        name: identity.name,
        avatarId: identity.avatarId,
        ready: this.roomState.players.length === 0,
        connectionId: conn.id,
      };
      this.roomState.players.push(player);
      if (!this.roomState.hostUserId) {
        this.roomState.hostUserId = identity.userId;
      }
    } else {
      player.connectionId = conn.id;
      player.name = identity.name;
      player.avatarId = identity.avatarId;
    }
    await this.persistMeta();
    this.broadcastLobby();
    this.sendPrivate(conn);
  }

  onClose(conn: Party.Connection) {
    const userId = (conn.state as { userId?: string } | null)?.userId;
    if (!userId) return;
    const player = this.roomState.players.find((p) => p.userId === userId);
    if (player) player.connectionId = undefined;
    this.broadcastLobby();
  }

  async onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === "hello") {
      try {
        await this.authenticate(sender, msg.token);
      } catch (e) {
        sender.send(
          JSON.stringify({
            type: "error",
            message: e instanceof Error ? e.message : "Auth failed",
          }),
        );
      }
      return;
    }

    const userId = (sender.state as { userId?: string } | null)?.userId;
    if (!userId) {
      sender.send(JSON.stringify({ type: "error", message: "Authenticate first" }));
      return;
    }

    if (msg.type === "chat") {
      const text = msg.text.trim().slice(0, 200);
      if (!text) return;
      const player = this.roomState.players.find((p) => p.userId === userId)!;
      this.roomState.chat.push({
        id: crypto.randomUUID(),
        userId,
        name: player.name,
        text,
        at: Date.now(),
      });
      this.roomState.chat = this.roomState.chat.slice(-50);
      this.broadcastLobby();
      return;
    }

    if (msg.type === "ready") {
      const player = this.roomState.players.find((p) => p.userId === userId);
      if (player) player.ready = true;
      await this.persistMeta();
      this.broadcastLobby();
      return;
    }

    if (msg.type === "start") {
      if (userId !== this.roomState.hostUserId) return;
      if (this.roomState.players.length < 2) return;
      this.roomState.status = "playing";
      this.roomState.startedAt = new Date().toISOString();
      this.roomState.blindLevelStartedAt = Date.now();
      this.roomState.engine = new PokerEngine({
        ...this.roomState.settings,
        players: this.roomState.players.map((p) => ({
          id: p.userId,
          name: p.name,
          avatarId: p.avatarId,
        })),
      });
      this.roomState.engine.startHand(Date.now());
      await this.persistMeta();
      this.broadcastGame();
      return;
    }

    if (msg.type === "action" && this.roomState.engine) {
      this.roomState.engine.applyAction(
        userId,
        msg.action,
        msg.raiseTo,
        Date.now(),
      );
      this.afterEngineUpdate();
      return;
    }

    if (msg.type === "sync") {
      this.sendLobby(sender);
      this.sendPrivate(sender);
    }
  }

  async onRequest(req: Party.Request) {
    if (req.method === "POST") {
      const body = (await req.json()) as {
        hostUserId: string;
        settings: PokerLobbySettings;
        players: RoomPlayer[];
      };
      this.roomState.hostUserId = body.hostUserId;
      this.roomState.settings = body.settings;
      this.roomState.players = body.players.map((p) => ({
        ...p,
        ready: p.userId === body.hostUserId,
      }));
      this.roomState.status = "waiting";
      await this.persistMeta();
      return Response.json({ ok: true });
    }
    return Response.json({
      code: this.room.id,
      status: this.roomState.status,
      players: this.roomState.players.length,
    });
  }

  onTick() {
    const engine = this.roomState.engine;
    if (!engine) return;
    const now = Date.now();

    // Blind level increases
    if (
      this.roomState.blindLevelStartedAt &&
      engine.status !== "finished" &&
      now - this.roomState.blindLevelStartedAt >=
        this.roomState.settings.blindIntervalMin * 60_000
    ) {
      engine.bumpBlindLevel();
      this.roomState.blindLevelStartedAt = now;
    }

    const before = engine.status;
    engine.tick(now);

    if (engine.status === "waiting" && before === "showdown") {
      // brief pause then next hand
      setTimeout(() => {
        if (this.roomState.engine?.status === "waiting") {
          this.roomState.engine.startHand(Date.now());
          this.broadcastGame();
        }
      }, 2500);
    }

    if (engine.status === "finished" && this.roomState.status === "playing") {
      this.roomState.status = "finished";
      void this.persistMatch();
    }

    this.broadcastGame();
  }

  afterEngineUpdate() {
    const engine = this.roomState.engine!;
    if (engine.status === "waiting") {
      setTimeout(() => {
        if (this.roomState.engine?.status === "waiting") {
          this.roomState.engine.startHand(Date.now());
          this.broadcastGame();
        }
      }, 2500);
    }
    if (engine.status === "finished") {
      this.roomState.status = "finished";
      void this.persistMatch();
    }
    this.broadcastGame();
  }

  async persistMatch() {
    const engine = this.roomState.engine;
    if (!engine || !this.roomState.startedAt) return;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
    try {
      await fetch(`${appUrl}/api/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-party-secret":
            process.env.PARTYKIT_TOKEN_SECRET ||
            process.env.BETTER_AUTH_SECRET ||
            "dev-party-secret",
        },
        body: JSON.stringify({
          lobbyCode: this.room.id,
          gameId: "poker",
          players: engine.getPlacements().map((p) => ({
            userId: p.id,
            name: p.name,
            avatarId: p.avatarId,
            place: p.place,
            finalStack: p.stack,
          })),
          settings: this.roomState.settings,
          startedAt: this.roomState.startedAt,
          endedAt: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error("Failed to persist match", e);
    }
  }

  lobbyPayload() {
    return {
      type: "lobby",
      code: this.room.id,
      hostUserId: this.roomState.hostUserId,
      status: this.roomState.status,
      settings: this.roomState.settings,
      players: this.roomState.players,
      chat: this.roomState.chat,
    };
  }

  sendLobby(conn: Party.Connection) {
    conn.send(JSON.stringify(this.lobbyPayload()));
  }

  broadcastLobby() {
    this.room.broadcast(JSON.stringify(this.lobbyPayload()));
  }

  broadcastGame() {
    this.broadcastLobby();
    for (const conn of this.room.getConnections()) {
      this.sendPrivate(conn);
    }
  }

  sendPrivate(conn: Party.Connection) {
    const userId = (conn.state as { userId?: string } | null)?.userId;
    const engine = this.roomState.engine;
    if (!userId || !engine) return;
    conn.send(
      JSON.stringify({
        type: "game",
        state: engine.toPrivate(userId),
      }),
    );
  }
}

PokerRoom satisfies Party.Worker;
