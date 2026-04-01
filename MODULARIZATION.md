# Modularization Implementation Plan

## Context

**Project**: AI Game Jam — a Cloudflare Workers app where conference attendees chat with an AI to build browser games, deployed via Dynamic Workers.

**Current state**: ~1,840 lines across 10 source files. Most logic lives in two monolithic files: `src/server.ts` (600 lines) and `src/routes/_authed/chat.tsx` (489 lines). Types are duplicated across 3 files, button class strings are copy-pasted 16+ times, and JSON response boilerplate is repeated 12 times.

**Goal**: Extract reusable components, shared types, utility functions, and split the server into focused modules — without changing any behavior.

**Constraints**:

- `wrangler.jsonc` line 4: `"main": "src/server.ts"` — this file must remain the entrypoint and must `export class ChatAgent` and `export default { fetch }`.
- `env.d.ts` line 5: `typeof import("./src/server")` — `ChatAgent` must be exported from `src/server.ts`.
- `tsconfig.json` extends `"agents/tsconfig"` — no path aliases configured, use relative imports everywhere.
- `chat.tsx` line 22: `import type { ChatAgent } from "../../server"` — this import path must remain valid.
- Tailwind v4 is in use (`@tailwindcss/vite` v4.2.2). Custom design tokens are registered via `@theme` in CSS, not `tailwind.config.js`.
- Run `npm run check` (`oxfmt --check . && oxlint src/ && tsc`) to verify correctness after all changes.

**Proposed directory structure after refactoring**:

```
src/
├── components/
│   ├── AppHeader.tsx          (NEW)
│   ├── CyberButton.tsx        (NEW)
│   ├── CyberSurface.tsx       (NEW)
│   ├── GameCard.tsx           (NEW)
│   └── ToolPartView.tsx       (NEW — extracted from chat.tsx)
├── hooks/
│   ├── usePolling.ts          (NEW)
│   └── useGameUrl.ts          (NEW — extracted from chat.tsx)
├── lib/
│   └── api.ts                 (NEW)
├── server/
│   ├── auth.ts                (NEW — extracted from server.ts)
│   ├── agent.ts               (NEW — extracted from server.ts)
│   ├── routes.ts              (NEW — extracted from server.ts)
│   └── utils.ts               (NEW)
├── routes/
│   ├── _authed/
│   │   ├── chat.tsx           (MODIFIED — slimmed down)
│   │   └── gallery.tsx        (MODIFIED — slimmed down)
│   ├── __root.tsx             (MODIFIED — use shared types)
│   ├── _authed.tsx            (UNCHANGED)
│   ├── dashboard.tsx          (MODIFIED — slimmed down)
│   └── index.tsx              (MODIFIED — use CyberButton/CyberSurface)
├── types.ts                   (NEW)
├── client.tsx                 (UNCHANGED)
├── server.ts                  (MODIFIED — slim re-export entrypoint)
├── routeTree.gen.ts           (AUTO-GENERATED — do not touch)
└── styles.css                 (MODIFIED — add @theme block)
```

---

## Step 1: Create `src/types.ts` — Shared Type Definitions

**Why**: `Game` is defined independently in `dashboard.tsx:6-11`, `gallery.tsx:10-20`, and `server.ts:24-34` (as `_Game`, unused). `Stats` is defined in `dashboard.tsx:18-23`. `User` is defined in `server.ts:12-17` and inline in `__root.tsx:6`. This causes drift and confusion.

**Create** `src/types.ts` with these exact types:

```typescript
// The full Game row from D1 (matches schema.sql)
export interface Game {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  code: string;
  version: number;
  vote_count: number;
  created_at: string;
  updated_at: string;
}

// Game as returned by /api/gallery (joined with users, includes vote status)
export interface GalleryGame {
  id: string;
  title: string;
  description: string;
  vote_count: number;
  version: number;
  created_at: string;
  updated_at: string;
  creator_name: string;
  has_voted: boolean;
}

// Subset used by the dashboard leaderboard
export interface LeaderboardGame {
  id: string;
  title: string;
  vote_count: number;
  creator_name: string;
}

export interface GalleryData {
  games: GalleryGame[];
  total: number;
  page: number;
}

export interface DashboardData {
  games: LeaderboardGame[];
  total: number;
}

export interface Stats {
  total_games: number;
  total_users: number;
  total_votes: number;
  recent_games: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

// Public user info (no created_at — used in router context and API responses)
export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface AgentState {
  userId?: string;
  currentGameId?: string;
}
```

**No files need updating yet** — downstream changes happen in later steps.

---

## Step 2: Create `src/server/utils.ts` — Response Helpers

**Why**: The pattern `new Response(JSON.stringify({...}), { status: N, headers: { "Content-Type": "application/json" } })` appears 12+ times in `server.ts`. Every route handler also duplicates method-check guards.

**Create** `src/server/utils.ts`:

```typescript
/**
 * Return a JSON Response with proper Content-Type header.
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

/**
 * Return a JSON error response: { error: string }.
 */
export function errorResponse(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

/**
 * Returns a 405 Response if request.method doesn't match, otherwise null.
 * Usage: const err = assertMethod(request, "POST"); if (err) return err;
 */
export function assertMethod(
  request: Request,
  method: string
): Response | null {
  if (request.method !== method) {
    return new Response("Method not allowed", { status: 405 });
  }
  return null;
}
```

---

## Step 3: Create `src/server/auth.ts` — Auth Helpers

**Why**: Auth logic (`server.ts` lines 40–101) is self-contained. It uses only Web Crypto APIs, the `Env` global, and no imports from route handlers or the agent.

**Create** `src/server/auth.ts` by extracting the following from `server.ts`:

- `encoder` constant (line 40)
- `importKey()` function (lines 42–50) — keep private, do not export
- `signSession()` function (lines 52–61) — export
- `verifySession()` function (lines 63–85) — export
- `getSessionUser()` function (lines 87–101) — export

Import `User` from `../types`.

```typescript
import type { User } from "../types";

const encoder = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(
  userId: string,
  secret: string
): Promise<string> {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(userId)
  );
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${userId}.${sigBase64}`;
}

export async function verifySession(
  cookie: string,
  secret: string
): Promise<string | null> {
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;
  const [userId, signature] = parts;
  const key = await importKey(secret);
  try {
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(userId)
    );
    return valid ? userId : null;
  } catch {
    return null;
  }
}

export async function getSessionUser(
  request: Request,
  env: Env
): Promise<User | null> {
  const cookie = request.headers.get("Cookie")?.match(/session=([^;]+)/)?.[1];
  if (!cookie) return null;
  const userId = await verifySession(cookie, env.SESSION_SECRET);
  if (!userId) return null;
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<User>();
  return user;
}
```

---

## Step 4: Create `src/server/agent.ts` — ChatAgent Durable Object

**Why**: The `ChatAgent` class (`server.ts` lines 107–244) is a large, self-contained unit. It has no dependency on auth helpers or route handlers.

**Create** `src/server/agent.ts` by extracting `ChatAgent` from `server.ts` lines 107–244 exactly as-is, with these adjustments:

- Import `AgentState` from `../types` instead of defining it locally.
- Keep all other imports (`createWorkersAI`, `AIChatAgent`, `streamText`, `tool`, `convertToModelMessages`, `stepCountIs`, `z`, `nanoid`) at the top.

```typescript
import { createWorkersAI } from "workers-ai-provider";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { streamText, tool, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AgentState } from "../types";

export class ChatAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;
  private agentState: AgentState = {};
  // ... rest of class, copied verbatim from server.ts:107-244 ...
}
```

**Critical**: `ChatAgent` must ultimately be re-exported from `src/server.ts` because:

- `wrangler.jsonc` line 4 sets `"main": "src/server.ts"`
- `env.d.ts` line 13 references `import("./src/server").ChatAgent`
- `chat.tsx` line 22 imports `type { ChatAgent } from "../../server"`

---

## Step 5: Create `src/server/routes.ts` — Route Handlers

**Why**: The 6 route handler functions (`server.ts` lines 250–570) are the bulk of the file. Each is an independent async function with no cross-dependencies.

**Create** `src/server/routes.ts` by extracting these functions from `server.ts`:

- `handleLogin` (lines 250–318)
- `handleMe` (lines 320–341)
- `handleGallery` (lines 343–418)
- `handleVote` (lines 420–494)
- `handleStats` (lines 496–528)
- `handleApp` (lines 530–570)

**Imports**:

```typescript
import type { User } from "../types";
import { signSession, getSessionUser } from "./auth";
import { jsonResponse, errorResponse, assertMethod } from "./utils";
import { nanoid } from "nanoid";
```

**Refactoring within each handler**: Replace every `new Response(JSON.stringify({...}), { status, headers })` instance with `jsonResponse()` or `errorResponse()`. Replace method guards with `assertMethod()`.

Example transformation — before (server.ts lines 266–269):

```typescript
return new Response(JSON.stringify({ error: "Name is required" }), {
  status: 400,
  headers: { "Content-Type": "application/json" }
});
```

After:

```typescript
return errorResponse("Name is required", 400);
```

For `handleLogin`'s success response, which needs `Set-Cookie`, use `jsonResponse` with `extraHeaders`:

```typescript
return jsonResponse({ id: user.id, name: user.name, email: user.email }, 200, {
  "Set-Cookie": `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
});
```

For `handleMe` method guard (line 321):

```typescript
const err = assertMethod(request, "GET");
if (err) return err;
```

Export all 6 handler functions.

---

## Step 6: Slim Down `src/server.ts` — Entrypoint Only

**Why**: After extracting auth, agent, routes, and utils, `server.ts` becomes a thin re-export hub that satisfies all wrangler and TypeScript constraints.

**Replace the entire contents of `src/server.ts`** with:

```typescript
import { routeAgentRequest } from "agents";
import {
  handleLogin,
  handleMe,
  handleGallery,
  handleVote,
  handleStats,
  handleApp
} from "./server/routes";

// Re-export ChatAgent so wrangler and chat.tsx can import it from this file.
export { ChatAgent } from "./server/agent";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Agent WebSocket routes (must come first)
    if (path.startsWith("/agents/")) {
      const agentResponse = await routeAgentRequest(request, env);
      if (agentResponse) return agentResponse;
    }

    // API routes
    if (path === "/api/login") return handleLogin(request, env);
    if (path === "/api/me") return handleMe(request, env);
    if (path === "/api/gallery") return handleGallery(request, env);
    if (path === "/api/stats") return handleStats(request, env);
    if (path.startsWith("/api/vote/")) return handleVote(request, env);

    // Dynamic Worker app serving
    if (path.startsWith("/app/")) return handleApp(request, env);

    // 404 fallback (assets Worker handles everything else)
    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
```

**Delete from `server.ts`**: Everything except the router switch above. All type definitions (lines 8–34), auth helpers (lines 36–101), `ChatAgent` class (lines 103–244), and handler functions (lines 246–570) are now in their respective modules.

**After this step**: Run `npx wrangler dev` to verify the ChatAgent re-export resolves correctly. If wrangler cannot resolve the re-exported DO class, move the `ChatAgent` class body back into `server.ts` (Durable Object classes sometimes need to be in the entry module for wrangler's static analysis). In that case, keep `agent.ts` but import and re-export from server.ts more explicitly.

---

## Step 7: Add Tailwind Theme Colors to `src/styles.css`

**Why**: CSS variables are already defined at `styles.css:7-26` (`--cf-orange`, `--cf-mid-gray`, etc.) but not registered with Tailwind. Every component uses hardcoded hex values like `text-[#f48120]` and `border-[#3c3e40]`. Tailwind v4 uses `@theme` to register custom design tokens as utility classes.

**Modify `src/styles.css`**: Insert the `@theme` block immediately after the existing `@source` lines (after line 5), before the `:root` block:

```css
@theme {
  --color-cf-orange: #f48120;
  --color-cf-orange-light: #ffb020;
  --color-cf-orange-dark: #d9650d;
  --color-cf-blue: #0055ff;
  --color-cf-dark-gray: #1d1f20;
  --color-cf-mid-gray: #3c3e40;
  --color-cf-light-gray: #8e8e8e;
  --color-bg-deep: #050505;
  --color-bg-charcoal: #111111;
}
```

This enables Tailwind utility classes:

- `text-cf-orange` instead of `text-[#f48120]`
- `border-cf-mid-gray` instead of `border-[#3c3e40]`
- `bg-bg-charcoal` instead of `bg-[#111]`
- `text-cf-light-gray` instead of `text-[#8e8e8e]`
- `text-cf-orange-dark` instead of `text-[#d9650d]`
- `text-cf-orange-light` instead of `text-[#ffb020]`
- `bg-bg-deep` instead of `bg-[#050505]`
- `bg-cf-dark-gray` instead of `bg-[#1d1f20]`

**Do not** replace hex values in route files yet — that happens in Step 16.

---

## Step 8: Create `src/components/CyberButton.tsx`

**Why**: The Tailwind class string:

```
"rounded-none border-2 border-[#3c3e40] bg-black text-[#f48120] hover:bg-[#f48120] hover:text-black hover:border-[#f48120] font-mono uppercase text-xs"
```

appears 16+ times across `chat.tsx`, `gallery.tsx`, and `index.tsx`. There are also secondary and danger variants.

**Create** `src/components/CyberButton.tsx`:

```typescript
import { Button } from "@cloudflare/kumo";
import type { ComponentProps } from "react";

export type CyberVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = ComponentProps<typeof Button>;

interface CyberButtonProps extends Omit<ButtonProps, "variant"> {
  cyber?: CyberVariant;
  variant?: ButtonProps["variant"];
}

const cyberClasses: Record<CyberVariant, string> = {
  // Orange accent — default interactive button
  primary:
    "rounded-none border-2 border-cf-mid-gray bg-black text-cf-orange hover:bg-cf-orange hover:text-black hover:border-cf-orange font-mono uppercase text-xs",
  // Gray accent — secondary/muted button
  secondary:
    "rounded-none border-2 border-cf-mid-gray bg-black text-cf-light-gray hover:text-cf-orange hover:border-cf-orange font-mono uppercase text-xs",
  // Red/dark-orange — destructive action (CLEAR, STOP)
  danger:
    "rounded-none border-2 border-cf-orange-dark bg-black text-cf-orange-dark hover:bg-cf-orange-dark hover:text-black font-mono uppercase text-xs",
  // Like secondary but danger colors on hover
  ghost:
    "rounded-none border-2 border-cf-mid-gray bg-black text-cf-light-gray hover:text-cf-orange-dark hover:border-cf-orange-dark font-mono uppercase text-xs",
};

export function CyberButton({
  cyber = "primary",
  className = "",
  variant = "secondary",
  ...props
}: CyberButtonProps) {
  return (
    <Button
      variant={variant}
      className={`${cyberClasses[cyber]} ${className}`}
      {...props}
    />
  );
}
```

The `className` prop allows per-instance additions (e.g., `tracking-wide`, `w-full`, `shadow-brutalist-cyan`).

---

## Step 9: Create `src/components/CyberSurface.tsx`

**Why**: `<Surface>` from Kumo is always overridden with `rounded-none border-2 border-[#3c3e40] bg-[#111]`. This pattern appears in:

- `chat.tsx` lines 47, 62, 86, 347
- `gallery.tsx` line 109
- `index.tsx` line 67

**Create** `src/components/CyberSurface.tsx`:

```typescript
import { Surface } from "@cloudflare/kumo";
import type { ComponentProps } from "react";

interface CyberSurfaceProps extends ComponentProps<typeof Surface> {
  glow?: boolean;
}

export function CyberSurface({ className = "", glow = false, ...props }: CyberSurfaceProps) {
  return (
    <Surface
      className={`rounded-none border border-cf-mid-gray bg-bg-charcoal font-mono${glow ? " border-cf-orange shadow-brutalist-cyan" : ""} ${className}`}
      {...props}
    />
  );
}
```

Usage:

- Default: `<CyberSurface>` — dark bg, gray border
- With glow: `<CyberSurface glow>` — orange border + brutalist shadow (used on login page)
- With extras: `<CyberSurface className="chamfer-br shadow-brutalist-magenta flex flex-col">` — passthrough

---

## Step 10: Create `src/components/AppHeader.tsx`

**Why**: The header bar structure is duplicated between `chat.tsx` (lines 202–248) and `gallery.tsx` (lines 84–101). Both share the same outer HTML:

```html
<header className="px-5 py-3 bg-[#111] border-b-2 border-[#f48120]">
  <div className="max-w-6xl mx-auto flex items-center justify-between">
    <div className="flex items-center gap-3">
      <h1 ...>{title}</h1>
      {badge}
    </div>
    {actions}
  </div>
</header>
```

**Create** `src/components/AppHeader.tsx`:

```typescript
import type { ReactNode } from "react";

interface AppHeaderProps {
  title: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({ title, badge, actions }: AppHeaderProps) {
  return (
    <header className="px-5 py-3 bg-bg-charcoal border-b-2 border-cf-orange">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white font-display text-glow-cyan tracking-widest uppercase">
            {title}
          </h1>
          {badge}
        </div>
        {actions && (
          <div className="flex items-center gap-3">{actions}</div>
        )}
      </div>
    </header>
  );
}
```

---

## Step 11: Create `src/components/ToolPartView.tsx`

**Why**: `ToolPartView` and its helper `formatToolName` (`chat.tsx` lines 30–109) are a self-contained component. Moving them out reduces `chat.tsx` size and makes the component independently importable.

**Create** `src/components/ToolPartView.tsx` by extracting lines 30–109 from `chat.tsx`, updating to use `CyberSurface` and theme color classes:

```typescript
import { Badge } from "@cloudflare/kumo";
import { RocketLaunchIcon, CheckCircleIcon, GearIcon } from "@phosphor-icons/react";
import { isToolUIPart, getToolName, type UIMessage } from "ai";
import { CyberSurface } from "./CyberSurface";

function formatToolName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function ToolPartView({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);
  const isGame = toolName === "generateGame";
  const displayName = isGame
    ? "GENERATE_GAME"
    : formatToolName(toolName).toUpperCase().replace(/ /g, "_");

  if (part.state === "input-streaming") {
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <GearIcon size={14} className="text-cf-orange animate-spin" />
            <span className="text-xs text-cf-orange font-mono uppercase">
              {">"} BUILDING {displayName}...
            </span>
          </div>
        </CyberSurface>
      </div>
    );
  }

  if (part.state === "input-available") {
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isGame ? (
              <RocketLaunchIcon size={14} className="text-cf-orange-dark animate-pulse" />
            ) : (
              <GearIcon size={14} className="text-cf-orange animate-spin" />
            )}
            <span className="text-xs text-cf-orange font-mono uppercase">
              {isGame ? "{'>'} DEPLOYING ARCHIVE..." : `{'>'} EXECUTING ${displayName}...`}
            </span>
          </div>
        </CyberSurface>
      </div>
    );
  }

  if (part.state === "output-available") {
    return (
      <div className="flex justify-start">
        <CyberSurface className="max-w-[80%] px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isGame ? (
              <CheckCircleIcon size={14} className="text-cf-orange-light" />
            ) : (
              <GearIcon size={14} className="text-cf-orange" />
            )}
            <span className="text-xs font-bold text-cf-orange-light font-mono uppercase">
              {isGame ? "[ARCHIVE DEPLOYED]" : `[${displayName}]`}
            </span>
            <Badge
              variant="secondary"
              className="rounded-none border border-cf-orange-light text-cf-orange-light bg-black font-mono text-[10px]"
            >
              OK
            </Badge>
          </div>
        </CyberSurface>
      </div>
    );
  }

  return null;
}
```

---

## Step 12: Create `src/components/GameCard.tsx`

**Why**: The game card rendering (`gallery.tsx` lines 106–163) is a substantial, self-contained unit. Extracting it makes the gallery file significantly shorter and the card independently reusable.

**Create** `src/components/GameCard.tsx`:

```typescript
import { TriangleIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";
import type { GalleryGame } from "../types";
import { CyberButton } from "./CyberButton";
import { CyberSurface } from "./CyberSurface";

interface GameCardProps {
  game: GalleryGame;
  onVote: (gameId: string) => void;
  voteDisabled?: boolean;
}

export function GameCard({ game, onVote, voteDisabled = false }: GameCardProps) {
  return (
    <CyberSurface className="chamfer-br shadow-brutalist-magenta flex flex-col hover:border-cf-orange transition-colors border-2">
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-white text-lg font-display tracking-wide">
            {game.title.toUpperCase()}
          </h3>
          <span className="text-[10px] text-cf-light-gray font-mono border border-cf-mid-gray px-1">
            V{game.version}
          </span>
        </div>
        <p className="text-cf-orange text-xs mb-3 font-mono uppercase tracking-wider">
          {">"} {game.creator_name}
        </p>
        <p className="text-cf-light-gray text-sm line-clamp-2 font-mono">
          {game.description || "[NO DESCRIPTION AVAILABLE]"}
        </p>
      </div>

      <div className="px-4 pb-4 flex items-center justify-between border-t border-cf-mid-gray pt-3 mt-2">
        <CyberButton
          cyber={game.has_voted ? "primary" : "secondary"}
          variant={game.has_voted ? "primary" : "secondary"}
          size="sm"
          icon={<TriangleIcon size={14} weight="fill" />}
          onClick={() => onVote(game.id)}
          disabled={game.has_voted || voteDisabled}
          aria-label={game.has_voted ? "Already voted" : "Upvote"}
          className={
            game.has_voted
              ? "border-cf-orange-light bg-cf-orange-light text-black box-glow-green"
              : "text-cf-light-gray hover:text-cf-orange-light hover:border-cf-orange-light"
          }
        >
          {game.vote_count}
        </CyberButton>

        <a href={`/app/${game.id}`} target="_blank" rel="noopener noreferrer">
          <CyberButton
            size="sm"
            icon={<ArrowSquareOutIcon size={14} />}
            className="tracking-wide"
          >
            LAUNCH
          </CyberButton>
        </a>
      </div>
    </CyberSurface>
  );
}
```

---

## Step 13: Create `src/lib/api.ts` — Typed API Client

**Why**: API fetch calls are scattered and duplicated across 4 files:

- `gallery.tsx` line 31: `fetch("/api/gallery?limit=20")`
- `gallery.tsx` line 46: `fetch("/api/gallery?limit=20")` (again in polling)
- `gallery.tsx` line 61: `fetch("/api/vote/${gameId}", { method: "POST" })`
- `dashboard.tsx` line 28: `fetch("/api/gallery?limit=10")`
- `dashboard.tsx` line 49: `fetch("/api/gallery?limit=10")` (again in polling)
- `dashboard.tsx` line 50: `fetch("/api/stats")`
- `index.tsx` lines 44–47: `fetch("/api/login", { method: "POST", ... })`
- `__root.tsx` lines 10–16: `fetch("/api/me")`

**Create** `src/lib/api.ts`:

```typescript
import type { GalleryData, DashboardData, Stats, PublicUser } from "../types";

export async function fetchGallery(limit = 20): Promise<GalleryData> {
  const res = await fetch(`/api/gallery?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load gallery");
  return res.json();
}

export async function fetchDashboard(limit = 10): Promise<DashboardData> {
  const res = await fetch(`/api/gallery?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function fetchMe(): Promise<PublicUser | undefined> {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export async function login(name: string, email: string): Promise<PublicUser> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email })
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error || "Login failed");
  }
  return res.json();
}

export async function vote(
  gameId: string
): Promise<{ vote_count: number; voted: boolean }> {
  const res = await fetch(`/api/vote/${gameId}`, { method: "POST" });
  if (!res.ok) throw new Error("Vote failed");
  return res.json();
}
```

---

## Step 14: Create `src/hooks/usePolling.ts`

**Why**: Both `dashboard.tsx` (lines 45–70) and `gallery.tsx` (lines 43–57) implement the same `useEffect + setInterval` polling pattern.

**Create** `src/hooks/usePolling.ts`:

```typescript
import { useEffect } from "react";

/**
 * Calls `fetcher` immediately on mount and then every `intervalMs` milliseconds.
 * Silently ignores errors. Cleans up the interval on unmount.
 *
 * IMPORTANT: Wrap `fetcher` in `useCallback` to avoid re-registering the interval
 * on every render.
 */
export function usePolling(
  fetcher: () => Promise<void>,
  intervalMs: number
): void {
  useEffect(() => {
    fetcher().catch(() => {});
    const id = setInterval(() => {
      fetcher().catch(() => {});
    }, intervalMs);
    return () => clearInterval(id);
    // fetcher intentionally excluded — wrap in useCallback at call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
```

---

## Step 15: Create `src/hooks/useGameUrl.ts`

**Why**: `chat.tsx` lines 146–159 scan chat messages to extract the latest game URL from tool outputs. This is a discrete side-effect with its own state.

**Create** `src/hooks/useGameUrl.ts`:

```typescript
import { useState, useEffect } from "react";
import { isToolUIPart, type UIMessage } from "ai";

/**
 * Scans `messages` and returns the URL of the most recently deployed game,
 * or null if no game has been deployed yet.
 */
export function useGameUrl(messages: UIMessage[]): string | null {
  const [gameUrl, setGameUrl] = useState<string | null>(null);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === "assistant") {
        for (const part of msg.parts) {
          if (isToolUIPart(part) && part.state === "output-available") {
            const output = part.output as { url?: string } | undefined;
            if (output?.url) {
              setGameUrl(output.url);
            }
          }
        }
      }
    }
  }, [messages]);

  return gameUrl;
}
```

---

## Step 16: Update All Route Files

Apply all extracted modules to the existing route files. These files should be fully rewritten, not patched.

### 16a: Update `src/routes/__root.tsx`

Replace inline `fetchUser` function and `RouterContext` user type:

- Remove `async function fetchUser()` (lines 9–17)
- Import `fetchMe` from `../lib/api`
- Import `PublicUser` from `../types`
- Change `RouterContext.user` type from `{ id: string; name: string; email: string } | undefined` to `PublicUser | undefined`
- In `beforeLoad` (line 22), replace `fetchUser()` call with `fetchMe()`

Final file:

```typescript
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toasty } from "@cloudflare/kumo/components/toast";
import { useEffect, useState } from "react";
import { fetchMe } from "../lib/api";
import type { PublicUser } from "../types";

export interface RouterContext {
  user: PublicUser | undefined;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  beforeLoad: async () => {
    const user = await fetchMe();
    return { user };
  },
});

function RootLayout() {
  const [isDark] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", isDark ? "dark" : "light");
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  return (
    <Toasty>
      <div className={`${isDark ? "dark" : ""} crt-overlay`}>
        <Outlet />
      </div>
    </Toasty>
  );
}
```

### 16b: Update `src/routes/index.tsx`

- Remove inline `fetch("/api/login", ...)` block — use `login()` from `../../lib/api`
- Replace `<Surface>` with `<CyberSurface glow>` (the login box has an orange glowing border)
- Replace the submit `<Button>` with `<CyberButton>`
- Keep `<Input>` from Kumo (no CyberInput component was created)
- Use theme color classes for hardcoded hex values

```typescript
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@cloudflare/kumo";
import { login } from "../lib/api";
import { CyberSurface } from "../components/CyberSurface";
import { CyberButton } from "../components/CyberButton";

export const Route = createFileRoute("/")({
  component: LoginPage,
  beforeLoad: async ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/chat" });
    }
  },
});

function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email"); return; }

    setLoading(true);
    try {
      await login(name.trim(), email.trim());
      await router.invalidate();
      await navigate({ to: "/chat" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep bg-grid flex items-center justify-center p-4">
      <CyberSurface glow className="w-full max-w-md p-8 border-2">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 font-display text-glow-cyan tracking-wider">
            AI GAME JAM
          </h1>
          <p className="text-cf-light-gray font-mono text-sm uppercase tracking-widest">
            AI Engineer Europe 2026
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-cf-orange mb-1 font-mono uppercase tracking-wider">
              [NAME]
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="> ENTER_IDENTITY"
              disabled={loading}
              className="w-full rounded-none border-2 border-cf-mid-gray focus:border-cf-orange bg-black text-white font-mono placeholder:text-cf-mid-gray"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-bold text-cf-orange mb-1 font-mono uppercase tracking-wider">
              [EMAIL]
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="> ENTER_COMMS_ADDRESS"
              disabled={loading}
              className="w-full rounded-none border-2 border-cf-mid-gray focus:border-cf-orange bg-black text-white font-mono placeholder:text-cf-mid-gray"
            />
          </div>

          {error && (
            <p className="text-cf-orange-dark text-sm font-mono">[!] {error}</p>
          )}

          <CyberButton
            type="submit"
            variant="primary"
            className="w-full tracking-wider font-display font-bold transition-all"
            disabled={loading}
          >
            {loading ? "> INITIALIZING..." : "> START_BUILDING"}
          </CyberButton>
        </form>

        <p className="text-center text-xs text-cf-light-gray mt-6 font-mono uppercase">
          Your game will be live in seconds.
        </p>
      </CyberSurface>
    </div>
  );
}
```

### 16c: Update `src/routes/_authed/gallery.tsx`

- Remove `Game` and `GalleryData` interfaces — import from `../../types`
- Replace inline fetch calls with `fetchGallery()` and `vote()` from `../../lib/api`
- Replace polling `useEffect` with `usePolling()` — wrap the fetch callback in `useCallback`
- Replace header with `<AppHeader>`
- Replace game cards with `<GameCard>`
- Use theme color classes

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import type { GalleryGame, GalleryData } from "../../types";
import { fetchGallery, vote } from "../../lib/api";
import { usePolling } from "../../hooks/usePolling";
import { AppHeader } from "../../components/AppHeader";
import { GameCard } from "../../components/GameCard";
import { CyberButton } from "../../components/CyberButton";

export const Route = createFileRoute("/_authed/gallery")({
  component: GalleryPage,
  loader: async (): Promise<GalleryData> => fetchGallery(20),
});

function GalleryPage() {
  const initialData = Route.useLoaderData();
  const [games, setGames] = useState<GalleryGame[]>(initialData.games);

  const refresh = useCallback(async () => {
    const data = await fetchGallery(20);
    setGames(data.games);
  }, []);

  usePolling(refresh, 10000);

  const handleVote = async (gameId: string) => {
    try {
      const result = await vote(gameId);
      setGames((prev) =>
        prev.map((g) =>
          g.id === gameId
            ? { ...g, vote_count: result.vote_count, has_voted: result.voted }
            : g
        )
      );
    } catch {
      // Ignore errors
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep">
      <AppHeader
        title="ARCHIVE_DATABASE"
        actions={
          <Link to="/chat">
            <CyberButton icon={<ChatCircleDotsIcon size={14} />}>
              BUILDER
            </CyberButton>
          </Link>
        }
      />

      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onVote={handleVote} />
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-block border-2 border-cf-mid-gray p-8 mb-6">
              <p className="text-cf-light-gray text-lg font-mono uppercase">[ARCHIVE EMPTY]</p>
              <p className="text-cf-mid-gray text-sm font-mono mt-2">No data entries found in database</p>
            </div>
            <Link to="/chat" className="mt-4 inline-block">
              <CyberButton className="shadow-brutalist-cyan tracking-wider">
                INITIALIZE_CREATION
              </CyberButton>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
```

### 16d: Update `src/routes/_authed/chat.tsx`

This is the most involved update. Key changes:

- Remove `formatToolName` and `ToolPartView` (lines 30–109) — import `ToolPartView` from `../../components/ToolPartView`
- Remove game URL extraction `useEffect` (lines 146–159) and `gameUrl` state — replace with `const gameUrl = useGameUrl(messages)`
- Replace header (lines 202–248) with `<AppHeader>` + badge + actions
- Replace thinking indicator `<Surface>` (line 347) with `<CyberSurface>`
- Replace all `<Button>` instances with `<CyberButton>`
- Use theme color classes

**Imports diff**:

Remove:

- `Surface` from `@cloudflare/kumo`
- `GearIcon`, `CheckCircleIcon`, `RocketLaunchIcon` (now in ToolPartView)
- `getToolName` from `ai` (now in ToolPartView)

Add:

- `import { ToolPartView } from "../../components/ToolPartView"`
- `import { AppHeader } from "../../components/AppHeader"`
- `import { CyberButton } from "../../components/CyberButton"`
- `import { CyberSurface } from "../../components/CyberSurface"`
- `import { useGameUrl } from "../../hooks/useGameUrl"`

**Header replacement** — replace lines 202–248 with:

```tsx
<AppHeader
  title="AI GAME JAM"
  badge={
    <Badge
      variant="secondary"
      className="rounded-none border border-cf-light-gray bg-black text-cf-light-gray font-mono text-[10px] uppercase"
    >
      <ChatCircleDotsIcon size={10} weight="bold" className="mr-1" />
      BUILDER_V1.0
    </Badge>
  }
  actions={
    <>
      <div className="flex items-center gap-2 font-mono text-xs uppercase">
        <CircleIcon
          size={8}
          weight="fill"
          className={
            connected ? "text-cf-orange box-glow-green" : "text-cf-orange-dark"
          }
        />
        <span className={connected ? "text-cf-orange" : "text-cf-orange-dark"}>
          {connected ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
      <Link to="/gallery">
        <CyberButton variant="secondary" size="sm">
          ARCHIVE
        </CyberButton>
      </Link>
      <CyberButton
        cyber="ghost"
        variant="secondary"
        size="sm"
        icon={<TrashIcon size={14} />}
        onClick={clearHistory}
      >
        CLEAR
      </CyberButton>
    </>
  }
/>
```

**Suggested prompts buttons** — replace the `<Button>` inside the map (line 272–286) with:

```tsx
<CyberButton
  key={prompt}
  size="sm"
  disabled={isStreaming}
  onClick={() =>
    sendMessage({ role: "user", parts: [{ type: "text", text: prompt }] })
  }
  className="tracking-wide"
>
  {prompt.toUpperCase()}
</CyberButton>
```

**Thinking indicator** — replace lines 346–358 with:

```tsx
<div className="flex justify-start">
  <CyberSurface className="max-w-[80%] px-4 py-2.5">
    <div className="flex items-center gap-2">
      <GearIcon size={14} className="text-cf-orange animate-spin" />
      <span className="text-xs text-cf-orange font-mono uppercase">
        Processing...
      </span>
    </div>
  </CyberSurface>
</div>
```

Note: `GearIcon` must remain imported in `chat.tsx` for the thinking indicator above.

**Preview panel buttons** (lines 424–444) — use `<CyberButton>`:

```tsx
<CyberButton
  cyber="secondary"
  size="sm"
  icon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
  onClick={copyGameUrl}
>
  {copied ? "COPIED" : "COPY"}
</CyberButton>
<a href={gameUrl} target="_blank" rel="noopener noreferrer">
  <CyberButton size="sm" icon={<ArrowSquareOutIcon size={14} />}>OPEN</CyberButton>
</a>
```

**Send / stop buttons** (lines 391–411) — use `<CyberButton>`:

```tsx
{
  isStreaming ? (
    <CyberButton
      cyber="danger"
      type="button"
      variant="secondary"
      shape="square"
      icon={<StopIcon size={18} />}
      onClick={stop}
      aria-label="Stop generation"
    />
  ) : (
    <CyberButton
      type="button"
      variant="primary"
      shape="square"
      disabled={!input.trim() || !connected}
      icon={<PaperPlaneRightIcon size={18} />}
      onClick={send}
      className="border-cf-orange text-cf-orange hover:bg-cf-orange hover:text-black disabled:border-cf-mid-gray disabled:text-cf-mid-gray"
      aria-label="Send message"
    />
  );
}
```

**Mobile LAUNCH button** (lines 477–485):

```tsx
<CyberButton
  variant="primary"
  size="lg"
  icon={<ArrowSquareOutIcon size={20} />}
  className="shadow-brutalist-cyan"
>
  LAUNCH
</CyberButton>
```

### 16e: Update `src/routes/dashboard.tsx`

- Remove `Game`, `DashboardData`, `Stats` interfaces (lines 6–23) — import from `../types`
- Replace inline fetch calls with `fetchDashboard()` and `fetchStats()` from `../lib/api`
- Replace polling `useEffect` (lines 45–70) with `usePolling()` — wrap fetch logic in `useCallback`

Note: The dashboard uses a different visual style (slate/purple/green, rounded, emojis). Do NOT apply `CyberButton`, `CyberSurface`, or `AppHeader` to the dashboard — it is intentionally a different design for the booth ambient display.

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { Surface } from "@cloudflare/kumo";
import { QRCodeSVG } from "qrcode.react";
import type { LeaderboardGame, DashboardData, Stats } from "../types";
import { fetchDashboard, fetchStats } from "../lib/api";
import { usePolling } from "../hooks/usePolling";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  loader: async (): Promise<DashboardData> => fetchDashboard(10)
});

function DashboardPage() {
  const initialData = Route.useLoaderData();
  const [games, setGames] = useState<LeaderboardGame[]>(initialData.games);
  const [stats, setStats] = useState<Stats>({
    total_games: 0,
    total_users: 0,
    total_votes: 0,
    recent_games: 0
  });

  const refresh = useCallback(async () => {
    const [galleryData, statsData] = await Promise.all([
      fetchDashboard(10),
      fetchStats()
    ]);
    setGames(galleryData.games);
    setStats(statsData);
  }, []);

  usePolling(refresh, 5000);

  // ... rest of JSX is unchanged from original dashboard.tsx
}
```

The JSX body (lines 74–179 in the original) is unchanged.

---

## Step 17: Cleanup and Verification

### 17a: Run formatter

```bash
npm run format
```

### 17b: Run full check

```bash
npm run check
```

This runs `oxfmt --check . && oxlint src/ && tsc`. Fix any reported errors.

### 17c: Verify wrangler types are still correct

```bash
npx wrangler types
```

Confirm `env.d.ts` still contains the `ChatAgent` reference to `./src/server`. The file should remain unchanged if the re-export chain is correct.

### 17d: Smoke test

```bash
npx wrangler dev
```

Verify in browser:

1. Login page renders with orange-glow border, login works
2. Chat page connects (ONLINE indicator), can send messages, AI responds
3. Generated game URL appears in preview panel
4. Gallery loads and displays game cards with vote buttons
5. Dashboard loads with leaderboard, stats, and QR code
6. Voting works from gallery (vote count updates immediately)

---

## Dependency Order (Which Steps Must Complete Before Others)

```
Step 1 (types.ts)
  └─► Step 3 (auth.ts)
  └─► Step 4 (agent.ts)
  └─► Step 5 (routes.ts) ──► also needs Steps 2, 3
  └─► Step 13 (api.ts)
  └─► Steps 12, 16 (GameCard, route files)

Step 2 (utils.ts)
  └─► Step 5 (routes.ts)

Steps 3+4+5 all complete
  └─► Step 6 (slim server.ts)

Step 7 (tailwind @theme)
  └─► Steps 8, 9, 10 (CyberButton, CyberSurface, AppHeader)

Steps 8+9 complete
  └─► Step 11 (ToolPartView)
  └─► Step 12 (GameCard)

Steps 1+7+8+9+10+11+12+13+14+15 all complete
  └─► Step 16 (update route files)

Step 16 complete
  └─► Step 17 (cleanup + verify)
```

**Steps that can run in parallel**:

- Steps 1 and 2 (no mutual dependency)
- Steps 3 and 4 (both only need Step 1)
- Steps 7, 13, 14, 15 (all can start as soon as Step 1 is done)
- Steps 8, 9, 10 (all need Step 7, no mutual dependency)
- Steps 11 and 12 (both need Steps 8+9, no mutual dependency)

---

## Line Count Summary

| File                              | Before | After |
| --------------------------------- | ------ | ----- |
| `src/server.ts`                   | 600    | ~25   |
| `src/server/auth.ts`              | —      | ~65   |
| `src/server/agent.ts`             | —      | ~145  |
| `src/server/routes.ts`            | —      | ~280  |
| `src/server/utils.ts`             | —      | ~25   |
| `src/types.ts`                    | —      | ~65   |
| `src/lib/api.ts`                  | —      | ~55   |
| `src/hooks/usePolling.ts`         | —      | ~20   |
| `src/hooks/useGameUrl.ts`         | —      | ~25   |
| `src/components/CyberButton.tsx`  | —      | ~40   |
| `src/components/CyberSurface.tsx` | —      | ~20   |
| `src/components/AppHeader.tsx`    | —      | ~25   |
| `src/components/ToolPartView.tsx` | —      | ~85   |
| `src/components/GameCard.tsx`     | —      | ~55   |
| `src/routes/_authed/chat.tsx`     | 489    | ~300  |
| `src/routes/_authed/gallery.tsx`  | 189    | ~75   |
| `src/routes/dashboard.tsx`        | 181    | ~145  |
| `src/routes/index.tsx`            | 134    | ~100  |
| `src/routes/__root.tsx`           | 45     | ~35   |
| `src/styles.css`                  | 173    | ~185  |

---

## Risk Notes

1. **ChatAgent re-export and wrangler static analysis**: Wrangler performs static analysis on the entry module to locate Durable Object class definitions. A `export { ChatAgent } from "./server/agent"` re-export should work, but if `npx wrangler dev` errors with something like "Could not find ChatAgent class", the fix is to keep the class body in `src/server.ts` and only extract the helpers. In that case, `agent.ts` would contain everything except the class definition itself (or the agent.ts approach is abandoned and only auth/routes are split out).

2. **Tailwind v4 `@theme` syntax**: With `@tailwindcss/vite` v4.2.2, the `@theme` directive uses `--color-{name}` to register color tokens that become available as `text-{name}`, `bg-{name}`, `border-{name}` etc. If a color name collides with a Tailwind built-in (e.g. `--color-black`), it will override it. Use the `cf-` prefix for all custom colors to avoid collisions.

3. **`ComponentProps<typeof Button>` vs `ButtonProps`**: If Kumo exports `ButtonProps` as a named type, prefer it directly. If not, `ComponentProps<typeof Button>` from React is the safe fallback. Check the Kumo package exports before writing `CyberButton.tsx`.

4. **oxlint `react-hooks/exhaustive-deps`**: The `usePolling` hook intentionally omits `fetcher` from the `useEffect` dependency array. The eslint-disable comment is included in the hook implementation. Consumers must wrap their fetcher callbacks in `useCallback` to prevent stale closures.

5. **`DashboardData` type in loader**: The dashboard route loader returns `DashboardData` which uses `LeaderboardGame[]` (a subset of `GalleryGame`). The `/api/gallery` endpoint actually returns full `GalleryGame` objects. The `DashboardData` type is intentionally narrower — TypeScript will accept this because `LeaderboardGame` is a structural subset of the returned data. If TypeScript complains, cast: `fetchDashboard` can return `Promise<DashboardData>` by relying on the fact that the extra fields are simply unused.
