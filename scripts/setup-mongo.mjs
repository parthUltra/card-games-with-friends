/**
 * Ensures MongoDB collections + indexes for the multi-game platform.
 * Usage: node --env-file=.env.local scripts/setup-mongo.mjs
 *    or: MONGODB_URI=... MONGODB_DB=cardgames node scripts/setup-mongo.mjs
 */
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "cardgames";

if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

const client = new MongoClient(uri);

async function ensureIndex(col, keys, options) {
  try {
    await col.createIndex(keys, options);
    console.log(`  ✓ ${col.collectionName}.${options.name}`);
  } catch (e) {
    console.warn(`  ~ ${col.collectionName}.${options.name}: ${e.message}`);
  }
}

async function main() {
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to ${dbName}`);

  const lobbies = db.collection("lobbies");
  await ensureIndex(lobbies, { code: 1 }, { unique: true, name: "lobbies_code_unique" });
  await ensureIndex(lobbies, { status: 1, updatedAt: -1 }, { name: "lobbies_status_updated" });
  await ensureIndex(lobbies, { gameId: 1, status: 1, createdAt: -1 }, { name: "lobbies_game_status" });
  await ensureIndex(lobbies, { hostUserId: 1, createdAt: -1 }, { name: "lobbies_host" });
  await ensureIndex(lobbies, { "players.userId": 1 }, { name: "lobbies_players" });

  const matches = db.collection("matches");
  await ensureIndex(matches, { lobbyCode: 1, endedAt: -1 }, { name: "matches_lobby_ended" });
  await ensureIndex(matches, { gameId: 1, endedAt: -1 }, { name: "matches_game_ended" });
  await ensureIndex(matches, { "players.userId": 1, endedAt: -1 }, { name: "matches_player_ended" });
  await ensureIndex(matches, { endedAt: -1 }, { name: "matches_ended" });

  const leaderboard = db.collection("leaderboard");
  await ensureIndex(
    leaderboard,
    { userId: 1, gameId: 1 },
    { unique: true, name: "lb_user_game_unique" },
  );
  await ensureIndex(leaderboard, { gameId: 1, wins: -1, top3: -1 }, { name: "lb_game_wins" });
  await ensureIndex(leaderboard, { gameId: 1, played: -1 }, { name: "lb_game_played" });

  const events = db.collection("game_events");
  await ensureIndex(events, { matchId: 1, at: 1 }, { name: "events_match_at" });
  await ensureIndex(events, { gameId: 1, type: 1, at: -1 }, { name: "events_game_type" });
  await ensureIndex(events, { userId: 1, at: -1 }, { name: "events_user_at" });

  const users = db.collection("user");
  await ensureIndex(users, { email: 1 }, { unique: true, sparse: true, name: "user_email" });
  await ensureIndex(users, { statsWins: -1, statsTop3: -1 }, { name: "user_global_leaderboard" });
  await ensureIndex(
    users,
    { onboardingComplete: 1, statsWins: -1 },
    { name: "user_onboarded_wins" },
  );

  await db.collection("games_catalog").updateOne(
    { _id: "catalog" },
    {
      $set: {
        games: [
          { id: "poker", name: "Texas Hold'em", status: "live", minPlayers: 2, maxPlayers: 6 },
          {
            id: "blackjack",
            name: "Blackjack",
            status: "coming_soon",
            minPlayers: 2,
            maxPlayers: 6,
          },
          { id: "hearts", name: "Hearts", status: "coming_soon", minPlayers: 4, maxPlayers: 4 },
        ],
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  console.log("  ✓ games_catalog seeded");

  console.log("Collections:", await db.listCollections().map((c) => c.name).toArray());
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
