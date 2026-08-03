# Card Games With Friends

Multiplayer card nights on Vercel. v1: **Texas Hold'em** single-table tournaments (2–6 players), invite code/link lobbies, magic-link auth, MongoDB Atlas, PartyKit realtime. Built as a multi-game lounge — more titles can plug into the same auth, lobbies, history, and leaderboards.

## Stack

- Next.js (App Router) + TypeScript + Tailwind — Vercel
- better-auth magic links (Resend optional; logs to console in dev)
- MongoDB Atlas — users, lobbies, matches, per-game leaderboards, game events
- PartyKit — authoritative poker rooms + timers
- Framer Motion + Balatro-style card art

## Setup

1. Copy env:

```bash
cp .env.example .env.local
```

2. Set at least:

- `MONGODB_URI` / `MONGODB_DB`
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`
- `PARTYKIT_TOKEN_SECRET` / `NEXT_PUBLIC_PARTYKIT_HOST`
- `RESEND_API_KEY` (optional)

Atlas **Network Access** must allow your IP (or `0.0.0.0/0` for Vercel). **Rotate any DB password that was shared in chat.**

3. Install, index DB, run:

```bash
npm install
npm run db:setup
npm run dev:party   # terminal 1 — PartyKit on :1999
npm run dev         # terminal 2 — Next on :3000
```

4. Open http://localhost:3000 → Sign in → pick avatar → create a poker lobby.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js |
| `npm run dev:party` | PartyKit local server |
| `npm run db:setup` | Ensure MongoDB indexes + catalog |
| `npm test` | Poker engine unit tests |
| `npm run build` | Production Next build |
| `npm run deploy:party` | Deploy PartyKit to Cloudflare |

## Deploy (Vercel)

1. Push this repo to GitHub and import the project on Vercel.
2. Add env vars from `.env.example` (production URLs + secrets).
3. Set Atlas Network Access to allow Vercel (`0.0.0.0/0` is typical).
4. Deploy PartyKit (`npm run deploy:party`), set `NEXT_PUBLIC_PARTYKIT_HOST` to the deployed host.
5. Point `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` at your Vercel domain.
6. Keep `ALLOW_DEV_AUTH` / `NEXT_PUBLIC_ALLOW_DEV_AUTH` **unset or false** in production.

## Data model (MongoDB `cardgames`)

| Collection | Purpose |
|------------|---------|
| `user` / `session` / `verification` | better-auth accounts + sessions |
| `lobbies` | Private rooms by invite code |
| `matches` | Finished games (history, past nights) |
| `leaderboard` | Per-user, per-game standings |
| `game_events` | Match finish events / analytics |
| `games_catalog` | Ops mirror of ship status |

## Multi-game layout

Games register in `src/lib/games/registry.ts`. Poker UI: `/games/poker`, `/lobby/[code]`, `/play/[code]`. Party server: `party/poker.ts`. Add future games as registry entries + party handlers + routes under `/games/<id>`.
