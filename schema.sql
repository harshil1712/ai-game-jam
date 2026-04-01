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
