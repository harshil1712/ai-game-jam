import type { User } from "../types";
import { signSession, getSessionUser } from "./auth";
import { jsonResponse, errorResponse, assertMethod } from "./utils";
import { nanoid } from "nanoid";

export async function handleLogin(
  request: Request,
  env: Env
): Promise<Response> {
  const err = assertMethod(request, "POST");
  if (err) return err;

  let body: { name?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, email } = body;

  // Validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return errorResponse("Valid email is required", 400);
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const userId = nanoid(10);

  // Upsert user
  await env.DB.prepare(
    `
    INSERT INTO users (id, name, email) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET name = excluded.name
  `
  )
    .bind(userId, trimmedName, trimmedEmail)
    .run();

  // Get the user (either the new one or the updated existing one)
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(trimmedEmail)
    .first<User>();

  if (!user) {
    return errorResponse("Failed to create user", 500);
  }

  // Sign session
  const sessionToken = await signSession(user.id, env.SESSION_SECRET);

  return jsonResponse(
    { id: user.id, name: user.name, email: user.email },
    200,
    {
      "Set-Cookie": `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
    }
  );
}

export async function handleLogout(
  request: Request,
  _env: Env
): Promise<Response> {
  const err = assertMethod(request, "POST");
  if (err) return err;

  return jsonResponse({ ok: true }, 200, {
    "Set-Cookie":
      "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
  });
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const err = assertMethod(request, "GET");
  if (err) return err;

  const user = await getSessionUser(request, env);

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  return jsonResponse({ id: user.id, name: user.name, email: user.email }, 200);
}

export async function handleGallery(
  request: Request,
  env: Env
): Promise<Response> {
  const err = assertMethod(request, "GET");
  if (err) return err;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "20", 10),
    50
  );
  const offset = (page - 1) * limit;

  const currentUser = await getSessionUser(request, env);

  // Get games with creator info
  const games = await env.DB.prepare(
    `
    SELECT
      g.id, g.title, g.description, g.vote_count, g.version,
      g.created_at, g.updated_at,
      u.name AS creator_name
    FROM games g
    JOIN users u ON u.id = g.creator_id
    ORDER BY g.vote_count DESC, g.created_at DESC
    LIMIT ? OFFSET ?
  `
  )
    .bind(limit, offset)
    .all<{
      id: string;
      title: string;
      description: string;
      vote_count: number;
      version: number;
      created_at: string;
      updated_at: string;
      creator_name: string;
    }>();

  // Get total count
  const countResult = await env.DB.prepare(
    "SELECT COUNT(*) as total FROM games"
  ).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Check which games the current user has voted for
  let userVotes: Set<string> = new Set();
  if (currentUser) {
    const votes = await env.DB.prepare(
      "SELECT game_id FROM votes WHERE user_id = ?"
    )
      .bind(currentUser.id)
      .all<{ game_id: string }>();
    userVotes = new Set(votes.results?.map((v) => v.game_id) || []);
  }

  const gamesWithVotes = (games.results || []).map(
    (game: (typeof games.results)[0]) => ({
      ...game,
      has_voted: userVotes.has(game.id)
    })
  );

  return jsonResponse(
    {
      games: gamesWithVotes,
      total,
      page
    },
    200
  );
}

export async function handleVote(
  request: Request,
  env: Env
): Promise<Response> {
  const err = assertMethod(request, "POST");
  if (err) return err;

  const user = await getSessionUser(request, env);

  if (!user) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const gameId = url.pathname.split("/").pop();

  if (!gameId) {
    return errorResponse("Game ID required", 400);
  }

  // Check game exists
  const game = await env.DB.prepare("SELECT id FROM games WHERE id = ?")
    .bind(gameId)
    .first();
  if (!game) {
    return errorResponse("Game not found", 404);
  }

  // Try to insert vote
  const insertResult = await env.DB.prepare(
    `
    INSERT OR IGNORE INTO votes (user_id, game_id) VALUES (?, ?)
  `
  )
    .bind(user.id, gameId)
    .run();

  const voted = insertResult.meta?.changes > 0;

  // If new vote, increment count
  if (voted) {
    await env.DB.prepare(
      `
      UPDATE games SET vote_count = vote_count + 1 WHERE id = ?
    `
    )
      .bind(gameId)
      .run();
  }

  // Get updated vote count
  const updatedGame = await env.DB.prepare(
    "SELECT vote_count FROM games WHERE id = ?"
  )
    .bind(gameId)
    .first<{ vote_count: number }>();

  return jsonResponse(
    {
      voted,
      vote_count: updatedGame?.vote_count || 0
    },
    200
  );
}

export async function handleStats(
  request: Request,
  env: Env
): Promise<Response> {
  const err = assertMethod(request, "GET");
  if (err) return err;

  const stats = await env.DB.prepare(
    `
    SELECT
      (SELECT COUNT(*) FROM games)  AS total_games,
      (SELECT COUNT(*) FROM users)  AS total_users,
      (SELECT SUM(vote_count) FROM games) AS total_votes,
      (SELECT COUNT(*) FROM games WHERE updated_at > datetime('now', '-5 minutes')) AS recent_games
  `
  ).first<{
    total_games: number;
    total_users: number;
    total_votes: number;
    recent_games: number;
  }>();

  return jsonResponse(
    {
      total_games: stats?.total_games || 0,
      total_users: stats?.total_users || 0,
      total_votes: stats?.total_votes || 0,
      recent_games: stats?.recent_games || 0
    },
    200
  );
}

export async function handleApp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const gameId = url.pathname.split("/app/")[1];

  if (!gameId) {
    return new Response("Game not found", { status: 404 });
  }

  // Fetch latest game code from D1
  const game = await env.DB.prepare(
    "SELECT code, version FROM games WHERE id = ?"
  )
    .bind(gameId)
    .first<{ code: string; version: number }>();

  if (!game) {
    return new Response("Game not found", { status: 404 });
  }

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
