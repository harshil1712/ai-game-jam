# AI Game Jam

A booth demo for AI Engineer Europe showcasing Cloudflare's Dynamic Workers as the primitive for running AI-generated code instantly in secure, isolated sandboxes.

## Concept

Attendees log in with just their name and email, then chat with an AI agent to describe an interactive web app they want to build. The agent generates the code and it's live at a unique URL in milliseconds — no deploy step, no build pipeline. Attendees can iterate on their creation through chat, share the link with others at the conference, and vote for their favorite games on a live gallery leaderboard displayed on the booth screen.

## What it demonstrates

- **Dynamic Workers** — the hero feature: AI-generated code spins up as an isolated Worker instantly via `env.LOADER.get(workerId, code)`. No deploy step. Millisecond startup.
- **Agents SDK** — a persistent chat agent per user that generates code, manages iterations, and tracks the conversation
- **Workers AI + AI Gateway** — model inference for code generation; AI Gateway surfaces live token usage, cost, and request logs on the booth screen
- **D1** — stores user accounts, game metadata, generated code, and vote counts
- **Durable Objects** — backs each user's agent instance with persistent conversation state

## User experience

1. Attendee scans QR code or visits the booth URL on their phone or laptop
2. Enters name and email to log in (no OAuth, instant access)
3. Opens a chat with the AI agent and describes what they want: _"build me a breakout game"_, _"make a quiz about European capitals"_, _"create a drawing app"_
4. The agent generates a self-contained HTML/JS app and it's immediately live at a unique URL: `booth.example.com/app/{workerId}`
5. Attendee plays their creation, then iterates via chat: _"make the ball faster"_, _"add a dark mode"_, _"show a score counter"_
6. Each iteration bumps the worker version; the same URL continues to serve the latest version
7. Attendee can share the link with anyone at the conference
8. A gallery page lists all created apps with upvote buttons
9. The booth screen shows a live leaderboard: top-voted apps, total games created, active sessions

## Architecture

```
Attendee phone/laptop
       │
       ▼
┌───────────────────────────────────────────┐
│  Main Worker (Agents SDK)                 │
│                                           │
│  Routes:                                  │
│  ├── POST /login → session (D1)           │
│  ├── GET/POST /chat → AIChatAgent         │
│  │    ├── AI generates HTML/JS code       │
│  │    ├── Saves code + metadata to D1     │
│  │    └── Returns /app/{workerId} URL     │
│  ├── GET /app/:workerId                   │
│  │    └── LOADER.get(workerId, code)      │
│  │         └── Dynamic Worker serves app  │
│  ├── GET /gallery → top games + votes     │
│  └── POST /vote/:workerId                 │
│                                           │
│  State:                                   │
│  ├── D1: users, games, votes              │
│  └── Durable Object: agent per user       │
└───────────────────────────────────────────┘
                    │
          LOADER.get(workerId, ...)
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

## Key design decisions

**Game format**: The AI generates a single self-contained HTML file with inline CSS and JavaScript — the simplest possible format that needs no bundler and runs directly in the Dynamic Worker's `fetch()` handler. This works well for browser games, quizzes, drawing tools, and other interactive apps.

**Worker ID strategy**: Each game is identified by `{gameId}:{version}` (e.g., `game_abc123:v3`). When the user iterates via chat, the agent increments the version. `LOADER.get()` sees a new ID and loads fresh code; the stable `/app/{gameId}` URL always fetches the latest version from D1 and dispatches accordingly.

**Sandboxing**: All Dynamic Workers run with `globalOutbound: null`. Generated apps are pure client-side experiences served as HTML — they don't need outbound network access. This is also good security hygiene for running untrusted, AI-generated code from conference attendees.

**Voting**: One upvote per user per game, deduped by login email. Vote counts stored in D1. The gallery page and booth dashboard poll every few seconds.

## What the AI agent generates

Simple, self-contained browser apps scoped to what fits in a single HTML file:

- Browser games: Snake, Pong, Breakout, Tetris, Tic-tac-toe, memory match, 2048
- Quizzes and trivia: topic-based question/answer with scoring
- Interactive tools: drawing canvas, color pickers, timers, generators
- Simulations: particle effects, bouncing shapes, Conway's Game of Life

The agent's system prompt constrains output to a single `<!DOCTYPE html>` document with no external dependencies, ensuring it runs reliably as a Dynamic Worker response.

## Booth screen

The booth's ambient display shows:

- **Live leaderboard**: top-voted apps by name and creator, with vote counts
- **Counter**: total games created, total upvotes cast
- **Active sessions**: number of people currently building or playing
- **AI Gateway analytics**: requests/min, tokens used, cost per game
- **QR code**: always visible in the corner, pointing to the login page

## Key talking points for booth staff

- "The code the AI wrote is running right now in a secure sandbox — no deploy, no build, just instant execution."
- "Each person's app is completely isolated from every other. That's capability-based security built into the platform."
- "The generated app has zero network access. We handed it nothing but a blank environment and it can only return an HTTP response."
- "Iterating on the app just bumps a version ID. The same URL always serves the latest version from our cache."
- "Every model call flows through AI Gateway — you can see exactly how many tokens each game cost to generate."

## Open questions

- **Dynamic Workers availability**: Confirm access to the closed beta before committing to this architecture. Workers for Platforms (dispatch namespaces) is a viable fallback with a similar UX but requires a wrangler deploy step per game instead of runtime loading.
- **Game scope**: Scope should be clearly communicated to attendees — "describe a simple browser app" — to set expectations and keep the AI's output within the single-file format.
- **Iteration depth**: Decide whether to support multi-turn iteration (more impressive, more complex agent logic) or a single-shot "describe it and get it" experience (simpler, faster for a busy booth).

## What to build

- [ ] Main Worker with login, routing, gallery, and voting endpoints
- [ ] AIChatAgent subclass with code generation logic and system prompt
- [ ] D1 schema: `users`, `games` (id, creator, code, version, votes), `votes`
- [ ] Dynamic Worker Loader binding and `/app/:workerId` dispatch handler
- [ ] Mobile-friendly chat UI (React + `useAgentChat`)
- [ ] Gallery + leaderboard page
- [ ] Booth dashboard (ambient display with live stats)
- [ ] QR code pointing to the login page
