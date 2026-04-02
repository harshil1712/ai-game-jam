# Game Editing Implementation Plan

## Goal

Enable the AI agent to edit existing games by:

1. Making `generateGame` accept an optional `gameId` so the model can explicitly target an existing game for update
2. Adding a `listMyGames` tool so the model can discover games built in previous sessions
3. Adding a `loadGame` tool so the model can fetch the current source code before making edits

## Background / Bug Description

`ChatAgent` is a Cloudflare Durable Object. Its `agentState.currentGameId` is an in-memory instance property that is set when `generateGame` creates a new game. If the DO is evicted and re-instantiated (idle timeout, deployment, etc.), `agentState` resets to `{}` and `currentGameId` is lost.

The persisted message history (up to 100 messages via `maxPersistedMessages`) is already passed to the model as context via `convertToModelMessages(this.messages)`. So the model can see previous `generateGame` tool calls and their results — including the `gameId` — in its context window. The problem is the tool's `execute` function has no way to receive that `gameId` from the model, so it always falls through to the create-new-game branch.

## File to Modify

**`/Users/harshil/projects/ai-game-jam/src/server/agent.ts`** — this is the only file that needs changes.

---

## Change 1: Update the System Prompt

**Location:** End of the `system` string in `streamText` (~line 64, just before the closing backtick)

Append the following text. Do **not** remove or modify any existing prompt text.

```
You have three tools available: generateGame, listMyGames, and loadGame.

When iterating on a game from the current conversation, pass the gameId from the earlier generateGame tool result to generateGame so it updates the existing game instead of creating a new one.

If a user asks to edit, update, or modify a game that is not in the current conversation, call listMyGames first to find it. Then call loadGame with the gameId to retrieve the current source code. Then call generateGame with the gameId to update it. Always base your edits on the actual code returned by loadGame — do not guess what the current code looks like.
```

---

## Change 2: Add Optional `gameId` to `generateGame` Input Schema

**Location:** Inside `generateGame`'s `inputSchema: z.object({})` (~line 70)

Add `gameId` as the **first** field in the z.object:

```ts
gameId: z
  .string()
  .optional()
  .describe("The ID of an existing game to update. Pass this when iterating on a previously generated game."),
```

---

## Change 3: Use `gameId` from Input in `generateGame` Execute

**Location:** `generateGame`'s `execute` callback (~line 81)

**Step A** — Add `gameId` to the destructured parameters:

Before:

```ts
execute: async ({ title, description, code }) => {
```

After:

```ts
execute: async ({ gameId, title, description, code }) => {
```

**Step B** — Use `gameId` from input, falling back to `agentState`:

Before:

```ts
const existingGameId = this.agentState.currentGameId;
```

After:

```ts
const existingGameId = gameId ?? this.agentState.currentGameId;
```

No other changes to the execute function. The create/update branching logic and `this.agentState.currentGameId` assignment remain unchanged.

---

## Change 4: Add `listMyGames` Tool

**Location:** Inside the `tools: {}` object, after the closing `})` of `generateGame`

```ts
listMyGames: tool({
  description:
    "List all games the current user has previously built. Returns metadata only (no source code). Call this when a user wants to see or edit their existing games.",
  inputSchema: z.object({}),
  execute: async () => {
    const userId = this.agentState.userId;
    if (!userId) return { error: "Not authenticated" };

    const games = await this.env.DB.prepare(
      `SELECT id, title, description, version, vote_count, updated_at
       FROM games WHERE creator_id = ?
       ORDER BY updated_at DESC`
    )
      .bind(userId)
      .all<{
        id: string;
        title: string;
        description: string;
        version: number;
        vote_count: number;
        updated_at: string;
      }>();

    return { games: games.results ?? [] };
  },
}),
```

---

## Change 5: Add `loadGame` Tool

**Location:** Inside the `tools: {}` object, after `listMyGames`

```ts
loadGame: tool({
  description:
    "Load the full source code of an existing game by its ID. Call this before editing a game that is not in the current conversation history. This also sets the game as the active game so subsequent generateGame calls update it by default.",
  inputSchema: z.object({
    gameId: z.string().describe("The ID of the game to load"),
  }),
  execute: async ({ gameId }) => {
    const userId = this.agentState.userId;
    if (!userId) return { error: "Not authenticated" };

    const game = await this.env.DB.prepare(
      `SELECT id, title, description, code, version, vote_count, updated_at
       FROM games WHERE id = ? AND creator_id = ?`
    )
      .bind(gameId, userId)
      .first<{
        id: string;
        title: string;
        description: string;
        code: string;
        version: number;
        vote_count: number;
        updated_at: string;
      }>();

    if (!game) return { error: "Game not found" };

    // Set as active game so generateGame updates it by default
    this.agentState.currentGameId = game.id;

    return {
      gameId: game.id,
      title: game.title,
      description: game.description,
      code: game.code,
      version: game.version,
      voteCount: game.vote_count,
      updatedAt: game.updated_at,
    };
  },
}),
```

---

## Summary of All Changes

| #   | What                                                                              | Where                                   |
| --- | --------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Append tool usage instructions to system prompt                                   | End of `system` string (~line 64)       |
| 2   | Add optional `gameId` field to `generateGame` input schema                        | Inside `z.object({})` (~line 70)        |
| 3   | Destructure `gameId` in execute and use `gameId ?? this.agentState.currentGameId` | Execute callback (~lines 81, 86)        |
| 4   | Add `listMyGames` tool                                                            | Inside `tools: {}` after `generateGame` |
| 5   | Add `loadGame` tool                                                               | Inside `tools: {}` after `listMyGames`  |

## What Does NOT Change

- `schema.sql` — existing schema supports all queries (the `idx_games_creator` index already exists)
- `src/types.ts`
- `src/server/routes.ts`
- All frontend files
- `wrangler.jsonc`
- No new dependencies

## How to Verify

Run `npx wrangler dev` and test the following scenarios:

1. **New game creation** — ask the agent to build a game, confirm a new game is created (version 1)
2. **In-session iteration** — ask to modify it in the same chat session, confirm it updates the same game (version 2, same `gameId`)
3. **Cross-session iteration (core bug fix)** — refresh the page (forces DO restart), ask to modify the game again, confirm the model passes the `gameId` from its message history and the game is updated (version 3, same `gameId`) rather than a new game being created
4. **List games** — clear chat history, ask "what games have I built?", confirm `listMyGames` is called and returns the user's games
5. **Cross-session edit** — ask to edit one of the games from `listMyGames`, confirm the model calls `loadGame` with the correct `gameId`, then calls `generateGame` with that `gameId` to update it
