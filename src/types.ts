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
