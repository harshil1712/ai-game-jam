# AI Game Jam — Implementation Plan

A booth demo for AI Engineer Europe showcasing Cloudflare's Dynamic Workers as the primitive for running AI-generated code instantly in secure, isolated sandboxes.

## Starting Point

The codebase is an unmodified `create-cloudflare` Agents SDK chat starter template. Everything described below needs to be built on top of it.

**What exists:**

- `ChatAgent` Durable Object extending `AIChatAgent` (generic chatbot with weather/timezone/calculate tools)
- React chat UI (`src/app.tsx`) with streaming markdown, image attachments, MCP panel
- Workers AI binding (`env.AI`) using `@cf/moonshotai/kimi-k2.5`
- Tailwind CSS v4 + `@cloudflare/kumo` component library

**What needs to be built:** Everything else — login, game generation, Dynamic Worker dispatch, gallery, voting, booth dashboard.

---

## Architecture

```
Attendee phone/laptop
       │
       ▼
┌───────────────────────────────────────────┐
│  Main Worker (Agents SDK)                 │
│                                           │
│  Routes:                                  │
│  ├── POST /api/login → session (D1)       │
│  ├── GET  /api/me → current user          │
│  ├── GET/POST /agents/* → AIChatAgent     │
│  │    ├── AI generates HTML/JS code       │
│  │    ├── generateGame tool → saves to D1 │
│  │    └── Returns /app/{gameId} URL       │
│  ├── GET /app/:gameId                     │
│  │    └── LOADER.get(id, callback)        │
│  │         └── Dynamic Worker serves app  │
│  ├── GET /api/gallery → games + votes     │
│  ├── POST /api/vote/:gameId               │
│  └── GET /api/stats → booth counters      │
│                                           │
│  State:                                   │
│  ├── D1: users, games, votes              │
│  └── Durable Object: agent per user       │
└───────────────────────────────────────────┘
                    │
          LOADER.get(gameId:vN, ...)
                    │
                    ▼
         ┌──────────────────────┐
         │  Dynamic Worker      │
         │  (per game version)  │
         │                      │
         │  Serves generated    │
         │  HTML/JS app         │
         │                      │
         │  globalOutbound: null│
         │  (fully sandboxed)   │
         └──────────────────────┘
```

---

## Phase 1: Infrastructure & Bindings

### 1.1 Create D1 database

```bash
npx wrangler d1 create ai-game-jam-db
```

Copy the output `database_id` into `wrangler.jsonc`.

### 1.2 Update `wrangler.jsonc`

Add bindings and expand `run_worker_first` to cover all Worker-handled routes:

```jsonc
{
  // existing config...

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "ai-game-jam-db",
      "database_id": "<ID from wrangler d1 create>"
    }
  ],

  "worker_loaders": [
    {
      "binding": "LOADER"
    }
  ],

  "vars": {
    "SESSION_SECRET": "change-me-in-production"
  },

  "assets": {
    "directory": "./public",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/agents/*", "/oauth/*", "/api/*", "/app/*"]
  }
}
```

> Note: `/gallery` and `/dashboard` are client-side React routes served by the SPA fallback — they don't need `run_worker_first`.

### 1.3 Create `schema.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id          TEXT PRIMARY KEY,
  creator_id  TEXT NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  code        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  vote_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  user_id     TEXT NOT NULL REFERENCES users(id),
  game_id     TEXT NOT NULL REFERENCES games(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_games_votes   ON games(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_games_creator ON games(creator_id);
```

Bootstrap locally:

```bash
npx wrangler d1 execute ai-game-jam-db --local --file=./schema.sql
```

Bootstrap remotely (before deploying):

```bash
npx wrangler d1 execute ai-game-jam-db --remote --file=./schema.sql
```

### 1.4 Regenerate types

```bash
npm run types  # wrangler types env.d.ts --include-runtime false
```

After this, `Env` will include `DB: D1Database`, `LOADER: WorkerLoader`, and `SESSION_SECRET: string`.

### 1.5 Add new npm dependencies

```bash
npm install nanoid qrcode.react @tanstack/react-router
npm install -D @tanstack/router-plugin
```

| Package                   | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `nanoid`                  | Compact unique IDs for users and games      |
| `qrcode.react`            | Client-side QR code for the booth dashboard |
| `@tanstack/react-router`  | Type-safe client-side routing               |
| `@tanstack/router-plugin` | Vite plugin for file-based route generation |

### 1.6 Update `vite.config.ts`

Add the TanStack Router Vite plugin. It must come **before** other plugins so it generates the route tree before React/Cloudflare plugins process the source:

```ts
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import agents from "agents/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true
    }),
    agents(),
    react(),
    cloudflare(),
    tailwindcss()
  ]
});
```

The plugin watches `src/routes/` and auto-generates `src/routeTree.gen.ts` containing the typed route tree. This file is gitignored and regenerated on each dev/build.

---

## Phase 2: Backend — Routes & Auth

### 2.1 Restructure `src/server.ts`

The file currently has the `ChatAgent` class and a minimal `fetch` handler that calls `routeAgentRequest`. Expand it into a full router.

**New structure of `src/server.ts`:**

```
exports:
  - ChatAgent class (Durable Object)
  - default fetch handler (routes all requests)

fetch handler logic:
  const url = new URL(request.url);
  const path = url.pathname;

  // Agent WebSocket routes (must come first)
  if (path.startsWith('/agents/')) → routeAgentRequest

  // API routes
  if (path === '/api/login' && method === 'POST') → handleLogin
  if (path === '/api/me')                         → handleMe
  if (path === '/api/gallery')                    → handleGallery
  if (path === '/api/stats')                      → handleStats
  if (path.startsWith('/api/vote/') && method === 'POST') → handleVote

  // Dynamic Worker app serving
  if (path.startsWith('/app/')) → handleApp

  // 404 fallback (assets Worker handles everything else)
  → new Response('Not found', { status: 404 })
```

### 2.2 Auth helper — cookie-based sessions

No OAuth. Simple signed cookies.

```ts
// Sign: HMAC-SHA256(secret, userId) → base64
// Cookie value: `{userId}.{signature}`
// Verify: recompute signature, compare in constant time

async function signSession(userId: string, secret: string): Promise<string>;
async function verifySession(
  cookie: string,
  secret: string
): Promise<string | null>;
async function getSessionUser(request: Request, env: Env): Promise<User | null>;
```

Use the Web Crypto API (available in Workers):

```ts
const key = await crypto.subtle.importKey(
  "raw",
  encoder.encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);
```

### 2.3 `POST /api/login`

```
Body: { name: string, email: string }

1. Validate: name and email are non-empty strings; email matches basic regex
2. Upsert into D1:
   INSERT INTO users (id, name, email) VALUES (?, ?, ?)
   ON CONFLICT(email) DO UPDATE SET name = excluded.name
3. Sign session cookie: signSession(user.id, env.SESSION_SECRET)
4. Return:
   Set-Cookie: session={signed}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400
   Body: { id, name, email }
```

### 2.4 `GET /api/me`

```
1. Read session cookie → verifySession → userId
2. SELECT * FROM users WHERE id = ?
3. Return { id, name, email } or 401
```

### 2.5 `GET /api/gallery`

```
Query params: ?page=1&limit=20

SELECT
  g.id, g.title, g.description, g.vote_count, g.version,
  g.created_at, g.updated_at,
  u.name AS creator_name
FROM games g
JOIN users u ON u.id = g.creator_id
ORDER BY g.vote_count DESC, g.created_at DESC
LIMIT ? OFFSET ?

Return: { games: [...], total: number, page: number }
```

Also return whether the current user (if logged in) has voted for each game — query `votes` table and join into results.

### 2.6 `POST /api/vote/:gameId`

```
Auth required (401 if no session).

1. Parse gameId from path
2. Check game exists
3. INSERT OR IGNORE INTO votes (user_id, game_id) VALUES (?, ?)
4. If a new row was inserted (changes > 0):
   UPDATE games SET vote_count = vote_count + 1 WHERE id = ?
5. Return { voted: boolean, vote_count: number }
```

D1 doesn't support triggers in the same way as full SQLite, so the denormalized `vote_count` update is done in a transaction-like sequence (two sequential statements; D1 batch API can be used for atomicity).

### 2.7 `GET /api/stats`

```
SELECT
  (SELECT COUNT(*) FROM games)  AS total_games,
  (SELECT COUNT(*) FROM users)  AS total_users,
  (SELECT SUM(vote_count) FROM games) AS total_votes,
  (SELECT COUNT(*) FROM games WHERE updated_at > datetime('now', '-5 minutes')) AS recent_games
```

Return as JSON for the dashboard to poll.

### 2.8 `GET /app/:gameId` — Dynamic Worker dispatch

This is the hero feature.

```ts
async function handleApp(request: Request, env: Env): Promise<Response> {
  const gameId = url.pathname.split("/app/")[1];
  if (!gameId) return new Response("Not found", { status: 404 });

  // Fetch latest game code from D1
  const game = await env.DB.prepare(
    "SELECT code, version FROM games WHERE id = ?"
  )
    .bind(gameId)
    .first();

  if (!game) return new Response("Game not found", { status: 404 });

  // Load (or reuse warm) Dynamic Worker keyed by game ID + version
  const workerId = `${gameId}:v${game.version}`;

  const worker = env.LOADER.get(workerId, async () => ({
    compatibilityDate: "2026-03-02",
    mainModule: "index.js",
    modules: {
      "index.js": `
        export default {
          fetch() {
            return new Response(${JSON.stringify(game.code)}, {
              headers: { 'content-type': 'text/html; charset=utf-8' }
            });
          }
        };
      `
    },
    globalOutbound: null // fully sandboxed — no outbound network
  }));

  return worker.getEntrypoint().fetch(request);
}
```

**Key design points:**

- `workerId` includes version: `game_abc123:v3`. When user iterates, version increments → new ID → fresh isolate loaded.
- The stable URL `/app/{gameId}` always fetches latest version from D1 then dispatches.
- `LOADER.get()` caches warm isolates by ID, so subsequent visits to the same version are fast.
- `globalOutbound: null` sandboxes the generated code — no network access.

---

## Phase 3: AI Agent — Code Generation

### 3.1 Rewrite `ChatAgent` in `src/server.ts`

Replace the generic assistant with a game-builder agent.

**Remove from current code:**

- `getWeather` tool
- `getUserTimezone` tool
- `calculate` tool
- `scheduleTask`, `getScheduledTasks`, `cancelScheduledTask` tools
- `executeTask` method
- MCP server management (`addServer`, `removeServer`, `onStart` OAuth config)
- `inlineDataUrls` helper (no more image attachments)

**System prompt:**

```
You are an AI game builder at a conference booth. Your job is to create fun,
interactive browser apps based on what attendees describe.

When a user describes something they want to build, generate a complete,
self-contained HTML file that implements it. Then use the generateGame tool
to save and deploy it.

Rules for generated code:
- Output MUST be a single complete <!DOCTYPE html> document
- All CSS must be inline in a <style> tag
- All JavaScript must be inline in a <script> tag
- NO external dependencies, CDN links, or network requests
- The app must be visually appealing with a clean, modern design
- Games should include a score display where applicable
- Apps should work on both desktop and mobile (use responsive design)

When iterating on an existing game, you will receive the current code.
Always output the COMPLETE updated HTML file — not a diff or partial update.

Keep your text responses short and enthusiastic. After deploying, tell the
user their game is live and encourage them to share the link.

Good examples of things to build:
- Browser games: Snake, Pong, Breakout, Tetris, Tic-tac-toe, 2048, memory match
- Quizzes: topic-based Q&A with scoring and a timer
- Creative tools: drawing canvas, color mixer, pixel art editor
- Simulations: particle effects, bouncing balls, Conway's Game of Life
- Generators: name generator, color palette, random story
```

### 3.2 Agent state

The `AIChatAgent` stores messages in its Durable Object SQLite storage. We also need to track:

- `userId` — who this agent instance belongs to
- `currentGameId` — the game being iterated on (if any)

These can be stored in the DO's `state` (available via `this.state` on the Agent base class).

```ts
interface AgentState {
  userId?: string;
  currentGameId?: string;
}
```

### 3.3 `generateGame` tool

```ts
generateGame: tool({
  description:
    "Save the generated game to the platform and make it live. Call this whenever you have generated or updated an HTML game/app.",
  inputSchema: z.object({
    title: z
      .string()
      .describe("Short, catchy title for the game/app (max 50 chars)"),
    description: z
      .string()
      .describe("One-sentence description of what it does"),
    code: z.string().describe("The complete <!DOCTYPE html> source code")
  }),
  execute: async ({ title, description, code }) => {
    const userId = this.state.userId;
    if (!userId) return { error: "Not authenticated" };

    const db = this.env.DB;
    const existingGameId = this.state.currentGameId;

    if (existingGameId) {
      // Update existing game — increment version
      const result = await db
        .prepare(
          `
        UPDATE games 
        SET code = ?, title = ?, description = ?,
            version = version + 1,
            updated_at = datetime('now')
        WHERE id = ? AND creator_id = ?
        RETURNING version
      `
        )
        .bind(code, title, description, existingGameId, userId)
        .first();

      return {
        gameId: existingGameId,
        version: result?.version,
        url: `/app/${existingGameId}`
      };
    } else {
      // Create new game
      const gameId = nanoid(10);
      await db
        .prepare(
          `
        INSERT INTO games (id, creator_id, title, description, code)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .bind(gameId, userId, title, description, code)
        .run();

      // Store for future iterations
      this.setState({ ...this.state, currentGameId: gameId });

      return {
        gameId,
        version: 1,
        url: `/app/${gameId}`
      };
    }
  }
});
```

### 3.4 Pass user context to the agent

When the frontend connects to the WebSocket, it passes the user ID as a query parameter:

```
/agents/ChatAgent/user_{userId}?userId={userId}
```

The `AIChatAgent` is identified by the URL path segment after the agent class name, so each user gets their own Durable Object instance.

In `onChatMessage`, on first call, read `userId` from the request URL and store in state:

```ts
async onChatMessage(onFinish: unknown, options?: OnChatMessageOptions) {
  // Initialize userId from connection params on first message
  if (!this.state.userId && options?.request) {
    const url = new URL(options.request.url);
    const userId = url.searchParams.get('userId');
    if (userId) this.setState({ ...this.state, userId });
  }
  // ... rest of streamText call
}
```

### 3.5 Multi-turn iteration flow

1. User: "build me a snake game"
   → Agent generates HTML → calls `generateGame` → stores `currentGameId` in DO state
   → Returns: "Your Snake game is live! Play it at /app/abc123"

2. User: "make the snake faster and add a high score"
   → Agent has conversation history (sees previous code in the tool output)
   → Agent modifies the code → calls `generateGame` again (same gameId, new version)
   → Same URL `/app/abc123` now loads the new version from D1

The conversation history stored in the DO's SQLite includes the previous `generateGame` tool outputs, so the agent always has context of what code was last generated.

---

## Phase 4: Frontend — React UI with TanStack Router

### 4.1 Routing with TanStack Router (file-based)

We use [TanStack Router](https://tanstack.com/router) with its **file-based routing** approach. The `@tanstack/router-plugin` Vite plugin watches `src/routes/` and auto-generates a typed route tree (`src/routeTree.gen.ts`).

#### Directory structure

```
src/
├── routes/
│   ├── __root.tsx          # Root layout: <html> shell, auth context provider
│   ├── index.tsx           # "/" → LoginPage
│   ├── _authed.tsx         # Layout route: auth guard (redirects to / if not logged in)
│   ├── _authed/
│   │   ├── chat.tsx        # "/chat" → ChatPage (requires auth)
│   │   └── gallery.tsx     # "/gallery" → GalleryPage (requires auth)
│   └── dashboard.tsx       # "/dashboard" → DashboardPage (no auth needed, booth screen)
├── routeTree.gen.ts        # Auto-generated by TanStack Router plugin (gitignored)
├── client.tsx              # Entry: createRouter + RouterProvider
├── server.ts               # Worker backend (unchanged from Phase 2/3)
└── styles.css
```

#### Route tree explanation

| File                  | Route        | Auth | Description                                                                                                                                |
| --------------------- | ------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `__root.tsx`          | —            | —    | Root layout wrapping all pages. Provides auth context, `<Toasty>` wrapper, sets `<html>` theme.                                            |
| `index.tsx`           | `/`          | No   | Login page. If already authenticated, redirects to `/chat`.                                                                                |
| `_authed.tsx`         | —            | Yes  | Pathless layout route. Its `beforeLoad` hook calls `/api/me` and redirects to `/` if unauthenticated. All child routes inherit this guard. |
| `_authed/chat.tsx`    | `/chat`      | Yes  | Game-building chat interface.                                                                                                              |
| `_authed/gallery.tsx` | `/gallery`   | Yes  | Gallery with voting.                                                                                                                       |
| `dashboard.tsx`       | `/dashboard` | No   | Booth ambient display (no login needed).                                                                                                   |

> The `_authed` prefix (underscore) makes this a **pathless layout route** — it adds an auth guard wrapper without adding a URL segment. Routes inside `_authed/` are mounted at `/chat` and `/gallery`, not `/_authed/chat`.

#### Router creation (`src/client.tsx`)

```tsx
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  context: {
    user: undefined // filled by __root.tsx
  }
});

// Type-safe router declaration
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return <RouterProvider router={router} />;
}
```

#### Auth context pattern

The root route (`__root.tsx`) fetches `/api/me` and provides the user to all child routes via router context:

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

interface RouterContext {
  user: { id: string; name: string; email: string } | undefined;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout
});

function RootLayout() {
  return (
    <Toasty>
      <Outlet />
    </Toasty>
  );
}
```

The `_authed.tsx` layout route enforces auth:

```tsx
// src/routes/_authed.tsx
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />
});
```

#### Navigation

TanStack Router provides type-safe `<Link>` components and `useNavigate()`:

```tsx
import { Link, useNavigate } from "@tanstack/react-router";

// In components:
<Link to="/chat">Build</Link>
<Link to="/gallery">Gallery</Link>

// Programmatic navigation (e.g., after login):
const navigate = useNavigate();
await navigate({ to: "/chat" });
```

### 4.2 `LoginPage` (`src/routes/index.tsx`)

**Layout**: Centered card on a dark gradient background. Conference-themed.

```
┌─────────────────────────┐
│   AI Game Jam            │
│   AI Engineer Europe    │
│                         │
│  Name:  [____________]  │
│  Email: [____________]  │
│                         │
│  [  Start Building  ]   │
│                         │
│  "Your game will be     │
│   live in seconds."     │
└─────────────────────────┘
```

- `beforeLoad`: If `context.user` exists, `throw redirect({ to: "/chat" })` — skip login if already authenticated
- On submit: POST `/api/login` → on success, `router.invalidate()` (re-runs root loader to pick up the session) then `navigate({ to: "/chat" })`
- Show loading state during the request
- Simple client-side validation (non-empty name, valid-looking email)

### 4.3 `ChatPage` (`src/routes/_authed/chat.tsx`)

**Layout**: Split view on desktop, stacked on mobile.

```
Desktop:
┌──────────────────┬───────────────────────┐
│  Chat            │  Game Preview         │
│                  │                       │
│  [messages...]   │  ┌─────────────────┐  │
│                  │  │                 │  │
│                  │  │   <iframe>      │  │
│                  │  │   /app/{gameId} │  │
│  [input box]     │  │                 │  │
│                  │  └─────────────────┘  │
│                  │  [Share link] [Open]  │
└──────────────────┴───────────────────────┘

Mobile:
Full-screen chat with floating "View Game" button when a game exists.
```

**Simplified from existing Chat component — remove:**

- MCP panel
- Debug mode toggle
- Image attachment support
- Theme toggle (use system preference or always dark)

**Add:**

- Suggested prompts tailored to games: "Build me Snake", "Make a quiz about...", "Create a drawing tool"
- Game preview iframe that appears/updates when `generateGame` tool runs
- The agent's tool output contains the game URL — parse it from the message stream
- "Share" button: copies `/app/{gameId}` to clipboard
- "Open in new tab" button
- Header with `<Link to="/gallery">Gallery</Link>` nav

**Connecting to the agent:** Access user from route context, pass `userId` in the agent name so each user gets their own DO:

```tsx
const { user } = Route.useRouteContext();

const agent = useAgent<GameBuilderAgent>({
  agent: "ChatAgent",
  name: `user_${user.id}` // each user gets their own DO instance
});
```

### 4.4 `GalleryPage` (`src/routes/_authed/gallery.tsx`)

```
┌─────────────────────────────────────────┐
│  AI Game Jam Gallery             [Chat]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Snake    │  │ Quiz     │  │ ...    │ │
│  │ by Alice │  │ by Bob   │  │        │ │
│  │          │  │          │  │        │ │
│  │ ▲ 12     │  │ ▲ 8      │  │ ▲ 3   │ │
│  │ [Play]   │  │ [Play]   │  │ [Play] │ │
│  └──────────┘  └──────────┘  └────────┘ │
│                                         │
│  [Load more]                            │
└─────────────────────────────────────────┘
```

- Uses `Route.useLoaderData()` for initial data (fetches `/api/gallery` in the route's `loader`)
- Re-fetches every 10 seconds via `setInterval` in the component
- Upvote button calls `POST /api/vote/:gameId`; optimistic UI update
- "Play" opens `/app/{gameId}` in a new tab
- Show whether current user has already voted (disable button if so)

### 4.5 `DashboardPage` (`src/routes/dashboard.tsx`)

Designed for a large monitor (landscape). Dark background. Large text. **No auth required** — this is the booth screen.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   AI Game Jam              AI Engineer Europe 2026              │
│                                                                 │
│   ┌────────────────────┐          ┌────────────────────────┐   │
│   │ LEADERBOARD        │          │   STATS                │   │
│   │                    │          │                        │   │
│   │ 1. Snake  ▲42 Alice│          │  127  games created    │   │
│   │ 2. Quiz   ▲38 Bob  │          │  891  total votes      │   │
│   │ 3. Tetris ▲31 Carol│          │   23  playing now      │   │
│   │ ...                │          │                        │   │
│   └────────────────────┘          └────────────────────────┘   │
│                                                                 │
│                             ┌─────────────┐                    │
│                             │  [QR Code]  │                    │
│                             │             │                    │
│                             │  Scan to    │                    │
│                             │  build your │                    │
│                             │  game!      │                    │
│                             └─────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

- Full-screen (`h-screen`, `overflow-hidden`)
- Polls `/api/gallery?limit=10` and `/api/stats` every 5 seconds
- QR code generated client-side using `qrcode.react` pointing to the booth login URL
- Animated counters (count up when numbers increase)
- No interaction needed — ambient display only

---

## Phase 5: Wiring & Polish

### 5.1 Type safety

After all changes, run `npm run types` to regenerate `env.d.ts`. The `Env` interface should include:

```ts
interface Env {
  AI: Ai;
  DB: D1Database;
  LOADER: WorkerLoader;
  SESSION_SECRET: string;
  ChatAgent: DurableObjectNamespace<ChatAgent>;
}
```

### 5.2 Error states

| Scenario                    | Handling                                            |
| --------------------------- | --------------------------------------------------- |
| AI generation fails         | Chat shows "Something went wrong, try again"        |
| Generated HTML is malformed | Still save it; browser handles bad HTML gracefully  |
| Dynamic Worker load fails   | `/app/:gameId` returns a simple styled error page   |
| Game not found              | 404 page within the iframe                          |
| Vote on already-voted game  | Return `{ voted: true }` — frontend disables button |
| Session expired             | `/api/me` returns 401 → redirect to login           |

### 5.3 Performance considerations

- `LOADER.get()` with stable IDs means popular games stay warm — subsequent visits are fast
- D1 reads are fast for single-row lookups by primary key
- Gallery polling uses a simple `setInterval` — acceptable for a booth demo
- The AI generation stream means users see progress immediately, not just a spinner

### 5.4 Security considerations

- `globalOutbound: null` on all Dynamic Workers — generated code has zero network access
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Strict`
- Session secret via `vars` (use `wrangler secret put SESSION_SECRET` for production)
- No user-uploaded code — all code is AI-generated (but sandboxed anyway)
- Basic input validation on login (non-empty, email format)

### 5.5 Final deploy

```bash
# Schema migration (first time)
npx wrangler d1 execute ai-game-jam-db --remote --file=./schema.sql

# Build and deploy
npm run deploy
```

---

## File Change Summary

| File                             | Action         | Notes                                                                     |
| -------------------------------- | -------------- | ------------------------------------------------------------------------- |
| `wrangler.jsonc`                 | Edit           | Add D1, LOADER, SESSION_SECRET; expand routes                             |
| `schema.sql`                     | Create         | D1 tables: users, games, votes                                            |
| `env.d.ts`                       | Regenerate     | After `npm run types`                                                     |
| `package.json`                   | Edit           | Add nanoid, qrcode.react, @tanstack/react-router, @tanstack/router-plugin |
| `vite.config.ts`                 | Edit           | Add TanStackRouterVite plugin                                             |
| `src/server.ts`                  | Rewrite        | Router, auth, game agent, Dynamic Worker dispatch                         |
| `src/app.tsx`                    | Delete         | Replaced by file-based route components                                   |
| `src/client.tsx`                 | Rewrite        | Create TanStack Router, `RouterProvider`, type registration               |
| `src/routes/__root.tsx`          | Create         | Root layout with auth context provider, `<Toasty>` wrapper                |
| `src/routes/index.tsx`           | Create         | Login page (redirects to /chat if already authed)                         |
| `src/routes/_authed.tsx`         | Create         | Pathless layout route with `beforeLoad` auth guard                        |
| `src/routes/_authed/chat.tsx`    | Create         | Game-building chat (refactored from old `app.tsx` Chat component)         |
| `src/routes/_authed/gallery.tsx` | Create         | Gallery with voting                                                       |
| `src/routes/dashboard.tsx`       | Create         | Booth ambient display (no auth)                                           |
| `src/routeTree.gen.ts`           | Auto-generated | Created by TanStack Router plugin; gitignored                             |
| `src/styles.css`                 | Edit           | Additions for new components as needed                                    |
| `.gitignore`                     | Edit           | Add `src/routeTree.gen.ts`                                                |

---

## Implementation Order

```
Phase 1: Infrastructure
  ├── wrangler d1 create
  ├── Update wrangler.jsonc (D1 + LOADER + vars)
  ├── Create schema.sql
  ├── npm install nanoid qrcode.react @tanstack/react-router
  ├── npm install -D @tanstack/router-plugin
  ├── Update vite.config.ts (add TanStackRouterVite plugin)
  ├── npm run types → regenerate env.d.ts
  └── Add src/routeTree.gen.ts to .gitignore

Phase 2: Backend
  ├── Auth helpers (sign/verify session)
  ├── POST /api/login
  ├── GET /api/me
  ├── GET /app/:gameId (Dynamic Worker dispatch)
  ├── GET /api/gallery
  ├── POST /api/vote/:gameId
  └── GET /api/stats

Phase 3: AI Agent
  ├── New system prompt (game builder)
  ├── Remove old tools (weather, calculate, etc.)
  ├── Add generateGame tool
  ├── AgentState type (userId, currentGameId)
  └── userId initialization on first message

Phase 4: Frontend (TanStack Router file-based)
  ├── Rewrite src/client.tsx (createRouter + RouterProvider)
  ├── Delete src/app.tsx
  ├── Create src/routes/__root.tsx (root layout + auth context)
  ├── Create src/routes/index.tsx (LoginPage)
  ├── Create src/routes/_authed.tsx (auth guard layout)
  ├── Create src/routes/_authed/chat.tsx (ChatPage)
  │   ├── Simplified (no MCP, no attachments)
  │   ├── Game iframe preview panel
  │   └── Share button
  ├── Create src/routes/_authed/gallery.tsx (GalleryPage)
  └── Create src/routes/dashboard.tsx (DashboardPage, no auth)

Phase 5: Polish & Deploy
  ├── Error handling
  ├── npm run check (lint + typecheck)
  ├── Test locally with wrangler dev
  └── npm run deploy
```

---

## Open Questions (resolved)

| Question                     | Decision                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Dynamic Workers availability | Assume beta access; no fallback to Workers for Platforms                        |
| AI model                     | Workers AI with `@cf/moonshotai/kimi-k2.5` (existing binding)                   |
| Iteration depth              | Multi-turn — full chat-based iteration                                          |
| Booth dashboard deployment   | Same Worker, `/dashboard` route (SPA)                                           |
| Client-side routing          | TanStack Router with file-based routing (`@tanstack/router-plugin` Vite plugin) |
