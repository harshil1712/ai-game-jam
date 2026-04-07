# AI Game Jam

A game jam demo for showcasing [Cloudflare Dynamic Workers](https://developers.cloudflare.com/workers/runtime-apis/worker-loaders/) as a primitive for running AI-generated code instantly in secure, isolated sandboxes.

Users visit the URL, log in with a name and email, then chat with an AI agent that generates complete browser games. Each game is instantly deployed as a sandboxed Dynamic Worker at a unique URL. Users can iterate via chat, share links, and vote for favorites in a live gallery.

## What It Demonstrates

| Cloudflare Product                                                                                         | Role                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Dynamic Workers (Worker Loaders)](https://developers.cloudflare.com/workers/runtime-apis/worker-loaders/) | Hero feature: AI-generated HTML/JS games run in isolated Workers with no network access (`globalOutbound: null`) |
| [Agents SDK](https://developers.cloudflare.com/agents/)                                                    | `AIChatAgent` Durable Object for persistent per-user chat with tool-calling                                      |
| [Workers AI](https://developers.cloudflare.com/workers-ai/)                                                | Model inference using `@cf/moonshotai/kimi-k2.5` (no API key needed)                                             |
| [D1](https://developers.cloudflare.com/d1/)                                                                | SQLite database for users, games, and votes                                                                      |
| [Durable Objects](https://developers.cloudflare.com/durable-objects/)                                      | Backs each user's agent instance with persistent conversation state                                              |

## Tech Stack

- **[React 19](https://react.dev/)** + **[TanStack Router](https://tanstack.com/router)** — file-based routing, type-safe
- **[Tailwind CSS v4](https://tailwindcss.com/)** + **[@cloudflare/kumo](https://developers.cloudflare.com/style-guide/)** — Cloudflare design system
- **[Vite](https://vite.dev/)** — frontend build
- **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** — local dev + deployment

## Project Structure

```
src/
  server.ts              # Worker entry: routes requests, re-exports ChatAgent
  types.ts               # Shared TypeScript interfaces
  styles.css             # Tailwind v4 + Kumo + retro cyber theme
  server/
    agent.ts             # ChatAgent (AIChatAgent DO) with generateGame, listMyGames, loadGame tools
    routes.ts            # API handlers: login, gallery, vote, stats, game dispatch
    auth.ts              # HMAC-SHA256 cookie session auth
    utils.ts             # Shared response helpers
  components/
    AppHeader.tsx        # Page header with help icon
    HelpModal.tsx        # Resource links modal
    CyberButton.tsx      # Themed button variants
    CyberSurface.tsx     # Themed surface/card wrapper
    GameCard.tsx         # Gallery game card with vote + launch
    ToolPartView.tsx     # Renders AI tool call states + inline game preview iframe
  hooks/
    usePolling.ts        # setInterval-based polling hook
  lib/
    api.ts               # Typed client API functions
  routes/
    __root.tsx           # Root layout: auth context, dark mode
    index.tsx            # / — Login page
    _authed.tsx          # Auth guard layout
    _authed/
      chat.tsx           # /chat — AI game builder chat interface
      gallery.tsx        # /gallery — Game gallery with voting
    dashboard.tsx        # /dashboard — Booth ambient display (no auth)
schema.sql               # D1 schema: users, games, votes
wrangler.jsonc           # Cloudflare config: AI, D1, Worker Loaders, DO, assets
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/harshil1712/ai-game-jam.git
cd ai-game-jam
npm install
```

### 2. Create the D1 database

```bash
npx wrangler d1 create ai-game-jam-db
```

Copy the `database_id` from the output and update `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "ai-game-jam-db",
    "database_id": "<your-database-id>"  // replace this
  }
]
```

### 3. Apply the database schema

```bash
# For local development:
npx wrangler d1 execute ai-game-jam-db --local --file=schema.sql

# For production:
npx wrangler d1 execute ai-game-jam-db --file=schema.sql
```

### 4. Set a session secret

Update the `SESSION_SECRET` in `wrangler.jsonc` (or use a [Wrangler secret](https://developers.cloudflare.com/workers/configuration/secrets/) in production):

```bash
npx wrangler secret put SESSION_SECRET
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see the app.

### 6. Deploy

```bash
npm run deploy
```

Your app is live on Cloudflare's global network.

## How It Works

1. **User logs in** with name + email. A signed HMAC-SHA256 session cookie is set.
2. **User chats** with a `ChatAgent` (Durable Object backed by the Agents SDK). Each user gets their own persistent agent instance.
3. **Agent generates a game** using Workers AI (`kimi-k2.5`). The `generateGame` tool receives the AI-produced HTML/JS and calls `LOADER.run()` to spin up a sandboxed Dynamic Worker on the fly.
4. **Game is served** at `/app/{gameId}`. The Dynamic Worker has `globalOutbound: null` — it can't make outbound network requests, keeping it isolated.
5. **Users vote** on games in the gallery. The `/dashboard` route shows a live leaderboard, stats, and QR codes for the booth display.

## Key Implementation Details

### Dynamic Workers (Worker Loaders)

The core feature. In `src/server/routes.ts`, when serving a game:

```ts
const result = await env.LOADER.run(game.code, {
  globalOutbound: null // no network access — sandboxed
});
return result.response;
```

And in `wrangler.jsonc`:

```jsonc
"worker_loaders": [
  { "binding": "LOADER" }
]
```

### AI Chat Agent

The `ChatAgent` in `src/server/agent.ts` extends `AIChatAgent` from the Agents SDK. It exposes three tools:

- `generateGame` — generates and deploys a new game
- `listMyGames` — fetches the user's existing games
- `loadGame` — loads a previous game into context for editing

### Auth

Simple HMAC-SHA256 signed cookie session (`src/server/auth.ts`). No OAuth — just name + email for the booth demo.

## Learn More

### Cloudflare Products

- [Dynamic Workers (Worker Loaders)](https://developers.cloudflare.com/workers/runtime-apis/worker-loaders/) — run AI-generated code in isolated sandboxes
- [Agents SDK](https://developers.cloudflare.com/agents/) — build stateful AI agents on Cloudflare Workers
- [Build a Chat Agent](https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/) — step-by-step tutorial
- [Workers AI](https://developers.cloudflare.com/workers-ai/) — run AI models at the edge, no API key needed
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/) — full model catalog
- [D1](https://developers.cloudflare.com/d1/) — serverless SQLite at the edge
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) — stateful, globally consistent Workers
- [Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/) — CPU, memory, and request limits

### Frontend

- [TanStack Router](https://tanstack.com/router) — type-safe file-based routing for React
- [Cloudflare Kumo](https://developers.cloudflare.com/style-guide/) — Cloudflare's design system
- [Agents SDK React hooks](https://developers.cloudflare.com/agents/api-reference/agents-api/) — `useAgent`, `useAgentChat` for WebSocket chat

## License

MIT
